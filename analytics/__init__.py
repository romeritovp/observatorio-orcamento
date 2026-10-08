"""Funções puras de análise: DataFrame entra, DataFrame sai. Nada é lido de arquivo."""

from analytics.comparacao import agregar, mediana_entre_ufs, participacao, ranking, variacao
from analytics.deflacao import deflacionar
from analytics.nomes import nomear
from analytics.normalizacao import per_capita

__all__ = [
    "agregar", "deflacionar", "variacao", "participacao", "ranking", "mediana_entre_ufs", "per_capita", "nomear",
]
