"""Execução em lote de um extrator para várias UFs e anos, sem parar no primeiro erro.

Usado por lote_dca.py e lote_rreo.py.
"""

import pandas as pd

from extractors import base


def ufs_do_dicionario(caminho_ufs=base.CAMINHO_UFS):
    return pd.read_csv(caminho_ufs, dtype=str)["uf"].tolist()


def executar(ufs, anos, extrair):
    """Roda `extrair(uf, ano)` para cada combinação e devolve uma lista de resultados.

    Cada resultado: {"uf", "ano", "situacao" ("ok", "vazia" ou "erro"), "detalhe"}.
    """
    resultados = []
    for uf in ufs:
        for ano in anos:
            try:
                df = extrair(uf, ano)
                situacao, detalhe = "ok", f"{len(df)} linhas"
            except base.ConsultaVazia as erro:
                situacao, detalhe = "vazia", str(erro)
            except Exception as erro:  # qualquer falha vira registro; o lote continua
                situacao, detalhe = "erro", f"{type(erro).__name__}: {erro}"
            print(f"{uf} {ano}: {situacao} ({detalhe})", flush=True)
            resultados.append({"uf": uf, "ano": ano, "situacao": situacao, "detalhe": detalhe})
    return resultados


def resumo(resultados):
    """Texto com contagem por situação e a lista de vazias e de erros."""
    df = pd.DataFrame(resultados)
    linhas = [f"Combinações: {len(df)}"]
    for situacao in ["ok", "vazia", "erro"]:
        linhas.append(f"  {situacao}: {(df['situacao'] == situacao).sum()}")
    for situacao, titulo in [("vazia", "Vazias"), ("erro", "Falharam")]:
        parte = df[df["situacao"] == situacao]
        if not parte.empty:
            linhas.append(f"\n{titulo}:")
            linhas += [f"  {r.uf} {r.ano}: {r.detalhe}" for r in parte.itertuples()]
    return "\n".join(linhas)


def anos_dos_argumentos(argv, padrao):
    """`[inicial, final]` da linha de comando, ou o padrão."""
    inicial, final = (int(argv[0]), int(argv[1])) if argv else padrao
    return range(inicial, final + 1)
