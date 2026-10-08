"""Gera dicionarios/nacional/estatais.csv a partir do "Raio X das Empresas dos Estados" do Tesouro.

Uso:
    uv run python -m extractors.nacional.tesouro_estatais

Fonte: repositório público github.com/tesouro/empresas-estados (Tesouro Nacional), planilha
v2025/dados/dados-originais/dados_raw.xlsx, abas ex2024 e ex2023 (uma por exercício).
O arquivo é baixado de um commit fixo (COMMIT), para o resultado ser reproduzível, e guardado
como veio em data/raw/tesouro_estatais/<commit>/dados_raw.xlsx. Se já existe, não baixa de novo.

A planilha nunca é editada: as diferenças entre abas (nome de coluna com espaço, setor com
quebra de linha) são tratadas na leitura. Detalhes em docs/fontes/tesouro_estatais.md.
"""

import re
import unicodedata
from pathlib import Path

import httpx
import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]
DIR_RAW = RAIZ / "data" / "raw" / "tesouro_estatais"
CAMINHO_UFS = RAIZ / "dicionarios" / "nacional" / "ufs.csv"
CAMINHO_SAIDA = RAIZ / "dicionarios" / "nacional" / "estatais.csv"

REPOSITORIO = "tesouro/empresas-estados"
COMMIT = "b7f456b3088064330c6230bac65a160d87224642"
ARQUIVO = "v2025/dados/dados-originais/dados_raw.xlsx"

# Aba da planilha → exercício a que os dados se referem
ABAS = {"ex2024": 2024, "ex2023": 2023}

# Coluna da planilha (sem espaços nas pontas) → coluna do dicionário
COLUNAS = {
    "UF": "uf",
    "Estatal": "empresa",
    "Sigla": "sigla",
    "CNPJ": "cnpj",
    "Setor": "setor",
    "Dependência": "dependencia",
    "Situação": "situacao",
}

DEPENDENCIA = {"DEPENDENTE": True, "NÃO DEPENDENTE": False}

COLUNAS_SAIDA = [
    "uf", "cod_ibge", "empresa", "empresa_normalizada", "sigla", "cnpj", "setor",
    "dependente", "situacao", "ano_referencia", "fonte",
]


def url_bruta(commit=COMMIT, arquivo=ARQUIVO):
    return f"https://raw.githubusercontent.com/{REPOSITORIO}/{commit}/{arquivo}"


def baixar(commit=COMMIT, dir_raw=DIR_RAW, http=None):
    """Baixa a planilha do commit (se ainda não está em cache) e devolve o caminho local."""
    destino = Path(dir_raw) / commit / Path(ARQUIVO).name
    if destino.exists():
        return destino
    http = http or httpx.Client(timeout=60, follow_redirects=True)
    resposta = http.get(url_bruta(commit))
    resposta.raise_for_status()
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(resposta.content)
    return destino


def limpar_texto(serie):
    """Tira espaços e quebras de linha das pontas e junta espaços repetidos no meio."""
    return serie.str.replace(r"\s+", " ", regex=True).str.strip()


def normalizar_nome(nome):
    """Nome para comparação: maiúsculas, sem acentos, só letras/números, espaços simples."""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]", " ", sem_acento.upper())).strip()


def ler_aba(caminho, aba):
    """Uma aba da planilha só com as colunas do dicionário, tudo como texto, como veio."""
    df = pd.read_excel(caminho, sheet_name=aba, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]  # ex2023 tem 'Setor ' com espaço
    faltando = set(COLUNAS) - set(df.columns)
    if faltando:
        raise ValueError(f"aba {aba}: colunas ausentes {sorted(faltando)}")
    return df[list(COLUNAS)].rename(columns=COLUNAS)


def transformar(df, ano_referencia, ufs, fonte):
    """Linhas de uma aba → linhas do dicionário. `ufs`: dicionarios/nacional/ufs.csv."""
    df = df.copy()
    for coluna in ["uf", "sigla", "cnpj", "setor", "dependencia", "situacao"]:
        df[coluna] = limpar_texto(df[coluna])  # ex2023 tem '\nDESENVOLVIMENTO REGIONAL'
    for coluna in ["uf", "empresa", "sigla", "cnpj", "setor", "dependencia", "situacao"]:
        if df[coluna].isna().any():
            raise ValueError(f"{ano_referencia}: {coluna} vazio em {df[coluna].isna().sum()} linha(s)")

    df["uf"] = df["uf"].str.upper()
    desconhecidas = set(df["uf"]) - set(ufs["uf"])
    if desconhecidas:
        raise ValueError(f"{ano_referencia}: UF fora de ufs.csv: {sorted(desconhecidas)}")
    df = df.merge(ufs[["uf", "cod_ibge"]], on="uf", how="left")

    valores = set(df["dependencia"]) - set(DEPENDENCIA)
    if valores:
        raise ValueError(f"{ano_referencia}: dependência não reconhecida: {sorted(valores)}")
    df["dependente"] = df["dependencia"].map(DEPENDENCIA)

    # CNPJ só com os 14 dígitos (chave estável entre edições; nome e sigla mudam)
    df["cnpj"] = df["cnpj"].str.replace(r"\D", "", regex=True)
    invalidos = df.loc[df["cnpj"].str.len() != 14, "sigla"].tolist()
    if invalidos:
        raise ValueError(f"{ano_referencia}: CNPJ sem 14 dígitos: {invalidos}")
    # O mesmo CNPJ pode aparecer em duas UFs (ex.: BRDE no RS e em SC), mas não duas vezes na mesma
    if df.duplicated(["uf", "cnpj"]).any():
        raise ValueError(f"{ano_referencia}: CNPJ repetido na mesma UF")

    df["empresa_normalizada"] = df["empresa"].map(normalizar_nome)
    df["ano_referencia"] = ano_referencia
    df["fonte"] = fonte
    return df[COLUNAS_SAIDA]


def gerar(caminho, ufs, abas=ABAS, commit=COMMIT):
    """Todas as abas → um DataFrame, ordenado por exercício (mais recente primeiro), UF e empresa."""
    partes = []
    for aba, ano in abas.items():
        fonte = f"{REPOSITORIO}@{commit[:7]}:{ARQUIVO}#{aba}"
        partes.append(transformar(ler_aba(caminho, aba), ano, ufs, fonte))
    df = pd.concat(partes, ignore_index=True)
    return df.sort_values(["ano_referencia", "uf", "empresa_normalizada"], ascending=[False, True, True],
                          ignore_index=True)


def main(dir_raw=DIR_RAW, caminho_saida=CAMINHO_SAIDA):
    caminho = baixar(dir_raw=dir_raw)
    ufs = pd.read_csv(CAMINHO_UFS, dtype=str)
    df = gerar(caminho, ufs)
    # dependente gravado como true/false (minúsculas), não True/False do pandas
    df.assign(dependente=df["dependente"].map({True: "true", False: "false"})).to_csv(caminho_saida, index=False)
    for ano, grupo in df.groupby("ano_referencia"):
        print(f"{ano}: {len(grupo)} empresas, {grupo['uf'].nunique()} UFs, "
              f"{int(grupo['dependente'].sum())} dependentes, {(grupo['situacao'] != 'ATIVA').sum()} não ativas")
    print(f"gravado: {Path(caminho_saida).relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
