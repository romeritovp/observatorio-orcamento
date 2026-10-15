"""Funções puras de análise: DataFrame entra, DataFrame sai. Nada é lido de arquivo."""

from analytics.comparacao import agregar, mediana_entre_ufs, participacao, ranking, variacao
from analytics.completude import completar_com_zero
from analytics.deflacao import deflacionar
from analytics.edicoes import consolidar_edicoes
from analytics.estatais import (
    edicao_para_ano, estatais_fora_das_contas, funcao_das_estatais, mudancas_de_dependencia, nomes_de_exibicao,
)
from analytics.hierarquia import mapear_por_prefixo, segmentos, valores_proprios
from analytics.nomes import nomear
from analytics.normalizacao import per_capita
from analytics.pib import crescimento_acumulado, participacao_no_pais, participacao_no_vab, rebasear

__all__ = [
    "agregar", "completar_com_zero", "edicao_para_ano", "estatais_fora_das_contas", "funcao_das_estatais", "mudancas_de_dependencia", "nomes_de_exibicao", "deflacionar", "variacao", "participacao", "ranking", "mediana_entre_ufs", "per_capita", "nomear", "mapear_por_prefixo", "segmentos", "valores_proprios",
    "participacao_no_vab", "participacao_no_pais", "rebasear", "crescimento_acumulado", "consolidar_edicoes",
]
