"""Testes de analytics com DataFrames pequenos e duas UFs fictícias (AA e BB)."""

import pandas as pd
import pytest

from analytics import (
    agregar, deflacionar, mediana_entre_ufs, nomear, participacao, per_capita, ranking, variacao,
)

IPCA = pd.DataFrame({"ano": [2021, 2022, 2023], "variacao_pct": [10.0, 5.0, 4.0]})
POPULACAO = pd.DataFrame({
    "uf": ["AA", "AA", "BB", "BB"],
    "ano": [2022, 2023, 2022, 2023],
    "populacao": [1000, 1000, 500, 400],
})


def despesa():
    """Função 10 e 12 de duas UFs em dois anos."""
    return pd.DataFrame({
        "uf": ["AA", "AA", "AA", "AA", "BB", "BB", "BB", "BB"],
        "ano": [2022, 2022, 2023, 2023, 2022, 2022, 2023, 2023],
        "nivel": ["funcao"] * 8,
        "funcao_cod": ["10", "12"] * 4,
        "pago": [100.0, 300.0, 110.0, 290.0, 50.0, 50.0, 40.0, 60.0],
    })


# deflacionar

def test_deflacionar_leva_a_precos_do_ano_base():
    df = deflacionar(despesa(), ["pago"], 2023, IPCA)

    aa_2022 = df[(df["uf"] == "AA") & (df["ano"] == 2022) & (df["funcao_cod"] == "10")]
    assert aa_2022["pago_real"].iloc[0] == pytest.approx(100.0 * 1.04)
    assert (df.loc[df["ano"] == 2023, "pago_real"] == df.loc[df["ano"] == 2023, "pago"]).all()
    assert df["pago"].tolist() == despesa()["pago"].tolist()  # nominal intacto


def test_deflacionar_ano_base_anterior_reduz_valor():
    df = deflacionar(despesa(), ["pago"], 2021, IPCA)
    assert df["pago_real"].iloc[0] == pytest.approx(100.0 / 1.05)


def test_deflacionar_sem_ipca_do_ano_e_erro():
    with pytest.raises(ValueError, match="sem IPCA"):
        deflacionar(despesa(), ["pago"], 2023, IPCA[IPCA["ano"] != 2022].iloc[1:])
    with pytest.raises(ValueError, match="ano_base"):
        deflacionar(despesa(), ["pago"], 2030, IPCA)
    with pytest.raises(ValueError, match="faltando"):
        deflacionar(despesa(), ["pago"], 2023, IPCA[IPCA["ano"] != 2022])


def test_deflacionar_nao_altera_entrada():
    entrada = despesa()
    deflacionar(entrada, ["pago"], 2023, IPCA)
    assert "pago_real" not in entrada.columns


# variacao

def test_variacao_por_uf_e_funcao():
    df = variacao(despesa(), "pago", ["funcao_cod"])

    def var(uf, ano, funcao):
        linha = df[(df["uf"] == uf) & (df["ano"] == ano) & (df["funcao_cod"] == funcao)]
        return linha["pago_var_pct"].iloc[0]

    assert var("AA", 2023, "10") == pytest.approx(10.0)
    assert var("BB", 2023, "10") == pytest.approx(-20.0)  # não mistura com AA
    assert pd.isna(var("AA", 2022, "10"))
    assert list(df.index) == list(despesa().index)  # ordem original


def test_variacao_com_ano_faltando_fica_nula():
    df = despesa()
    df.loc[df["ano"] == 2023, "ano"] = 2024
    assert variacao(df, "pago", ["funcao_cod"])["pago_var_pct"].isna().all()


def test_variacao_recusa_linhas_repetidas_e_niveis_misturados():
    with pytest.raises(ValueError, match="mais de uma linha"):
        variacao(despesa(), "pago", [])  # duas funções no mesmo uf/ano
    misturado = despesa().assign(nivel=["funcao", "total"] * 4)
    with pytest.raises(ValueError, match="níveis"):
        variacao(misturado, "pago", ["funcao_cod"])


# participacao

def test_participacao_no_total_da_uf_e_ano():
    df = participacao(despesa(), "pago", ["ano"])

    assert df["pago_part_pct"].tolist() == pytest.approx([25.0, 75.0, 27.5, 72.5, 50.0, 50.0, 40.0, 60.0])
    soma = df.groupby(["uf", "ano"])["pago_part_pct"].sum()
    assert soma.tolist() == pytest.approx([100.0] * 4)


def test_participacao_recusa_niveis_misturados():
    with pytest.raises(ValueError, match="níveis"):
        participacao(despesa().assign(nivel=["funcao", "subfuncao"] * 4), "pago", ["ano"])


# per_capita

def test_per_capita_usa_populacao_da_uf_e_ano():
    df = per_capita(despesa(), ["pago"], POPULACAO)

    assert df["pago_per_capita"].tolist() == pytest.approx(
        [0.1, 0.3, 0.11, 0.29, 0.1, 0.1, 0.1, 0.15])
    assert "populacao" not in df.columns


def test_per_capita_sem_populacao_e_erro():
    with pytest.raises(ValueError, match="BB"):
        per_capita(despesa(), ["pago"], POPULACAO[POPULACAO["uf"] == "AA"])


# nomear

def test_nomear_junta_pelo_codigo():
    dicionario = pd.DataFrame({"funcao_cod": ["10", "12"], "funcao_nome": ["Saúde", "Educação"]})
    df = nomear(despesa(), dicionario)

    assert df["funcao_nome"].tolist() == ["Saúde", "Educação"] * 4
    assert len(df) == len(despesa())


def test_nomear_codigo_sem_nome_fica_nulo_e_nulo_continua_nulo():
    df = despesa()
    df.loc[0, "funcao_cod"] = None
    dicionario = pd.DataFrame({"funcao_cod": ["12"], "funcao_nome": ["Educação"]})

    nomeado = nomear(df, dicionario)

    assert pd.isna(nomeado.loc[0, "funcao_nome"])
    assert pd.isna(nomeado.loc[0, "funcao_cod"])
    assert pd.isna(nomeado.loc[2, "funcao_nome"])  # código 10 fora do dicionário
    assert nomeado.loc[1, "funcao_nome"] == "Educação"


def test_nomear_recusa_dicionario_ambiguo():
    with pytest.raises(ValueError, match="repetido"):
        nomear(despesa(), pd.DataFrame({"funcao_cod": ["10", "10"], "funcao_nome": ["a", "b"]}))
    with pytest.raises(ValueError, match="em comum"):
        nomear(despesa(), pd.DataFrame({"outra": ["10"], "nome": ["a"]}))


# ranking e mediana_entre_ufs

def tres_ufs():
    return pd.DataFrame({
        "uf": ["AA", "BB", "CC", "AA", "BB", "CC"],
        "ano": [2022, 2022, 2022, 2023, 2023, 2023],
        "nivel": ["funcao"] * 6,
        "valor": [10.0, 30.0, 20.0, 50.0, 40.0, None],
    })


def test_ranking_por_ano():
    df = ranking(tres_ufs(), "valor", ["ano"])

    assert df["valor_posicao"].tolist()[:5] == [3, 1, 2, 1, 2]
    assert pd.isna(df["valor_posicao"].iloc[5])  # sem valor, sem posição
    assert df["valor_n_ufs"].tolist() == [3, 3, 3, 2, 2, 2]


def test_ranking_empate_fica_com_melhor_posicao():
    df = tres_ufs().assign(valor=[10.0, 10.0, 5.0, 1.0, 1.0, 1.0])
    assert ranking(df, "valor", ["ano"])["valor_posicao"].tolist() == [1, 1, 3, 1, 1, 1]


def test_ranking_recusa_uf_repetida_no_grupo():
    with pytest.raises(ValueError, match="mais de uma linha"):
        ranking(despesa(), "pago", ["ano"])  # duas funções por uf e ano


def test_mediana_entre_ufs():
    med = mediana_entre_ufs(tres_ufs(), "valor", ["ano"])

    assert med.columns.tolist() == ["ano", "valor_mediana", "n_ufs"]
    assert med["valor_mediana"].tolist() == [20.0, 45.0]
    assert med["n_ufs"].tolist() == [3, 2]


# agregar

def test_agregar_soma_por_uf_e_grupo():
    df = agregar(despesa(), ["pago"], ["ano"])

    assert df.columns.tolist() == ["uf", "ano", "pago"]
    assert df["pago"].tolist() == [400.0, 400.0, 100.0, 100.0]


def test_agregar_grupo_so_com_nulos_fica_nulo():
    df = despesa().assign(pago=None)
    assert agregar(df, ["pago"], ["ano"])["pago"].isna().all()


def test_agregar_recusa_niveis_misturados():
    with pytest.raises(ValueError, match="níveis"):
        agregar(despesa().assign(nivel=["funcao", "total"] * 4), ["pago"], ["ano"])
