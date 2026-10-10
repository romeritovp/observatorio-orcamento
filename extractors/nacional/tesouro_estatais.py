"""Gera dicionarios/nacional/estatais.csv a partir do "Raio X das Empresas dos Estados" do Tesouro.

Uso:
    uv run python -m extractors.nacional.tesouro_estatais

Fonte: repositório público github.com/tesouro/empresas-estados (Tesouro Nacional), uma pasta por edição
do painel (a edição vN traz o exercício N−1). PLANILHAS diz que arquivo e que aba dão cada exercício:
v2025 (abas ex2024 e ex2023), v2023 (exercício 2022) e v2022 (exercício 2021), estas na aba "Todos",
a mesma que o script R da edição lê. Os arquivos são baixados de um commit fixo (COMMIT), para o
resultado ser reproduzível, e guardados como vieram em data/raw/tesouro_estatais/<commit>/<arquivo>.
Se já existem, não baixa de novo.

A planilha nunca é editada: as diferenças entre abas (nome de coluna com espaço, setor com
quebra de linha) são tratadas na leitura. Detalhes em docs/fontes/tesouro_estatais.md.
"""

import re
import unicodedata
from pathlib import Path

from urllib.parse import quote

import httpx
import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]
DIR_RAW = RAIZ / "data" / "raw" / "tesouro_estatais"
CAMINHO_UFS = RAIZ / "dicionarios" / "nacional" / "ufs.csv"
CAMINHO_SAIDA = RAIZ / "dicionarios" / "nacional" / "estatais.csv"

REPOSITORIO = "tesouro/empresas-estados"
COMMIT = "b7f456b3088064330c6230bac65a160d87224642"
COMMIT_DATA = "2026-04-13"  # data do commit no repositório (docs/fontes/tesouro_estatais.md)
ARQUIVO = "v2025/dados/dados-originais/dados_raw.xlsx"

ARQUIVO_2020 = "v2021/dados/dados-originais/quadro_estatais.xls"  # Excel 97: lido com xlrd
ARQUIVO_2019 = "v2020/dados/dados-originais/Quadro das Empresas Estatais Estaduais PAF 2020v1.xlsx"

# Arquivo do repositório → {aba: exercício a que os dados se referem}
PLANILHAS = {
    ARQUIVO: {"ex2024": 2024, "ex2023": 2023},
    "v2023/dados/dados-originais/quadro_estatais.xlsx": {"Todos": 2022},
    "v2022/dados/dados-originais/quadro_estatais.xlsx": {"Todos": 2021},
    ARQUIVO_2020: {"Estatais": 2020},
    ARQUIVO_2019: {"Dados": 2019},
}

# Exercício → exercício de onde vêm setor e situação, pelo mesmo UF e CNPJ (decisão do usuário, 2026-10-10).
# A edição do exercício 2019 não tem situação e usa uma classificação de setores antiga, sem correspondência
# com a atual; a dependência continua vindo só dela. Os campos herdados ficam marcados no dicionário.
HERANCA = {2019: 2021}
CAMPOS_HERDADOS = ["setor", "situacao"]

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
    "dependente", "situacao", "ano_referencia", "fonte", "campos_herdados", "herdado_de",
]


def url_bruta(commit=COMMIT, arquivo=ARQUIVO):
    return f"https://raw.githubusercontent.com/{REPOSITORIO}/{commit}/{quote(arquivo)}"


def baixar(commit=COMMIT, dir_raw=DIR_RAW, http=None, arquivo=ARQUIVO):
    """Baixa a planilha do commit (se ainda não está em cache) e devolve o caminho local."""
    destino = Path(dir_raw) / commit / arquivo
    if destino.exists():
        return destino
    http = http or httpx.Client(timeout=60, follow_redirects=True)
    resposta = http.get(url_bruta(commit, arquivo))
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
    """Uma aba da planilha só com as colunas do dicionário, tudo como texto, como veio.

    Devolve (df, opcionais, descartadas). A sigla é opcional: as edições dos exercícios 2020 e 2019 não
    têm essa coluna, e ela fica nula. Qualquer outra coluna ausente é erro.
    """
    df = pd.read_excel(caminho, sheet_name=aba, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]  # ex2023 tem 'Setor ', v2023 ' Sigla ', com espaço
    opcionais = []
    if "Sigla" not in df.columns:
        df["Sigla"] = None
        opcionais.append("sigla")
    faltando = set(COLUNAS) - set(df.columns)
    if faltando:
        raise ValueError(f"aba {aba}: colunas ausentes {sorted(faltando)}")
    return df[list(COLUNAS)].rename(columns=COLUNAS), opcionais, []


def ler_aba_paf_2020(caminho, aba):
    """Planilha da edição v2020 (exercício 2019): duas linhas de título e cabeçalho "Grupo > Coluna".

    Sem sigla e sem situação; o setor está numa classificação antiga e não é lido (vem por HERANCA).
    Linhas sem CNPJ de 14 dígitos não têm como ser ligadas às outras edições: saem e voltam em
    `descartadas` (uf, empresa, cnpj como veio), para o resumo e a documentação.
    """
    df = pd.read_excel(caminho, sheet_name=aba, skiprows=2, dtype=str)
    df.columns = [str(c).split(">")[-1].strip() for c in df.columns]
    df = df.loc[:, ~df.columns.duplicated()]
    nomes = {"Estado": "uf", "Nome da Empresa": "empresa", "CNPJ Principal": "cnpj", "Dependência": "dependencia"}
    faltando = set(nomes) - set(df.columns)
    if faltando:
        raise ValueError(f"aba {aba}: colunas ausentes {sorted(faltando)}")
    df = df[list(nomes)].rename(columns=nomes)
    df["dependencia"] = limpar_texto(df["dependencia"]).str.upper()  # 'Não dependente' e 'NÃO DEPENDENTE'
    valido = df["cnpj"].fillna("").str.replace(r"\D", "", regex=True).str.len() == 14
    descartadas = df.loc[~valido, ["uf", "empresa", "cnpj"]].to_dict(orient="records")
    df = df[valido].assign(sigla=None, setor=None, situacao=None)
    return df, ["sigla", "setor", "situacao"], descartadas


# Arquivo → leitor, quando não é o padrão (ler_aba)
LEITORES = {ARQUIVO_2019: ler_aba_paf_2020}


def transformar(df, ano_referencia, ufs, fonte, opcionais=()):
    """Linhas de uma aba → linhas do dicionário. `ufs`: dicionarios/nacional/ufs.csv.

    `opcionais`: colunas que a edição não traz e ficam nulas (ex.: sigla em 2020 e 2019); nas demais,
    vazio é erro.
    """
    df = df.copy()
    for coluna in ["uf", "sigla", "cnpj", "setor", "dependencia", "situacao"]:
        df[coluna] = limpar_texto(df[coluna].astype("object"))  # ex2023 tem '\nDESENVOLVIMENTO REGIONAL'
    for coluna in ["uf", "empresa", "sigla", "cnpj", "setor", "dependencia", "situacao"]:
        if coluna not in opcionais and df[coluna].isna().any():
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
    invalidos = df.loc[df["cnpj"].str.len() != 14, "empresa"].tolist()
    if invalidos:
        raise ValueError(f"{ano_referencia}: CNPJ sem 14 dígitos: {invalidos}")
    # O mesmo CNPJ pode aparecer em duas UFs (ex.: BRDE no RS e em SC), mas não duas vezes na mesma
    if df.duplicated(["uf", "cnpj"]).any():
        raise ValueError(f"{ano_referencia}: CNPJ repetido na mesma UF")

    df["empresa_normalizada"] = df["empresa"].map(normalizar_nome)
    df["ano_referencia"] = ano_referencia
    df["fonte"] = fonte
    df["campos_herdados"] = None
    df["herdado_de"] = None
    return df[COLUNAS_SAIDA]


def herdar(df, heranca=HERANCA, campos=CAMPOS_HERDADOS):
    """Preenche `campos` de cada exercício em `heranca` com os do exercício de origem, pelo mesmo UF e CNPJ,
    e marca `campos_herdados` ("setor,situacao") e `herdado_de` (o exercício). Sem par na origem: continuam
    nulos e sem marca (sem setor, a empresa fica sem área relacionada)."""
    df = df.copy()
    for ano, origem in heranca.items():
        alvo = df["ano_referencia"] == ano
        if not alvo.any():
            continue
        fonte = df[df["ano_referencia"] == origem].set_index(["uf", "cnpj"])[campos]
        chaves = list(zip(df.loc[alvo, "uf"], df.loc[alvo, "cnpj"]))
        achou = pd.Series([k in fonte.index for k in chaves], index=df.index[alvo])
        for campo in campos:
            df.loc[alvo, campo] = [fonte.loc[k, campo] if k in fonte.index else None for k in chaves]
        idx = achou[achou].index
        df.loc[idx, "campos_herdados"] = ",".join(campos)
        df.loc[idx, "herdado_de"] = str(origem)
    return df


def gerar(caminhos, ufs, planilhas=PLANILHAS, commit=COMMIT, descartadas=None):
    """Todas as abas de todas as planilhas → um DataFrame, ordenado por exercício (mais recente primeiro),
    UF e empresa. caminhos: {arquivo do repositório: caminho local}. Exercício repetido é erro.
    Setor e situação herdados conforme HERANCA. `descartadas` (lista): recebe as linhas sem CNPJ válido."""
    partes, anos = [], []
    for arquivo, abas in planilhas.items():
        for aba, ano in abas.items():
            fonte = f"{REPOSITORIO}@{commit[:7]}:{arquivo}#{aba}"
            lidas, opcionais, fora = LEITORES.get(arquivo, ler_aba)(caminhos[arquivo], aba)
            partes.append(transformar(lidas, ano, ufs, fonte, opcionais))
            if descartadas is not None:
                descartadas += [{**d, "ano_referencia": ano} for d in fora]
            anos.append(ano)
    if len(anos) != len(set(anos)):
        raise ValueError(f"exercício repetido entre as planilhas: {sorted(anos)}")
    df = herdar(pd.concat(partes, ignore_index=True))
    return df.sort_values(["ano_referencia", "uf", "empresa_normalizada"], ascending=[False, True, True],
                          ignore_index=True)


def main(dir_raw=DIR_RAW, caminho_saida=CAMINHO_SAIDA):
    caminhos = {arquivo: baixar(dir_raw=dir_raw, arquivo=arquivo) for arquivo in PLANILHAS}
    ufs = pd.read_csv(CAMINHO_UFS, dtype=str)
    descartadas = []
    df = gerar(caminhos, ufs, descartadas=descartadas)
    # dependente gravado como true/false (minúsculas), não True/False do pandas
    df.assign(dependente=df["dependente"].map({True: "true", False: "false"})).to_csv(caminho_saida, index=False)
    for ano, grupo in df.groupby("ano_referencia"):
        print(f"{ano}: {len(grupo)} empresas, {grupo['uf'].nunique()} UFs, "
              f"{int(grupo['dependente'].sum())} dependentes, {(grupo['situacao'] != 'ATIVA').sum()} não ativas")
    for ano, origem in HERANCA.items():
        grupo = df[df["ano_referencia"] == ano]
        herdadas = grupo["campos_herdados"].notna().sum()
        print(f"{ano}: setor e situação herdados de {origem} em {herdadas} de {len(grupo)} empresas; "
              f"sem par em {origem}: {', '.join(f'{u} {e}' for u, e in grupo.loc[grupo['campos_herdados'].isna(), ['uf', 'empresa']].values) or 'nenhuma'}")
    for d in descartadas:
        print(f"descartada ({d['ano_referencia']}, sem CNPJ válido): {d['uf']} {d['empresa']} [{d['cnpj']}]")
    print(f"gravado: {Path(caminho_saida).relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
