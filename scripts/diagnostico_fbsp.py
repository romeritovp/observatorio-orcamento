"""Diagnóstico do FBSP: o que ficou fora de data/processed/fbsp/ e por quê, para medir antes e depois de cada mudança
no extrator (extractors/nacional/fbsp/fbsp.py).

Uso (depois de rodar o extrator):
    uv run python scripts/diagnostico_fbsp.py                     # compara com o retrato "antes" guardado
    uv run python scripts/diagnostico_fbsp.py --salvar-como-antes  # o resultado de agora vira o novo "antes"
    uv run python scripts/diagnostico_fbsp.py --detalhe            # + tabelas que concentram capitais e municípios

Relê os CSV de conferência (data/interim/fbsp/brutos/) com a MESMA leitura do extrator, guardando os textos de cada
linha, e classifica cada valor fora de processed/ pelo território da linha:
    capitais, outros municípios, regiões, Brasil, UF (rótulo fora das colunas de identificação),
    UF (sem ano inequívoco), não identificados.
Quando o extrator já identificou o território (nivel_territorial), vale o dele; senão, os textos da linha decidem
(mesma regra do retrato "antes", feito quando o extrator só olhava a 1ª coluna).

Também confere a aceitação: em cada edição, a tabela de mortes violentas intencionais (MVI) por UF deve estar em
processed/ com as 27 UFs, e a soma das UFs deve bater com a linha Brasil em cada coluna de números absolutos.

Saídas em data/interim/fbsp/diagnostico/:
    fora_classificado.parquet          cada valor fora de processed/, com o grupo
    resumo_grupos.csv                  antes x depois, por grupo
    aceitacao_mvi.csv                  uma linha por edição
    antes_fora_classificado.parquet    retrato "antes" (só muda com --salvar-como-antes)
"""
import argparse
import re
import shutil
import sys
import unicodedata
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
from extractors import base  # noqa: E402
from extractors.nacional.fbsp import fbsp  # noqa: E402

DIR = RAIZ / "data" / "interim" / "fbsp"
DIR_SAIDA = DIR / "diagnostico"
ANTES = DIR_SAIDA / "antes_fora_classificado.parquet"
ORDEM = ["capitais", "outros municípios", "regiões", "Brasil", "UF (rótulo fora das colunas de identificação)",
         "UF (sem ano inequívoco)", "não identificados"]
# nome do grupo no retrato de antes (o extrator só olhava a 1ª coluna)
NOMES_ANTIGOS = {"UF (rótulo fora da 1ª coluna)": "UF (rótulo fora das colunas de identificação)"}
POR_NIVEL = {"uf": "UF (sem ano inequívoco)", "brasil": "Brasil", "capital": "capitais", "total_capitais": "capitais",
             "municipio": "outros municípios", "regiao": "regiões"}


# --------------------------------------------------------------- releitura
def reler():
    """Todos os valores, lidos dos CSV de conferência como o extrator lê, com os textos de cada linha."""
    catalogo = pd.read_parquet(DIR / "catalogo.parquet")
    catalogo = catalogo[catalogo["tabela_id"].notna()]
    registros = []
    for t in catalogo.itertuples():
        csv = caminho_do_csv(t)
        if csv is None:
            continue
        linhas = pd.read_csv(csv, header=None, dtype=object, keep_default_na=False).values.tolist()
        meta = {"tabela_id": t.tabela_id, "arquivo": t.arquivo, "local": t.local, "titulo": t.titulo}
        regs = fbsp.para_longo(linhas, meta, com_textos=True)
        descritivo = titulo_descritivo(linhas, t)
        for r in regs:
            r["titulo_descritivo"] = descritivo
        registros += regs
    df = pd.DataFrame(registros)
    df["edicao"] = df["arquivo"].str.extract(r"(20\d{2})", expand=False).astype("Int64")
    df["ano_coluna"] = df["ano_coluna"].astype("Int64")
    df["motivo"] = fbsp.motivo_fora(df)
    return df


def caminho_do_csv(t):
    """CSV de conferência da aba (data/interim/fbsp/brutos/<arquivo>_<aba>.csv)."""
    if not t.local.startswith("aba:"):
        return None
    stem = t.arquivo.rsplit(".", 1)[0]
    csv = DIR / "brutos" / f"{stem}_{re.sub(r'\W+', '_', str(t.local[4:]))}.csv"
    return csv if csv.exists() else None


def titulo_descritivo(linhas, t):
    """As primeiras linhas de texto da aba (o "titulo" é só "T07 — TABELA 07")."""
    cab = [next((str(c).strip() for c in l if str(c).strip()), "") for l in linhas[:4]]
    return " | ".join(x for x in cab if x and "Voltar" not in x)[:160]


# ----------------------------------------------------------- classificação
def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\(\d+\)|\*+|\s+", " ", s).strip()


ufs = pd.read_csv(base.CAMINHO_UFS, dtype=str)
SIGLAS = set(ufs["uf"])
NOMES_UF = {norm(n) for n in ufs["nome"]}
REGIOES = {norm(r) for r in ufs["regiao"].unique()} | {f"regiao {norm(r)}" for r in ufs["regiao"].unique()}
CAPITAIS = {norm(c) for c in ufs["capital"]}
TOTAIS_CAPITAIS = {"total capitais", "capitais", "total das capitais", "capitais e distrito federal"}
TOTAIS_BRASIL = {"brasil", "total brasil", "total", "total geral", "brasil (total)"}
NAO_NOMES = TOTAIS_BRASIL | TOTAIS_CAPITAIS | {"unidades da federacao", "municipios", "municipio", "capital", "uf", "grupo"}


def grupo_pelos_textos(r):
    """Regra do retrato "antes": o território pelo conjunto de textos da linha."""
    textos = [norm(t) for t in r.textos_linha]
    siglas = [t.upper() for t in textos if t.upper() in SIGLAS]
    nomes = [t for t in textos if t.upper() not in SIGLAS and len(t) > 2
             and not re.fullmatch(r"(grupo \d+|-)", t)]
    contexto = norm(f"{r.titulo} {r.titulo_descritivo} {r.coluna}")
    municipal = re.search(r"\bmunicipios?\b|\bcidades?\b", contexto) is not None  # não "munição" nem "municipais"
    if any(t in TOTAIS_CAPITAIS for t in textos):
        return "capitais"
    # nome de capital; quando ele é também nome de UF (Rio de Janeiro, São Paulo), só vale em tabela de capitais/municípios
    capitais = [t for t in nomes if t in CAPITAIS]
    if capitais and ("capita" in contexto or municipal or any(t not in NOMES_UF for t in capitais)):
        return "capitais"
    if any(t in {"brasil", "total brasil"} for t in textos):
        return "Brasil"
    if any(t in REGIOES for t in textos):
        return "regiões"
    if municipal and [t for t in nomes if t not in NOMES_UF and t not in REGIOES and t not in NAO_NOMES]:
        return "outros municípios"
    if siglas or any(t in NOMES_UF for t in textos):
        return "UF (rótulo fora das colunas de identificação)"
    return "não identificados"


def classificar(fora):
    nivel = fora["nivel_territorial"]
    return [POR_NIVEL[n] if isinstance(n, str) else grupo_pelos_textos(r) for n, r in zip(nivel, fora.itertuples())]


def resumo(fora):
    r = fora.groupby("grupo").agg(valores=("valor", "size"), edicoes=("edicao", "nunique"),
                                  tabelas=("tabela_id", "nunique"))
    return r.reindex(ORDEM).fillna(0).astype(int)


# --------------------------------------------------------------- aceitação
RE_MVI = re.compile(r"mortes violentas intencionais (?:\(mvi\) )?\(1\)")
RE_NAO_MVI_UF = re.compile(r"serie historica|semestre|qualidade estimada|capitais|por sexo|por raca|por idade|por cor")


def aceitacao_mvi(df):
    """Por edição: a 1ª tabela "Mortes violentas intencionais (1) — Brasil e Unidades da Federação" (sem a série
    histórica, o semestre, o ranking de qualidade nem as capitais); UFs em processed/ e soma das UFs x Brasil."""
    em_processed = df[df["motivo"].isna()]
    linhas = []
    for edicao in sorted(df["edicao"].dropna().unique()):
        parte = df[df["edicao"] == edicao]
        texto = (parte["titulo_descritivo"] + " | " + parte["coluna"]).map(lambda s: unicodedata.normalize(
            "NFKD", s).encode("ascii", "ignore").decode().lower())
        alvo = parte[texto.str.contains(RE_MVI) & texto.str.contains("brasil e unidades da federacao")
                     & ~texto.str.contains(RE_NAO_MVI_UF)]
        linha = {"edicao": int(edicao), "arquivo": parte["arquivo"].iloc[0], "tabela": None, "ufs_em_processed": 0,
                 "colunas_absolutas": 0, "colunas_soma_diferente": None, "celulas_nao_disponiveis": None, "ok": False}
        if alvo.empty:
            linha["observacao"] = "tabela de MVI por UF não encontrada na extração"
            linhas.append(linha)
            continue
        tabela_id = alvo["tabela_id"].iloc[0]
        t = em_processed[(em_processed["tabela_id"] == tabela_id)]
        abs_ = t[t["coluna"].str.contains(r"Absolut|Abs\.", regex=True)]
        soma = abs_[abs_["uf"] != "BR"].groupby("coluna")["valor"].sum()  # "-" fica fora da tabela: soma como zero
        brasil = abs_[abs_["uf"] == "BR"].groupby("coluna")["valor"].sum()
        diferentes = (soma.reindex(brasil.index).fillna(0) - brasil).abs() > 0.5
        todas = parte[parte["tabela_id"] == tabela_id]
        linha.update(tabela=f"{alvo['local'].iloc[0]} — {alvo['titulo_descritivo'].iloc[0][:70]}",
                     ufs_em_processed=t.loc[t["uf"] != "BR", "uf"].nunique(), colunas_absolutas=len(brasil),
                     colunas_soma_diferente=int(diferentes.sum()),
                     celulas_nao_disponiveis=nao_disponiveis(todas))
        linha["ok"] = linha["ufs_em_processed"] == 27 and len(brasil) > 0 and linha["colunas_soma_diferente"] == 0
        linhas.append(linha)
    return pd.DataFrame(linhas)


def nao_disponiveis(tabela):
    """Células "..." (informação não disponível) não viram valor; contadas a partir do CSV de conferência."""
    t = tabela.iloc[0]
    csv = caminho_do_csv(t)
    if csv is None:
        return None
    return int((pd.read_csv(csv, header=None, dtype=str, keep_default_na=False).map(str.strip).isin(["...", "…"])).sum().sum())


# ---------------------------------------------------------------- relatório
def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--salvar-como-antes", action="store_true", help="guarda o resultado de agora como retrato 'antes'")
    ap.add_argument("--detalhe", action="store_true", help="lista as tabelas que concentram capitais e municípios")
    args = ap.parse_args(argv)
    DIR_SAIDA.mkdir(parents=True, exist_ok=True)
    pd.set_option("display.width", 220)
    pd.set_option("display.max_colwidth", 90)

    df = reler()
    extraidos = len(pd.read_parquet(DIR / "fbsp_longo.parquet", columns=["valor"]))
    fora = df[df["motivo"].notna()].copy()
    print(f"releitura: {len(df):,} valores (extração: {extraidos:,}); em processed/: {len(df) - len(fora):,}; "
          f"fora: {len(fora):,}")
    fora["grupo"] = classificar(fora)
    fora.drop(columns=["textos_linha"]).to_parquet(DIR_SAIDA / "fora_classificado.parquet", index=False)

    depois = resumo(fora)
    if ANTES.exists():
        antes_df = pd.read_parquet(ANTES)
        # o retrato "antes" pode trazer valores dos PDFs (lidos até 2026-10-15): compara só as planilhas
        antes_df = antes_df[~antes_df["arquivo"].str.lower().str.endswith(".pdf")]
        antes_df["grupo"] = antes_df["grupo"].replace(NOMES_ANTIGOS)
        antes = resumo(antes_df)
        tabela = pd.concat({"antes": antes, "depois": depois}, axis=1)
        tabela[("diferença", "valores")] = tabela[("depois", "valores")] - tabela[("antes", "valores")]
        tabela.loc["total"] = [antes["valores"].sum(), antes_df["edicao"].nunique(), antes_df["tabela_id"].nunique(),
                               depois["valores"].sum(), fora["edicao"].nunique(), fora["tabela_id"].nunique(),
                               depois["valores"].sum() - antes["valores"].sum()]
    else:
        tabela = depois
        tabela.loc["total"] = [depois["valores"].sum(), fora["edicao"].nunique(), fora["tabela_id"].nunique()]
    print("\nValores fora de processed/, por grupo:")
    print(tabela.to_string())
    tabela.columns = [" ".join(c) if isinstance(c, tuple) else c for c in tabela.columns]
    tabela.to_csv(DIR_SAIDA / "resumo_grupos.csv", encoding="utf-8-sig")

    print("\nFora de processed/, por motivo (como o extrator grava):")
    print(fora["motivo"].value_counts().to_string())

    ac = aceitacao_mvi(df)
    ac.to_csv(DIR_SAIDA / "aceitacao_mvi.csv", index=False, encoding="utf-8-sig")
    print("\nAceitação: tabela de MVI por UF de cada edição (27 UFs; soma das UFs = Brasil nas colunas absolutas)")
    print(ac.drop(columns=["arquivo"]).to_string(index=False))

    if args.detalhe:
        mun = fora[fora["grupo"].isin(["capitais", "outros municípios"])]
        top = (mun.groupby(["grupo", "edicao", "local", "titulo_descritivo"]).size().rename("valores").reset_index()
               .sort_values("valores", ascending=False))
        for g in ["capitais", "outros municípios"]:
            print(f"\n[{g}] as 15 maiores tabelas:")
            print(top[top.grupo == g].head(15).drop(columns="grupo").to_string(index=False))

    if args.salvar_como_antes:
        shutil.copy(DIR_SAIDA / "fora_classificado.parquet", ANTES)
        print(f"\nretrato 'antes' atualizado: {ANTES.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
