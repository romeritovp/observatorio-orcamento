"""Junção de códigos com nomes dos dicionários."""


def nomear(df, dicionario):
    """Acrescenta os nomes do `dicionario` ao df, pela única coluna que os dois têm em comum.

    Ex.: dicionario com `funcao_cod, funcao_nome` acrescenta `funcao_nome` pela `funcao_cod`.
    O número de linhas não muda. Código sem nome no dicionário fica com nome nulo.
    """
    comuns = [c for c in dicionario.columns if c in df.columns]
    if len(comuns) != 1:
        raise ValueError(f"esperada 1 coluna em comum com o dicionário, há {comuns}")
    chave = comuns[0]
    if dicionario[chave].duplicated().any():
        raise ValueError(f"dicionário com '{chave}' repetido")

    dic = dicionario.copy()
    dic[chave] = dic[chave].astype(str)
    saida = df.copy()
    codigos = saida[chave]
    saida[chave] = codigos.astype(str).where(codigos.notna())
    saida = saida.merge(dic, on=chave, how="left")
    saida.index = df.index
    saida[chave] = codigos
    return saida
