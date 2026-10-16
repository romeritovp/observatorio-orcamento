"""publicacao/violencia.py: JSON da tela "Violência", anos de troca de base da taxa e gabarito (ranking pela taxa e
índice do número). UFs fictícias (XA e XB na região R1, XC na R2) e o país ZZ."""
import pandas as pd
import pytest

from publicacao import violencia

UFS = pd.DataFrame({"uf": ["XA", "XB", "XC"], "nome": ["Xa", "Xb", "Xc"], "regiao": ["R1", "R1", "R2"]})
TERRITORIOS = pd.DataFrame({"uf": ["ZZ"], "nome": ["País"]})


def linha(uf, ano, numero, taxa, edicao):
    return {"uf": uf, "ano": ano, "mvi_numero": numero, "mvi_taxa": taxa, "edicao_fonte": edicao, "tabela_fonte": "T01",
            "edicao_primeira_publicacao": edicao - 1 if ano < 2022 else edicao, "mvi_numero_primeira_publicacao": numero,
            "revisao_numero": 0, "mvi_taxa_primeira_publicacao": taxa, "revisao_taxa": 0.0}


# população implícita do país: 1.000.000 em 2020, 1.005.000 em 2021 (+0,5%), 950.000 em 2022 (−5,5%: base nova)
MVI = pd.DataFrame([
    linha("XA", 2020, 100, 20.0, 2021), linha("XB", 2020, 200, 40.0, 2021), linha("XC", 2020, 100, 25.0, 2021),
    linha("ZZ", 2020, 400, 40.0, 2021),
    linha("XA", 2021, 110, 22.0, 2022), linha("XB", 2021, 180, 36.0, 2022), linha("XC", 2021, 112, 28.0, 2022),
    linha("ZZ", 2021, 402, 40.0, 2022),
    linha("XA", 2022, 90, 19.0, 2022), linha("XB", 2022, 190, 40.0, 2022), linha("XC", 2022, 100, 26.0, 2022),
    linha("ZZ", 2022, 380, 40.0, 2022),
])


def test_quebra_de_base_quando_a_populacao_implicita_do_pais_salta():
    assert violencia.quebras_de_base(MVI, "ZZ") == [2022]
    assert violencia.quebras_de_base(MVI, "ZZ", limite=0.10) == []


def test_json_traz_anos_edicoes_ultimo_ano_sujeito_a_revisao_e_ressalvas():
    j = violencia.montar_violencia_json(MVI, UFS, TERRITORIOS)
    assert (j["anos"], j["ultimo_ano"], j["ano_sujeito_a_revisao"], j["pais"]) == ([2020, 2021, 2022], 2022, 2022, "ZZ")
    assert j["edicoes"] == [2020, 2021, 2022] and j["quebras_taxa"] == [2022]
    assert {t["uf"]: t["regiao"] for t in j["territorios"]} == {"ZZ": None, "XA": "R1", "XB": "R1", "XC": "R2"}
    assert [r["id"] for r in j["ressalvas"]] == ["mvi_edicao_mais_recente", "mvi_sujeito_a_revisao", "mvi_quebra_taxa",
                                                 "mdip_dentro_das_mvi"]
    assert "2021→2022" in j["ressalvas"][2]["texto"] and len(j["linhas"]) == 12


def test_gabarito_ranking_pela_taxa_e_indice_da_uf_da_regiao_e_do_pais():
    g = violencia.gabarito_violencia(MVI, UFS, "ZZ")
    pos = {(r["uf"], r["ano"]): r["posicao"] for r in g["ranking"]}
    assert (pos[("XB", 2020)], pos[("XC", 2020)], pos[("XA", 2020)]) == (1, 2, 3)  # o país não entra no ranking
    assert {r["n_ufs"] for r in g["ranking"]} == {3}
    ind = {(r["uf"], r["ano"]): r["indice"] for r in g["indice"]}
    assert ind[("XA", 2020)] == 100 and ind[("XA", 2021)] == pytest.approx(110)
    assert ind[("R1", 2022)] == pytest.approx((90 + 190) / (100 + 200) * 100)  # região = soma das UFs dela
    assert ind[("ZZ", 2022)] == pytest.approx(95)
    assert g["base"] == 2020


# mortes por intervenção policial (letalidade): XA 10/20, XB 20/30 e XC 5/10 em 2020 e 2021; país = soma
def mdip(uf, ano, numero, taxa, edicao):
    return {"uf": uf, "ano": ano, "mdip_numero": numero, "mdip_taxa": taxa, "edicao_fonte": edicao, "tabela_fonte": "T10",
            "edicao_primeira_publicacao": edicao, "mdip_numero_primeira_publicacao": numero, "revisao_numero": 0}


MDIP = pd.DataFrame([mdip(u, a, n, t, a + 1) for a in (2020, 2021, 2022)
                     for u, n, t in [("XA", 10, 2.0), ("XB", 20, 4.0), ("XC", 5, 1.25), ("ZZ", 35, 3.5)]])


def test_json_com_letalidade_policial_junta_as_colunas_mdip():
    j = violencia.montar_violencia_json(MVI, UFS, TERRITORIOS, MDIP)
    xa = next(l for l in j["linhas"] if l["uf"] == "XA" and l["ano"] == 2020)
    assert (xa["mvi_numero"], xa["mdip_numero"], xa["mdip_taxa"], xa["mdip_tabela_fonte"]) == (100, 10, 2.0, "T10")
    assert len(j["linhas"]) == 12


def test_gabarito_letalidade_ranking_pela_taxa_e_pct_nas_mvi_por_territorio():
    g = violencia.gabarito_violencia(MVI, UFS, "ZZ", MDIP)
    pos = {(r["uf"], r["ano"]): r["posicao"] for r in g["ranking_mdip"]}
    assert (pos[("XB", 2020)], pos[("XA", 2020)], pos[("XC", 2020)]) == (1, 2, 3)
    pct = {(r["uf"], r["ano"]): r["pct"] for r in g["pct_mdip_nas_mvi"]}
    assert pct[("XA", 2020)] == pytest.approx(10)
    assert pct[("R1", 2021)] == pytest.approx((10 + 20) / (110 + 180) * 100)  # região: soma das MDIP / soma das MVI
    assert pct[("ZZ", 2022)] == pytest.approx(35 / 380 * 100)
