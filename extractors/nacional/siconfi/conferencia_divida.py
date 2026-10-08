"""Conferência (só aviso, nunca falha) do pagamento da dívida entre três fontes do SICONFI.

Referência: DCA Anexo I-D, grupos 3.2 (juros e encargos) + 4.6 (amortização), liquidado, exceto intra
(soma das modalidades "DO": a linha do grupo inclui as intraorçamentárias, ver dca.soma_modalidades).
Comparada com:
- DCA Anexo I-E, subfunções 841 a 844 (refinanciamento e serviço da dívida interna e externa), liquidado,
  sem intra. Classificação funcional: cada estado a usa de um jeito (ver docs/fontes/siconfi.md), então
  diferença aqui é esperada em alguns casos e não indica erro na I-D;
- RREO Anexo 01 do 6º bimestre (quando entregue): juros e encargos + amortização (incluída a linha
  "amortização da dívida / refinanciamento"), despesas liquidadas até o bimestre, exceto intra.
"""

import logging

import pandas as pd

from extractors.nacional.siconfi import cliente, dca

log = logging.getLogger(__name__)

SUBFUNCOES_DIVIDA = ("841", "842", "843", "844")
CONTAS_RREO = ("JurosEEncargosDaDivida", "AmortizacaoDaDivida", "AmortizacaoRefinanciamentoDaDivida")
TOLERANCIA = 1.0  # R$


def pago_natureza(itens_i_d):
    """Juros (3.2) + amortização (4.6) liquidados da DCA I-D, exceto intra. Grupo ausente conta zero."""
    df = pd.DataFrame(itens_i_d)
    if df.empty:
        return None
    liquidado = df[df["coluna"] == "Despesas Liquidadas"]
    return dca.soma_modalidades(liquidado, "3.2") + dca.soma_modalidades(liquidado, "4.6")


def pago_subfuncoes(itens_i_e, uf, cod_ibge, ano):
    """Soma do liquidado das subfunções 841 a 844 (qualquer função), sem intra, da DCA I-E."""
    if not itens_i_e:
        return None
    df = dca.transformar_despesa_funcao(itens_i_e, uf, cod_ibge, ano)
    sub = df[(df["nivel"] == "subfuncao") & ~df["intra"].astype(bool) & df["subfuncao_cod"].isin(SUBFUNCOES_DIVIDA)]
    return float(sub["liquidado"].fillna(0).sum())


def pago_rreo(itens_rreo_01):
    """Juros + amortização liquidados até o 6º bimestre no RREO Anexo 01, exceto intra; None sem as linhas."""
    df = pd.DataFrame(itens_rreo_01)
    if df.empty:
        return None
    colunas = [c for c in df["coluna"].unique() if c.upper().startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE")]
    linhas = df[df["cod_conta"].isin(CONTAS_RREO) & df["coluna"].isin(colunas)]
    if linhas.empty:
        return None
    return float(linhas["valor"].sum())


def comparar(referencia, outras):
    """Avisos (texto) quando cada valor de `outras` ({nome: valor ou None}) difere da referência."""
    avisos = []
    for nome, valor in outras.items():
        if valor is None or referencia is None:
            continue
        diferenca = valor - referencia
        if abs(diferenca) > TOLERANCIA:
            relativa = f" ({diferenca / referencia * 100:+.1f}%)" if referencia else ""
            avisos.append(f"{nome} = {valor:,.2f} difere da DCA I-D ({referencia:,.2f}) em {diferenca:,.2f}{relativa}")
    return avisos


def conferir(uf, cod_ibge, ano, dir_raw=cliente.DIR_RAW):
    """Compara as três fontes para uma UF e ano, com o que houver em cache (baixa se faltar).

    Devolve {"referencia", "subfuncoes", "rreo", "avisos"}; cada aviso também vai para o log.
    """
    i_d = cliente.consultar("dca", {"an_exercicio": ano, "no_anexo": dca.ANEXO_I_D, "id_ente": cod_ibge}, dir_raw=dir_raw)
    i_e = cliente.consultar("dca", {"an_exercicio": ano, "no_anexo": dca.ANEXO_I_E, "id_ente": cod_ibge}, dir_raw=dir_raw)
    rreo = cliente.consultar("rreo", {"an_exercicio": ano, "nr_periodo": 6, "co_tipo_demonstrativo": "RREO",
                                      "no_anexo": "RREO-Anexo 01", "co_esfera": "E", "id_ente": cod_ibge}, dir_raw=dir_raw)
    referencia = pago_natureza(i_d)
    valores = {"subfunções 841–844 (DCA I-E)": pago_subfuncoes(i_e, uf, cod_ibge, ano), "RREO Anexo 01": pago_rreo(rreo)}
    avisos = comparar(referencia, valores)
    for aviso in avisos:
        log.warning("%s %s: %s", uf, ano, aviso)
    return {"referencia": referencia, "subfuncoes": valores["subfunções 841–844 (DCA I-E)"],
            "rreo": valores["RREO Anexo 01"], "avisos": avisos}
