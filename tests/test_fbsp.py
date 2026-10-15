"""FBSP (Anuário Brasileiro de Segurança Pública): leitura de tabela em formato longo e as regras do projeto
(arquivos repetidos, tabela canônica só com UF e ano, regra do ano, território em qualquer coluna de identificação).
Sem rede; a Tabela 64 de 2026 e a Tabela 02 de 2024 (mortes violentas intencionais) são recortes reais em
tests/fixtures/fbsp/."""

from pathlib import Path

import pandas as pd
import pytest

from extractors import base
from extractors.nacional.fbsp import fbsp

TABELA = [
    ["Tabela 1 - Mortes violentas intencionais", "", ""],
    ["UF", "2022", "2023"],
    ["Rio de Janeiro", "4.123", "3.987"],
    ["Sergipe (1)", "-", "612"],
    ["Brasil", "47.398", "46.328"],
    ["Capitais", "10.001", "9.876"],
]


def test_para_longo_numeros_ufs_e_anos():
    regs = fbsp.para_longo(TABELA, {"tabela_id": "t", "arquivo": "anuario-2024.xlsx", "local": "aba:T01", "titulo": "T"})
    por = {(r["rotulo"], r["ano_coluna"]): r for r in regs}
    assert por[("Rio de Janeiro", 2022)]["valor"] == 4123 and por[("Rio de Janeiro", 2022)]["uf"] == "RJ"
    assert ("Sergipe (1)", 2022) not in por  # "-" é ausente, nunca 0
    assert por[("Sergipe (1)", 2023)]["uf"] == "SE"  # nota de rodapé no rótulo
    assert por[("Brasil", 2023)]["uf"] == "BR" and por[("Capitais", 2023)]["uf"] is None
    assert por[("Capitais", 2023)]["nivel_territorial"] == "total_capitais"


def test_arquivos_repetidos_param_a_extracao(tmp_path):
    (tmp_path / "anuario-2016.xlsx").write_bytes(b"igual")
    (tmp_path / "anuario-2022.xlsx").write_bytes(b"igual")
    (tmp_path / "anuario-2023.xlsx").write_bytes(b"outro")
    with pytest.raises(base.ErroValidacao, match="anuario-2016.xlsx = anuario-2022.xlsx"):
        fbsp.conferir_repetidos(sorted(tmp_path.iterdir()))
    fbsp.conferir_repetidos([tmp_path / "anuario-2022.xlsx", tmp_path / "anuario-2023.xlsx"])


def test_tabela_canonica_so_com_uf_e_ano_no_esquema():
    regs = fbsp.para_longo(TABELA, {"tabela_id": "t", "arquivo": "anuario-2024.xlsx", "local": "aba:T01", "titulo": "T"})
    df = pd.DataFrame(regs)
    df["edicao"] = 2024
    df["ano_coluna"] = df["ano_coluna"].astype("Int64")
    canonica = base.validar_esquema(fbsp.tabela_canonica(df), "fbsp")
    assert set(canonica["uf"]) == {"RJ", "SE", "BR"}  # "Capitais" fica só na tabela de conferência
    assert dict(zip(canonica["uf"], canonica["cod_ibge"]))["BR"] == "1"
    assert canonica["ano"].notna().all() and set(canonica["fonte_dado"]) == {"fbsp_anuario"}


def test_tabela_64_da_edicao_2026_ano_pela_coluna_nunca_pelo_intervalo_do_titulo():
    """Tabela 64 (2026), real: 7 linhas de cabeçalho, título "... - 2022-2026" e um ano por coluna. Antes, o cabeçalho
    parava na 5ª linha: os anos viravam valores e os valores herdavam 2026 do intervalo do título."""
    linhas = pd.read_csv(Path(__file__).parent / "fixtures" / "fbsp" / "anuario-2026_T64.csv", header=None, dtype=object).values.tolist()
    df = pd.DataFrame(fbsp.para_longo(linhas, {"tabela_id": "t64", "arquivo": "anuario-2026.xlsx", "local": "aba:T64",
                                               "titulo": "T64 — TABELA 64"}))
    assert set(df["ano_origem"]) == {"coluna"}
    assert set(df["ano_coluna"]) == {2022, 2023, 2024, 2025, 2026}
    assert not df["valor"].isin([2022.0, 2023.0, 2024.0, 2025.0, 2026.0]).any()  # a linha dos anos não é dado
    brasil = df[(df["uf"] == "BR") & df["coluna"].str.contains("Segurança Privada")]
    assert dict(zip(brasil["ano_coluna"], brasil["valor"].round(2)))[2022] == 1681.98
    assert (df["coluna"].str.endswith("| 2026") == (df["ano_coluna"] == 2026)).all()


@pytest.mark.parametrize("coluna, titulo, esperado", [
    (["Homicídios", "2024"], ["Tabela 1 - 2022-2024"], (2024, "coluna", None)),
    (["Homicídios"], ["Tabela 1 - 2024"], (2024, "titulo", None)),
    (["Homicídios"], ["Tabela 1 - 2022-2026"], (None, None, "varios_anos_no_titulo")),  # intervalo não vira ano
    (["Variação 2023/2024"], ["Tabela 1 - 2024"], (None, None, "varios_anos_na_coluna")),
    (["Homicídios"], ["Tabela 1"], (None, None, "sem_ano")),
])
def test_regra_do_ano(coluna, titulo, esperado):
    assert fbsp.ano_da_coluna(coluna, titulo) == esperado


def test_inventario_e_resumo_do_que_ficou_fora():
    df = pd.DataFrame([
        {"edicao": 2026, "titulo": "T", "coluna": "c | 2024", "uf": "RJ", "ano_coluna": 2024, "ano_origem": "coluna",
         "motivo_sem_ano": None, "valor": 1.0, "rotulo": "Rio de Janeiro", "nivel_territorial": "uf", "tabela_id": "a", "arquivo": "x", "local": "aba:T"},
        {"edicao": 2026, "titulo": "T", "coluna": "c | 2024", "uf": None, "ano_coluna": 2024, "ano_origem": "coluna",
         "motivo_sem_ano": None, "valor": 2.0, "rotulo": "Capitais", "nivel_territorial": "total_capitais", "tabela_id": "a", "arquivo": "x", "local": "aba:T"},
        {"edicao": 2026, "titulo": "T", "coluna": "c", "uf": "SP", "ano_coluna": None, "ano_origem": None,
         "motivo_sem_ano": "varios_anos_no_titulo", "valor": 3.0, "rotulo": "São Paulo", "nivel_territorial": "uf", "tabela_id": "a", "arquivo": "x", "local": "aba:T"},
    ])
    inv = fbsp.inventario(df)
    assert inv[["coluna", "n_valores", "n_em_processed"]].values.tolist() == [["c", 1, 0], ["c | 2024", 2, 1]]
    resumo = fbsp.resumo_fora(df).set_index("motivo")["n_valores"].to_dict()
    assert resumo == {"total_capitais": 1, "varios_anos_no_titulo": 1, "TOTAL": 2}


def test_ano_com_nota_de_rodape_no_cabecalho_continua_sendo_cabecalho():
    """Edição 2025, Tabela 46: a linha dos anos traz "2023 (2)"; antes ela virava dado e o cabeçalho parava nela."""
    tabela = [
        ["TABELA 46", "", "", ""],
        ["Lesão corporal dolosa em contexto de violência doméstica", "", "", ""],
        ["Brasil e Unidades da Federação – 2023-2024", "", "", ""],
        ["Brasil e Unidades da Federação", "0-4 anos", "", ""],
        ["", "Ns. Absolutos", "", "Variação (%)"],
        ["", "2023 (2)", 2024, ""],
        ["Brasil", 2106, 2204, 7.9],
        ["Acre", 14, 21, 54.97],
    ]
    df = pd.DataFrame(fbsp.para_longo(tabela, {"tabela_id": "t46", "arquivo": "anuario-2025.xlsx", "local": "aba:T46", "titulo": "T46"}))
    acre = df[df["uf"] == "AC"].set_index("valor")
    assert acre.loc[14, "ano_coluna"] == 2023 and acre.loc[21, "ano_coluna"] == 2024
    assert pd.isna(acre.loc[54.97, "ano_coluna"]) and acre.loc[54.97, "motivo_sem_ano"] == "varios_anos_no_titulo"
    assert not df["valor"].isin([2023.0, 2024.0]).any()


def ler_fixture(nome):
    return pd.read_csv(Path(__file__).parent / "fixtures" / "fbsp" / nome, header=None, dtype=object,
                       keep_default_na=False).values.tolist()


def test_mortes_violentas_2024_ufs_na_2a_coluna_e_soma_igual_ao_brasil():
    """Aceitação. Tabela 02 (2024), real: o grupo de qualidade fica na 1ª coluna e a UF na 2ª. Antes, a UF não era
    achada e a tabela inteira ficava fora de processed/. Agora: as 27 UFs, o grupo numa coluna própria e, em cada
    coluna de números absolutos, a soma das UFs igual à linha Brasil ("-" é zero na soma, nunca na tabela)."""
    df = pd.DataFrame(fbsp.para_longo(ler_fixture("anuario-2024_T02.csv"),
                                      {"tabela_id": "t02", "arquivo": "anuario-2024.xlsx", "local": "aba:T02", "titulo": "T02 — TABELA 02"}))
    df["edicao"] = 2024
    df["ano_coluna"] = df["ano_coluna"].astype("Int64")
    canonica = base.validar_esquema(fbsp.tabela_canonica(df), "fbsp")
    assert canonica["uf"].nunique() == 28  # 27 UFs + BR
    assert set(canonica.loc[canonica["uf"] == "AL", "grupo_qualidade"]) == {"Grupo 1"}
    assert set(canonica.loc[canonica["uf"] == "RR", "grupo_qualidade"]) == {"Grupo 3"}
    assert canonica.loc[canonica["uf"] == "BR", "grupo_qualidade"].isna().all()  # Brasil não herda grupo
    absolutos = canonica[canonica["coluna"].str.contains("Número Absoluto")]
    soma_ufs = absolutos[absolutos["uf"] != "BR"].groupby("coluna")["valor"].sum()
    brasil = absolutos[absolutos["uf"] == "BR"].set_index("coluna")["valor"]
    assert len(brasil) == 12
    pd.testing.assert_series_equal(soma_ufs.sort_index(), brasil.sort_index(), check_names=False)
    mvi_2023 = brasil[brasil.index.str.contains("Mortes Violentas Intencionais") & brasil.index.str.endswith("| 2023")]
    assert mvi_2023.tolist() == [46328]


def test_capitais_com_uf_e_grupo_a_esquerda_nao_entram_como_uf():
    """Layout da Tabela 07 (2024): grupo | UF | capital. A linha é da capital (a UF é atributo); "DF | -" é Brasília;
    "Rio de Janeiro" numa coluna de capitais é a cidade. Nada disso vai para processed/."""
    tabela = [
        ["Grupos segundo qualidade dos dados", "UF", "Capitais e Distrito Federal", "2023"],
        ["Total Capitais", "", "", "9.876"],
        ["Grupo 1", "AL", "Maceió", "361"],
        ["", "DF", "-", "313"],
        ["Grupo 2", "RJ", "Rio de Janeiro", "1.430"],
    ]
    regs = fbsp.para_longo(tabela, {"tabela_id": "t07", "arquivo": "anuario-2024.xlsx", "local": "aba:T07", "titulo": "T07"})
    por = {r["valor"]: r for r in regs}
    assert por[9876]["nivel_territorial"] == "total_capitais" and por[9876]["uf"] is None
    assert (por[361]["nivel_territorial"], por[361]["uf"], por[361]["capital"], por[361]["grupo_qualidade"]) == \
        ("capital", "AL", "Maceió", "Grupo 1")
    assert (por[313]["capital"], por[313]["grupo_qualidade"]) == ("Brasília", "Grupo 1")
    assert (por[1430]["nivel_territorial"], por[1430]["capital"]) == ("capital", "Rio de Janeiro")
    df = pd.DataFrame(regs).assign(edicao=2024)
    df["ano_coluna"] = df["ano_coluna"].astype("Int64")
    assert fbsp.tabela_canonica(df).empty


def test_municipios_ranking_e_codigo_nunca_viram_uf_nem_valor():
    """"50 cidades mais violentas" (2023): posição | município | UF. A linha é do município, não da UF; a posição e o
    código IBGE não são valores."""
    tabela = [
        ["No.", "Código IBGE", "Município", "UF", "Taxa de MVI (2022)"],
        ["1", "2918001", "Jequié", "BA", "88,8"],
        ["2", "1600303", "Macapá", "AP", "70,1"],
    ]
    regs = fbsp.para_longo(tabela, {"tabela_id": "t02", "arquivo": "anuario-2023.xlsx", "local": "aba:T02", "titulo": "T02"})
    assert [r["valor"] for r in regs] == [88.8, 70.1]
    assert {r["nivel_territorial"] for r in regs} == {"municipio"}
    assert [r["uf"] for r in regs] == ["BA", "AP"]  # a UF do município fica como atributo


@pytest.mark.parametrize("texto, esperado", [("Grupo 2", "Grupo 2"), ("1 opurG", "Grupo 1"), ("Grupo 3 (1)", "Grupo 3"),
                                             ("Grupos segundo qualidade", None), ("Alagoas", None)])
def test_grupo_de_qualidade(texto, esperado):
    assert fbsp.grupo_qualidade(texto) == esperado


def test_regioes_e_ranking_a_direita():
    """Série histórica (2025, T02): "Região Norte" é região, não UF. Ranking à direita ("1º") não é valor."""
    tabela = [
        ["Brasil, Regiões e UFs", "2023", "2024", "Posição no ranking"],
        ["Brasil", "46.441", "44.127", ""],
        ["Região Norte", "5.000", "4.900", ""],
        ["Acre", "214", "179", "1"],
    ]
    regs = fbsp.para_longo(tabela, {"tabela_id": "t", "arquivo": "anuario-2025.xlsx", "local": "aba:T02", "titulo": "T02"})
    assert {(r["rotulo"], r["nivel_territorial"]) for r in regs} == {("Brasil", "brasil"), ("Região Norte", "regiao"), ("Acre", "uf")}
    assert 1.0 not in {r["valor"] for r in regs}


def test_titulo_com_municipios_nao_faz_da_coluna_de_ufs_uma_coluna_de_municipios():
    """Despesa com segurança (2026, T54): título "União, Unidades da Federação e Municípios"; a coluna das UFs continua
    sendo de UFs (antes do ajuste, o título entrava no papel da coluna e as 27 UFs viravam municípios)."""
    tabela = [
        ["TABELA 54", "", ""],
        ["Despesas realizadas com a Função Segurança Pública, por Subfunções", "", ""],
        ["União, Unidades da Federação e Municípios - 2024-2025", "", ""],
        ["União e Unidades da Federação", "Policiamento", ""],
        ["", "2024", "2025"],
        ["Municípios", "6.719", "6.717"],
        ["Acre", "409", "410"],
    ]
    regs = fbsp.para_longo(tabela, {"tabela_id": "t54", "arquivo": "anuario-2026.xlsx", "local": "aba:T54", "titulo": "T54"})
    assert {(r["rotulo"], r["nivel_territorial"]) for r in regs} == {("Municípios", None), ("Acre", "uf")}
