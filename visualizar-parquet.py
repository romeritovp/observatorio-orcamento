"""Mostra metadados, esquema e as primeiras linhas de um parquet ou de uma tabela particionada.

Uso:
    uv run python visualizar-parquet.py <caminho ou tabela> [--linhas N] [--uf RJ] [--ano 2024] [--colunas c1 c2 ...]

<caminho ou tabela> pode ser:
    - um arquivo:   data/processed/despesa/uf=RJ/ano=2024/siconfi_dca_anexo_i_e.parquet
    - uma pasta:    data/processed/ideb            (tabela particionada uf=/ano=, como gravada por extractors/base.py)
    - um nome:      ideb                           (procurado em data/processed/)

Exemplos:
    uv run python visualizar-parquet.py ideb --linhas 5
    uv run python visualizar-parquet.py despesa --uf RJ --ano 2024 --linhas 20
    uv run python visualizar-parquet.py pib_uf --colunas uf ano pib_corrente

Só lê; não altera nenhum arquivo.
"""

import argparse
import sys
from pathlib import Path

import pandas as pd
import pyarrow.dataset as ds
import pyarrow.parquet as pq

RAIZ = Path(__file__).resolve().parent
DIR_PROCESSED = RAIZ / "data" / "processed"


def localizar(alvo):
    """Caminho do arquivo ou da pasta: o próprio caminho, se existir, ou data/processed/<alvo>."""
    caminho = Path(alvo)
    if caminho.exists():
        return caminho
    if (DIR_PROCESSED / alvo).exists():
        return DIR_PROCESSED / alvo
    disponiveis = sorted(p.name for p in DIR_PROCESSED.iterdir() if p.is_dir()) if DIR_PROCESSED.exists() else []
    sys.exit(f"Não encontrado: {alvo}\nTabelas em data/processed/: {', '.join(disponiveis) or 'nenhuma'}")


def tamanho(bytes_):
    for unidade in ("B", "KB", "MB", "GB"):
        if bytes_ < 1024 or unidade == "GB":
            return f"{bytes_:,.0f} {unidade}" if unidade == "B" else f"{bytes_:,.1f} {unidade}"
        bytes_ /= 1024


def titulo(texto):
    print(f"\n{texto}\n{'─' * len(texto)}")


def metadados_arquivo(caminho):
    """Metadados de um único parquet: linhas, grupos de linhas, compressão e estatísticas por coluna."""
    arquivo = pq.ParquetFile(caminho)
    meta = arquivo.metadata
    titulo("Metadados do arquivo")
    print(f"Arquivo:          {caminho}")
    print(f"Tamanho:          {tamanho(caminho.stat().st_size)}")
    print(f"Linhas:           {meta.num_rows:,}")
    print(f"Colunas:          {meta.num_columns}")
    print(f"Grupos de linhas: {meta.num_row_groups}")
    print(f"Formato:          parquet {meta.format_version}")
    print(f"Criado por:       {meta.created_by}")

    titulo("Colunas (tipo, compressão, nulos, mínimo e máximo)")
    linhas = []
    for i in range(meta.num_columns):
        nulos, minimo, maximo, compressao = 0, None, None, None
        for g in range(meta.num_row_groups):
            coluna = meta.row_group(g).column(i)
            compressao = coluna.compression
            est = coluna.statistics
            if est is None:
                nulos = None
                continue
            if nulos is not None and est.has_null_count:
                nulos += est.null_count
            if est.has_min_max:
                minimo = est.min if minimo is None else min(minimo, est.min)
                maximo = est.max if maximo is None else max(maximo, est.max)
        nome = meta.schema.column(i).name
        linhas.append({"coluna": nome, "tipo": str(arquivo.schema_arrow.field(nome).type), "compressão": compressao,
                       "nulos": nulos, "mínimo": minimo, "máximo": maximo})
    print(pd.DataFrame(linhas).to_string(index=False))


def metadados_pasta(pasta, dataset):
    """Metadados de uma tabela particionada: arquivos, linhas, partições e esquema."""
    arquivos = list(pasta.rglob("*.parquet"))
    linhas_por_arquivo = [pq.ParquetFile(a).metadata.num_rows for a in arquivos]
    titulo("Metadados da tabela")
    print(f"Pasta:    {pasta}")
    print(f"Arquivos: {len(arquivos):,} ({tamanho(sum(a.stat().st_size for a in arquivos))})")
    print(f"Linhas:   {sum(linhas_por_arquivo):,}")
    print(f"Colunas:  {len(dataset.schema)} (incluindo as das partições)")
    nomes = sorted({a.name for a in arquivos})
    print(f"Nomes de arquivo: {', '.join(nomes)}")

    particoes = [c for c in ("uf", "ano") if c in dataset.schema.names]
    if particoes:
        titulo("Partições")
        valores = dataset.to_table(columns=particoes).to_pandas()
        for coluna in particoes:
            distintos = sorted(valores[coluna].astype(str).unique(), key=lambda v: (len(v), v) if coluna == "ano" else v)
            amostra = ", ".join(distintos) if len(distintos) <= 40 else ", ".join(distintos[:40]) + ", ..."
            print(f"{coluna} ({len(distintos)}): {amostra}")

    titulo("Esquema")
    for campo in dataset.schema:
        print(f"{campo.name:<28} {campo.type}")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Metadados, esquema e primeiras linhas de um parquet.")
    parser.add_argument("alvo", help="arquivo .parquet, pasta da tabela ou nome da tabela em data/processed/")
    parser.add_argument("--linhas", type=int, default=10, help="quantas linhas mostrar (padrão: 10; 0 = nenhuma)")
    parser.add_argument("--uf", help="filtrar por UF (tabelas particionadas)")
    parser.add_argument("--ano", type=int, help="filtrar por ano (tabelas particionadas)")
    parser.add_argument("--colunas", nargs="+", help="mostrar só estas colunas nas linhas")
    args = parser.parse_args(argv)
    if args.linhas < 0:
        parser.error("--linhas não pode ser negativo")

    caminho = localizar(args.alvo)
    if caminho.is_dir():
        dataset = ds.dataset(caminho, format="parquet", partitioning="hive")
        metadados_pasta(caminho, dataset)
    else:
        dataset = ds.dataset(caminho, format="parquet")
        metadados_arquivo(caminho)

    if args.linhas == 0:
        return
    filtro = None
    for coluna, valor in (("uf", args.uf), ("ano", args.ano)):
        if valor is None:
            continue
        if coluna not in dataset.schema.names:
            sys.exit(f"--{coluna}: a tabela não tem a coluna {coluna}")
        valor = valor.upper() if coluna == "uf" else valor
        condicao = ds.field(coluna) == valor
        filtro = condicao if filtro is None else filtro & condicao
    colunas = args.colunas
    if colunas:
        faltando = set(colunas) - set(dataset.schema.names)
        if faltando:
            sys.exit(f"--colunas: não existem {sorted(faltando)}. Disponíveis: {', '.join(dataset.schema.names)}")

    tabela = dataset.head(args.linhas, columns=colunas, filter=filtro)
    filtros = " ".join(f"{c}={v}" for c, v in (("uf", args.uf and args.uf.upper()), ("ano", args.ano)) if v is not None)
    titulo(f"Primeiras {min(args.linhas, tabela.num_rows)} linhas" + (f" ({filtros})" if filtros else ""))
    if tabela.num_rows == 0:
        print("(nenhuma linha)")
        return
    # Números grandes (R$) com separador e 2 casas; os pequenos com até 6 algarismos significativos (P do IDEB, escores)
    numero = lambda v: f"{v:,.2f}" if abs(v) >= 1e5 else f"{v:.6g}"
    with pd.option_context("display.max_columns", None, "display.width", 200, "display.max_colwidth", 40,
                           "display.float_format", numero):
        print(tabela.to_pandas().to_string(index=False))


if __name__ == "__main__":
    main()
