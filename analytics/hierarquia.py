"""Códigos hierárquicos com pontos (ex.: natureza da receita "1.1.1.4.50.1.0"): valor próprio e mapeamento.

Um código vale pelos seus segmentos sem os zeros do fim: "1.1.1.4.50.1.0" → ("1","1","1","4","50","1").
O pai de uma linha é a linha presente cujo código é o maior prefixo próprio do dela.
"""

import pandas as pd


def segmentos(codigo):
    """'1.1.1.4.50.1.0' → ('1', '1', '1', '4', '50', '1'): segmentos sem os zeros finais."""
    partes = str(codigo).split(".")
    while partes and int(partes[-1]) == 0:
        partes.pop()
    return tuple(partes)


def valores_proprios(df, coluna_codigo, colunas, por):
    """Valor próprio de cada linha: valor − soma dos filhos diretos, dentro de cada grupo `por`.

    A soma dos valores próprios de um grupo é igual à soma das linhas de topo (categorias), então
    somar valores próprios nunca conta nada duas vezes e não perde a parte de um pai que os filhos
    não detalham. Nulo vale zero. Código repetido no mesmo grupo é erro. Cria `<coluna>_proprio`.
    """
    saida = df.copy()
    pais = pd.Series(pd.NA, index=df.index, dtype="object")
    for _, grupo in df.groupby(list(por), sort=False):
        segs = grupo[coluna_codigo].map(segmentos)
        if segs.duplicated().any():
            raise ValueError(f"código repetido no grupo: {sorted(set(segs[segs.duplicated()]))[:3]}")
        indice_por_seg = dict(zip(segs, grupo.index))
        for idx, seg in zip(grupo.index, segs):
            for tamanho in range(len(seg) - 1, 0, -1):  # pai = maior prefixo presente
                if seg[:tamanho] in indice_por_seg:
                    pais[idx] = indice_por_seg[seg[:tamanho]]
                    break
    valores = df[list(colunas)].fillna(0.0).astype(float)
    filhos = valores[pais.notna()].groupby(pais[pais.notna()]).sum()
    for coluna in colunas:
        saida[f"{coluna}_proprio"] = valores[coluna] - filhos[coluna].reindex(df.index).fillna(0.0)
    return saida


def mapear_por_prefixo(df, coluna_codigo, coluna_ano, dicionario):
    """Item de cada linha pelo prefixo mais longo do `dicionario` vigente no ano da linha.

    dicionario: DataFrame com item, codigo, ano_inicio, ano_fim (anos inclusivos; nulo = sem limite).
    Cria a coluna `item` (nula quando nenhum prefixo serve).
    """
    regras = [(segmentos(r.codigo), r.item,
               -10**9 if pd.isna(r.ano_inicio) else int(r.ano_inicio),
               10**9 if pd.isna(r.ano_fim) else int(r.ano_fim)) for r in dicionario.itertuples()]

    def item(codigo, ano):
        seg = segmentos(codigo)
        candidatas = [(len(p), it) for p, it, ini, fim in regras if ini <= ano <= fim and seg[:len(p)] == p]
        if not candidatas:
            return None
        maior = max(c[0] for c in candidatas)
        itens = {it for tamanho, it in candidatas if tamanho == maior}
        if len(itens) > 1:
            raise ValueError(f"código {codigo} ({ano}) em mais de um item: {sorted(itens)}")
        return itens.pop()

    return df.assign(item=[item(c, int(a)) for c, a in zip(df[coluna_codigo], df[coluna_ano])])
