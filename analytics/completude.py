"""Completar com zero as UFs que não têm linha numa área (ex.: não declararam gasto em saneamento)."""

import pandas as pd

MARCADOR = "sem_gasto_declarado"


def completar_com_zero(df, universo, chaves, por, colunas, marcador=MARCADOR):
    """Acrescenta linhas com valor 0 para as combinações ausentes de `universo` × valores de `por`.

    universo: DataFrame com as UFs/anos que entregaram o demonstrativo (uma linha por `chaves`,
        ex.: uf e ano); suas demais colunas (ex.: populacao) são copiadas para as linhas novas.
    chaves: colunas que identificam a linha do universo (ex.: ["uf", "ano"]).
    por: colunas cujos valores distintos em `df` são cruzados com o universo (ex.: ["funcao_cod"]).
    colunas: colunas de valor que recebem 0 nas linhas novas.
    Cria `marcador` (True nas linhas novas, False nas que já existiam). A UF continua no ranking,
    na mediana e na tabela, com 0, e não some da comparação.
    """
    if universo.duplicated(chaves).any():
        raise ValueError(f"universo com mais de uma linha por {chaves}")
    grade = universo.merge(df[list(por)].drop_duplicates(), how="cross")
    existentes = df[[*chaves, *por]].drop_duplicates()
    faltando = grade.merge(existentes, on=[*chaves, *por], how="left", indicator=True)
    faltando = faltando[faltando["_merge"] == "left_only"].drop(columns="_merge")
    for coluna in colunas:
        faltando[coluna] = 0.0

    existentes_df = df.assign(**{marcador: False})
    novas = faltando.assign(**{marcador: True})
    saida = pd.concat([existentes_df, novas], ignore_index=True)
    return saida.reindex(columns=[*df.columns, *[c for c in novas.columns if c not in df.columns]])
