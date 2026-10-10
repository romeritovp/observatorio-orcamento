"""Dívida do estado para o front: estoque (RGF Anexo 02, 3º quadrimestre) e pagamento (DCA Anexo I-D).

Lê linhas da tabela `demonstrativo` (já carregadas) e monta uma linha por UF e ano, em R$ NOMINAIS.
Valores reais, posição e mediana ficam com o front (calculos.js) e, para teste, com o gabarito.

Linhas que não integram a dívida consolidada (passivo atuarial, precatórios anteriores a 2000,
restos a pagar não processados, depósitos judiciais, PPP: extractors.nacional.siconfi.rgf.FORA_DA_DC)
não entram em nenhum campo.
"""

import pandas as pd

from extractors.nacional.siconfi.dca import soma_modalidades
from extractors.nacional.siconfi.rgf import layout_antigo

COLUNA_ESTOQUE = "Até o 3º Quadrimestre"
COLUNA_PAGO = "Despesas Liquidadas"
# Pagamento exceto intra = soma das modalidades "DO" do grupo (a linha do grupo inclui as intra)
GRUPOS_PAGO = {"juros": "3.2", "amortizacao": "4.6"}

# Campo → cod_conta do RGF Anexo 02 (uma linha cada)
ESTOQUE = {
    "dc": "DividaConsolidada",
    "deducoes": "DeducoesDaDividaConsolidada",
    "dcl": "DividaConsolidadaLiquida",
    "rcl": "RGF2ReceitaCorrenteLiquida",
    "rcl_ajustada": "ReceitaCorrenteLiquidaAjustadaParaCalculoDosLimitesDeEndividamento",
    "dcl_rcl_pct": "PercentualDaDCLSobreARCL",  # linha oficial do relatório (já em %)
    "limite": "LimiteDefinidoPorResolucaoDoSenadoFederal",
    "alerta": "LimiteDeAlerta",
}

# Composição por tipo: campo → cod_contas somados. Soma de todos os tipos = DC (conferido).
COMPOSICAO = {
    "reestruturacao": ("RGF2ReestruturacaoDaDividaDeEstadosEMunicipios",),
    "internos": ("RGF2EmprestimosInternos", "RGF2FinanciamentosInternos"),
    "externos": ("RGF2EmprestimosExternos", "RGF2FinanciamentosExternos"),
    "parcelamentos": ("RGF2ParcelamentoERenegociacaoDeDividas",),
    "precatorios": ("PrecatoriosPosterioresA05052000VencidosENaoPagos",),
    "outras": ("DividaMobiliaria", "OutrasDividas", "RGF2DemaisDividasContratuais"),
}

DESCRICAO_CAMPOS = {
    "dc": "dívida consolidada (R$)",
    "deducoes": "deduções: caixa e haveres financeiros (R$)",
    "dcl": "dívida consolidada líquida = dc − deducoes (R$)",
    "rcl": "receita corrente líquida (R$)",
    "rcl_ajustada": "RCL ajustada para os limites de endividamento (R$); nula antes de existir no relatório (2019)",
    "dcl_rcl_pct": "DCL sobre a RCL (ajustada), em %: linha oficial do RGF",
    "limite": "limite do Senado (R$), 200% da RCL ajustada",
    "limite_pct": "limite em % da RCL ajustada (da RCL quando não há ajustada)",
    "alerta": "limite de alerta (R$), 90% do limite",
    "alerta_pct": "limite de alerta em % da RCL ajustada (da RCL quando não há ajustada)",
    "composicao": "dívida consolidada por tipo (R$); soma = dc. O relatório separa por tipo, não por credor. "
                  "Nula no layout de 2015–2016 do RGF (só interna/externa: não comparável)",
    "juros": "juros e encargos da dívida pagos (liquidado, natureza 3.2, exceto intra, R$); nulo sem DCA I-D",
    "amortizacao": "amortização da dívida (liquidado, natureza 4.6, exceto intra, R$); nulo sem DCA I-D",
}


def _pagos(dca_i_d):
    """{(uf, ano): {"juros": R$, "amortizacao": R$}} exceto intra, da coluna de liquidado da I-D."""
    parte = dca_i_d[dca_i_d["coluna"] == COLUNA_PAGO]
    return {chave: {campo: soma_modalidades(g, grupo) for campo, grupo in GRUPOS_PAGO.items()}
            for chave, g in parte.groupby(["uf", "ano"])}


def _por_uf_ano(df, coluna):
    """{(uf, ano): {cod_conta: valor}} das linhas de uma coluna."""
    parte = df[df["coluna"] == coluna]
    return {chave: dict(zip(g["cod_conta"], g["valor"].astype(float))) for chave, g in parte.groupby(["uf", "ano"])}


def montar_divida(rgf, dca_i_d, tolerancia=1.0):
    """Linhas do RGF Anexo 02 e da DCA I-D (tabela demonstrativo) → lista de registros por UF e ano.

    Grupo da I-D ausente = nada pago naquele grupo (0); UF/ano sem I-D = juros e amortização nulos.
    Composição que não soma a DC é erro. No layout antigo do RGF (2015–2016, rgf.layout_antigo) a dívida
    contratual só se divide em interna e externa: composição nula (não comparável com 2017 em diante).
    """
    estoques = _por_uf_ano(rgf, COLUNA_ESTOQUE)
    pagos = _pagos(dca_i_d)
    registros = []
    for (uf, ano), v in sorted(estoques.items()):
        linha = {"uf": uf, "ano": int(ano)}
        for campo, cod in ESTOQUE.items():
            linha[campo] = v.get(cod)
        base_limites = linha["rcl_ajustada"] if linha["rcl_ajustada"] is not None else linha["rcl"]
        linha["limite_pct"] = linha["limite"] / base_limites * 100 if base_limites else None
        linha["alerta_pct"] = linha["alerta"] / base_limites * 100 if base_limites else None
        if layout_antigo(v):
            # 2015–2016: só DC, deduções, DCL, RCL e DCL/RCL; limites e composição ficam nulos
            for campo in ["rcl_ajustada", "limite", "alerta", "limite_pct", "alerta_pct"]:
                linha[campo] = None
            linha["composicao"] = None
        else:
            linha["composicao"] = {campo: sum(v.get(c, 0.0) for c in cods) for campo, cods in COMPOSICAO.items()}
            soma = sum(linha["composicao"].values())
            if abs(soma - (linha["dc"] or 0.0)) > tolerancia:
                raise ValueError(f"{uf} {ano}: composição soma {soma:,.2f}, dívida consolidada {linha['dc']:,.2f}")
        pago = pagos.get((uf, ano))
        linha["juros"] = None if pago is None else pago["juros"]
        linha["amortizacao"] = None if pago is None else pago["amortizacao"]
        registros.append(linha)
    return registros


def tabela_divida(registros):
    """Registros → DataFrame plano (para o gabarito): uf, ano, dcl_rcl_pct, juros, amortizacao."""
    return pd.DataFrame([{k: r[k] for k in ["uf", "ano", "dcl_rcl_pct", "juros", "amortizacao"]} for r in registros])
