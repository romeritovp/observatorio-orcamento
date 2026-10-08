"""Baixa e extrai a receita (DCA Anexo I-C) para todas as UFs, sem parar no primeiro erro.

Uso:
    uv run python -m extractors.nacional.siconfi.lote_receita                # 2019 a 2025
    uv run python -m extractors.nacional.siconfi.lote_receita 2022 2024      # outro intervalo

Duas etapas, cada uma com o resumo de sempre (certos, vazios, falhas):
1. DCA Anexo I-C → `demonstrativo`, como veio (totais conferidos em `dca.validar_receita`).
2. Conferência: receita líquida exceto intra da I-C (bruta − deduções) × RREO Anexo 01 do 6º bimestre,
   "RECEITAS (EXCETO INTRA-ORÇAMENTÁRIAS)", até o bimestre. Diferença vira "erro" no resumo.
O mapeamento por item (dicionarios/nacional/receita_itens.csv) é conferido em `python -m publicacao.receita`.
"""

import logging
import sys

import pandas as pd

from extractors import base
from extractors.nacional.siconfi import cliente, dca
from extractors.nacional.siconfi.lote import anos_dos_argumentos, executar, resumo, ufs_do_dicionario

ANOS_PADRAO = (2019, 2025)
TOLERANCIA = 1.0


def liquida_exceto_intra_i_c(itens):
    df = pd.DataFrame(itens)
    total = df[df["cod_conta"] == dca.TOTAL_EXCETO_INTRA].set_index("coluna")["valor"]
    deducoes = [c for c in dca.COLUNAS_RECEITA if c != "Receitas Brutas Realizadas"]
    return float(total.get("Receitas Brutas Realizadas", 0.0)) - sum(float(total.get(c, 0.0)) for c in deducoes)


def receita_exceto_intra_rreo(itens):
    """RREO Anexo 01: receitas exceto intra realizadas até o bimestre; None se o anexo não tem a linha."""
    df = pd.DataFrame(itens)
    if df.empty:
        return None
    linha = df[(df["cod_conta"] == "ReceitasExcetoIntraOrcamentarias") & df["coluna"].str.startswith("Até o Bimestre")]
    return float(linha["valor"].iloc[0]) if len(linha) else None


def conferir_com_rreo(uf, ano):
    """Levanta erro se a líquida exceto intra da I-C difere do RREO Anexo 01; ConsultaVazia se não há RREO."""
    _, cod_ibge = base.ente(uf)
    i_c = cliente.consultar("dca", {"an_exercicio": ano, "no_anexo": dca.ANEXO_I_C, "id_ente": cod_ibge})
    rreo = cliente.consultar("rreo", {"an_exercicio": ano, "nr_periodo": 6, "co_tipo_demonstrativo": "RREO",
                                      "no_anexo": "RREO-Anexo 01", "co_esfera": "E", "id_ente": cod_ibge})
    valor_rreo = receita_exceto_intra_rreo(rreo)
    if valor_rreo is None:
        raise base.ConsultaVazia(f"sem RREO Anexo 01 para {uf} {ano}")
    valor_i_c = liquida_exceto_intra_i_c(i_c)
    if abs(valor_i_c - valor_rreo) > TOLERANCIA:
        raise base.ErroValidacao(f"I-C líquida exceto intra {valor_i_c:,.2f} ≠ RREO Anexo 01 {valor_rreo:,.2f} "
                                 f"({valor_i_c - valor_rreo:+,.2f})")
    return pd.DataFrame({"i_c": [valor_i_c], "rreo": [valor_rreo]})


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    ufs = ufs_do_dicionario()
    anos = anos_dos_argumentos(argv, ANOS_PADRAO)
    print("=== 1. DCA Anexo I-C")
    extracao = executar(ufs, anos, lambda uf, ano: dca.extrair_receita(uf, ano))
    print("\n=== 2. Conferência: I-C líquida exceto intra × RREO Anexo 01")
    conferencia = executar(ufs, anos, conferir_com_rreo)
    print("\n######## Extração (DCA I-C)\n" + resumo(extracao))
    print("\n######## Conferência com o RREO Anexo 01 (vazia = sem RREO; erro = diferença)\n" + resumo(conferencia))


if __name__ == "__main__":
    logging.basicConfig(level=logging.ERROR)
    main()
