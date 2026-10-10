"""Testes da dívida (RGF Anexo 02, DCA I-D e conferência), com respostas reais em tests/fixtures/ (sem rede)."""

import json
from pathlib import Path

import httpx
import pandas as pd
import pytest

from extractors import base
from extractors.nacional.siconfi import cliente, conferencia_divida, dca, rgf

FIXTURES = Path(__file__).parent / "fixtures"


def ler(nome):
    with open(FIXTURES / nome, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def rgf_resposta():
    return ler("rgf_anexo_02.json")


@pytest.fixture
def i_d_resposta():
    return ler("dca_anexo_i_d.json")


def ente_de(resposta):
    item = resposta["items"][0]
    return item["uf"], str(item["cod_ibge"]), int(item["exercicio"])


def sem_rede():
    return httpx.Client(transport=httpx.MockTransport(lambda r: pytest.fail("chamou a API")))


def no_cache(tmp_path, endpoint, params, resposta):
    arquivo = cliente.caminho_cache(endpoint, params, tmp_path / "raw")
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    arquivo.write_text(json.dumps({"extraido_em": "teste", "endpoint": endpoint, "params": params,
                                   "paginas": [resposta]}), encoding="utf-8")


# --- RGF Anexo 02 ----------------------------------------------------------------------------

def test_rgf_parametros_incluem_poder_executivo():
    p = rgf.params_anexo_02("33", 2024)
    assert p["co_poder"] == "E" and p["in_periodicidade"] == "Q" and p["nr_periodo"] == 3
    assert p["co_tipo_demonstrativo"] == "RGF" and p["co_esfera"] == "E"


def test_rgf_transforma_e_valida_resposta_real(rgf_resposta):
    uf, cod, ano = ente_de(rgf_resposta)
    df = rgf.transformar_anexo_02(rgf_resposta["items"], uf, cod, ano)
    assert len(df) == len(rgf_resposta["items"])
    assert (df["demonstrativo"] == "RGF").all() and (df["periodo"] == 3).all()
    rgf.validar_anexo_02(df)  # não levanta


def test_rgf_recusa_dcl_que_nao_fecha(rgf_resposta):
    uf, cod, ano = ente_de(rgf_resposta)
    df = rgf.transformar_anexo_02(rgf_resposta["items"], uf, cod, ano)
    alvo = (df["cod_conta"] == rgf.DCL) & (df["coluna"] == rgf.COLUNA_ESTOQUE)
    df.loc[alvo, "valor"] += 1000
    with pytest.raises(base.ErroValidacao, match="DC − deduções"):
        rgf.validar_anexo_02(df)


def test_rgf_recusa_subcontas_que_nao_somam(rgf_resposta):
    uf, cod, ano = ente_de(rgf_resposta)
    df = rgf.transformar_anexo_02(rgf_resposta["items"], uf, cod, ano)
    alvo = (df["cod_conta"] == "RGF2EmprestimosExternos") & (df["coluna"] == rgf.COLUNA_ESTOQUE)
    df.loc[alvo, "valor"] += 1000
    with pytest.raises(base.ErroValidacao, match="RGF2Emprestimos"):
        rgf.validar_anexo_02(df)


def anexo_antigo(**ajustes):
    """RGF Anexo 02 no layout de 2015–2016 (contratual = interna + externa), só a coluna do estoque."""
    valores = {"DividaConsolidada": 100.0, "DividaMobiliaria": 0.0, "DividaContratual": 90.0,
               "DividaContratualInterna": 70.0, "DividaContratualExterna": 20.0, "OutrasDividas": 10.0,
               "DeducoesDaDividaConsolidada": 30.0, "DividaConsolidadaLiquida": 70.0, **ajustes}
    return pd.DataFrame([{"cod_conta": c, "coluna": rgf.COLUNA_ESTOQUE, "valor": v} for c, v in valores.items()])


def test_rgf_layout_antigo_confere_pela_hierarquia_daquele_layout():
    assert rgf.layout_antigo(anexo_antigo()["cod_conta"])
    rgf.validar_anexo_02(anexo_antigo())  # sem empréstimos/financiamentos, que não existem nesse layout
    with pytest.raises(base.ErroValidacao, match="DividaContratual"):
        rgf.validar_anexo_02(anexo_antigo(DividaContratualExterna=25.0))


def test_rgf_aceita_dcl_zero_quando_deducoes_passam_da_dc():
    # AP 2017: DC − deduções negativa, DCL declarada como zero
    rgf.validar_anexo_02(anexo_antigo(DeducoesDaDividaConsolidada=150.0, DividaConsolidadaLiquida=0.0))
    with pytest.raises(base.ErroValidacao, match="DC − deduções"):
        rgf.validar_anexo_02(anexo_antigo(DeducoesDaDividaConsolidada=150.0, DividaConsolidadaLiquida=10.0))


def test_rgf_linhas_fora_da_dc_nao_entram_na_conferencia(rgf_resposta):
    uf, cod, ano = ente_de(rgf_resposta)
    df = rgf.transformar_anexo_02(rgf_resposta["items"], uf, cod, ano)
    extra = df[df["cod_conta"] == rgf.DC].assign(cod_conta="DividaContratualDePPP", conta="Dívida Contratual de PPP")
    df = pd.concat([df, extra])
    rgf.validar_anexo_02(df)  # PPP fora da DC (como no RO) não quebra a soma das subcontas


def test_rgf_extrair_le_do_cache_e_grava(tmp_path, rgf_resposta):
    uf, cod, ano = ente_de(rgf_resposta)
    no_cache(tmp_path, "rgf", rgf.params_anexo_02(cod, ano), rgf_resposta)
    df = rgf.extrair_anexo_02(uf, ano, dir_raw=tmp_path / "raw", dir_processed=tmp_path / "processed", http=sem_rede())
    gravado = tmp_path / "processed" / "demonstrativo" / f"uf={uf}" / f"ano={ano}" / f"{rgf.FONTE_DADO}_anexo_02_q3.parquet"
    assert gravado.exists() and len(pd.read_parquet(gravado)) == len(df)
    assert (df["extraido_em"] == "teste").all()


def test_rgf_vazio_vira_consulta_vazia(tmp_path):
    vazio = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={"items": [], "hasMore": False})),
                         base_url="http://teste")
    with pytest.raises(base.ConsultaVazia, match="poder Executivo"):
        rgf.extrair_anexo_02("RJ", 2024, dir_raw=tmp_path / "raw", dir_processed=tmp_path / "p", http=vazio)


# --- DCA Anexo I-D ---------------------------------------------------------------------------

def test_i_d_transforma_e_valida_resposta_real(i_d_resposta):
    uf, cod, ano = ente_de(i_d_resposta)
    df = dca.transformar_natureza(i_d_resposta["items"], uf, cod, ano)
    assert df["periodo"].isna().all() and (df["demonstrativo"] == "DCA").all()
    dca.validar_natureza(df)
    liq = df[df["coluna"] == "Despesas Liquidadas"]
    assert dca.soma_modalidades(liq, "3.2") > 0 and dca.soma_modalidades(liq, "4.6") > 0


def test_i_d_grupo_inclui_intra_e_o_valor_exceto_intra_sao_as_modalidades_do():
    linhas = pd.DataFrame({"cod_conta": [dca.GRUPO_AMORTIZACAO, "DO4.6.90.00.00.00", "DO4.6.20.00.00.00",
                                         "DI4.6.91.00.00.00", "DO4.6.90.71.00.00"],
                           "valor": [110.0, 80.0, 20.0, 10.0, 80.0], "coluna": ["Despesas Liquidadas"] * 5})
    assert dca.soma_modalidades(linhas, "4.6") == 100.0  # exceto intra; o elemento 4.6.90.71 não conta 2x
    assert dca.soma_modalidades(linhas, "4.6", prefixos=("O", "I")) == 110.0
    dca.validar_natureza(linhas)  # grupo (110) = DO (100) + DI (10)


def test_i_d_recusa_grupo_que_nao_soma_as_modalidades(i_d_resposta):
    uf, cod, ano = ente_de(i_d_resposta)
    df = dca.transformar_natureza(i_d_resposta["items"], uf, cod, ano)
    df.loc[df["cod_conta"] == dca.GRUPO_JUROS, "valor"] += 1000
    with pytest.raises(base.ErroValidacao):
        dca.validar_natureza(df)


def test_i_d_extrair_le_do_cache_e_grava(tmp_path, i_d_resposta):
    uf, cod, ano = ente_de(i_d_resposta)
    no_cache(tmp_path, "dca", {"an_exercicio": ano, "no_anexo": dca.ANEXO_I_D, "id_ente": cod}, i_d_resposta)
    df = dca.extrair_natureza(uf, ano, dir_raw=tmp_path / "raw", dir_processed=tmp_path / "processed", http=sem_rede())
    gravado = tmp_path / "processed" / "demonstrativo" / f"uf={uf}" / f"ano={ano}" / f"{dca.NOME_ARQUIVO_I_D}.parquet"
    assert gravado.exists() and len(df) == len(i_d_resposta["items"])


# --- conferência (só aviso) --------------------------------------------------------------------

def test_conferencia_pago_pela_natureza_e_pelo_rreo(i_d_resposta):
    natureza = conferencia_divida.pago_natureza(i_d_resposta["items"])
    liq = pd.DataFrame(i_d_resposta["items"]).query("coluna == 'Despesas Liquidadas'")
    assert natureza == pytest.approx(dca.soma_modalidades(liq, "3.2") + dca.soma_modalidades(liq, "4.6"))
    rreo = [
        {"cod_conta": "JurosEEncargosDaDivida", "coluna": "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)", "valor": 10.0},
        {"cod_conta": "AmortizacaoDaDivida", "coluna": "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)", "valor": 5.0},
        {"cod_conta": "AmortizacaoDaDividaIntra", "coluna": "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)", "valor": 99.0},
        {"cod_conta": "JurosEEncargosDaDivida", "coluna": "DOTAÇÃO INICIAL", "valor": 77.0},
    ]
    assert conferencia_divida.pago_rreo(rreo) == 15.0
    assert conferencia_divida.pago_rreo([]) is None


def test_conferencia_so_avisa_diferencas():
    assert conferencia_divida.comparar(100.0, {"a": 100.4, "b": None}) == []
    avisos = conferencia_divida.comparar(100.0, {"subfunções": 70.0})
    assert len(avisos) == 1 and "-30.0%" in avisos[0]


# --- publicação: divida.json ------------------------------------------------------------------

def test_montar_divida_campos_composicao_e_pagamento(rgf_resposta):
    from publicacao import divida

    uf, cod, ano = ente_de(rgf_resposta)
    rgf_df = rgf.transformar_anexo_02(rgf_resposta["items"], uf, cod, ano)
    i_d = pd.DataFrame([
        {"uf": uf, "ano": ano, "coluna": "Despesas Liquidadas", "cod_conta": "DO3.2.00.00.00.00", "valor": 31.0},
        {"uf": uf, "ano": ano, "coluna": "Despesas Liquidadas", "cod_conta": "DO3.2.90.00.00.00", "valor": 30.0},
        {"uf": uf, "ano": ano, "coluna": "Despesas Liquidadas", "cod_conta": "DI3.2.91.00.00.00", "valor": 1.0},
        {"uf": uf, "ano": ano, "coluna": "Despesas Pagas", "cod_conta": "DO3.2.90.00.00.00", "valor": 29.0},
    ])
    [linha] = divida.montar_divida(rgf_df, i_d)
    estoque = rgf_df[rgf_df["coluna"] == divida.COLUNA_ESTOQUE].set_index("cod_conta")["valor"]
    assert linha["dcl"] == estoque["DividaConsolidadaLiquida"]
    assert linha["dcl_rcl_pct"] == estoque["PercentualDaDCLSobreARCL"]  # linha oficial, não recalculada
    assert sum(linha["composicao"].values()) == pytest.approx(linha["dc"])
    assert linha["limite_pct"] == pytest.approx(200, abs=0.01) and linha["alerta_pct"] == pytest.approx(180, abs=0.01)
    assert linha["juros"] == 30.0  # exceto intra: sem a modalidade 91
    assert linha["amortizacao"] == 0.0  # grupo ausente na I-D = nada pago

    [sem_i_d] = divida.montar_divida(rgf_df, i_d.iloc[0:0])
    assert sem_i_d["juros"] is None and sem_i_d["amortizacao"] is None


def test_montar_divida_layout_antigo_sem_composicao():
    from publicacao import divida

    rgf_df = anexo_antigo().assign(uf="AA", ano=2015)
    [linha] = divida.montar_divida(rgf_df, rgf_df.iloc[0:0])
    assert linha["composicao"] is None  # não comparável com 2017 em diante
    assert linha["limite"] is None and linha["alerta"] is None and linha["limite_pct"] is None
    assert linha["dc"] == 100.0 and linha["deducoes"] == 30.0 and linha["dcl"] == 70.0


def test_montar_divida_recusa_composicao_que_nao_soma_a_dc(rgf_resposta):
    from publicacao import divida

    uf, cod, ano = ente_de(rgf_resposta)
    rgf_df = rgf.transformar_anexo_02(rgf_resposta["items"], uf, cod, ano)
    rgf_df.loc[(rgf_df["cod_conta"] == "OutrasDividas") & (rgf_df["coluna"] == divida.COLUNA_ESTOQUE), "valor"] += 1e6
    with pytest.raises(ValueError, match="composição"):
        divida.montar_divida(rgf_df, rgf_df.iloc[0:0])
