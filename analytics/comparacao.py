"""Variação entre anos, participação no total e comparação entre UFs."""

import pandas as pd


def _com_uf(por):
    """Agrupamentos sempre incluem `uf`."""
    por = list(por)
    return por if "uf" in por else ["uf", *por]


def _checar_um_nivel(df):
    """Linhas de níveis diferentes (total, funcao, ...) nunca entram juntas numa conta."""
    if "nivel" in df.columns and df["nivel"].nunique(dropna=False) > 1:
        raise ValueError(f"DataFrame mistura níveis {sorted(df['nivel'].dropna().unique())}; filtre um antes")


def variacao(df, coluna, por):
    """Variação percentual de `coluna` em relação ao ano anterior, dentro de cada grupo `por` (+ uf).

    Cria `<coluna>_var_pct`. Fica nula no primeiro ano do grupo e quando o ano anterior
    não está nos dados. Use a coluna nominal ou a `_real` para variação nominal ou real.
    Mais de uma linha por grupo e ano é erro.
    """
    _checar_um_nivel(df)
    por = _com_uf(por)
    if df.duplicated([*por, "ano"]).any():
        raise ValueError(f"mais de uma linha por {por} e ano")

    saida = df.sort_values([*por, "ano"]).copy()
    grupos = saida.groupby(por, observed=True, dropna=False)
    anterior = grupos[coluna].shift(1)
    ano_anterior = grupos["ano"].shift(1)
    consecutivo = saida["ano"] - ano_anterior == 1
    saida[f"{coluna}_var_pct"] = ((saida[coluna] / anterior - 1) * 100).where(consecutivo)
    return saida.loc[df.index]


def participacao(df, coluna, por):
    """Participação percentual de cada linha no total do grupo `por` (+ uf).

    Cria `<coluna>_part_pct`. Normalmente `por` inclui `ano`.
    """
    _checar_um_nivel(df)
    por = _com_uf(por)
    saida = df.copy()
    total = saida.groupby(por, observed=True, dropna=False)[coluna].transform("sum")
    saida[f"{coluna}_part_pct"] = saida[coluna] / total * 100
    return saida


def _checar_uma_linha_por_uf(df, por):
    if df.duplicated(["uf", *por]).any():
        raise ValueError(f"mais de uma linha por uf e {list(por)}")


def ranking(df, coluna, por):
    """Posição de cada UF em `coluna` dentro de cada grupo `por` (1 = maior valor).

    Compara UFs entre si, por isso `por` não inclui uf (ex.: `["ano"]`). Use só
    colunas normalizadas (per capita ou % da RCL). Cria `<coluna>_posicao` e
    `<coluna>_n_ufs` (quantas UFs têm valor no grupo). Empates ficam com a melhor posição.
    """
    _checar_um_nivel(df)
    por = [c for c in por if c != "uf"]
    _checar_uma_linha_por_uf(df, por)
    saida = df.copy()
    grupos = saida.groupby(por, observed=True, dropna=False)[coluna]
    saida[f"{coluna}_posicao"] = grupos.rank(ascending=False, method="min").astype("Int64")
    saida[f"{coluna}_n_ufs"] = grupos.transform("count").astype("Int64")
    return saida


def mediana_entre_ufs(df, coluna, por):
    """Mediana de `coluna` entre as UFs, em cada grupo `por` (ex.: `["ano"]`).

    Devolve um DataFrame com as colunas `por`, `<coluna>_mediana` e `n_ufs`.
    Use só colunas normalizadas (per capita ou % da RCL).
    """
    _checar_um_nivel(df)
    por = [c for c in por if c != "uf"]
    _checar_uma_linha_por_uf(df, por)
    grupos = df.groupby(por, observed=True, dropna=False)[coluna]
    return pd.DataFrame({
        f"{coluna}_mediana": grupos.median(),
        "n_ufs": grupos.count(),
    }).reset_index()


def agregar(df, colunas, por):
    """Soma `colunas` dentro de cada grupo `por` (+ uf). Devolve uma linha por grupo.

    Recusa DataFrame com mais de um `nivel` (nunca somar níveis diferentes).
    Nulos são ignorados na soma; grupo só com nulos fica nulo.
    """
    _checar_um_nivel(df)
    por = _com_uf(por)
    grupos = df.groupby(por, observed=True, dropna=False)[list(colunas)]
    return grupos.sum(min_count=1).reset_index()
