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
    assert saida["edicao_por_ano"] == {"2022": None, "2023": 2023, "2024": 2024, "2025": 2024}
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
    # Lista completa: inclui dependentes e sem função; painel da edição (pasta vAAAA = exercício AAAA-1)
    assert [e["sigla"] for e in saida["lista_por_edicao"]["2024"]["BB"]] == ["BANCO", "SANB"]
    banco = saida["lista_por_edicao"]["2024"]["BB"][0]
    assert banco["funcao_cod"] is None and banco["dependente"] is False and banco["situacao"] == "ATIVA"
    assert saida["paineis"] == {"2023": "https://tesouro.github.io/empresas-estados/v2024/",
                                "2024": "https://tesouro.github.io/empresas-estados/v2025/"}

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


def test_gabarito_totais_por_uf_e_variacao():
    gab = exportar.montar_gabarito(despesa(), POPULACAO, IPCA, 2024)
    totais = {(t["uf"], t["ano"]): t for t in gab["totais"]}
    assert len(totais) == 4
    for (uf, ano), t in totais.items():
        soma = sum(l["liquidado"] for l in despesa().to_dict(orient="records")
                   if l["uf"] == uf and l["ano"] == ano and l["nivel"] == "funcao" and not l["intra"])
        assert t["total_nominal"] == pytest.approx(soma)
        assert t["per_capita_nominal"] == pytest.approx(soma / POPULACAO.set_index(["uf", "ano"]).loc[(uf, ano), "populacao"])
    primeiro, segundo = totais[("AA", 2023)], totais[("AA", 2024)]
    assert primeiro["var_real_pct"] is None
    assert segundo["var_nominal_pct"] == pytest.approx((segundo["total_nominal"] / primeiro["total_nominal"] - 1) * 100)
    assert segundo["var_real_pct"] == pytest.approx((segundo["total_real"] / primeiro["total_real"] - 1) * 100)


def registros_divida():
    """Dívida de duas UFs em dois anos (formato de publicacao.divida.montar_divida)."""
    def linha(uf, ano, pct, juros, amort):
        return {"uf": uf, "ano": ano, "dc": 100.0, "deducoes": 20.0, "dcl": 80.0, "rcl": 50.0, "rcl_ajustada": 50.0,
                "dcl_rcl_pct": pct, "limite": 100.0, "alerta": 90.0, "limite_pct": 200.0, "alerta_pct": 180.0,
                "composicao": {"reestruturacao": 100.0}, "juros": juros, "amortizacao": amort}
    return [linha("AA", 2023, 150.0, 10.0, 5.0), linha("BB", 2023, 30.0, 1.0, 1.0),
            linha("AA", 2024, 140.0, 20.0, 10.0), linha("BB", 2024, 160.0, None, None)]


def test_gabarito_divida_posicao_mediana_e_valores_reais():
    gab = exportar.montar_gabarito(despesa(), POPULACAO, IPCA, 2024, registros_divida())
    valores = {(v["uf"], v["ano"]): v for v in gab["divida"]}
    aa23 = valores[("AA", 2023)]
    assert aa23["posicao_dcl_rcl"] == 1 and aa23["n_ufs"] == 2
    assert aa23["pago_real"] == pytest.approx(15 * 1.05)  # IPCA 2024 = 5%
    assert aa23["juros_real"] == pytest.approx(10.5)
    assert valores[("BB", 2024)]["pago_real"] is None  # sem DCA I-D: nulo, não zero
    assert valores[("BB", 2024)]["posicao_dcl_rcl"] == 1
    medianas = {m["ano"]: m["dcl_rcl_pct"] for m in gab["medianas_divida"]}
    assert medianas == {2023: 90.0, 2024: 150.0}


def test_divida_json_tem_campos_ressalvas_e_nota():
    saida = exportar.montar_divida_json(registros_divida(), "2026-10-08T00:00:00+00:00")
    assert len(saida["linhas"]) == 4 and saida["linhas"][3]["juros"] is None
    assert {r["id"] for r in saida["ressalvas"]} == {"pagar_pouco", "suspensao_2020", "passivo_atuarial"}
    assert "não por credor" in saida["nota_composicao"]
    assert "dcl_rcl_pct" in saida["campos"]
    json.dumps(saida, allow_nan=False)


def test_gabarito_receita_pesos_posicoes_e_medianas():
    totais = pd.DataFrame({"uf": ["AA", "BB", "AA", "BB"], "ano": [2023, 2023, 2024, 2024],
                           "liquida_exceto_intra": [100.0, 50.0, 110.0, 40.0],
                           "impostos_proprios": [60.0, 10.0, 66.0, 10.0], "transferencias_uniao": [30.0, 35.0, 33.0, 25.0]})
    gab = exportar.montar_gabarito(despesa(), POPULACAO, IPCA, 2024, receita_totais=totais)
    v = {(r["uf"], r["ano"]): r for r in gab["receita"]}
    assert v[("AA", 2023)]["pct_impostos_proprios"] == pytest.approx(60.0)
    assert v[("BB", 2023)]["pct_transferencias_uniao"] == pytest.approx(70.0)
    assert v[("AA", 2023)]["receita_liquida_real"] == pytest.approx(105.0)
    assert v[("AA", 2023)]["per_capita_real"] == pytest.approx(1.05)
    assert v[("AA", 2023)]["posicao_pct_impostos"] == 1 and v[("BB", 2024)]["posicao_per_capita_real"] == 2
    med = {m["ano"]: m for m in gab["medianas_receita"]}
    assert med[2023]["pct_impostos_proprios"] == pytest.approx((60 + 20) / 2)


def test_config_ufs_ressalvas_e_marcacao_de_petroleo(tmp_path):
    ufs = pd.DataFrame({"uf": ["AA", "BB"]})
    (tmp_path / "aa.yaml").write_text(
        "uf: AA\npublicacao:\n  receita:\n    petroleo_nao_separado: true\n    ressalvas:\n"
        "      - id: r1\n        anos: [2022]\n        titulo: T\n        texto: X\n", encoding="utf-8")
    (tmp_path / "bb.yaml").write_text("uf: BB\nfontes: {}\n", encoding="utf-8")
    ressalvas, nao_separa = exportar.ler_config_ufs(ufs, tmp_path)
    assert ressalvas == {"AA": [{"id": "r1", "anos": [2022], "titulo": "T", "texto": "X"}]} and nao_separa == {"AA": None}
    (tmp_path / "bb.yaml").write_text("uf: BB\npublicacao:\n  receita:\n    petroleo_nao_separado: true\n"
                                      "    petroleo_nao_separado_desde: 2018\n", encoding="utf-8")
    assert exportar.ler_config_ufs(ufs, tmp_path)[1] == {"AA": None, "BB": 2018}
    (tmp_path / "zz.yaml").write_text("uf: ZZ\n", encoding="utf-8")
    with pytest.raises(ValueError, match="ZZ"):
        exportar.ler_config_ufs(ufs, tmp_path)


def test_config_ufs_real_tem_as_ressalvas_da_receita():
    ressalvas, nao_separa = exportar.ler_config_ufs(pd.read_csv(exportar.RAIZ / "dicionarios" / "nacional" / "ufs.csv", dtype=str))
    assert set(nao_separa) >= {"RJ", "DF"} and nao_separa["RJ"] == 2018
    assert any(r.get("anos") == [2022] for r in ressalvas.get("MG", []))
    assert any("hipótese não verificada" in r["titulo"] for r in ressalvas.get("PR", []))
    cedae = next(r for r in ressalvas["RJ"] if r["id"] == "outorga_cedae")
    assert cedae["anos"] == [2021, 2022, 2023, 2024, 2025] and "IstoÉ Dinheiro, 16/06/2021" in cedae["texto"]


def test_receita_json_itens_ressalvas_e_ressalva_do_rj():
    linhas = pd.DataFrame({"uf": ["AA"], "ano": [2024], "item": ["icms"], "bruta": [10.0], "ded_transferencias": [2.5],
                           "ded_fundeb": [1.5], "ded_outras": [0.0], "liquida": [6.0]})
    totais = pd.DataFrame({"uf": ["AA"], "ano": [2024], "liquida_exceto_intra": [6.0], "impostos_proprios": [6.0],
                           "transferencias_uniao": [0.0]})
    ressalvas = {"AA": [{"id": "x", "titulo": "t", "texto": "y", "anos": [2022]}]}
    saida = exportar.montar_receita_json(linhas, totais, "agora", ressalvas, ufs_nao_separa={"AA": 2018, "BB": None}, ultimo_ano_pe=2024)
    assert {r["id"] for r in saida["ressalvas"]} == {"recodificacao_2018", "recodificacao_2022", "icms_2022", "fundeb", "compensacoes",
                                                     "operacoes_credito"}
    assert saida["ressalvas_por_uf"]["AA"][0]["anos"] == [2022]
    assert saida["petroleo"]["ufs_nao_separa_na_dca"] == ["AA", "BB"]
    assert saida["petroleo"]["nao_separa_desde"] == {"AA": 2018} and saida["petroleo"]["ultimo_ano_participacao_especial"] == 2024
    assert "petroleo_gas" in saida["comparar_pela_bruta"] and "petroleo_concessao" in saida["comparar_pela_bruta"]
    assert [i["item"] for i in saida["itens"]][:2] == ["icms", "icms_fecp"]
    json.dumps(saida, allow_nan=False)


def test_site_uf_padrao_validada_e_no_meta(tmp_path):
    ufs = pd.DataFrame({"uf": ["AA", "BB"]})
    caminho = tmp_path / "site.yaml"
    caminho.write_text("uf_padrao: bb\n", encoding="utf-8")
    site = exportar.ler_site(ufs, caminho)
    assert site == {"uf_padrao": "BB", "exemplo_metodo": None}
    meta = exportar.montar_meta(exportar.montar_despesa(despesa(), POPULACAO), IPCA, 2024, "agora", site=site)
    assert meta["uf_padrao"] == "BB"
    caminho.write_text("uf_padrao: ZZ\n", encoding="utf-8")
    with pytest.raises(ValueError, match="uf_padrao"):
        exportar.ler_site(ufs, caminho)
    caminho.write_text("# sem padrão\n", encoding="utf-8")
    assert exportar.ler_site(ufs, caminho) == {"uf_padrao": None, "exemplo_metodo": None}
    caminho.write_text("exemplo_metodo:\n  uf: aa\n  funcao: 10\n", encoding="utf-8")
    assert exportar.ler_site(ufs, caminho)["exemplo_metodo"] == {"uf": "AA", "funcao_cod": "10"}
    caminho.write_text("exemplo_metodo:\n  uf: ZZ\n  funcao: '10'\n", encoding="utf-8")
    with pytest.raises(ValueError, match="exemplo_metodo"):
        exportar.ler_site(ufs, caminho)


def test_documentacao_fontes_com_data_da_ultima_extracao():
    despesa_ = pd.DataFrame({"extraido_em": ["2026-01-02T00:00:00+00:00", "2026-01-05T00:00:00+00:00"]})
    demonstrativo = pd.DataFrame({"demonstrativo": ["DCA", "RGF", "RREO", "RGF"],
                                  "extraido_em": ["2026-01-03T00:00:00+00:00", "2026-01-04T00:00:00+00:00",
                                                  "2026-01-01T00:00:00+00:00", "2026-01-09T00:00:00+00:00"]})
    anp = pd.DataFrame({"extraido_em": ["2026-02-01T00:00:00+00:00"]})
    ipca_fonte = {"pagina": "https://sidra", "documentacao_api": "d", "consulta": "c", "consultado_em": "2026-03-01"}
    doc = exportar.montar_documentacao(despesa_, demonstrativo, anp, "https://api", ipca_fonte, {"uf": "AA", "funcao_cod": "10"})
    f = doc["fontes"]
    assert f["siconfi"]["extraido_em"] == "2026-01-09T00:00:00+00:00" and f["siconfi"]["api"] == "https://api"
    partes = {p["sigla"]: p["extraido_em"] for p in f["siconfi"]["partes"]}
    assert partes == {"DCA": "2026-01-05T00:00:00+00:00", "RGF": "2026-01-09T00:00:00+00:00", "RREO": "2026-01-01T00:00:00+00:00"}
    assert f["anp"]["extraido_em"] == "2026-02-01T00:00:00+00:00" and f["ibge_ipca"]["extraido_em"] == "2026-03-01"
    assert f["tesouro_estatais"]["commit"] and f["tesouro_estatais"]["versao_de"]
    assert all(x["pagina_oficial"].startswith("https://") for x in f.values())
    assert doc["exemplo"] == {"uf": "AA", "funcao_cod": "10", "endpoint": "dca", "anexo": "DCA-Anexo I-E",
                              "coluna": "Despesas Liquidadas"}


def test_divisao_por_uf_geral_com_funcoes_e_arquivo_por_uf_com_subfuncoes():
    tabela = pd.DataFrame({
        "uf": ["AA", "AA", "AA", "BB", "BB"], "ano": [2024] * 5,
        "nivel": ["total", "funcao", "subfuncao", "funcao", "demais"], "valor": [10.0, 10.0, 6.0, 5.0, 5.0],
    })
    receita = {"fonte": "x", "totais": [{"uf": "AA"}], "linhas": [{"uf": "AA", "item": "icms"}, {"uf": "BB", "item": "ipva"}]}
    arquivos = exportar.dividir_por_uf(tabela, receita)
    assert set(arquivos) == {"despesa_funcoes.json", "receita.json", "despesa/AA.json", "despesa/BB.json",
                             "receita/AA.json", "receita/BB.json"}
    assert {l["nivel"] for l in arquivos["despesa_funcoes.json"]} == {"total", "funcao"}
    assert [l["nivel"] for l in arquivos["despesa/AA.json"]] == ["subfuncao"]
    assert [l["nivel"] for l in arquivos["despesa/BB.json"]] == ["demais"]
    assert "linhas" not in arquivos["receita.json"] and arquivos["receita.json"]["totais"] == [{"uf": "AA"}]
    assert arquivos["receita/BB.json"] == [{"uf": "BB", "item": "ipva"}]
    # nada se perde nem se repete na divisão
    juntas = arquivos["despesa_funcoes.json"] + arquivos["despesa/AA.json"] + arquivos["despesa/BB.json"]
    assert len(juntas) == len(tabela)


def test_divisao_das_estatais_lista_por_uf():
    estatais = {"edicoes": [2023, 2024], "por_edicao": {"2024": {}},
                "lista_por_edicao": {"2023": {"AA": [{"sigla": "X"}]}, "2024": {"AA": [], "BB": [{"sigla": "Y"}]}}}
    arquivos = exportar.dividir_estatais(estatais)
    assert "lista_por_edicao" not in arquivos["estatais.json"] and arquivos["estatais.json"]["por_edicao"] == {"2024": {}}
    assert arquivos["estatais/AA.json"] == {"2023": [{"sigla": "X"}], "2024": []}
    assert arquivos["estatais/BB.json"] == {"2023": [], "2024": [{"sigla": "Y"}]}
