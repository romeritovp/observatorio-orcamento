"""
fbsp.py — extrai as tabelas das planilhas (XLSX) do Fórum Brasileiro de Segurança Pública
(Anuário Brasileiro de Segurança Pública) e junta tudo em formato longo. Os PDFs (edições até 2017) não são lidos.

Uso:
    uv run python -m extractors.nacional.fbsp.fbsp
    uv run python -m extractors.nacional.fbsp.fbsp --ignorar anuario-2016.xlsx   # pula um arquivo
    uv run python -m extractors.nacional.fbsp.fbsp --entrada <pasta> --conferencia <pasta>

Entrada (brutos, nunca editados): data/raw/fbsp/anuario-<edição>.xlsx. A edição vem do nome do arquivo. Qualquer outro
arquivo da pasta (PDFs, planilhas de trabalho, arquivos temporários do Excel "~$...") é listado e ignorado.
Dois arquivos com o mesmo conteúdo (SHA-256) param a extração: a edição sairia trocada. Use --ignorar.

Saídas:
    data/processed/fbsp/uf=<UF>/ano=<ano>/fbsp.parquet   tabela canônica `fbsp` (extractors/base.py): só as células
                                                         com UF (ou BR) e ano identificados (uf, cod_ibge e ano são
                                                         obrigatórios no projeto)
    data/interim/fbsp/fbsp_longo.parquet                 TODAS as células numéricas (para conferência e exploração):
                                                         tabela_id | titulo | rotulo | coluna | ano_coluna | valor ...
    data/interim/fbsp/catalogo.parquet                   1 linha por tabela: arquivo, aba, título, tamanho,
                                                         status, mais o SHA-256 de cada arquivo lido
    data/interim/fbsp/brutos/*.csv                       cada tabela como saiu do arquivo (para conferência)
    data/interim/fbsp/inventario.parquet|csv             combinações distintas de (edicao, titulo, coluna), com contagens:
                                                         base do dicionário de indicadores
    data/interim/fbsp/fora_de_processed.parquet|csv      valores que não entraram em processed/, agrupados pelo motivo

Território de cada linha (nivel_territorial): procurado em todas as colunas de identificação (as primeiras colunas de
texto, não só a 1ª), pelos dicionários (ufs.csv, com o nome da capital, e territorios.csv). Vale o território mais à
direita; o que fica à esquerda é atributo: o grupo de qualidade vai para `grupo_qualidade`, a capital para `capital`.
Colunas de código (IBGE etc.) e de posição em ranking nunca viram valor. Só linhas de UF e Brasil vão para processed/.

Ano de cada célula (ano_origem): o cabeçalho da coluna, se tiver exatamente um ano ("coluna"); senão o título da
tabela, se tiver exatamente um ano ("titulo"); senão nulo (intervalo "2022-2026" ou vários anos não viram ano).
Ano de cabeçalho com qualquer número de notas ("2019 (1) (2)") continua sendo ano. Colunas de variação ("Variação (%)")
nunca vão para processed/: são recalculáveis a partir dos anos.
"""
import argparse
import functools
import hashlib
import re
import unicodedata
from pathlib import Path

import pandas as pd

from extractors import base

FONTE_DADO = "fbsp_anuario"
DIR_RAW = base.RAIZ / "data" / "raw" / "fbsp"
DIR_CONFERENCIA = base.RAIZ / "data" / "interim" / "fbsp"
CAMINHO_TERRITORIOS = base.RAIZ / "dicionarios" / "nacional" / "territorios.csv"

NULOS = {"", "-", "–", "—", "...", "…", "..", "x", "n/d", "nd", "s/i", "nan", "none"}
RE_TITULO = r"(Tabela|Quadro|Gráfico)\s*\d+[^\n]*"
RE_ANO = re.compile(r"\b(19[89]\d|20[0-4]\d)\b")



# ---------------------------------------------------------------- utilidades
def sem_acento(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()


def limpa_texto(s) -> str:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


def parse_numero(s):
    """'1.234,5' -> 1234.5 | '12,3%' -> 12.3 | '-' / '...' -> None | '45 (1)' -> 45."""
    if isinstance(s, (int, float)) and not pd.isna(s):
        return float(s)
    t = limpa_texto(s)
    t = re.sub(r"\(\d+\)|\*+", "", t)          # notas de rodapé: (1), *
    t = t.replace("%", "").replace(" ", "")
    if sem_acento(t) in NULOS:
        return None
    if re.fullmatch(r"-?\d{1,3}(\.\d{3})+(,\d+)?|-?\d+(,\d+)?", t):
        return float(t.replace(".", "").replace(",", "."))
    if re.fullmatch(r"-?\d+\.\d+", t):         # já veio com ponto decimal (xlsx)
        return float(t)
    return None


def tabela_id(*partes) -> str:
    return hashlib.md5("|".join(map(str, partes)).encode()).hexdigest()[:10]


# ----------------------------------------------------------------- território
# Nível de cada linha (nivel_territorial): "uf", "brasil", "capital", "total_capitais", "regiao" ou "municipio";
# nulo quando nada na linha identifica o território. Só "uf" e "brasil" vão para processed/.
RE_GRUPO = re.compile(r"grupo\s*(\d)")
RE_TOTAL_CAPITAIS = re.compile(r"(total (das |de )?)?capitais( e (o )?(df|distrito federal))?")
RE_MUNICIPAL = re.compile(r"\bmunicipios?\b|\bcidades?\b|\bbairros?\b")  # não pega "munição" nem "municipais"
# colunas que nunca são valor: código (IBGE etc.) e posição em ranking. "Nº de vítimas" é valor: o "nº" só conta sozinho
RE_COLUNA_NAO_VALOR = re.compile(r"\bcod(\.|igo)?\b|\bposicao\b|\branking\b|^(n[o°]?\.?|ordem|#|pos\.?)$")


def norm_territorio(s: str) -> str:
    """Texto comparável: sem acento, minúsculo, sem notas de rodapé ("Acre (2)", "DF*") e com espaços simples."""
    s = re.sub(r"\(\d+\)|\*+", " ", sem_acento(s))
    return re.sub(r"\s+", " ", s.replace("-", " ")).strip()


@functools.lru_cache(maxsize=1)
def territorios():
    """Nomes que identificam território, todos a partir de dicionarios/nacional/ (ufs.csv e territorios.csv)."""
    ufs = pd.read_csv(base.CAMINHO_UFS, dtype=str)
    brasil = pd.read_csv(CAMINHO_TERRITORIOS, dtype=str)
    uf_por_nome = {norm_territorio(n): u for u, n in zip(ufs["uf"], ufs["nome"])}
    uf_por_nome |= {norm_territorio(n): u for u, n in zip(brasil["uf"], brasil["nome"])}
    uf_por_nome |= {f"total {norm_territorio(n)}": u for u, n in zip(brasil["uf"], brasil["nome"])}
    regioes = {norm_territorio(r) for r in ufs["regiao"]}
    return {
        "siglas": set(ufs["uf"]) | set(brasil["uf"]),
        "uf_por_nome": uf_por_nome,
        "regioes": regioes | {f"regiao {r}" for r in regioes},
        "capital_por_nome": {norm_territorio(c): (u, c) for u, c in zip(ufs["uf"], ufs["capital"])},
        "capital_da_uf": dict(zip(ufs["uf"], ufs["capital"])),
        "brasil": set(brasil["uf"]),
    }


def grupo_qualidade(texto: str):
    """'Grupo 1', 'Grupo 1 (2)' -> 'Grupo 1'."""
    m = RE_GRUPO.fullmatch(norm_territorio(texto))
    return f"Grupo {m.group(1)}" if m else None


def tipo_celula(texto: str):
    """O que um texto da coluna de identificação diz: ("uf"|"capital"|"total_capitais"|"regiao", sigla, capital),
    ("grupo", ...), ("vazio", ...) ou ("outro", ...)."""
    t = territorios()
    n = norm_territorio(texto)
    if not n or n in NULOS:
        return "vazio", None, None
    if grupo_qualidade(texto):
        return "grupo", None, None
    if texto.strip().upper().rstrip("*") in t["siglas"] and len(n) == 2:
        return "uf", texto.strip().upper().rstrip("*"), None
    if n in t["uf_por_nome"]:
        return "uf", t["uf_por_nome"][n], None
    if n in t["capital_por_nome"]:
        return ("capital", *t["capital_por_nome"][n])
    if RE_TOTAL_CAPITAIS.fullmatch(n):
        return "total_capitais", None, None
    if n in t["regioes"]:
        return "regiao", None, None
    return "outro", None, None


def coluna_nao_valor(nome: str) -> bool:
    """Coluna de código ou de posição em ranking, pelo cabeçalho: nunca vira valor."""
    return any(RE_COLUNA_NAO_VALOR.search(sem_acento(parte).strip()) for parte in nome.split(" | ") if parte)


def colunas_de_identificacao(dados, nomes):
    """Primeiras colunas da tabela que identificam a linha: a 1ª sempre; depois, enquanto a coluna for de código/ranking
    (pelo cabeçalho) ou tiver mais texto que número nas linhas de dados."""
    ncol = len(nomes)
    ids = [0]
    for j in range(1, ncol):
        celulas = [l[j] for l in dados if l[j] and sem_acento(l[j]) not in NULOS]
        numericas = sum(parse_numero(c) is not None for c in celulas)
        if coluna_nao_valor(nomes[j]) or numericas * 2 < len(celulas) or not celulas:
            ids.append(j)
        else:
            break
    # colunas vazias depois da última com texto não são de identificação
    while len(ids) > 1 and not any(l[ids[-1]] for l in dados):
        ids.pop()
    return ids


def papel_da_coluna(partes) -> str:
    """Pelas linhas de cabeçalho da própria coluna (sem as linhas de título da tabela): "capitais" (só capitais),
    "municipios" (só municípios) ou "" (UF, Brasil, grupo, misto como "União, UFs e Municípios"...)."""
    n = norm_territorio(" ".join(partes))
    if re.search(r"unidades? da federacao|\buf\b|\bestados?\b|\bbrasil\b|\buniao\b", n):
        return ""
    if "capita" in n:
        return "capitais"
    if RE_MUNICIPAL.search(n):
        return "municipios"
    return ""


def territorio_da_linha(celulas, titulo_municipal: bool = False):
    """Território da linha a partir das colunas de identificação: lista de (texto, papel_da_coluna), da esquerda
    para a direita. Vale o território mais à direita; o que fica à esquerda é atributo (grupo de qualidade, UF da
    capital). Devolve dict com nivel_territorial, uf, capital e grupo_qualidade."""
    t = territorios()
    saida = {"nivel_territorial": None, "uf": None, "capital": None, "grupo_qualidade": None}
    tem_municipio, coluna_de_capital = False, False
    for texto, papel in celulas:
        tipo, sigla, capital = tipo_celula(texto)
        coluna_de_capital |= papel == "capitais"
        if tipo == "grupo":
            saida["grupo_qualidade"] = grupo_qualidade(texto)
        elif tipo == "outro":
            # nome que não é território: município, se a coluna (ou o título) é de municípios
            tem_municipio |= papel == "municipios" or titulo_municipal
        elif tipo == "uf" and papel in ("capitais", "municipios") and sigla not in t["brasil"]:
            # "Rio de Janeiro" numa coluna de capitais ou de municípios é a cidade
            nivel = "municipio" if papel == "municipios" else "capital"
            saida.update(nivel_territorial=nivel, uf=sigla, capital=t["capital_da_uf"][sigla])
        elif tipo == "capital":
            # numa coluna de municípios, a capital é um município como os outros (o nome fica em `capital`)
            saida.update(nivel_territorial="municipio" if papel == "municipios" else "capital", uf=sigla, capital=capital)
        elif tipo == "uf":
            if saida["nivel_territorial"] in ("capital", "municipio") and saida["uf"] == sigla:
                continue  # "Maceió | AL": a UF da capital é atributo
            saida.update(nivel_territorial="brasil" if sigla in t["brasil"] else "uf", uf=sigla, capital=None)
        elif tipo in ("total_capitais", "regiao"):
            saida.update(nivel_territorial=tipo, uf=None, capital=None)
    if saida["nivel_territorial"] == "uf" and coluna_de_capital:
        # tabela com coluna de capitais e a célula vazia: "DF | -" é Brasília
        saida.update(nivel_territorial="capital", capital=t["capital_da_uf"][saida["uf"]])
    if tem_municipio and saida["nivel_territorial"] in ("uf", "capital"):
        saida.update(nivel_territorial="municipio", capital=None)
    if saida["nivel_territorial"] == "brasil":
        saida["grupo_qualidade"] = None  # a linha Brasil vem antes dos grupos; não herda o grupo de cima
    if saida["nivel_territorial"] not in ("uf", "brasil", "capital", "municipio"):
        saida["uf"] = None
    return saida


# ------------------------------------------------------ tabela crua -> longo
MAX_CABECALHO = 10  # linhas de cabeçalho aceitas (a Tabela 64 da edição 2026 tem 7)
# ano de cabeçalho com qualquer número de notas: "2024", "2023 (2)", "2019 (1) (2)", "2024*"
RE_ANO_DE_CABECALHO = re.compile(r"(19[89]\d|20[0-4]\d)(\s*(\(\d+\)|\*+))*")
RE_VARIACAO = re.compile(r"\bvaria[cç][aã]o\b", re.I)


def eh_ano(celula: str) -> bool:
    """Célula de cabeçalho que é só um ano, com ou sem nota de rodapé colada ("2023 (2)")."""
    return bool(RE_ANO_DE_CABECALHO.fullmatch(celula))


def ano_unico(textos):
    """(ano, quantos anos distintos) nos textos: o ano só vale quando é um só."""
    anos = sorted({int(a) for t in textos for a in RE_ANO.findall(t)})
    return (anos[0] if len(anos) == 1 else None), len(anos)


def ano_da_coluna(partes_coluna, partes_titulo):
    """Ano da célula: (ano, ano_origem, motivo_sem_ano).
    1º o cabeçalho da própria coluna, se tiver exatamente um ano; 2º o título da tabela, se tiver exatamente um ano.
    Intervalo ("2022-2026") ou vários anos não viram ano: ficam nulos, com o motivo."""
    ano, n = ano_unico(partes_coluna)
    if ano is not None:
        return ano, "coluna", None
    if n > 1:
        return None, None, "varios_anos_na_coluna"
    ano, n = ano_unico(partes_titulo)
    if ano is not None:
        return ano, "titulo", None
    return None, None, "varios_anos_no_titulo" if n > 1 else "sem_ano"


def para_longo(linhas, meta, com_textos=False):
    """Recebe a tabela como lista de listas e devolve registros longos. com_textos=True junta a cada registro os textos
    não numéricos da linha inteira (textos_linha), para o diagnóstico (scripts/diagnostico_fbsp.py)."""
    linhas = [[limpa_texto(c) for c in l] for l in linhas if any(limpa_texto(c) for c in l)]
    if len(linhas) < 2:
        return []
    ncol = max(len(l) for l in linhas)
    linhas = [l + [""] * (ncol - len(l)) for l in linhas]

    # cabeçalho = linhas iniciais sem nenhum número fora da 1ª coluna (anos não contam como número)
    n_cab = 0
    for l in linhas[:MAX_CABECALHO]:
        if any(parse_numero(c) is not None and not eh_ano(c) for c in l[1:]):
            break
        n_cab += 1
    n_cab = max(n_cab, 1)

    # células mescladas vêm vazias: propaga para a direita em cada linha de cabeçalho, menos na última quando há
    # mais de uma: ela é a de cada coluna (ex.: os anos), e vazio ali quer dizer "sem" (ex.: "Variação (%)" não herda
    # o "2024" da coluna ao lado)
    cab = []
    for i, l in enumerate(linhas[:n_cab]):
        if n_cab > 1 and i == n_cab - 1:
            cab.append(list(l))
            continue
        ultimo, nova = "", []
        for j, c in enumerate(l):
            ultimo = c or (ultimo if j > 0 else "")
            nova.append(ultimo)
        cab.append(nova)
    nomes = [" | ".join(dict.fromkeys(h[j] for h in cab if h[j])) for j in range(ncol)]

    # Linha de título: vale igual para todas as colunas de valor (ex.: "TABELA 64", "... - 2022-2026").
    # As outras linhas do cabeçalho são da coluna (ex.: "Segurança Privada", "2024").
    eh_titulo = [len({c for c in h[1:] if c}) <= 1 for h in cab]
    partes_titulo = [meta.get("titulo") or ""] + [h[0] or next((c for c in h[1:] if c), "") for h, t in zip(cab, eh_titulo) if t]
    partes_coluna = [[h[j] for h, t in zip(cab, eh_titulo) if not t and h[j]] for j in range(ncol)]
    anos = [ano_da_coluna(partes_coluna[j], partes_titulo) for j in range(ncol)]

    # Colunas de identificação (território e atributos, ex.: grupo de qualidade) e colunas de valor. Código e posição
    # em ranking nunca são valor.
    dados = linhas[n_cab:]
    ids = colunas_de_identificacao(dados, nomes)
    papeis = [papel_da_coluna(partes_coluna[j]) for j in ids]
    valores = [j for j in range(ncol) if j not in ids and not coluna_nao_valor(nomes[j])]
    titulo_municipal = bool(RE_MUNICIPAL.search(norm_territorio(" ".join(partes_titulo))))

    registros, col0_ant = [], ""
    for l in dados:
        # a 1ª coluna vem vazia nas células mescladas: vale a de cima (ex.: "Grupo 1" para as UFs do grupo)
        col0 = l[0] or col0_ant
        col0_ant = col0
        textos = [col0] + [l[j] for j in ids[1:]]
        terr = territorio_da_linha(list(zip(textos, papeis)), titulo_municipal)
        if terr["grupo_qualidade"] is None and terr["nivel_territorial"] not in (None, "brasil"):
            # algumas tabelas trazem o grupo à direita dos valores (ex.: "Grupo de Qualidade" depois da pontuação)
            terr["grupo_qualidade"] = next((g for g in map(grupo_qualidade, l) if g), None)
        rotulo = " | ".join(dict.fromkeys(t for t in textos if t))
        for j in valores:
            v = parse_numero(l[j])
            if v is None:
                continue
            ano, origem, motivo = anos[j]
            registros.append({
                **meta,
                "rotulo": rotulo,
                **terr,
                "coluna": nomes[j],
                "ano_coluna": ano,
                "variacao": bool(RE_VARIACAO.search(" ".join(partes_coluna[j]))),
                "ano_origem": origem,
                "motivo_sem_ano": motivo,
                "valor": v,
                "valor_texto": l[j],
                **({"textos_linha": tuple(c for c in l if c and parse_numero(c) is None and not RE_ANO.fullmatch(c))}
                   if com_textos else {}),
            })
    return registros


# ------------------------------------------------------------------- XLSX
def processa_xlsx(caminho: Path, dir_brutos: Path):
    catalogo, longos = [], []
    for aba, df in pd.read_excel(caminho, sheet_name=None, header=None, dtype=object).items():
        df = df.dropna(how="all").dropna(axis=1, how="all")
        if df.empty:
            continue
        linhas = df.values.tolist()
        primeira = next((limpa_texto(c) for c in linhas[0] if limpa_texto(c)), "")
        titulo = primeira if re.match(RE_TITULO, primeira) else f"{aba} — {primeira}"
        tid = tabela_id(caminho.name, aba)
        meta = {"tabela_id": tid, "arquivo": caminho.name, "local": f"aba:{aba}", "titulo": titulo}
        aba_slug = re.sub(r"\W+", "_", str(aba))
        df.to_csv(dir_brutos / f"{caminho.stem}_{aba_slug}.csv", index=False, header=False)
        regs = para_longo(linhas, meta)
        longos += regs
        catalogo.append({**meta, "n_linhas": len(linhas), "n_colunas": df.shape[1],
                         "n_valores": len(regs), "status": "ok" if regs else "sem_numeros"})
    return catalogo, longos


# ------------------------------------------------------------------- main
RE_ARQUIVO_ANUARIO = re.compile(r"anuario-(\d{4})\.xlsx?", re.I)


def arquivos_do_anuario(entrada: Path, ignorar=()):
    """(planilhas anuario-<edição>.xlsx, demais arquivos ignorados), em ordem de nome."""
    todos = sorted(p for p in entrada.rglob("*") if p.is_file())
    lidos = [p for p in todos if RE_ARQUIVO_ANUARIO.fullmatch(p.name) and p.name not in ignorar]
    return lidos, [p for p in todos if p not in lidos]


def sha256(caminho: Path) -> str:
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def conferir_repetidos(arquivos):
    """Arquivos com o mesmo conteúdo: a edição (tirada do nome) sairia trocada. Erro com a lista."""
    por_hash = {}
    for arq in arquivos:
        por_hash.setdefault(sha256(arq), []).append(arq.name)
    repetidos = [nomes for nomes in por_hash.values() if len(nomes) > 1]
    if repetidos:
        raise base.ErroValidacao(
            "arquivos com o mesmo conteúdo (SHA-256): " + "; ".join(" = ".join(n) for n in repetidos)
            + ". Troque o arquivo errado em data/raw/fbsp/ ou use --ignorar <arquivo>.")


NIVEIS_CANONICOS = ("uf", "brasil")


def tabela_canonica(df):
    """Linhas da tabela `fbsp`: só as células de UF ou Brasil (nunca capital, região ou município) com ano identificado,
    sem as colunas de variação (recalculáveis a partir dos anos), com cod_ibge dos dicionários."""
    codigo = fbsp_codigos()
    saida = df[df["nivel_territorial"].isin(NIVEIS_CANONICOS) & df["uf"].isin(codigo) & df["ano_coluna"].notna()
               & ~df["variacao"].astype(bool)].copy()
    saida["cod_ibge"] = saida["uf"].map(codigo)
    saida["ano"] = saida["ano_coluna"].astype(int)
    saida["fonte_dado"] = FONTE_DADO
    saida["extraido_em"] = None  # arquivos baixados à mão, sem data de extração registrada (o SHA-256 vai no catálogo)
    return saida.drop(columns=["ano_coluna", "motivo_sem_ano", "nivel_territorial", "capital", "variacao"])


def motivo_fora(df):
    """Por que cada célula ficou fora da tabela canônica (None = entrou): o território ("sem_uf" quando não foi
    identificado; "capital", "regiao", "municipio", "total_capitais" quando não é UF nem Brasil), o motivo do ano nulo
    ("variacao" para coluna de variação), ou os dois ("sem_uf + varios_anos_no_titulo")."""
    nivel = df["nivel_territorial"]
    canonico = nivel.isin(NIVEIS_CANONICOS) & df["uf"].isin(set(fbsp_codigos()))
    motivo_terr = nivel.where(nivel.notna() & ~nivel.isin(NIVEIS_CANONICOS), "sem_uf")
    variacao = df["variacao"].astype(bool)
    sem_ano = df["ano_coluna"].isna() | variacao
    motivo_ano = df["motivo_sem_ano"].where(~variacao, "variacao").fillna("sem_ano")
    return pd.Series(
        [(t + " + " + m) if not c and a else t if not c else m if a else None
         for c, t, a, m in zip(canonico, motivo_terr, sem_ano, motivo_ano)], index=df.index, dtype="object")


def fbsp_codigos():
    codigos = pd.concat([pd.read_csv(c, dtype=str)[["uf", "cod_ibge"]] for c in (base.CAMINHO_UFS, CAMINHO_TERRITORIOS)])
    return dict(zip(codigos["uf"], codigos["cod_ibge"]))


def inventario(df):
    """Combinações distintas de (edicao, titulo, coluna): base do dicionário de indicadores."""
    df = df.assign(_fora=motivo_fora(df), _ano=df["ano_coluna"])
    grupos = df.groupby(["edicao", "titulo", "coluna"], dropna=False, sort=True)
    saida = grupos.agg(
        n_valores=("valor", "size"),
        n_em_processed=("_fora", lambda s: int(s.isna().sum())),
        n_ufs=("uf", "nunique"),
        anos=("_ano", lambda s: ", ".join(str(int(a)) for a in sorted(s.dropna().unique()))),
        ano_origem=("ano_origem", lambda s: ", ".join(sorted(s.dropna().unique()))),
        arquivo=("arquivo", "first"),
        local=("local", lambda s: ", ".join(dict.fromkeys(s))),
        tabela_id=("tabela_id", "first"),
    ).reset_index()
    return saida.sort_values(["edicao", "titulo", "coluna"]).reset_index(drop=True)


def resumo_fora(df):
    """Valores fora de processed/ agrupados pelo motivo, com contagens e exemplos de rótulos."""
    fora = df.assign(motivo=motivo_fora(df))
    fora = fora[fora["motivo"].notna()]
    linhas = []
    for motivo, parte in fora.groupby("motivo"):
        linhas.append({
            "motivo": motivo, "n_valores": len(parte), "n_tabelas": parte["tabela_id"].nunique(),
            "edicoes": ", ".join(str(int(e)) for e in sorted(parte["edicao"].dropna().unique())),
            "exemplos_rotulo": " | ".join(parte["rotulo"].value_counts().head(8).index),
            "exemplos_titulo": " | ".join(parte["titulo"].value_counts().head(5).index),
        })
    total = pd.DataFrame(linhas).sort_values("n_valores", ascending=False)
    return pd.concat([total, pd.DataFrame([{"motivo": "TOTAL", "n_valores": int(total["n_valores"].sum()),
                                            "n_tabelas": fora["tabela_id"].nunique()}])], ignore_index=True)


def gravar_tabela(df, caminho):
    """Parquet e CSV (UTF-8 com BOM, para abrir no Excel) lado a lado."""
    df.to_parquet(caminho.with_suffix(".parquet"), index=False)
    df.to_csv(caminho.with_suffix(".csv"), index=False, encoding="utf-8-sig")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", default=str(DIR_RAW), help="pasta com as planilhas do FBSP (padrão: data/raw/fbsp)")
    ap.add_argument("--conferencia", default=str(DIR_CONFERENCIA),
                    help="pasta da tabela longa completa, do catálogo e dos CSV (padrão: data/interim/fbsp)")
    ap.add_argument("--ignorar", nargs="*", default=[], help="nomes de arquivo a pular (ex.: anuario-2016.xlsx)")
    args = ap.parse_args(argv)

    entrada, conferencia = Path(args.entrada), Path(args.conferencia)
    dir_brutos = conferencia / "brutos"
    dir_brutos.mkdir(parents=True, exist_ok=True)

    arquivos, ignorados = arquivos_do_anuario(entrada, args.ignorar)
    if ignorados:
        print(f"ignorados ({len(ignorados)}, fora do padrão anuario-<edição>.xlsx ou em --ignorar): "
              + ", ".join(p.name for p in ignorados))
    conferir_repetidos(arquivos)

    catalogo, longos = [], []
    for arq in arquivos:
        print(f"→ {arq.name}")
        try:
            c, l = processa_xlsx(arq, dir_brutos)
            catalogo += [{**x, "sha256": sha256(arq)} for x in c]
            longos += l
        except Exception as e:  # um arquivo quebrado não derruba o lote
            catalogo.append({"arquivo": arq.name, "sha256": sha256(arq), "status": f"erro: {e}"})

    df = pd.DataFrame(longos)
    gravados = []
    if not df.empty:
        # edição do Anuário a partir do nome do arquivo (ex.: anuario-2024.xlsx)
        df["edicao"] = df["arquivo"].str.extract(r"(20\d{2})", expand=False).astype("Int64")
        df["ano_coluna"] = df["ano_coluna"].astype("Int64")
        df.to_parquet(conferencia / "fbsp_longo.parquet", index=False)
        gravar_tabela(inventario(df), conferencia / "inventario")
        resumo = resumo_fora(df)
        gravar_tabela(resumo, conferencia / "fora_de_processed")
        print("\nFora de processed/, por motivo:")
        print(resumo[["motivo", "n_valores", "n_tabelas"]].to_string(index=False))
        gravados = base.gravar(tabela_canonica(df), "fbsp", "fbsp")
    pd.DataFrame(catalogo).to_parquet(conferencia / "catalogo.parquet", index=False)

    canonicas = sum(len(pd.read_parquet(g)) for g in gravados)
    print(f"\n{len(arquivos)} arquivos | {len(catalogo)} tabelas | {len(df)} valores "
          f"({canonicas} com UF e ano → data/processed/fbsp/, {len(gravados)} arquivos)")
    print(f"Conferência em: {conferencia}")


if __name__ == "__main__":
    main()
