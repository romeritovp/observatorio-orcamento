"""Baixa e extrai o RREO Anexo 02 do 6º bimestre para todas as UFs, sem parar no primeiro erro.

Uso:
    uv run python -m extractors.nacional.siconfi.lote_rreo                # 2015 a 2025
    uv run python -m extractors.nacional.siconfi.lote_rreo 2022 2024      # outro intervalo

As UFs vêm de dicionarios/nacional/ufs.csv. O cache do cliente evita baixar de novo.
Rodar depois do lote da DCA: a validação usa dicionarios/nacional/funcoes.csv.
"""

import logging
import sys

from extractors.nacional.siconfi import rreo
from extractors.nacional.siconfi.lote import ANOS_PADRAO, anos_dos_argumentos, executar, resumo, ufs_do_dicionario

PERIODO = 6


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    resultados = executar(
        ufs_do_dicionario(),
        anos_dos_argumentos(argv, ANOS_PADRAO),
        lambda uf, ano: rreo.extrair_anexo_02(uf, ano, PERIODO),
    )
    print("\n" + resumo(resultados))


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    main()
