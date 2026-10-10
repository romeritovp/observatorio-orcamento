"""Royalties e participação especial do petróleo destinados aos ESTADOS (nunca aos municípios), da ANP.

Uso:
    uv run python -m extractors.nacional.anp.compensacoes              # baixa o que falta e grava
    uv run python -m extractors.nacional.anp.compensacoes --atualizar  # baixa tudo de novo

Fonte: dados abertos da ANP, "Participações Governamentais" (ver docs/fontes/anp.md):
- Royalties – Estados: um CSV por ano, formato LARGO (uma linha por mês, uma coluna por estado);
- Participação especial – estados: pe_estado.csv, formato LONGO (competencia; caixa; estado; valor), trimestral.
Os dois: latin1, separador ";", vírgula decimal, datas como número de série do Excel, linhas vazias no fim,
nomes de arquivo variados (royalties_estado_2018, royalties-estado-2019, royalties-estados-2022...).

Brutos, como vieram: data/raw/anp/royalties-estados/<ano>.csv e data/raw/anp/participacao-especial/pe_estado.csv,
com data/raw/anp/manifesto.json (URL de origem e data da extração de cada arquivo).
Tabela gravada: `compensacoes_anp` (uf, cod_ibge, ano, tipo, valor, fonte_dado, extraido_em), somada por ANO DE CAIXA
(quando o dinheiro chegou ao estado, o critério da receita realizada da DCA). tipo: royalties ou participacao_especial.
"""

import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import httpx
import pandas as pd

from extractors import base

PAGINA = "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/participacoes-governamentais"
DIR_RAW = base.RAIZ / "data" / "raw" / "anp"
DIR_ROYALTIES = "royalties-estados"
DIR_PE = "participacao-especial"
ARQUIVO_PE = "pe_estado.csv"
MANIFESTO = "manifesto.json"
FONTES = {"royalties": "anp_royalties_estados", "participacao_especial": "anp_pe_estado"}

RE_ROYALTIES = re.compile(r"royalties[-_]estados?[-_](\d{4})\.csv$", re.IGNORECASE)
RE_PE = re.compile(r"/pe_estado\.csv$", re.IGNORECASE)


# --- download (cache em data/raw/anp/) -------------------------------------------------------

def links_da_pagina(html):
    """{caminho relativo em data/raw/anp: URL} dos arquivos de royalties por estado e de PE por estado."""
    links = {}
    for url in sorted(set(re.findall(r'href="([^"]+\.csv)"', html))):
        if (m := RE_ROYALTIES.search(url)):
            links[f"{DIR_ROYALTIES}/{m.group(1)}.csv"] = url
        elif RE_PE.search(url):
            links[f"{DIR_PE}/{ARQUIVO_PE}"] = url
    return links


def baixar(dir_raw=DIR_RAW, http=None, atualizar=False):
    """Baixa os arquivos que faltam (ou todos, com atualizar) e atualiza o manifesto. Devolve o manifesto."""
    dir_raw = Path(dir_raw)
    caminho_manifesto = dir_raw / MANIFESTO
    manifesto = json.loads(caminho_manifesto.read_text(encoding="utf-8")) if caminho_manifesto.exists() else {}
    http = http or httpx.Client(timeout=60, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"})
    resposta = http.get(PAGINA)
    resposta.raise_for_status()
    links = links_da_pagina(resposta.text)
    if f"{DIR_PE}/{ARQUIVO_PE}" not in links or not any(k.startswith(DIR_ROYALTIES) for k in links):
        raise base.ErroValidacao("página da ANP sem os links esperados (royalties por estado e pe_estado.csv)")
    for relativo, url in links.items():
        destino = dir_raw / relativo
        if destino.exists() and not atualizar:
            continue
        arquivo = http.get(url)
        arquivo.raise_for_status()
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(arquivo.content)  # como veio
        manifesto[relativo] = {"url": url, "extraido_em": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    caminho_manifesto.parent.mkdir(parents=True, exist_ok=True)
    caminho_manifesto.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return manifesto


# --- leitura ---------------------------------------------------------------------------------

def _sem_acento(texto):
    return unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode().strip().lower()


def _data_excel(serie):
    """Número de série do Excel (dias desde 30/12/1899) → data."""
    return pd.to_datetime(pd.to_numeric(serie), unit="D", origin="1899-12-30")


def _numero(serie):
    """'343461217,4' → 343461217.4 (vírgula decimal; ponto como milhar, se houver)."""
    return pd.to_numeric(serie.astype(str).str.strip().str.replace(".", "", regex=False).str.replace(",", ".", regex=False))


def _ler_csv(caminho):
    df = pd.read_csv(caminho, sep=";", dtype=str, encoding="latin1")
    df = df.loc[:, ~df.columns.str.match(r"^Unnamed")]  # coluna vazia do ";" final
    df.columns = [_sem_acento(c) for c in df.columns]
    return df.dropna(subset=["competencia", "caixa"], how="all")  # linhas vazias no fim


def nomes_para_uf(ufs):
    """Nome sem acento, em minúsculas ('sao paulo') → sigla, a partir de dicionarios/nacional/ufs.csv."""
    return {_sem_acento(n): u for n, u in zip(ufs["nome"], ufs["uf"])}


def ler_royalties(caminho, ufs):
    """Arquivo largo de royalties por estado → (uf, competencia, caixa, valor). Estado desconhecido é erro."""
    df = _ler_csv(caminho)
    mapa = nomes_para_uf(ufs)
    estados = [c for c in df.columns if c not in ("competencia", "caixa")]
    desconhecidos = [c for c in estados if c not in mapa]
    if desconhecidos:
        raise base.ErroValidacao(f"{Path(caminho).name}: estados desconhecidos {desconhecidos}")
    if df["competencia"].duplicated().any():
        raise base.ErroValidacao(f"{Path(caminho).name}: competência repetida")
    longo = df.melt(id_vars=["competencia", "caixa"], value_vars=estados, var_name="estado", value_name="valor")
    return pd.DataFrame({"uf": longo["estado"].map(mapa), "competencia": _data_excel(longo["competencia"]),
                         "caixa": _data_excel(longo["caixa"]), "valor": _numero(longo["valor"].fillna("0"))})


def ler_participacao_especial(caminho, ufs):
    """Arquivo longo de participação especial por estado → (uf, competencia, caixa, valor)."""
    df = _ler_csv(caminho)
    mapa = nomes_para_uf(ufs)
    nomes = df["estado"].map(_sem_acento)
    desconhecidos = sorted(set(nomes) - set(mapa))
    if desconhecidos:
        raise base.ErroValidacao(f"{Path(caminho).name}: estados desconhecidos {desconhecidos}")
    return pd.DataFrame({"uf": nomes.map(mapa), "competencia": _data_excel(df["competencia"]),
                         "caixa": _data_excel(df["caixa"]), "valor": _numero(df["valor"])})


def por_ano_de_caixa(lancamentos, tipo, ufs, extraido_em):
    """Lançamentos → uma linha por UF e ano de caixa, no formato da tabela compensacoes_anp."""
    soma = lancamentos.assign(ano=lancamentos["caixa"].dt.year).groupby(["uf", "ano"], as_index=False)["valor"].sum()
    cod = dict(zip(ufs["uf"], ufs["cod_ibge"]))
    return soma.assign(cod_ibge=soma["uf"].map(cod), tipo=tipo, fonte_dado=FONTES[tipo], extraido_em=extraido_em)


def cobertura(royalties, pe):
    """Meses de caixa por ano (royalties) e última data de caixa da participação especial."""
    meses = royalties.groupby(royalties["caixa"].dt.year)["caixa"].nunique().to_dict()
    return {"meses_royalties_por_ano": meses, "pe_ultima_caixa": pe["caixa"].max().date().isoformat()}


def extrair(dir_raw=DIR_RAW, dir_processed=base.DIR_PROCESSED, caminho_ufs=base.CAMINHO_UFS):
    """Lê os brutos de data/raw/anp/, soma por ano de caixa e grava `compensacoes_anp`. Devolve (tabela, cobertura)."""
    dir_raw = Path(dir_raw)
    ufs = pd.read_csv(caminho_ufs, dtype=str)
    manifesto = json.loads((dir_raw / MANIFESTO).read_text(encoding="utf-8"))
    arquivos = sorted((dir_raw / DIR_ROYALTIES).glob("*.csv"))
    if not arquivos:
        raise base.ConsultaVazia("nenhum arquivo de royalties em data/raw/anp/")

    royalties = pd.concat([ler_royalties(a, ufs) for a in arquivos], ignore_index=True)
    if royalties.duplicated(["uf", "competencia"]).any():
        raise base.ErroValidacao("a mesma competência aparece em dois arquivos de royalties")
    pe = ler_participacao_especial(dir_raw / DIR_PE / ARQUIVO_PE, ufs)
    data_royalties = max(manifesto[f"{DIR_ROYALTIES}/{a.name}"]["extraido_em"] for a in arquivos)
    data_pe = manifesto[f"{DIR_PE}/{ARQUIVO_PE}"]["extraido_em"]

    tabela = pd.concat([por_ano_de_caixa(royalties, "royalties", ufs, data_royalties),
                        por_ano_de_caixa(pe, "participacao_especial", ufs, data_pe)], ignore_index=True)
    base.gravar(tabela, "compensacoes_anp", "anp", dir_processed=dir_processed)
    return base.validar_esquema(tabela, "compensacoes_anp"), cobertura(royalties, pe)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    manifesto = baixar(atualizar="--atualizar" in argv)
    print(f"Brutos em data/raw/anp/: {len(manifesto)} arquivos")
    tabela, cob = extrair()
    print(f"compensacoes_anp: {len(tabela)} linhas, {tabela['uf'].nunique()} UFs, anos {tabela['ano'].min()}–{tabela['ano'].max()}")
    incompletos = {a: m for a, m in cob["meses_royalties_por_ano"].items() if m != 12}
    print(f"Royalties: anos com menos de 12 meses de caixa: {incompletos or 'nenhum'}")
    print(f"Participação especial: última data de caixa {cob['pe_ultima_caixa']}")


if __name__ == "__main__":
    main()
