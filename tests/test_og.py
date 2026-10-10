"""Prévias de compartilhamento: números das imagens × gabarito.json, tamanho e peso das imagens, textos do PHP."""

import json
from pathlib import Path

import pytest
from PIL import Image

from publicacao import og

DATA = og.DIR_DATA
OG = og.DIR_OG


@pytest.fixture(scope="module")
def dados():
    return og.ler_dados()


@pytest.fixture(scope="module")
def gabarito():
    return json.loads((DATA / "gabarito.json").read_text(encoding="utf-8"))


def test_numeros_de_cada_imagem_conferem_com_o_gabarito(dados, gabarito):
    numeros = og.numeros_por_uf(dados)
    assert len(numeros) == 27
    ano = max(dados["meta"]["anos"])
    receita = {(r["uf"], r["ano"]): r["receita_liquida"] for r in gabarito["receita"]}
    divida = {(r["uf"], r["ano"]): r["dcl_rcl_pct"] for r in gabarito["divida"]}
    saude = {(r["uf"], r["ano"]): r["per_capita_real"] for r in gabarito["valores"] if r["funcao_cod"] == og.FUNCAO_SAUDE}
    for uf, n in numeros.items():
        assert n["ano"] == ano
        assert n["receita_liquida"] == pytest.approx(receita[(uf, ano)], rel=1e-12), uf
        assert n["dcl_rcl_pct"] == pytest.approx(divida[(uf, ano)], rel=1e-12), uf
        assert n["saude_per_capita"] == pytest.approx(saude[(uf, ano)], rel=1e-9), uf


def test_imagens_gravadas_estao_atualizadas_e_no_tamanho(dados):
    if not (OG / "numeros.json").exists():
        pytest.skip("rode uv run python -m publicacao.og")
    gravados = json.loads((OG / "numeros.json").read_text(encoding="utf-8"))
    atuais = og.numeros_por_uf(dados)
    assert set(gravados) == set(atuais)
    for uf, n in atuais.items():  # imagens geradas com os dados exportados de agora
        for campo, valor in n.items():
            assert gravados[uf][campo] == pytest.approx(valor), (uf, campo)
    arquivos = [OG / "padrao.png"] + [OG / f"estado-{uf.lower()}.png" for uf in gravados]
    for arquivo in arquivos:
        with Image.open(arquivo) as imagem:
            assert imagem.size == (1200, 630), arquivo.name
        assert arquivo.stat().st_size < 300 * 1024, arquivo.name


def test_desenho_e_formatos(tmp_path):
    site = {"dominio": "exemplo.com.br", "nome": "Site", "url": "https://exemplo.com.br"}
    caminho = og.gravar_png(og.imagem_estado(site, "Bahia", "a", {"ano": 2025, "receita_liquida": 1.2e9,
                                                                   "dcl_rcl_pct": None, "saude_per_capita": 900}),
                            tmp_path / "x.png")
    assert Image.open(caminho).size == (1200, 630)
    assert og.reais_compacto(52540641986.05) == "R$ 52,5 bi"
    assert og.reais_compacto(108745366047.31) == "R$ 109 bi"
    assert og.reais_inteiros(1217.52) == "R$ 1.218" and og.pct(217.25) == "217,2%"


def test_compartilhar_json_textos_para_o_php(dados):
    site = {"dominio": "exemplo.com.br", "nome": "Site", "url": "https://exemplo.com.br"}
    c = og.montar_compartilhar(site, dados, og.numeros_por_uf(dados))
    assert len(c["ufs"]) == 27 and c["ufs"]["RJ"]["title"].startswith("As contas do Rio de Janeiro")
    assert c["ufs"]["PE"]["image"] == "https://exemplo.com.br/og/estado-pe.png"
    assert c["funcoes"]["10"]["title"].startswith("Comparar estados: Saúde")
    assert c["views"] == ["estado", "comparar"] and c["padrao"]["image"].endswith("/og/padrao.png")
