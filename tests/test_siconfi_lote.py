"""Testes do lote genérico, com extrator falso (sem rede) e duas UFs fictícias."""

import pandas as pd

from extractors import base
from extractors.nacional.siconfi import lote


def extrator_falso(uf, ano):
    if uf == "AA" and ano == 2020:
        raise base.ConsultaVazia("DCA I-E vazia para AA 2020")
    if uf == "BB" and ano == 2019:
        raise ValueError("linha em formato desconhecido")
    return pd.DataFrame({"x": [1, 2]})


def test_executar_nao_para_no_erro():
    resultados = lote.executar(["AA", "BB"], [2019, 2020], extrator_falso)

    situacoes = {(r["uf"], r["ano"]): r["situacao"] for r in resultados}
    assert situacoes == {
        ("AA", 2019): "ok", ("AA", 2020): "vazia",
        ("BB", 2019): "erro", ("BB", 2020): "ok",
    }
    erro = next(r for r in resultados if r["situacao"] == "erro")
    assert "ValueError" in erro["detalhe"]


def test_resumo_lista_vazias_e_falhas():
    texto = lote.resumo(lote.executar(["AA", "BB"], [2019, 2020], extrator_falso))

    assert "ok: 2" in texto and "vazia: 1" in texto and "erro: 1" in texto
    assert "AA 2020" in texto
    assert "BB 2019: ValueError" in texto


def test_ufs_do_dicionario(tmp_path):
    caminho = tmp_path / "ufs.csv"
    caminho.write_text("uf,cod_ibge,nome,regiao\nAA,01,A,Norte\nBB,02,B,Sul\n", encoding="utf-8")
    assert lote.ufs_do_dicionario(caminho) == ["AA", "BB"]
