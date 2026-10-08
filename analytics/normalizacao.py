"""Normalização para comparar UFs: per capita."""

import pandas as pd


def per_capita(df, colunas, populacao):
    """Divide cada coluna pela população da UF no ano.

    populacao: DataFrame com `uf`, `ano` e `populacao` (uma linha por UF e ano).
    Cria `<coluna>_per_capita`. UF/ano sem população é erro (nunca inventar valor).
    """
    pop = populacao[["uf", "ano", "populacao"]].copy()
    pop["uf"] = pop["uf"].astype(str)
    pop["ano"] = pop["ano"].astype(int)
    if pop.duplicated(["uf", "ano"]).any():
        raise ValueError("população com mais de uma linha por uf e ano")

    chaves = pd.DataFrame({"uf": df["uf"].astype(str), "ano": df["ano"].astype(int)}, index=df.index)
    divisor = chaves.merge(pop, on=["uf", "ano"], how="left")["populacao"].to_numpy()
    if pd.isna(divisor).any():
        faltando = chaves[pd.isna(divisor)].drop_duplicates()
        raise ValueError(f"sem população para: {faltando.to_records(index=False).tolist()}")

    saida = df.copy()
    for coluna in colunas:
        saida[f"{coluna}_per_capita"] = saida[coluna].astype("float64") / divisor
    return saida
