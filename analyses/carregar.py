"""Leitura dos dados que as análises usam: tabelas de data/processed/, referências e dicionários.

Única porta de entrada de dados das análises; o resto é feito com analytics/.
"""

from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
DIR_PROCESSED = RAIZ / "data" / "processed"
DIR_REFERENCE = RAIZ / "data" / "reference"
DIR_DICIONARIOS = RAIZ / "dicionarios"


def carregar(tabela, ufs=None, anos=None, dir_processed=DIR_PROCESSED):
    """Lê data/processed/<tabela>/ (particionado por uf e ano) num DataFrame.

    ufs: sigla ou lista de siglas; anos: ano ou lista de anos. None = todos.
    Devolve uf e cod_ibge como texto e ano como inteiro (as partições do parquet
    voltariam como categoria). Sem nenhum arquivo para o filtro é erro.
    """
    pasta = Path(dir_processed) / tabela
    if not pasta.exists():
        raise FileNotFoundError(f"tabela não encontrada: {pasta}")

    filtros = []
    if ufs is not None:
        filtros.append(("uf", "in", [u.upper() for u in _lista(ufs)]))
    if anos is not None:
        filtros.append(("ano", "in", [int(a) for a in _lista(anos)]))

    df = pd.read_parquet(pasta, filters=filtros or None)
    if df.empty:
        raise ValueError(f"nenhum dado em '{tabela}' para ufs={ufs}, anos={anos}")

    df["uf"] = df["uf"].astype(str)
    df["ano"] = df["ano"].astype(int)
    if "cod_ibge" in df.columns:
        df["cod_ibge"] = df["cod_ibge"].astype(str)
    return df.reset_index(drop=True)


def carregar_ipca(dir_reference=DIR_REFERENCE):
    """data/reference/ipca.csv (ano, variacao_pct, indice_dez)."""
    return pd.read_csv(Path(dir_reference) / "ipca.csv", dtype={"ano": int})


def carregar_dicionario(caminho, dir_dicionarios=DIR_DICIONARIOS):
    """Um dicionário de dicionarios/, com tudo como texto (ex.: 'nacional/funcoes.csv')."""
    return pd.read_csv(Path(dir_dicionarios) / caminho, dtype=str)


def _lista(valor):
    return list(valor) if isinstance(valor, (list, tuple, set, range)) else [valor]
