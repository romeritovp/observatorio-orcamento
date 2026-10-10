"""Testes do dicionário de estatais (Raio X das Empresas dos Estados), sem rede.

A planilha de exemplo é montada no teste, com as mesmas diferenças da real entre abas:
ex2023 tem a coluna 'Setor ' (com espaço) e um setor com quebra de linha.
"""

import httpx
import pandas as pd
import pytest

from extractors.nacional import tesouro_estatais as te

UFS = pd.DataFrame({"uf": ["AA", "BB"], "cod_ibge": ["91", "92"]})
SO_V2025 = {te.ARQUIVO: {"ex2024": 2024, "ex2023": 2023}}


def aba(setor_coluna="Setor", **colunas):
    base = {
        "UF": ["AA", "BB", "BB"],
        "Estatal": ["Companhia de Águas - CA", "BANCO REGIONAL  S/A - EM LIQUIDAÇÃO", "Banco Regional"],
        "Sigla": ["CA", "BR", "BR"],
        "CNPJ": ["11.111.111/0001-11", "22.222.222/0001-22", "33.333.333/0001-33"],
        setor_coluna: ["SANEAMENTO", "FINANCEIRO", "FINANCEIRO"],
        "Dependência": ["NÃO DEPENDENTE", "DEPENDENTE", "DEPENDENTE"],
        "Situação": ["ATIVA", "EM LIQUIDAÇÃO", "ATIVA"],
        "Outra coluna": ["x", "y", "z"],
    }
    base.update(colunas)
    return pd.DataFrame(base)


@pytest.fixture
def planilha(tmp_path):
    caminho = tmp_path / "dados_raw.xlsx"
    with pd.ExcelWriter(caminho) as escritor:
        aba().to_excel(escritor, sheet_name="ex2024", index=False)
        aba("Setor ", **{"Setor ": ["\nSANEAMENTO", "FINANCEIRO ", "FINANCEIRO"]}).to_excel(
            escritor, sheet_name="ex2023", index=False)
        pd.DataFrame({"lixo": [1]}).to_excel(escritor, sheet_name="Estatisticas", index=False)
    return caminho


def test_gera_as_duas_edicoes_com_colunas_do_dicionario(planilha):
    df = te.gerar({te.ARQUIVO: planilha}, UFS, planilhas=SO_V2025)
    assert list(df.columns) == te.COLUNAS_SAIDA
    assert df["ano_referencia"].value_counts().to_dict() == {2024: 3, 2023: 3}
    assert df["ano_referencia"].iloc[0] == 2024  # mais recente primeiro


def test_trata_coluna_com_espaco_e_quebra_de_linha_no_setor(planilha):
    df = te.gerar({te.ARQUIVO: planilha}, UFS, planilhas=SO_V2025)
    assert set(df.loc[df["ano_referencia"] == 2023, "setor"]) == {"SANEAMENTO", "FINANCEIRO"}


def test_mantem_nome_original_e_normaliza_em_coluna_nova(planilha):
    linha = te.gerar({te.ARQUIVO: planilha}, UFS, planilhas=SO_V2025).query("ano_referencia == 2024 and sigla == 'BR' and situacao != 'ATIVA'").iloc[0]
    assert linha["empresa"] == "BANCO REGIONAL  S/A - EM LIQUIDAÇÃO"  # como veio
    assert linha["empresa_normalizada"] == "BANCO REGIONAL S A EM LIQUIDACAO"
    assert te.normalizar_nome("Companhia de Águas - CA") == "COMPANHIA DE AGUAS CA"


def test_dependencia_cnpj_cod_ibge_e_situacao(planilha):
    df = te.gerar({te.ARQUIVO: planilha}, UFS, planilhas=SO_V2025)
    ca = df.query("ano_referencia == 2024 and sigla == 'CA'").iloc[0]
    assert not ca["dependente"]
    assert ca["cnpj"] == "11111111000111" and ca["cod_ibge"] == "91" and ca["uf"] == "AA"
    # Em liquidação continua no dicionário, marcada pela situação
    assert (df["situacao"] == "EM LIQUIDAÇÃO").sum() == 2
    assert df.query("sigla == 'BR'")["dependente"].all()


def test_fonte_registra_commit_e_aba(planilha):
    df = te.gerar({te.ARQUIVO: planilha}, UFS, planilhas=SO_V2025, commit="abcdef1234567")
    assert set(df["fonte"]) == {
        f"tesouro/empresas-estados@abcdef1:{te.ARQUIVO}#ex2024",
        f"tesouro/empresas-estados@abcdef1:{te.ARQUIVO}#ex2023",
    }


def test_recusa_dependencia_desconhecida(tmp_path):
    caminho = tmp_path / "p.xlsx"
    aba(**{"Dependência": ["SIM", "DEPENDENTE", "DEPENDENTE"]}).to_excel(caminho, sheet_name="ex2024", index=False)
    with pytest.raises(ValueError, match="dependência"):
        te.gerar({te.ARQUIVO: caminho}, UFS, planilhas={te.ARQUIVO: {"ex2024": 2024}})


def test_recusa_uf_fora_do_dicionario(tmp_path):
    caminho = tmp_path / "p.xlsx"
    aba(UF=["AA", "BB", "ZZ"]).to_excel(caminho, sheet_name="ex2024", index=False)
    with pytest.raises(ValueError, match="UF fora"):
        te.gerar({te.ARQUIVO: caminho}, UFS, planilhas={te.ARQUIVO: {"ex2024": 2024}})


def test_recusa_coluna_ausente_mas_aceita_edicao_sem_sigla(tmp_path):
    caminho = tmp_path / "p.xlsx"
    aba().drop(columns="Situação").to_excel(caminho, sheet_name="ex2024", index=False)
    with pytest.raises(ValueError, match="Situação"):
        te.gerar({te.ARQUIVO: caminho}, UFS, planilhas={te.ARQUIVO: {"ex2024": 2024}})
    # Edições dos exercícios 2020 e 2019 não têm sigla: fica nula
    aba().drop(columns="Sigla").to_excel(caminho, sheet_name="ex2024", index=False)
    df = te.gerar({te.ARQUIVO: caminho}, UFS, planilhas={te.ARQUIVO: {"ex2024": 2024}})
    assert df["sigla"].isna().all() and len(df) == 3


def planilha_paf(caminho, linhas):
    """Imita a planilha do exercício 2019: duas linhas de título e cabeçalho "Grupo > Coluna"."""
    cabecalho = ["Estado", "Nome da Empresa", "Ficha > CNPJ Principal", "Ficha > Setor", "Ficha > Dependência"]
    corpo = pd.DataFrame([["título"] + [None] * 4, [None] * 5, cabecalho] + linhas)
    corpo.to_excel(caminho, sheet_name="Dados", index=False, header=False)


def test_edicao_2019_herda_setor_e_situacao_de_2021_e_descarta_sem_cnpj(tmp_path):
    caminho_2019 = tmp_path / "paf.xlsx"
    planilha_paf(caminho_2019, [
        ["AA", "Companhia de Águas", "11.111.111/0001-11", "SERVIÇOS PÚBLICOS", "Dependente"],  # tem par em 2021
        ["BB", "Banco Antigo", "44.444.444/0001-44", "FINANCEIRO", "NÃO DEPENDENTE"],          # sem par
        ["BB", "Sem CNPJ", None, "OUTRO", "DEPENDENTE"],                                           # descartada
        ["BB", "CNPJ com dígito a mais", "22.222.222/00001-22", "OUTRO", "DEPENDENTE"],            # descartada
    ])
    caminho_2021 = tmp_path / "q.xlsx"
    aba().to_excel(caminho_2021, sheet_name="Todos", index=False)
    descartadas = []
    df = te.gerar({te.ARQUIVO_2019: caminho_2019, "v2022/q.xlsx": caminho_2021}, UFS,
                  planilhas={te.ARQUIVO_2019: {"Dados": 2019}, "v2022/q.xlsx": {"Todos": 2021}}, descartadas=descartadas)
    e19 = df[df["ano_referencia"] == 2019].set_index("cnpj")
    assert len(e19) == 2
    # dependência da própria edição (CA era NÃO DEPENDENTE em 2021); setor e situação de 2021, marcados
    assert e19.loc["11111111000111", "dependente"] == True  # noqa: E712
    assert e19.loc["11111111000111", "setor"] == "SANEAMENTO" and e19.loc["11111111000111", "situacao"] == "ATIVA"
    assert e19.loc["11111111000111", "campos_herdados"] == "setor,situacao" and e19.loc["11111111000111", "herdado_de"] == "2021"
    # sem par em 2021: sem setor, sem situação, sem marca
    assert pd.isna(e19.loc["44444444000144", "setor"]) and pd.isna(e19.loc["44444444000144", "campos_herdados"])
    assert [d["empresa"] for d in descartadas] == ["Sem CNPJ", "CNPJ com dígito a mais"]
    assert df.loc[df["ano_referencia"] == 2021, "campos_herdados"].isna().all()


def test_mesmo_cnpj_em_duas_ufs_e_permitido_mas_nao_na_mesma(tmp_path):
    caminho = tmp_path / "p.xlsx"
    cnpjs = ["11.111.111/0001-11", "11.111.111/0001-11", "33.333.333/0001-33"]
    aba(CNPJ=cnpjs).to_excel(caminho, sheet_name="ex2024", index=False)
    assert len(te.gerar({te.ARQUIVO: caminho}, UFS, planilhas={te.ARQUIVO: {"ex2024": 2024}})) == 3
    aba(CNPJ=[cnpjs[2], cnpjs[0], cnpjs[0]]).to_excel(caminho, sheet_name="ex2024", index=False)
    with pytest.raises(ValueError, match="mesma UF"):
        te.gerar({te.ARQUIVO: caminho}, UFS, planilhas={te.ARQUIVO: {"ex2024": 2024}})


def test_baixar_grava_como_veio_e_usa_cache(tmp_path):
    chamadas = []

    def responder(requisicao):
        chamadas.append(str(requisicao.url))
        return httpx.Response(200, content=b"conteudo-bruto")

    http = httpx.Client(transport=httpx.MockTransport(responder))
    caminho = te.baixar(commit="c0ffee", dir_raw=tmp_path, http=http)
    assert caminho == tmp_path / "c0ffee" / te.ARQUIVO
    assert caminho.read_bytes() == b"conteudo-bruto"
    assert chamadas == [f"https://raw.githubusercontent.com/tesouro/empresas-estados/c0ffee/{te.ARQUIVO}"]
    te.baixar(commit="c0ffee", dir_raw=tmp_path, http=http)
    assert len(chamadas) == 1  # segunda vez veio do cache


def test_varias_planilhas_e_exercicio_repetido(tmp_path):
    antiga = tmp_path / "quadro_estatais.xlsx"
    with pd.ExcelWriter(antiga) as escritor:
        aba(**{"Sigla": [" CA ", "BR", "BR"]}).rename(columns={"Sigla": " Sigla "}).to_excel(
            escritor, sheet_name="Todos", index=False)
    caminhos = {"v2025/a.xlsx": antiga, "v2022/b.xlsx": antiga}
    df = te.gerar(caminhos, UFS, planilhas={"v2025/a.xlsx": {"Todos": 2024}, "v2022/b.xlsx": {"Todos": 2021}})
    assert sorted(df["ano_referencia"].unique()) == [2021, 2024]
    assert set(df["sigla"]) == {"CA", "BR"}  # coluna ' Sigla ' (v2023) lida e limpa
    assert df.loc[df["ano_referencia"] == 2021, "fonte"].str.endswith("v2022/b.xlsx#Todos").all()
    with pytest.raises(ValueError, match="repetido"):
        te.gerar(caminhos, UFS, planilhas={"v2025/a.xlsx": {"Todos": 2024}, "v2022/b.xlsx": {"Todos": 2024}})


def test_dicionarios_versionados_sao_coerentes():
    """estatais.csv × setor_funcao.csv × funcoes.csv: todo setor tem linha e todo código existe."""
    dicionarios = te.RAIZ / "dicionarios" / "nacional"
    estatais = pd.read_csv(dicionarios / "estatais.csv", dtype=str)
    setor_funcao = pd.read_csv(dicionarios / "setor_funcao.csv", dtype=str)
    funcoes = pd.read_csv(dicionarios / "funcoes.csv", dtype=str)

    assert not setor_funcao["setor"].duplicated().any()
    # setor nulo só onde a edição não tem setor próprio e não houve par para herdar (exercício 2019)
    assert set(estatais["setor"].dropna()) == set(setor_funcao["setor"])
    sem_setor = estatais[estatais["setor"].isna()]
    assert set(sem_setor["ano_referencia"]) <= {str(a) for a in te.HERANCA} and sem_setor["campos_herdados"].isna().all()
    herdados = estatais[estatais["campos_herdados"].notna()]
    assert set(herdados["ano_referencia"]) <= {str(a) for a in te.HERANCA}
    assert set(setor_funcao["funcao_cod"].dropna()) <= set(funcoes["funcao_cod"])
    # Sem função ⇔ correspondência "nenhuma"
    assert (setor_funcao["funcao_cod"].isna() == (setor_funcao["correspondencia"] == "nenhuma")).all()
    assert set(estatais["dependente"]) == {"true", "false"}

    # Ajustes por empresa: CNPJ existente, sem repetição, função válida
    ajustes = pd.read_csv(dicionarios / "estatais_ajustes.csv", dtype=str)
    assert not ajustes["cnpj"].duplicated().any()
    assert set(ajustes["cnpj"]) <= set(estatais["cnpj"])
    assert set(ajustes["funcao_cod"].dropna()) <= set(funcoes["funcao_cod"])

    # Correções de nome para exibição: CNPJ existente, sem repetição, campos preenchidos
    nomes = pd.read_csv(dicionarios / "estatais_nomes_exibicao.csv", dtype=str)
    assert not nomes["cnpj"].duplicated().any()
    assert set(nomes["cnpj"]) <= set(estatais["cnpj"])
    assert nomes[["sigla_exibicao", "nome_exibicao"]].notna().all().all()
