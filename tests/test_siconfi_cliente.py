"""Testes do cliente do SICONFI. Nenhum teste chama a API: as respostas vêm de tests/fixtures/."""

import json
from pathlib import Path

import httpx
import pytest

from extractors.nacional.siconfi import cliente

FIXTURES = Path(__file__).parent / "fixtures"
CONFIG = {
    "url_base": "https://api.teste",
    "pausa_segundos": 1.1,
    "tentativas": 3,
    "timeout_segundos": 5,
}


@pytest.fixture
def resposta_rreo():
    with open(FIXTURES / "rreo.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def params_rreo(resposta_rreo):
    # O ente vem da própria fixture, para não fixar código de UF no teste
    primeiro = resposta_rreo["items"][0]
    return {
        "an_exercicio": primeiro["exercicio"],
        "nr_periodo": primeiro["periodo"],
        "co_tipo_demonstrativo": primeiro["demonstrativo"],
        "no_anexo": primeiro["anexo"],
        "co_esfera": primeiro["esfera"],
        "id_ente": primeiro["cod_ibge"],
    }


@pytest.fixture(autouse=True)
def sem_espera(monkeypatch):
    """Registra as pausas em vez de dormir e zera o relógio do cliente."""
    esperas = []
    monkeypatch.setattr(cliente.time, "sleep", esperas.append)
    monkeypatch.setattr(cliente, "_ultima_chamada", None)
    return esperas


def http_falso(responder):
    """httpx.Client cujas respostas vêm de `responder(request)`; guarda as requisições."""
    requisicoes = []

    def tratar(request):
        requisicoes.append(request)
        return responder(request)

    http = httpx.Client(base_url=CONFIG["url_base"], transport=httpx.MockTransport(tratar))
    return http, requisicoes


def test_consulta_devolve_itens_e_grava_cache(tmp_path, resposta_rreo, params_rreo):
    http, requisicoes = http_falso(lambda req: httpx.Response(200, json=resposta_rreo))

    itens = cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)

    assert itens == resposta_rreo["items"]
    assert len(requisicoes) == 1
    assert requisicoes[0].url.path == "/rreo"
    assert requisicoes[0].url.params["id_ente"] == str(params_rreo["id_ente"])

    arquivo = cliente.caminho_cache("rreo", params_rreo, tmp_path)
    assert arquivo.exists()
    gravado = json.loads(arquivo.read_text(encoding="utf-8"))
    assert gravado["paginas"] == [resposta_rreo]  # bruto, como veio
    assert gravado["extraido_em"]


def test_consulta_vazia_nao_grava_cache_e_avisa(tmp_path, params_rreo, caplog):
    vazia = {"items": [], "hasMore": False, "offset": 0, "count": 0}
    http, requisicoes = http_falso(lambda req: httpx.Response(200, json=vazia))

    with caplog.at_level("WARNING", logger=cliente.__name__):
        itens = cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)

    assert itens == []
    assert not cliente.caminho_cache("rreo", params_rreo, tmp_path).exists()
    assert any("zero itens" in r.getMessage() for r in caplog.records)

    # Sem cache, a consulta seguinte chama a API de novo
    cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)
    assert len(requisicoes) == 2


def test_caminho_cache_segue_convencao(tmp_path, params_rreo):
    arquivo = cliente.caminho_cache("/rreo", params_rreo, tmp_path)

    ano, periodo = params_rreo["an_exercicio"], params_rreo["nr_periodo"]
    assert arquivo.parent == tmp_path / "rreo" / str(params_rreo["id_ente"])
    assert arquivo.name.startswith(f"{ano}_{periodo}_RREO-Anexo-02_")
    assert arquivo.suffix == ".json"


def test_caminho_cache_sem_ente_e_sem_params(tmp_path):
    assert cliente.caminho_cache("entes", {}, tmp_path) == tmp_path / "entes" / "todos" / "completo.json"


def test_caminho_cache_distingue_parametros(tmp_path, params_rreo):
    outro = {**params_rreo, "co_tipo_demonstrativo": "RREO Simplificado"}
    assert cliente.caminho_cache("rreo", params_rreo, tmp_path) != cliente.caminho_cache("rreo", outro, tmp_path)


def test_cache_existente_nao_chama_api(tmp_path, resposta_rreo, params_rreo):
    http, requisicoes = http_falso(lambda req: httpx.Response(200, json=resposta_rreo))
    cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)

    http2, requisicoes2 = http_falso(lambda req: pytest.fail("não deveria chamar a API"))
    itens = cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http2)

    assert itens == resposta_rreo["items"]
    assert requisicoes2 == []


def test_paginacao_junta_todas_as_paginas(tmp_path, resposta_rreo, params_rreo, sem_espera):
    itens = resposta_rreo["items"]
    corte = 1000

    def responder(request):
        offset = int(request.url.params["offset"])
        pagina = itens[offset:offset + corte]
        return httpx.Response(200, json={
            "items": pagina,
            "hasMore": offset + corte < len(itens),
            "offset": offset,
            "count": len(pagina),
        })

    http, requisicoes = http_falso(responder)
    resultado = cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)

    assert resultado == itens
    assert [int(r.url.params["offset"]) for r in requisicoes] == [0, 1000, 2000]
    gravado = json.loads(cliente.caminho_cache("rreo", params_rreo, tmp_path).read_text(encoding="utf-8"))
    assert len(gravado["paginas"]) == 3
    # Pausa entre chamadas: a 2ª e a 3ª esperam (a 1ª não tem anterior)
    assert len(sem_espera) == 2
    assert all(0 < s <= CONFIG["pausa_segundos"] for s in sem_espera)


def test_pausa_vem_do_config():
    config = cliente.carregar_config()
    assert config["pausa_segundos"] > 0
    assert config["tentativas"] == 3


def test_tenta_de_novo_em_429(tmp_path, resposta_rreo, params_rreo):
    respostas = iter([
        httpx.Response(429, headers={"Retry-After": "7"}),
        httpx.Response(200, json=resposta_rreo),
    ])
    http, requisicoes = http_falso(lambda req: next(respostas))

    itens = cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)

    assert itens == resposta_rreo["items"]
    assert len(requisicoes) == 2


def test_tenta_de_novo_em_erro_de_rede(tmp_path, resposta_rreo, params_rreo):
    chamadas = []

    def responder(request):
        chamadas.append(request)
        if len(chamadas) < 3:
            raise httpx.ConnectError("sem rede", request=request)
        return httpx.Response(200, json=resposta_rreo)

    http, _ = http_falso(responder)
    itens = cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)

    assert itens == resposta_rreo["items"]
    assert len(chamadas) == 3


def test_desiste_apos_3_tentativas_e_nao_grava_cache(tmp_path, params_rreo):
    def responder(request):
        raise httpx.ReadTimeout("demorou", request=request)

    http, requisicoes = http_falso(responder)
    with pytest.raises(httpx.ReadTimeout):
        cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)

    assert len(requisicoes) == 3
    assert not cliente.caminho_cache("rreo", params_rreo, tmp_path).exists()


def test_429_persistente_vira_erro(tmp_path, params_rreo):
    http, requisicoes = http_falso(lambda req: httpx.Response(429))
    with pytest.raises(httpx.HTTPStatusError):
        cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)
    assert len(requisicoes) == 3


def test_outro_erro_http_nao_tenta_de_novo(tmp_path, params_rreo):
    http, requisicoes = http_falso(lambda req: httpx.Response(500))
    with pytest.raises(httpx.HTTPStatusError):
        cliente.consultar("rreo", params_rreo, config=CONFIG, dir_raw=tmp_path, http=http)
    assert len(requisicoes) == 1
