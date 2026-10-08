"""Testes da camada de publicação, com duas UFs fictícias (sem ler data/)."""

import json

import pandas as pd
import pytest

from publicacao import exportar

IPCA = pd.DataFrame({"ano": [2023, 2024], "variacao_pct": [10.0, 5.0], "indice_dez": [110.0, 115.5]})
POPULACAO = pd.DataFrame({"uf": ["AA", "AA", "BB", "BB"], "ano": [2023, 2024, 2023, 2024],
                          "populacao": [100, 100, 50, 40]})


def despesa():
    """Por UF e ano: total sem intra, total intra, funções 10 e 12, uma subfunção."""
    linhas = []
    for uf, ano, saude, educacao in [("AA", 2023, 30.0, 70.0), ("AA", 2024, 44.0, 66.0),
                                    ("BB", 2023, 10.0, 10.0), ("BB", 2024, 12.0, 28.0)]:
        comum = {"uf": uf, "ano": ano, "fonte_dado": "siconfi_dca", "extraido_em": "2026-01-01T00:00:00+00:00",
                 "empenhado": None, "pago": None}
        linhas += [
            {**comum, "nivel": "total", "intra": False, "funcao_cod": None, "subfuncao_cod": None,
             "liquidado": saude + educacao},
            {**comum, "nivel": "total", "intra": True, "funcao_cod": None, "subfuncao_cod": None, "liquidado": 5.0},
            {**comum, "nivel": "funcao", "intra": False, "funcao_cod": "10", "subfuncao_cod": None, "liquidado": saude},
            {**comum, "nivel": "funcao", "intra": False, "funcao_cod": "12", "subfuncao_cod": None,
             "liquidado": educacao},
            {**comum, "nivel": "subfuncao", "intra": False, "funcao_cod": "10", "subfuncao_cod": "302",
             "liquidado": saude},
        ]
    return pd.DataFrame(linhas)


def test_montar_despesa_colunas_populacao_e_ordem():
    df = exportar.montar_despesa(despesa(), POPULACAO)

    assert df.columns.tolist() == list(exportar.COLUNAS_DESPESA)
    assert df.loc[df["uf"] == "BB", "populacao"].tolist() == [50] * 5 + [40] * 5
    primeira = df.iloc[0]
    assert (primeira["uf"], primeira["ano"], primeira["nivel"], primeira["intra"]) == ("AA", 2023, "total", False)
    assert df["intra"].dtype == bool


def test_montar_despesa_nao_calcula_nada():
    df = exportar.montar_despesa(despesa(), POPULACAO)
    assert not any(c.endswith(("_real", "_per_capita", "_pct")) for c in df.columns)
    assert df["liquidado"].sum() == despesa()["liquidado"].sum()


def test_registros_nulos_viram_none_e_json_valido(tmp_path):
    reg = exportar.registros(exportar.montar_despesa(despesa(), POPULACAO))
    assert reg[0]["empenhado"] is None and reg[0]["funcao_cod"] is None
    assert isinstance(reg[0]["populacao"], int) and isinstance(reg[0]["ano"], int)

    caminho = exportar.gravar_json(reg, tmp_path / "despesa.json", compacto=True)
    assert json.loads(caminho.read_text(encoding="utf-8")) == reg


def test_gabarito_per_capita_real_e_pct():
    gab = exportar.montar_gabarito(despesa(), POPULACAO, IPCA, ano_base=2024)
    valores = {(v["funcao_cod"], v["uf"], v["ano"]): v for v in gab["valores"]}

    # AA 2023: 30 × 1,05 / 100; 30 de 100
    assert valores[("10", "AA", 2023)]["per_capita_real"] == pytest.approx(0.315)
    assert valores[("10", "AA", 2023)]["per_capita_nominal"] == pytest.approx(0.3)
    assert valores[("10", "AA", 2023)]["pct_despesa_total"] == pytest.approx(30.0)
    # BB 2024: 12 / 40 (já a preços de 2024); 12 de 40
    assert valores[("10", "BB", 2024)]["per_capita_real"] == pytest.approx(0.3)
    assert valores[("10", "BB", 2024)]["pct_despesa_total"] == pytest.approx(30.0)
    assert len(valores) == 8  # 2 funções × 2 UFs × 2 anos
    assert gab["parametros"]["intra"] is False and "teste" in gab["aviso"]


def test_gabarito_linha_sem_valor_no_estagio_conta_como_ausencia():
    d = despesa()
    alvo = (d["uf"] == "AA") & (d["ano"] == 2023) & (d["funcao_cod"] == "12")
    d.loc[alvo, "liquidado"] = None
    gab = exportar.montar_gabarito(d, POPULACAO, IPCA, ano_base=2024)
    linha = next(v for v in gab["valores"] if (v["funcao_cod"], v["uf"], v["ano"]) == ("12", "AA", 2023))
    assert linha["sem_gasto_declarado"] is True and linha["nominal"] == 0 and linha["n_ufs"] == 2


def test_gabarito_uf_sem_linha_entra_com_zero():
    d = despesa()
    d = d[~((d["uf"] == "BB") & (d["ano"] == 2024) & (d["funcao_cod"] == "12"))]
    gab = exportar.montar_gabarito(d, POPULACAO, IPCA, ano_base=2024)
    valores = {(v["funcao_cod"], v["uf"], v["ano"]): v for v in gab["valores"]}

    zero = valores[("12", "BB", 2024)]
    assert zero["sem_gasto_declarado"] is True
    assert zero["nominal"] == 0 and zero["per_capita_real"] == 0 and zero["pct_despesa_total"] == 0
    assert zero["posicao_per_capita_real"] == 2 and zero["n_ufs"] == 2
    assert valores[("12", "AA", 2024)]["sem_gasto_declarado"] is False
    mediana = next(m for m in gab["medianas"] if m["funcao_cod"] == "12" and m["ano"] == 2024)
    assert mediana["per_capita_real"] == pytest.approx(66.0 / 100 / 2)  # (0,66 + 0) / 2


def test_meta_descreve_ufs_anos_e_fontes():
    tabela = exportar.montar_despesa(despesa(), POPULACAO)
    meta = exportar.montar_meta(tabela, IPCA, 2024, "agora")

    assert meta["ufs"] == ["AA", "BB"] and meta["anos"] == [2023, 2024]
    assert meta["fontes"][0]["fonte_dado"] == "siconfi_dca"
    assert meta["linhas"]["despesa"] == 20
    assert {r["id"] for r in meta["ressalvas"]} >= {"municipios", "intra", "populacao"}
    assert meta["ressalvas_por_funcao"]["17"][0]["id"] == "saneamento_companhias"
    assert meta["atribuicoes"] == []
    json.dumps(meta, allow_nan=False)


def test_meta_leva_atribuicao_das_estatais_com_a_versao_usada():
    estatais = pd.DataFrame({"fonte": ["repo@abc:arq#ex2024", "repo@abc:arq#ex2023", "repo@abc:arq#ex2024"]})
    tabela = exportar.montar_despesa(despesa(), POPULACAO)
    meta = exportar.montar_meta(tabela, IPCA, 2024, "agora", exportar.montar_atribuicoes(estatais))

    [atribuicao] = meta["atribuicoes"]
    assert "Tesouro Nacional" in atribuicao["texto"]
    assert atribuicao["url"] == "https://github.com/tesouro/empresas-estados"
    assert atribuicao["versoes"] == ["repo@abc:arq#ex2023", "repo@abc:arq#ex2024"]


def test_estatais_json_por_edicao_uf_e_funcao_so_ativas_nao_dependentes():
    estatais = pd.DataFrame({
        "uf": ["AA", "AA", "BB", "BB", "AA", "BB"],
        "cnpj": ["1", "2", "3", "4", "1", "9"],
        "sigla": ["SAN", "OBRAS", "SANB", "BANCO", "SAN", "PRIV"],
        "empresa": ["Saneamento AA", "Obras AA", "Saneamento BB", "Banco BB", "Saneamento AA", "Privatizada BB"],
        "setor": ["SANEAMENTO", "HABITAÇÃO E URBANIZAÇÃO", "SANEAMENTO", "FINANCEIRO", "SANEAMENTO", "SANEAMENTO"],
        "dependente": ["false", "false", "true", "false", "false", "false"],
        "situacao": ["ATIVA"] * 6,
        "ano_referencia": ["2024", "2024", "2024", "2024", "2023", "2023"],
    })
    setor_funcao = pd.DataFrame({
        "setor": ["SANEAMENTO", "HABITAÇÃO E URBANIZAÇÃO", "FINANCEIRO"],
        "funcao_cod": ["17", "16", None], "correspondencia": ["direta", "parcial", "nenhuma"],
        "justificativa": ["", "", ""],
    })
    ajustes = pd.DataFrame({"cnpj": ["2"], "funcao_cod": ["15"], "justificativa": ["obras"]})

    saida = exportar.montar_estatais(estatais, setor_funcao, ajustes, anos=[2022, 2023, 2024, 2025])
    assert saida["edicoes"] == [2023, 2024]
    assert saida["edicao_por_ano"] == {"2022": 2023, "2023": 2023, "2024": 2024, "2025": 2024}
    assert "Tesouro Nacional" in saida["atribuicao"]
    exib = lambda sigla, nome: {"sigla_exibicao": sigla, "nome_exibicao": nome, "nome_manual": False}
    san = {"sigla": "SAN", "empresa": "Saneamento AA", "cnpj": "1", "setor": "SANEAMENTO", "correspondencia": "direta",
           **exib("SAN", "Saneamento AA")}
    assert saida["por_edicao"]["2024"] == {"AA": {
        "15": [{"sigla": "OBRAS", "empresa": "Obras AA", "cnpj": "2", "setor": "HABITAÇÃO E URBANIZAÇÃO",
                "correspondencia": "ajuste", **exib("OBRAS", "Obras AA")}],
        "17": [san],
    }}  # BB: saneamento dependente, banco sem função e a privatizada (só em 2023) ficam de fora
    assert saida["por_edicao"]["2023"]["BB"]["17"][0]["sigla"] == "PRIV"
    assert saida["por_edicao"]["2023"]["AA"] == {"17": [san]}
    assert saida["mudancas_dependencia"] == {}  # ninguém mudou de dependência entre as edições

    # SAN passa a dependente em 2024: vira mudança, e sai das estatais fora das contas de 2024
    mudou = estatais.assign(dependente=["true", "false", "true", "false", "false", "false"])
    saida = exportar.montar_estatais(mudou, setor_funcao, ajustes, anos=[2023, 2024])
    assert saida["mudancas_dependencia"] == {"AA": {"17": [{
        "ano": 2024, "ano_anterior": 2023, "sentido": "passou_a_dependente",
        "sigla": "SAN", "empresa": "Saneamento AA", "cnpj": "1", **exib("SAN", "Saneamento AA")}]}}
    assert "17" not in saida["por_edicao"]["2024"].get("AA", {})
    json.dumps(saida, allow_nan=False)

    with pytest.raises(ValueError, match="true/false"):
        exportar.montar_estatais(estatais.assign(dependente="sim"), setor_funcao, ajustes, anos=[2024])

    # Correção manual de exibição: vale sobre tudo, e o nome original continua em "empresa"
    correcoes = pd.DataFrame({"cnpj": ["1"], "sigla_exibicao": ["San"], "nome_exibicao": ["Saneamento de AA"]})
    saida = exportar.montar_estatais(estatais, setor_funcao, ajustes, [2024], correcoes)
    linha = saida["por_edicao"]["2024"]["AA"]["17"][0]
    assert linha["empresa"] == "Saneamento AA"
    assert (linha["sigla_exibicao"], linha["nome_exibicao"], linha["nome_manual"]) == ("San", "Saneamento de AA", True)
