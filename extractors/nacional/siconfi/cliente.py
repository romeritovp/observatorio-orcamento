"""Cliente da API do SICONFI (Tesouro Nacional).

Uso:
    from extractors.nacional.siconfi.cliente import consultar
    itens = consultar("rreo", {"an_exercicio": 2025, "nr_periodo": 6, ...,
                               "id_ente": 33})

O cliente não conhece nenhuma UF: o ente entra pelo parâmetro `id_ente`.

Cache: a resposta é gravada como veio (as páginas da API, sem alteração) em
    data/raw/siconfi/<endpoint>/<cod_ibge>/<ano>_<periodo>_<anexo>[_<demais>].json
Se o arquivo já existe, a API não é chamada. Consulta sem nenhum item não é
gravada (só gera um aviso no log).
"""

import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import yaml

log = logging.getLogger(__name__)

RAIZ = Path(__file__).resolve().parents[3]
CAMINHO_CONFIG = RAIZ / "config" / "siconfi.yaml"
DIR_RAW = RAIZ / "data" / "raw" / "siconfi"

# Parâmetros que formam o início do nome do arquivo, nesta ordem
PARAMS_ANO = ("an_exercicio", "an_referencia")
PARAMS_PERIODO = ("nr_periodo", "me_referencia")
PARAMS_ANEXO = ("no_anexo",)
# Parâmetros controlados pelo próprio cliente (não entram no nome do arquivo)
PARAMS_PAGINACAO = ("offset", "limit")

# Momento (time.monotonic) da última chamada à API, para respeitar a pausa
_ultima_chamada = None


def carregar_config(caminho=CAMINHO_CONFIG):
    with open(caminho, encoding="utf-8") as f:
        return yaml.safe_load(f)


def consultar(endpoint, params=None, *, config=None, dir_raw=DIR_RAW, http=None):
    """Consulta um endpoint do SICONFI e devolve a lista de itens (todas as páginas).

    endpoint: nome do endpoint, com ou sem barra ("rreo" ou "/rreo").
    params: parâmetros da consulta; `id_ente` define a pasta do cache.
    config, dir_raw, http: só para testes (config lida do yaml, pasta de
        brutos e um httpx.Client já configurado).
    """
    endpoint = endpoint.strip("/")
    params = dict(params or {})
    config = config or carregar_config()

    arquivo = caminho_cache(endpoint, params, dir_raw)
    if arquivo.exists():
        with open(arquivo, encoding="utf-8") as f:
            return _itens(json.load(f)["paginas"])

    paginas = _baixar_paginas(endpoint, params, config, http)
    itens = _itens(paginas)
    if not itens:
        # Resposta vazia pode ser entrega ainda não feita pelo ente: não vira cache,
        # para que a próxima consulta tente de novo
        log.warning("SICONFI /%s devolveu zero itens para %s; cache não gravado", endpoint, params)
        return []
    _gravar(arquivo, endpoint, params, paginas)
    return itens


def data_extracao(endpoint, params=None, dir_raw=DIR_RAW):
    """Data da extração (texto ISO, UTC) gravada no cache da consulta, ou None se não houver."""
    arquivo = caminho_cache(endpoint, dict(params or {}), dir_raw)
    if not arquivo.exists():
        return None
    with open(arquivo, encoding="utf-8") as f:
        return json.load(f).get("extraido_em")


def _itens(paginas):
    return [item for pagina in paginas for item in pagina.get("items", [])]


def caminho_cache(endpoint, params, dir_raw=DIR_RAW):
    """Caminho do JSON bruto de uma consulta.

    Pasta: <endpoint>/<cod_ibge> (ou "todos" quando a consulta não tem id_ente).
    Nome: ano, período e anexo, seguidos dos demais parâmetros em ordem
    alfabética do nome do parâmetro. Assim, consultas diferentes nunca
    caem no mesmo arquivo.
    """
    endpoint = endpoint.strip("/")
    cod_ibge = str(params["id_ente"]) if "id_ente" in params else "todos"

    usados = {"id_ente", *PARAMS_PAGINACAO}
    partes = []
    for grupo in (PARAMS_ANO, PARAMS_PERIODO, PARAMS_ANEXO):
        for chave in grupo:
            if chave in params:
                partes.append(params[chave])
                usados.add(chave)
    for chave in sorted(params):
        if chave not in usados:
            partes.append(params[chave])

    nome = "_".join(limpar_nome(p) for p in partes) or "completo"
    return Path(dir_raw) / endpoint / cod_ibge / f"{nome}.json"


def limpar_nome(valor):
    """Troca por '-' tudo o que não é letra, número ou hífen ('RREO-Anexo 02' -> 'RREO-Anexo-02')."""
    return re.sub(r"[^0-9A-Za-z-]+", "-", str(valor)).strip("-")


def _baixar_paginas(endpoint, params, config, http):
    """Chama a API página a página enquanto `hasMore` for verdadeiro."""
    fechar = http is None
    if http is None:
        http = httpx.Client(base_url=config["url_base"], timeout=config["timeout_segundos"])

    paginas = []
    offset = 0
    try:
        while True:
            pagina = _chamar(http, endpoint, {**params, "offset": offset}, config)
            paginas.append(pagina)
            itens = pagina.get("items", [])
            if not pagina.get("hasMore") or not itens:
                break
            offset += len(itens)
    finally:
        if fechar:
            http.close()
    return paginas


def _chamar(http, endpoint, params, config):
    """Uma chamada HTTP, com pausa mínima e até `tentativas` em erro de rede ou 429."""
    tentativas = config["tentativas"]
    for tentativa in range(1, tentativas + 1):
        _pausar(config["pausa_segundos"])
        try:
            resposta = http.get(f"/{endpoint}", params=params)
        except httpx.TransportError:
            if tentativa == tentativas:
                raise
            continue
        if resposta.status_code == 429 and tentativa < tentativas:
            # Espera extra: o que a API pedir em Retry-After, ou a pausa vezes a tentativa
            time.sleep(_espera_429(resposta, config["pausa_segundos"] * tentativa))
            continue
        resposta.raise_for_status()
        return resposta.json()


def _espera_429(resposta, padrao):
    try:
        return float(resposta.headers["Retry-After"])
    except (KeyError, ValueError):
        return padrao


def _pausar(pausa_segundos):
    """Garante pelo menos `pausa_segundos` entre o início de duas chamadas."""
    global _ultima_chamada
    if _ultima_chamada is not None:
        falta = pausa_segundos - (time.monotonic() - _ultima_chamada)
        if falta > 0:
            time.sleep(falta)
    _ultima_chamada = time.monotonic()


def _gravar(arquivo, endpoint, params, paginas):
    """Grava as páginas como vieram, com a data da extração (dados podem ser retificados)."""
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    conteudo = {
        "extraido_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "endpoint": endpoint,
        "params": params,
        "paginas": paginas,
    }
    temporario = arquivo.with_suffix(".json.tmp")
    with open(temporario, "w", encoding="utf-8") as f:
        json.dump(conteudo, f, ensure_ascii=False)
    # Só vira cache depois de gravado por inteiro
    temporario.replace(arquivo)
