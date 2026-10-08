"""Baixa e extrai a DCA Anexo I-E para todas as UFs, sem parar no primeiro erro.

Uso:
    uv run python -m extractors.nacional.siconfi.lote_dca                 # 2019 a 2025
    uv run python -m extractors.nacional.siconfi.lote_dca 2022 2024       # outro intervalo

As UFs vêm de dicionarios/nacional/ufs.csv. O cache do cliente evita baixar de novo.
No fim, mostra o resumo e regenera funcoes.csv e subfuncoes.csv.
"""

import logging
import sys

from extractors.nacional.siconfi import dca, dicionario_funcoes
from extractors.nacional.siconfi.lote import anos_dos_argumentos, executar, resumo, ufs_do_dicionario

ANOS_PADRAO = (2019, 2025)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    resultados = executar(ufs_do_dicionario(), anos_dos_argumentos(argv, ANOS_PADRAO), dca.extrair_despesa_funcao)
    print("\n" + resumo(resultados))

    print("\nDicionários:")
    dicionario_funcoes.main()


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    main()
