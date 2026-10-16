"""Tabela consolidada de MVI (FBSP): seleção das colunas pelo mapeamento (docs/fbsp_temas.csv), edição mais recente,
revisão, soma das UFs e população implícita. UFs fictícias (XA, XB) nos testes de regra; a Tabela 02 de 2024, real,
no teste do mapeamento."""
from pathlib import Path

import pandas as pd
import pytest

from extractors import base
from extractors.nacional.fbsp import fbsp, mvi

NUM = "TABELA 02 | Mortes Violentas Intencionais - MVI | Ns. Absolutos | {ano}"
TAXA = "TABELA 02 | Mortes Violentas Intencionais - MVI | Taxa (2) | {ano}"
MAPEAMENTO = pd.DataFrame([
    {"medida": "mvi_numero", "edicao": e, "aba": "T02", "anos": [e - 2, e - 1],
     "padrao_coluna": r"Mortes Violentas Intencionais - MVI \|(?:.* \|)? (?:Número Absoluto|Ns\. Absolutos) \|"} for e in (2021, 2022)
] + [
    {"medida": "mvi_taxa", "edicao": e, "aba": "T02", "anos": [e - 2, e - 1],
     "padrao_coluna": r"Mortes Violentas Intencionais - MVI \|(?:.* \|)? Taxa(?: \(\d+\))? \|"} for e in (2021, 2022)
])


def celulas(edicao, valores):
    """valores: {(uf, ano): (numero, taxa)} → linhas no formato da tabela fbsp."""
    linhas = []
    for (uf, ano), (n, t) in valores.items():
        linhas += [{"edicao": edicao, "local": "aba:T02", "uf": uf, "ano": ano, "coluna": NUM.format(ano=ano), "valor": n},
                   {"edicao": edicao, "local": "aba:T02", "uf": uf, "ano": ano, "coluna": TAXA.format(ano=ano), "valor": t}]
    return linhas


FBSP = pd.DataFrame(
    celulas(2021, {("XA", 2019): (10, 10.0), ("XB", 2019): (20, 10.0), ("BR", 2019): (30, 10.0),
                   ("XA", 2020): (12, 12.0), ("XB", 2020): (20, 10.0), ("BR", 2020): (32, 10.7)})
    + celulas(2022, {("XA", 2020): (13, 13.0), ("XB", 2020): (21, 10.5), ("BR", 2020): (34, 11.3),
                     ("XA", 2021): (11, 12.0), ("XB", 2021): (22, 11.0), ("BR", 2021): (33, 11.4)}))


def test_edicao_mais_recente_prevalece_com_primeira_publicacao_e_revisao():
    c = mvi.consolidar(mvi.selecionar(FBSP, MAPEAMENTO, ["XA", "XB", "BR"]), {"XA": "91", "XB": "92", "BR": "1"}, "mvi")
    xa = c.set_index(["uf", "ano"]).loc[("XA", 2020)]
    assert (xa["mvi_numero"], xa["edicao_fonte"], xa["mvi_numero_primeira_publicacao"], xa["revisao_numero"]) == (13, 2022, 12, 1)
    assert (xa["mvi_taxa"], xa["revisao_taxa"], xa["tabela_fonte"]) == (13.0, 1.0, "T02")
    assert xa["populacao_implicita"] == pytest.approx(100_000)
    assert c.set_index(["uf", "ano"]).loc[("XA", 2019), "revisao_numero"] == 0  # publicado uma vez só
    assert set(mvi.conferir_soma(c)["diferenca"]) == {0}
    base.validar_esquema(c, "fbsp_mvi")


def test_coluna_que_nao_acha_um_cabecalho_por_ano_ou_uf_faltando_param():
    sem_xb = FBSP[~((FBSP["uf"] == "XB") & (FBSP["edicao"] == 2022))]
    with pytest.raises(base.ErroValidacao, match=r"2022 T02 mvi_numero 2020: faltam \['XB'\]"):
        mvi.selecionar(sem_xb, MAPEAMENTO, ["XA", "XB", "BR"])
    duas = pd.concat([FBSP, FBSP[FBSP["edicao"] == 2021].assign(coluna=lambda d: d["coluna"] + " (outra)")])
    with pytest.raises(base.ErroValidacao, match="2 colunas"):
        mvi.selecionar(duas, MAPEAMENTO, ["XA", "XB", "BR"])


def test_populacao_implicita_que_varia_mais_de_5_por_cento():
    c = pd.DataFrame({"uf": ["XA"] * 3, "ano": [2019, 2020, 2021], "edicao_fonte": [2021, 2022, 2022],
                      "populacao_implicita": [100.0, 103.0, 92.0]})
    fora = mvi.variacoes_de_populacao(c)
    assert fora["ano"].tolist() == [2021] and fora["variacao_populacao"].iloc[0] == pytest.approx(92 / 103 - 1)


def test_mapeamento_real_acha_numero_e_taxa_da_tabela_02_de_2024():
    """docs/fbsp_temas.csv, linhas de 2024, sobre a Tabela 02 real: 2022 e 2023, as 27 UFs e o Brasil."""
    linhas = pd.read_csv(Path(__file__).parent / "fixtures" / "fbsp" / "anuario-2024_T02.csv", header=None, dtype=object,
                         keep_default_na=False).values.tolist()
    df = pd.DataFrame(fbsp.para_longo(linhas, {"tabela_id": "t", "arquivo": "anuario-2024.xlsx", "local": "aba:T02", "titulo": "T02"}))
    df["edicao"] = 2024
    df["ano_coluna"] = df["ano_coluna"].astype("Int64")
    tabela = fbsp.tabela_canonica(df)
    mapeamento = mvi.ler_mapeamento()
    assert sorted(mapeamento["edicao"].unique()) == list(range(2018, 2027)) and len(mapeamento) == 18
    siglas = sorted(fbsp.fbsp_codigos())
    longo = mvi.selecionar(tabela, mapeamento[mapeamento["edicao"] == 2024], siglas)
    assert longo.groupby(["medida", "ano"])["uf"].nunique().eq(28).all()
    brasil = longo[(longo["uf"] == "BR") & (longo["medida"] == "mvi_numero")].set_index("ano")["valor"]
    assert brasil.to_dict() == {2022: 47963, 2023: 46328}


def test_mdip_acima_das_mvi_e_apontado():
    """As mortes por intervenção policial estão dentro das MVI: MDIP > MVI na mesma UF e ano é erro de leitura."""
    mvi_ = pd.DataFrame({"uf": ["XA", "XB"], "ano": [2024, 2024], "mvi_numero": [100, 50]})
    mdip = pd.DataFrame({"uf": ["XA", "XB"], "ano": [2024, 2024], "mdip_numero": [30, 60]})
    assert mvi.conferir_mdip_dentro_da_mvi(mvi_, mdip)["uf"].tolist() == ["XB"]


def test_consolida_o_tema_mdip_com_as_mesmas_regras():
    mdip = FBSP.assign(coluna=FBSP["coluna"].str.replace("Mortes Violentas Intencionais - MVI", "Total", regex=False))
    mapeamento = MAPEAMENTO.assign(
        medida=MAPEAMENTO["medida"].str.replace("mvi", "mdip"),
        padrao_coluna=MAPEAMENTO["padrao_coluna"].str.replace("Mortes Violentas Intencionais - MVI ", "", regex=False))
    c = mvi.consolidar(mvi.selecionar(mdip, mapeamento, ["XA", "XB", "BR"]), {"XA": "91", "XB": "92", "BR": "1"}, "mdip")
    xa = c.set_index(["uf", "ano"]).loc[("XA", 2020)]
    assert (xa["mdip_numero"], xa["mdip_numero_primeira_publicacao"], xa["revisao_numero"]) == (13, 12, 1)
    base.validar_esquema(c, "fbsp_mdip")
