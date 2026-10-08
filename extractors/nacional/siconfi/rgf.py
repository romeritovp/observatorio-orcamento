"""RGF (Relatório de Gestão Fiscal) do SICONFI.

extrair_anexo_02(uf, ano): Anexo 02 (Dívida Consolidada Líquida) do 3º quadrimestre → tabela `demonstrativo`.

Parâmetros (ver docs/fontes/siconfi.md): in_periodicidade=Q, nr_periodo=3, co_tipo_demonstrativo=RGF,
co_esfera=E e **co_poder=E** (obrigatório: a dívida só sai no RGF do Executivo; sem co_poder, ou com
outro poder, a API devolve zero itens, sem erro).

A tabela `demonstrativo` guarda as linhas como vieram. O `cod_conta` identifica a linha
(DividaConsolidada, DeducoesDaDividaConsolidada, DividaConsolidadaLiquida, ...). Colunas de saldo:
"SALDO DO EXERCÍCIO ANTERIOR" e "Até o 1º/2º/3º Quadrimestre" (o estoque de fim de ano é o 3º).

Linhas abaixo do limite que NÃO integram a dívida consolidada (FORA_DA_DC: passivo atuarial, precatórios
anteriores a 05/05/2000, precatórios posteriores não incluídos na DC, restos a pagar não processados,
depósitos judiciais, dívida de PPP) são gravadas como vieram, mas não entram em validação nem em total.
"""

import pandas as pd

from extractors import base
from extractors.nacional.siconfi import cliente

ANEXO_02 = "RGF-Anexo 02"
FONTE_DADO = "siconfi_rgf"
PERIODO = 3

DC = "DividaConsolidada"
DEDUCOES = "DeducoesDaDividaConsolidada"
DCL = "DividaConsolidadaLiquida"
CONTRATUAL = "DividaContratual"
EMPRESTIMOS = "RGF2Emprestimos"
FINANCIAMENTOS = "RGF2Financiamentos"  # irmão de Empréstimos; alguns estados usam um, outros o outro
PARCELAMENTOS = "RGF2ParcelamentoERenegociacaoDeDividas"

# Hierarquia da dívida consolidada: pai → filhos diretos (a soma dos filhos deve dar o pai).
# Filho ausente conta zero: a linha só aparece quando tem valor.
HIERARQUIA = {
    DC: ("DividaMobiliaria", CONTRATUAL, "PrecatoriosPosterioresA05052000VencidosENaoPagos", "OutrasDividas"),
    CONTRATUAL: (EMPRESTIMOS, FINANCIAMENTOS, "RGF2ReestruturacaoDaDividaDeEstadosEMunicipios", PARCELAMENTOS,
                 "RGF2DemaisDividasContratuais"),
    EMPRESTIMOS: ("RGF2EmprestimosInternos", "RGF2EmprestimosExternos"),
    FINANCIAMENTOS: ("RGF2FinanciamentosInternos", "RGF2FinanciamentosExternos"),
    PARCELAMENTOS: ("RGF2ParcelamentoERenegociacaoDeDividasDeTributos",
                    "RGF2ParcelamentoERenegociacaoDeDividasDeContribuicoesSociaisPrevidenciarias",
                    "RGF2ParcelamentoERenegociacaoDeDividasDeContribuicoesSociaisDemaisContribuicoesSociais",
                    "RGF2ParcelamentoERenegociacaoDeDividasDoFGTS",
                    "RGF2ParcelamentoDeDividasComInstituicaoNaoFinanceira"),
}

# Linhas do anexo que NÃO integram a dívida consolidada: gravadas como vieram, fora de qualquer total.
# A "Dívida Contratual de PPP" aparece nessa seção (RO 2023 e 2024), não dentro da dívida contratual.
FORA_DA_DC = ("RGF2DividaConsolidadaPrevidenciariaPassivoAtuarial", "PrecatoriosAnterioresA05052000",
              "PrecatoriosAPartirDe05052000", "RPNaoProcessadosDeExerciciosAnteriores",
              "ApropriacaoDeDepositosJudiciais", "Depositos", "DividaContratualDePPP")

# Coluna do estoque de fim de ano: a única usada e conferida. As colunas intermediárias (saldo do
# exercício anterior, 1º e 2º quadrimestres) são gravadas como vieram, mas têm erros de preenchimento
# em alguns estados (subcontas que não somam) e não são usadas.
COLUNA_ESTOQUE = "Até o 3º Quadrimestre"


def params_anexo_02(cod_ibge, ano):
    return {
        "an_exercicio": ano, "in_periodicidade": "Q", "nr_periodo": PERIODO, "co_tipo_demonstrativo": "RGF",
        "no_anexo": ANEXO_02, "co_esfera": "E", "co_poder": "E", "id_ente": cod_ibge,
    }


def transformar_anexo_02(itens, uf, cod_ibge, ano):
    """Itens da API → DataFrame no formato da tabela `demonstrativo`."""
    linhas = []
    for item in itens:
        if str(item["cod_ibge"]) != cod_ibge:
            raise base.ErroValidacao(f"item de outro ente: cod_ibge {item['cod_ibge']}, esperado {cod_ibge}")
        if int(item["exercicio"]) != ano or int(item["periodo"]) != PERIODO:
            raise base.ErroValidacao(f"item de outro período: {item['exercicio']}/{item['periodo']}")
        linhas.append({
            "uf": uf, "cod_ibge": cod_ibge, "ano": ano, "periodo": PERIODO,
            "demonstrativo": "RGF", "anexo": item["anexo"], "rotulo": item["rotulo"],
            "cod_conta": item["cod_conta"], "conta": item["conta"], "coluna": item["coluna"],
            "valor": float(item["valor"]),
        })
    return pd.DataFrame(linhas)


def validar_anexo_02(df, tolerancia=1.0):
    """Confere, na coluna do estoque de fim de ano (3º quadrimestre):

    - DC − deduções = DCL
    - em cada nível da HIERARQUIA, soma dos filhos = pai (DC, contratual, empréstimos, financiamentos,
      parcelamentos). Linhas fora da dívida consolidada não entram em nenhuma conferência.
    """
    valores = df[df["coluna"] == COLUNA_ESTOQUE].groupby("cod_conta")["valor"].sum()
    if DC not in valores:
        raise base.ErroValidacao(f"sem a dívida consolidada na coluna {COLUNA_ESTOQUE!r}")

    def conferir(descricao, calculado, informado):
        if abs(calculado - informado) > tolerancia:
            raise base.ErroValidacao(f"{descricao} = {calculado:,.2f} difere do informado {informado:,.2f}")

    conferir("DC − deduções", valores[DC] - valores.get(DEDUCOES, 0.0), valores.get(DCL, 0.0))
    for pai, filhos in HIERARQUIA.items():
        if pai in valores:
            conferir(f"soma das subcontas de {pai}", sum(valores.get(f, 0.0) for f in filhos), valores[pai])


def extrair_anexo_02(uf, ano, *, dir_raw=cliente.DIR_RAW, dir_processed=base.DIR_PROCESSED, http=None):
    """Lê o RGF Anexo 02 do 3º quadrimestre do cache (baixa se faltar), confere e grava em `demonstrativo`."""
    uf, cod_ibge = base.ente(uf)
    params = params_anexo_02(cod_ibge, ano)
    itens = cliente.consultar("rgf", params, dir_raw=dir_raw, http=http)
    if not itens:
        raise base.ConsultaVazia(f"RGF Anexo 02 vazio para {uf} {ano} (3º quadrimestre, poder Executivo)")

    df = transformar_anexo_02(itens, uf, cod_ibge, ano)
    df["extraido_em"] = cliente.data_extracao("rgf", params, dir_raw)
    validar_anexo_02(df)
    base.gravar(df, "demonstrativo", f"{FONTE_DADO}_anexo_02_q{PERIODO}", dir_processed=dir_processed)
    return base.validar_esquema(df, "demonstrativo")
