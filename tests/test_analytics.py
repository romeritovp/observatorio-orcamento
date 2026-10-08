"""Testes de analytics com DataFrames pequenos e duas UFs fictícias (AA e BB)."""

import pandas as pd
import pytest

from analytics import (
    mapear_por_prefixo, segmentos, valores_proprios,
    agregar, completar_com_zero, deflacionar, edicao_para_ano, estatais_fora_das_contas, funcao_das_estatais, mudancas_de_dependencia, nomes_de_exibicao, mediana_entre_ufs, nomear, participacao, per_capita, ranking, variacao,
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


# completar_com_zero

def test_completar_com_zero_inclui_uf_sem_linha():
    df = despesa()
    df = df[~((df["uf"] == "BB") & (df["funcao_cod"] == "12"))]  # BB não declarou função 12
    universo = POPULACAO[["uf", "ano", "populacao"]]

    completo = completar_com_zero(df, universo, ["uf", "ano"], ["funcao_cod"], ["pago"])

    assert len(completo) == 8
    novas = completo[completo["sem_gasto_declarado"]]
    assert sorted(zip(novas["uf"], novas["ano"], novas["funcao_cod"])) == [("BB", 2022, "12"), ("BB", 2023, "12")]
    assert (novas["pago"] == 0).all()
    assert novas["populacao"].tolist() == [500, 400]  # colunas do universo vêm junto
    assert not completo.loc[~completo["sem_gasto_declarado"], "pago"].eq(0).any()


def test_completar_area_que_nenhuma_uf_declarou_num_ano():
    df = despesa()
    df = df[~((df["funcao_cod"] == "12") & (df["ano"] == 2023))]
    universo = POPULACAO[["uf", "ano"]]
    completo = completar_com_zero(df, universo, ["uf", "ano"], ["funcao_cod"], ["pago"])
    zerados = completo[(completo["funcao_cod"] == "12") & (completo["ano"] == 2023)]
    assert len(zerados) == 2 and zerados["sem_gasto_declarado"].all()


def test_zero_entra_no_ranking_e_na_mediana():
    df = despesa()
    df = df[~((df["uf"] == "BB") & (df["funcao_cod"] == "12"))]
    universo = pd.DataFrame({"uf": ["AA", "BB", "CC"], "ano": [2022] * 3})
    df = df[df["ano"] == 2022].assign(uf=lambda d: d["uf"])
    completo = completar_com_zero(df[df["funcao_cod"] == "12"], universo, ["uf", "ano"], ["funcao_cod"], ["pago"])
    completo = completo.assign(nivel="funcao")
    assert ranking(completo, "pago", ["ano"]).set_index("uf")["pago_posicao"].to_dict() == {"AA": 1, "BB": 2, "CC": 2}
    assert mediana_entre_ufs(completo, "pago", ["ano"])["pago_mediana"].tolist() == [0.0]


def test_completar_recusa_universo_repetido():
    universo = pd.DataFrame({"uf": ["AA", "AA"], "ano": [2022, 2022]})
    with pytest.raises(ValueError, match="universo"):
        completar_com_zero(despesa(), universo, ["uf", "ano"], ["funcao_cod"], ["pago"])


# estatais (só informativo)

SETOR_FUNCAO = pd.DataFrame({
    "setor": ["SANEAMENTO", "HABITAÇÃO E URBANIZAÇÃO", "FINANCEIRO"],
    "funcao_cod": ["17", "16", None],
    "correspondencia": ["direta", "parcial", "nenhuma"],
    "justificativa": ["s", "h", "f"],
})


def estatais():
    """AA e BB, dois exercícios; a mesma empresa de saneamento de AA nos dois."""
    return pd.DataFrame({
        "uf": ["AA", "AA", "AA", "BB", "BB", "AA"],
        "cnpj": ["1", "2", "3", "4", "5", "1"],
        "sigla": ["SAN", "OBRAS", "BANCO", "SANB", "HAB", "SAN"],
        "setor": ["SANEAMENTO", "HABITAÇÃO E URBANIZAÇÃO", "FINANCEIRO", "SANEAMENTO", "HABITAÇÃO E URBANIZAÇÃO",
                  "SANEAMENTO"],
        "dependente": [False, False, False, True, False, False],
        "situacao": ["ATIVA", "ATIVA", "ATIVA", "ATIVA", "EM LIQUIDAÇÃO", "ATIVA"],
        "ano_referencia": [2024, 2024, 2024, 2024, 2024, 2023],
    })


def test_funcao_das_estatais_ajuste_tem_prioridade_sobre_o_setor():
    ajustes = pd.DataFrame({"cnpj": ["2"], "funcao_cod": ["15"], "justificativa": ["obras públicas"]})
    df = funcao_das_estatais(estatais(), SETOR_FUNCAO, ajustes)
    obras = df[df["sigla"] == "OBRAS"].iloc[0]
    assert obras["funcao_cod"] == "15" and obras["correspondencia"] == "ajuste"
    assert obras["justificativa_funcao"] == "obras públicas"
    hab = df[df["sigla"] == "HAB"].iloc[0]
    assert hab["funcao_cod"] == "16" and hab["correspondencia"] == "parcial"
    assert pd.isna(df.loc[df["sigla"] == "BANCO", "funcao_cod"].iloc[0])  # sem correspondência fica nula
    assert len(df) == len(estatais())


def test_funcao_das_estatais_recusa_setor_sem_linha_e_ajuste_repetido():
    sem_ajuste = pd.DataFrame(columns=["cnpj", "funcao_cod", "justificativa"])
    with pytest.raises(ValueError, match="setores sem linha"):
        funcao_das_estatais(estatais().assign(setor="NOVO"), SETOR_FUNCAO, sem_ajuste)
    repetido = pd.DataFrame({"cnpj": ["1", "1"], "funcao_cod": ["17", "18"], "justificativa": ["a", "b"]})
    with pytest.raises(ValueError, match="CNPJ repetido"):
        funcao_das_estatais(estatais(), SETOR_FUNCAO, repetido)


def test_estatais_fora_das_contas_so_ativas_nao_dependentes_com_funcao_em_cada_edicao():
    sem_ajuste = pd.DataFrame(columns=["cnpj", "funcao_cod", "justificativa"])
    df = estatais_fora_das_contas(funcao_das_estatais(estatais(), SETOR_FUNCAO, sem_ajuste))
    # SANB é dependente, HAB está em liquidação, BANCO não tem função; as duas edições ficam
    assert df[["ano_referencia", "uf", "sigla", "funcao_cod"]].values.tolist() == [
        [2023, "AA", "SAN", "17"], [2024, "AA", "OBRAS", "16"], [2024, "AA", "SAN", "17"]]


def test_edicao_para_ano_mais_recente_que_nao_passa_do_ano():
    assert [edicao_para_ano([2024, 2023], a) for a in [2019, 2022, 2023, 2024, 2025]] == [2023, 2023, 2023, 2024, 2024]
    assert edicao_para_ano(["2023"], 2030) == 2023
    with pytest.raises(ValueError):
        edicao_para_ano([], 2024)


def test_estatais_fora_das_contas_exige_dependente_booleano():
    sem_ajuste = pd.DataFrame(columns=["cnpj", "funcao_cod", "justificativa"])
    df = funcao_das_estatais(estatais(), SETOR_FUNCAO, sem_ajuste)
    with pytest.raises(TypeError, match="booleano"):
        estatais_fora_das_contas(df.assign(dependente=df["dependente"].map({True: "true", False: "false"})))


def test_mudancas_de_dependencia_nos_dois_sentidos_com_funcao_da_edicao_nova():
    df = pd.DataFrame({
        "uf": ["AA", "AA", "BB", "BB", "AA", "AA", "BB", "BB", "BB"],
        "cnpj": ["1", "1", "2", "2", "3", "3", "4", "4", "5"],
        "sigla": ["MET", "MET", "GAS", "GAS", "IGUAL", "IGUAL", "BANCO", "BANCO", "NOVA"],
        "empresa": ["Metrô AA", "Metrô AA", "Gás BB", "Gás BB", "Igual", "Igual", "Banco", "Banco", "Nova"],
        "funcao_cod": ["26", "26", "25", "25", "17", "17", None, None, "17"],
        "dependente": [False, True, True, False, False, False, False, True, True],
        "ano_referencia": [2023, 2024, 2023, 2024, 2023, 2024, 2023, 2024, 2024],
    })
    m = mudancas_de_dependencia(df)
    # IGUAL não mudou; BANCO mudou mas não tem função; NOVA só existe em 2024
    assert m[["uf", "sigla", "funcao_cod", "ano", "ano_anterior", "sentido"]].values.tolist() == [
        ["AA", "MET", "26", 2024, 2023, "passou_a_dependente"],
        ["BB", "GAS", "25", 2024, 2023, "deixou_de_ser_dependente"],
    ]


def test_mudancas_de_dependencia_com_uma_edicao_so_e_vazio():
    df = pd.DataFrame({"uf": ["AA"], "cnpj": ["1"], "sigla": ["X"], "empresa": ["X"], "funcao_cod": ["17"],
                       "dependente": [True], "ano_referencia": [2024]})
    assert mudancas_de_dependencia(df).empty


def test_nomes_de_exibicao_manual_depois_acento_depois_mais_recente():
    df = pd.DataFrame({
        "uf": ["AA", "AA", "AA", "AA", "BB", "BB", "BB"],
        "cnpj": ["1", "1", "2", "2", "3", "3", "1"],
        "sigla": ["GAS", "GAS", "MET", "METRÔ", "X", "X", "GAS"],
        "empresa": ["Companhia de Gás", "COMPANHIA DE GAS", "METRO DE SAO PAULO", "Metrô de São Paulo",
                    "Velho Nome", "NOVO NOME", "Companhia de Gás BB"],
        "ano_referencia": [2023, 2024, 2023, 2024, 2023, 2024, 2024],
    })
    correcoes = pd.DataFrame({"cnpj": ["2"], "sigla_exibicao": ["Metrô"], "nome_exibicao": ["Metrô SP"]})
    n = nomes_de_exibicao(df, correcoes).set_index(["uf", "cnpj"])

    assert n.loc[("AA", "1"), "nome_exibicao"] == "Companhia de Gás"  # edição antiga tem acento
    assert n.loc[("AA", "1"), "sigla_exibicao"] == "GAS" and not n.loc[("AA", "1"), "nome_manual"]
    assert n.loc[("AA", "2")].tolist() == ["Metrô", "Metrô SP", True]  # manual tem prioridade
    assert n.loc[("BB", "3"), "nome_exibicao"] == "NOVO NOME"  # nenhuma com acento: a mais recente
    assert len(n) == 4  # o dicionário não muda de tamanho nem de conteúdo
    assert df["empresa"].iloc[1] == "COMPANHIA DE GAS"


def test_nomes_de_exibicao_recusa_correcao_repetida():
    df = pd.DataFrame({"uf": ["AA"], "cnpj": ["1"], "sigla": ["X"], "empresa": ["X"], "ano_referencia": [2024]})
    with pytest.raises(ValueError, match="repetido"):
        nomes_de_exibicao(df, pd.DataFrame({"cnpj": ["1", "1"], "sigla_exibicao": ["a", "b"], "nome_exibicao": ["a", "b"]}))


# códigos hierárquicos (natureza da receita)

def arvore():
    """AA e BB: categoria 1 com filhos 1.1 (que tem 1.1.1 e 1.1.2) e 1.7; em BB o 1.1 não detalha tudo."""
    linhas = []
    for uf, valores in [("AA", {"1.0.0": 100, "1.1.0": 60, "1.1.1": 40, "1.1.2": 20, "1.7.0": 40}),
                        ("BB", {"1.0.0": 50, "1.1.0": 30, "1.1.1": 25, "1.7.0": 20})]:
        linhas += [{"uf": uf, "ano": 2023, "codigo": c, "bruta": float(v)} for c, v in valores.items()]
    return pd.DataFrame(linhas)


def test_segmentos_sem_zeros_finais():
    assert segmentos("1.1.1.4.50.1.0") == ("1", "1", "1", "4", "50", "1")
    assert segmentos("1.3.1.0.01.0.0") == ("1", "3", "1", "0", "01")
    assert segmentos("7.0.0.0.00.0.0") == ("7",)


def test_valores_proprios_somam_o_topo_sem_dupla_contagem():
    df = valores_proprios(arvore(), "codigo", ["bruta"], ["uf", "ano"])
    for uf, topo in [("AA", 100), ("BB", 50)]:
        assert df[df["uf"] == uf]["bruta_proprio"].sum() == topo
    bb = df[df["uf"] == "BB"].set_index("codigo")["bruta_proprio"]
    assert bb["1.1.0"] == 5  # parte do pai que os filhos não detalham não some
    assert df[df["uf"] == "AA"].set_index("codigo")["bruta_proprio"]["1.0.0"] == 0


def test_valores_proprios_recusa_codigo_repetido():
    df = pd.concat([arvore(), arvore().iloc[[0]]])
    with pytest.raises(ValueError, match="repetido"):
        valores_proprios(df, "codigo", ["bruta"], ["uf", "ano"])


def test_mapear_por_prefixo_mais_longo_e_vigencia():
    dic = pd.DataFrame({"item": ["impostos", "imposto_x", "imposto_x_novo", "outras"],
                        "codigo": ["1.1", "1.1.1", "1.1.2", "1"],
                        "ano_inicio": [None, None, 2024, None], "ano_fim": [None, None, None, None]})
    df = mapear_por_prefixo(arvore().assign(ano=[2023] * 5 + [2024] * 4), "codigo", "ano", dic)
    itens = dict(zip(zip(df["uf"], df["codigo"]), df["item"]))
    assert itens[("AA", "1.1.1")] == "imposto_x" and itens[("AA", "1.1.2")] == "impostos"  # 2023: regra nova não vale
    assert itens[("AA", "1.7.0")] == "outras" and itens[("AA", "1.0.0")] == "outras"
    sem = mapear_por_prefixo(pd.DataFrame({"codigo": ["2.1.0"], "ano": [2023]}), "codigo", "ano", dic)
    assert sem["item"].isna().all()
