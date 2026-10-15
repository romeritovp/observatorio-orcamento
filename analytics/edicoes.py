"""Séries publicadas em várias edições (ex.: o Anuário do FBSP revisa o ano anterior): fica o valor da edição mais
recente, com o da primeira publicação ao lado."""
import pandas as pd


def consolidar_edicoes(df, chaves, valores, coluna_edicao="edicao"):
    """Uma linha por `chaves` (ex.: uf, ano): cada coluna de `valores` com o valor da edição mais recente em que ela
    aparece, o da primeira publicação (`<valor>_primeira_publicacao`) e a revisão (`revisao_<valor>`, final menos o
    primeiro; 0 quando só houve uma publicação). `edicao_fonte` e `edicao_primeira_publicacao` vêm da primeira coluna de
    `valores`. Valor nulo numa edição não conta como publicação."""
    saida = None
    for i, valor in enumerate(valores):
        parte = df.loc[df[valor].notna(), list(chaves) + [coluna_edicao, valor]].sort_values(coluna_edicao)
        if parte.duplicated(list(chaves) + [coluna_edicao]).any():
            raise ValueError(f"{valor}: mais de um valor na mesma edição para as mesmas chaves")
        grupos = parte.groupby(list(chaves), sort=True)
        final, primeira = grupos.last(), grupos.first()
        tabela = pd.DataFrame({
            valor: final[valor],
            f"{valor}_primeira_publicacao": primeira[valor],
            f"revisao_{valor}": final[valor] - primeira[valor],
        })
        if i == 0:
            tabela.insert(0, "edicao_fonte", final[coluna_edicao])
            tabela.insert(1, "edicao_primeira_publicacao", primeira[coluna_edicao])
        saida = tabela if saida is None else saida.join(tabela, how="outer")
    return saida.reset_index()
