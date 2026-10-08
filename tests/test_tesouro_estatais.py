"""Testes do dicionário de estatais (Raio X das Empresas dos Estados), sem rede.

A planilha de exemplo é montada no teste, com as mesmas diferenças da real entre abas:
ex2023 tem a coluna 'Setor ' (com espaço) e um setor com quebra de linha.
"""

import httpx
import pandas as pd
import pytest

from extractors.nacional import tesouro_estatais as te

UFS = pd.DataFrame({"uf": ["AA", "BB"], "cod_ibge": ["91", "92"]})


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
    df = te.gerar(planilha, UFS)
    assert list(df.columns) == te.COLUNAS_SAIDA
    assert df["ano_referencia"].value_counts().to_dict() == {2024: 3, 2023: 3}
    assert df["ano_referencia"].iloc[0] == 2024  # mais recente primeiro


def test_trata_coluna_com_espaco_e_quebra_de_linha_no_setor(planilha):
    df = te.gerar(planilha, UFS)
    assert set(df.loc[df["ano_referencia"] == 2023, "setor"]) == {"SANEAMENTO", "FINANCEIRO"}


def test_mantem_nome_original_e_normaliza_em_coluna_nova(planilha):
    linha = te.gerar(planilha, UFS).query("ano_referencia == 2024 and sigla == 'BR' and situacao != 'ATIVA'").iloc[0]
    assert linha["empresa"] == "BANCO REGIONAL  S/A - EM LIQUIDAÇÃO"  # como veio
    assert linha["empresa_normalizada"] == "BANCO REGIONAL S A EM LIQUIDACAO"
    assert te.normalizar_nome("Companhia de Águas - CA") == "COMPANHIA DE AGUAS CA"


def test_dependencia_cnpj_cod_ibge_e_situacao(planilha):
    df = te.gerar(planilha, UFS)
    ca = df.query("ano_referencia == 2024 and sigla == 'CA'").iloc[0]
    assert not ca["dependente"]
    assert ca["cnpj"] == "11111111000111" and ca["cod_ibge"] == "91" and ca["uf"] == "AA"
    # Em liquidação continua no dicionário, marcada pela situação
    assert (df["situacao"] == "EM LIQUIDAÇÃO").sum() == 2
    assert df.query("sigla == 'BR'")["dependente"].all()


def test_fonte_registra_commit_e_aba(planilha):
    df = te.gerar(planilha, UFS, commit="abcdef1234567")
    assert set(df["fonte"]) == {
        f"tesouro/empresas-estados@abcdef1:{te.ARQUIVO}#ex2024",
        f"tesouro/empresas-estados@abcdef1:{te.ARQUIVO}#ex2023",
    }


def test_recusa_dependencia_desconhecida(tmp_path):
    caminho = tmp_path / "p.xlsx"
    aba(**{"Dependência": ["SIM", "DEPENDENTE", "DEPENDENTE"]}).to_excel(caminho, sheet_name="ex2024", index=False)
    with pytest.raises(ValueError, match="dependência"):
        te.gerar(caminho, UFS, abas={"ex2024": 2024})


def test_recusa_uf_fora_do_dicionario(tmp_path):
    caminho = tmp_path / "p.xlsx"
    aba(UF=["AA", "BB", "ZZ"]).to_excel(caminho, sheet_name="ex2024", index=False)
    with pytest.raises(ValueError, match="UF fora"):
        te.gerar(caminho, UFS, abas={"ex2024": 2024})


def test_recusa_coluna_ausente(tmp_path):
    caminho = tmp_path / "p.xlsx"
    aba().drop(columns="Sigla").to_excel(caminho, sheet_name="ex2024", index=False)
    with pytest.raises(ValueError, match="Sigla"):
        te.gerar(caminho, UFS, abas={"ex2024": 2024})


def test_mesmo_cnpj_em_duas_ufs_e_permitido_mas_nao_na_mesma(tmp_path):
    caminho = tmp_path / "p.xlsx"
    cnpjs = ["11.111.111/0001-11", "11.111.111/0001-11", "33.333.333/0001-33"]
    aba(CNPJ=cnpjs).to_excel(caminho, sheet_name="ex2024", index=False)
    assert len(te.gerar(caminho, UFS, abas={"ex2024": 2024})) == 3
    aba(CNPJ=[cnpjs[2], cnpjs[0], cnpjs[0]]).to_excel(caminho, sheet_name="ex2024", index=False)
    with pytest.raises(ValueError, match="mesma UF"):
        te.gerar(caminho, UFS, abas={"ex2024": 2024})


def test_baixar_grava_como_veio_e_usa_cache(tmp_path):
    chamadas = []

    def responder(requisicao):
        chamadas.append(str(requisicao.url))
        return httpx.Response(200, content=b"conteudo-bruto")

    http = httpx.Client(transport=httpx.MockTransport(responder))
    caminho = te.baixar(commit="c0ffee", dir_raw=tmp_path, http=http)
    assert caminho == tmp_path / "c0ffee" / "dados_raw.xlsx"
    assert caminho.read_bytes() == b"conteudo-bruto"
    assert chamadas == [f"https://raw.githubusercontent.com/tesouro/empresas-estados/c0ffee/{te.ARQUIVO}"]
    te.baixar(commit="c0ffee", dir_raw=tmp_path, http=http)
    assert len(chamadas) == 1  # segunda vez veio do cache


def test_dicionarios_versionados_sao_coerentes():
    """estatais.csv × setor_funcao.csv × funcoes.csv: todo setor tem linha e todo código existe."""
    dicionarios = te.RAIZ / "dicionarios" / "nacional"
    estatais = pd.read_csv(dicionarios / "estatais.csv", dtype=str)
    setor_funcao = pd.read_csv(dicionarios / "setor_funcao.csv", dtype=str)
    funcoes = pd.read_csv(dicionarios / "funcoes.csv", dtype=str)

    assert not setor_funcao["setor"].duplicated().any()
    assert set(estatais["setor"]) == set(setor_funcao["setor"])
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
