"""Testes da receita: extractor da DCA I-C (fixture real de PE 2024) e montagem por item (UFs fictícias)."""

import json
from pathlib import Path

import pandas as pd
import pytest

from extractors import base
from extractors.nacional.siconfi import dca, lote_receita
from publicacao import receita

FIXTURE = Path(__file__).parent / "fixtures" / "dca_anexo_i_c.json"
RAIZ = Path(__file__).resolve().parents[1]


@pytest.fixture
def i_c():
    with open(FIXTURE, encoding="utf-8") as f:
        itens = json.load(f)["items"]
    item = itens[0]
    return dca.transformar_natureza(itens, item["uf"], str(item["cod_ibge"]), int(item["exercicio"]))


def test_i_c_resposta_real_valida(i_c):
    dca.validar_receita(i_c)
    assert (i_c["demonstrativo"] == "DCA").all() and i_c["periodo"].isna().all()


def test_i_c_intra_pela_categoria_mesmo_com_prefixo_ro(i_c):
    # Em 2019 vários estados entregam as categorias 7 e 8 com prefixo "RO": continua sendo intra
    trocado = i_c.assign(cod_conta=i_c["cod_conta"].str.replace(r"^RI", "RO", regex=True))
    dca.validar_receita(trocado)
    assert dca.e_intra("RO7.2.0.0.00.0.0") and not dca.e_intra("RO1.7.0.0.00.0.0")


def test_i_c_recusa_total_que_nao_fecha(i_c):
    alvo = (i_c["cod_conta"] == dca.TOTAL_EXCETO_INTRA) & (i_c["coluna"] == "Receitas Brutas Realizadas")
    i_c.loc[alvo, "valor"] += 1000
    with pytest.raises(base.ErroValidacao, match="exceto intra"):
        dca.validar_receita(i_c)


def test_lote_compara_liquida_com_o_rreo():
    itens = [{"cod_conta": dca.TOTAL_EXCETO_INTRA, "coluna": c, "valor": v} for c, v in
             [("Receitas Brutas Realizadas", 100.0), ("Deduções - FUNDEB", 20.0), ("Outras Deduções da Receita", 5.0)]]
    assert lote_receita.liquida_exceto_intra_i_c(itens) == 75.0
    rreo = [{"cod_conta": "ReceitasExcetoIntraOrcamentarias", "coluna": "Até o Bimestre (c)", "valor": 75.0},
            {"cod_conta": "ReceitasExcetoIntraOrcamentarias", "coluna": "PREVISÃO INICIAL", "valor": 90.0}]
    assert lote_receita.receita_exceto_intra_rreo(rreo) == 75.0
    assert lote_receita.receita_exceto_intra_rreo([]) is None


# --- montagem por item ------------------------------------------------------------------------

DICIONARIO = pd.DataFrame({
    "item": ["icms", "icms", "outros_impostos_taxas", "fpe", "outras_transferencias_uniao", "outras_transferencias",
             "outras_receitas_correntes", "outras_receitas_capital", "intraorcamentarias"],
    "codigo": ["1.1.1.8.02.1", "1.1.1.4.50.1", "1.1", "1.7.1.1.50", "1.7.1", "1.7", "1", "2", "7"],
    "ano_inicio": [2021, 2022, None, 2022, None, None, None, None, None],
    "ano_fim": [2021, None, None, None, None, None, None, None, None],
})


def ic_ficticia():
    """AA e BB em 2021 (códigos antigos) e 2022 (novos): ICMS, uma taxa, FPE, outra transferência, intra."""
    def bloco(uf, ano, icms, fundeb):
        cod_icms = "1.1.1.8.02.1.0" if ano == 2021 else "1.1.1.4.50.1.0"
        bruta = {"1.0.0.0.00.0.0": icms + 10 + 50 + 7, "1.1.0.0.00.0.0": icms + 10, cod_icms: icms,
                 "1.1.2.0.00.0.0": 10, "1.7.0.0.00.0.0": 57, "1.7.1.0.00.0.0": 50, "1.7.1.1.50.0.0": 40,
                 "1.7.2.0.00.0.0": 7, "7.0.0.0.00.0.0": 3}
        linhas = [{"uf": uf, "ano": ano, "cod_conta": ("RI" if c.startswith("7") else "RO") + c,
                   "coluna": "Receitas Brutas Realizadas", "valor": float(v)} for c, v in bruta.items()]
        linhas += [{"uf": uf, "ano": ano, "cod_conta": "RO" + cod, "coluna": "Deduções - FUNDEB", "valor": fundeb}
                   for cod in ("1.0.0.0.00.0.0", "1.1.0.0.00.0.0", cod_icms)]
        total = icms + 10 + 50 + 7
        for cod, b, f in [("ReceitasExcetoIntraOrcamentarias", total, fundeb), ("ReceitasIntraOrcamentarias", 3, 0),
                          ("TotalReceitas", total + 3, fundeb)]:
            linhas += [{"uf": uf, "ano": ano, "cod_conta": cod, "coluna": "Receitas Brutas Realizadas", "valor": float(b)},
                       {"uf": uf, "ano": ano, "cod_conta": cod, "coluna": "Deduções - FUNDEB", "valor": float(f)}]
        return linhas
    return pd.DataFrame(bloco("AA", 2021, 100, 20.0) + bloco("AA", 2022, 120, 24.0) + bloco("BB", 2022, 30, 6.0))


def test_itens_somam_o_total_e_nada_some():
    linhas, totais = receita.montar_receita(ic_ficticia(), DICIONARIO)
    aa22 = linhas[(linhas["uf"] == "AA") & (linhas["ano"] == 2022)].set_index("item")
    assert aa22.loc["icms", "bruta"] == 120 and aa22.loc["icms", "ded_fundeb"] == 24 and aa22.loc["icms", "liquida"] == 96
    assert aa22.loc["outros_impostos_taxas", "bruta"] == 10  # a taxa, sem código próprio, cai em "outros"
    assert aa22.loc["fpe", "bruta"] == 40 and aa22.loc["outras_transferencias_uniao", "bruta"] == 10
    assert aa22.loc["outras_transferencias", "bruta"] == 7 and aa22.loc["intraorcamentarias", "bruta"] == 3
    assert aa22["bruta"].sum() == 120 + 10 + 50 + 7 + 3
    aa21 = linhas[(linhas["uf"] == "AA") & (linhas["ano"] == 2021)].set_index("item")
    assert aa21.loc["icms", "bruta"] == 100  # código antigo no item certo
    assert "fpe" not in aa21.index  # regra do FPE só vale de 2022 em diante (no teste): cai em outras da União
    t = totais.set_index(["uf", "ano"])
    assert t.loc[("AA", 2022), "liquida_exceto_intra"] == 120 + 10 + 50 + 7 - 24
    assert t.loc[("AA", 2022), "impostos_proprios"] == 120 + 10 - 24
    assert t.loc[("AA", 2022), "transferencias_uniao"] == 50


def test_codigo_sem_item_e_erro():
    sem_capital = DICIONARIO[DICIONARIO["item"] != "outras_receitas_correntes"]
    with pytest.raises(ValueError, match="sem item"):
        receita.montar_receita(ic_ficticia(), sem_capital)


def test_soma_que_nao_bate_com_o_total_e_erro():
    ic = ic_ficticia()
    ic.loc[(ic["cod_conta"] == "TotalReceitas") & (ic["coluna"] == "Receitas Brutas Realizadas"), "valor"] += 50
    with pytest.raises(ValueError, match="soma dos itens"):
        receita.montar_receita(ic, DICIONARIO)


def test_relatorio_de_quebra():
    linhas, _ = receita.montar_receita(ic_ficticia(), DICIONARIO)
    ipca = pd.DataFrame({"ano": [2021, 2022], "variacao_pct": [10.0, 0.0]})
    resumo, detalhe = receita.quebras(linhas, ipca, minimo_ufs=0)
    fpe = detalhe[(detalhe["uf"] == "AA") & (detalhe["item"] == "fpe")].iloc[0]
    assert fpe["salto"]  # 0 em 2021 e 40 em 2022: item novo conta como salto
    icms = detalhe[(detalhe["uf"] == "AA") & (detalhe["item"] == "icms")].iloc[0]
    assert icms["var_real_pct"] == pytest.approx((96 / (80 * 1.0) - 1) * 100) and not icms["salto"]


def test_dicionario_versionado_cobre_os_dois_periodos_e_tem_os_itens_da_lista():
    dic = pd.read_csv(RAIZ / "dicionarios" / "nacional" / "receita_itens.csv", dtype=str)
    itens = {i for i, _, _ in receita.ITENS}
    assert set(dic["item"]) == itens
    for item in ["icms", "ipva", "itcmd", "fpe", "sus", "fundeb_retorno", "fundeb_complementacao"]:
        anos = dic[dic["item"] == item]
        assert (anos["ano_fim"] == "2021").any() and (anos["ano_inicio"] == "2022").any(), item
    assert {"1", "2", "7", "8"} <= set(dic["codigo"])  # catch-alls: nenhum código fica sem item
