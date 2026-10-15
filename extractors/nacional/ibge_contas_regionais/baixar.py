"""Baixa os arquivos das Contas Regionais do IBGE (PIB por UF) e guarda os brutos como vieram.

Uso:
    uv run python -m extractors.nacional.ibge_contas_regionais.baixar              # baixa o que falta
    uv run python -m extractors.nacional.ibge_contas_regionais.baixar --atualizar  # baixa tudo de novo

A edição (ano final da série) fica em config/ibge_contas_regionais.yaml: a próxima edição só troca o ano.
Brutos: data/raw/ibge/contas-regionais/<edicao>/<arquivo> (zip intacto e índice .txt), com o conteúdo de
cada zip extraído em <edicao>/<nome do zip sem .zip>/. O manifesto (data/raw/ibge/contas-regionais/manifesto.json)
guarda URL, data da extração, tamanho e SHA-256 de cada arquivo baixado.

Ainda sem leitura das planilhas (etapa de inspeção do layout).
"""

import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import httpx
import yaml

from extractors import base

CAMINHO_CONFIG = base.RAIZ / "config" / "ibge_contas_regionais.yaml"
DIR_RAW = base.RAIZ / "data" / "raw" / "ibge" / "contas-regionais"
MANIFESTO = "manifesto.json"


def ler_config(caminho=CAMINHO_CONFIG):
    with open(caminho, encoding="utf-8") as f:
        return yaml.safe_load(f)


def urls(config):
    """{caminho relativo em DIR_RAW: URL} dos arquivos da edição."""
    edicao, inicio = config["edicao"], config["serie_inicio"]
    url_base = config["url_base"].format(edicao=edicao)
    nomes = [n.format(inicio=inicio, edicao=edicao) for n in config["arquivos"]]
    return {f"{edicao}/{nome}": f"{url_base}/{nome}" for nome in nomes}


def extrair_zip(caminho_zip):
    """Extrai o zip numa pasta ao lado, com o mesmo nome sem .zip. Recusa caminhos que saiam da pasta."""
    destino = caminho_zip.with_suffix("")
    with zipfile.ZipFile(caminho_zip) as z:
        for nome in z.namelist():
            alvo = (destino / nome).resolve()
            if not alvo.is_relative_to(destino.resolve()):
                raise base.ErroValidacao(f"{caminho_zip.name}: caminho suspeito no zip ({nome})")
        z.extractall(destino)
    return destino


def baixar(config=None, dir_raw=DIR_RAW, http=None, atualizar=False):
    """Baixa os arquivos que faltam (ou todos, com atualizar), extrai os zips e atualiza o manifesto."""
    config = config or ler_config()
    dir_raw = Path(dir_raw)
    caminho_manifesto = dir_raw / MANIFESTO
    manifesto = json.loads(caminho_manifesto.read_text(encoding="utf-8")) if caminho_manifesto.exists() else {}
    http = http or httpx.Client(timeout=config["timeout_segundos"], follow_redirects=True,
                                headers={"User-Agent": "Mozilla/5.0"})
    for relativo, url in urls(config).items():
        destino = dir_raw / relativo
        if destino.exists() and not atualizar:
            continue
        resposta = http.get(url)
        resposta.raise_for_status()
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(resposta.content)  # como veio
        manifesto[relativo] = {"url": url, "extraido_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                               "bytes": len(resposta.content), "sha256": hashlib.sha256(resposta.content).hexdigest()}
        print(f"baixado {relativo} ({len(resposta.content):,} bytes)")
        if destino.suffix == ".zip":
            extrair_zip(destino)
    caminho_manifesto.parent.mkdir(parents=True, exist_ok=True)
    caminho_manifesto.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return manifesto


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    manifesto = baixar(atualizar="--atualizar" in argv)
    print(f"Brutos em {DIR_RAW.relative_to(base.RAIZ)}/: {len(manifesto)} arquivos no manifesto")


if __name__ == "__main__":
    main()
