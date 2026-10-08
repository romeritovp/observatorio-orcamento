"""Deflação de valores nominais pelo IPCA."""


def deflacionar(df, colunas, ano_base, ipca):
    """Converte valores nominais em reais a preços de dezembro do `ano_base`.

    ipca: DataFrame com `ano` e `variacao_pct` (variação dezembro a dezembro, em %),
        sem anos faltando entre o menor e o maior.
    Para cada coluna, cria `<coluna>_real` = valor × índice(ano_base) / índice(ano),
    com o índice encadeado a partir das variações anuais.
    Ano de df ou ano_base fora do IPCA é erro.
    """
    indice = _indice_encadeado(ipca)
    if ano_base not in indice.index:
        raise ValueError(f"ano_base {ano_base} fora do IPCA ({indice.index.min()}–{indice.index.max()})")
    faltando = set(df["ano"].astype(int)) - set(indice.index)
    if faltando:
        raise ValueError(f"anos sem IPCA: {sorted(faltando)}")

    saida = df.copy()
    fator = indice[ano_base] / saida["ano"].astype(int).map(indice)
    for coluna in colunas:
        saida[f"{coluna}_real"] = saida[coluna].astype("float64") * fator
    return saida


def _indice_encadeado(ipca):
    """Série ano → índice acumulado (base 1 no ano anterior ao primeiro)."""
    serie = ipca.set_index(ipca["ano"].astype(int))["variacao_pct"].sort_index()
    if not serie.index.is_unique:
        raise ValueError("IPCA com ano repetido")
    esperados = range(serie.index.min(), serie.index.max() + 1)
    if list(serie.index) != list(esperados):
        raise ValueError("IPCA com anos faltando")
    return (1 + serie / 100).cumprod()
