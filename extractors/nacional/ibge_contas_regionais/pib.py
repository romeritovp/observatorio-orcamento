"""PIB por UF das Contas Regionais do IBGE: lê as planilhas baixadas e grava `pib_uf` e `pib_uf_atividade`.

Uso:
    uv run python -m extractors.nacional.ibge_contas_regionais.pib              # baixa o que falta e grava
    uv run python -m extractors.nacional.ibge_contas_regionais.pib --atualizar  # baixa tudo de novo

Brutos (ver baixar.py): data/raw/ibge/contas-regionais/<edicao>/, com os zips extraídos em
Conta_da_Producao_<inicio>_<edicao>_xls/ e Especiais_<inicio>_<edicao>_xls/. Excel 97, lido com xlrd.

- Conta da Produção: um arquivo por território (TabelaN.xls), aba 0 = Sumário e abas 1 a 13 = atividades
  (Total, depois as 12 atividades). Cada aba tem três blocos empilhados (valor bruto da produção, consumo
  intermediário, valor adicionado bruto), cada um com título, território, atividade, cabeçalho e um ano por linha.
- Especiais: tab01 (PIB corrente), tab03 (volume do PIB, 2002 = 100), tab04 (VAB) com territórios nas linhas e
  anos nas colunas; tab05 (volume do VAB por atividade, 2002 = 100), uma aba por atividade, só para conferência.

As abas são localizadas pela POSIÇÃO e conferidas pelo conteúdo (território e atividade), nunca pelo nome da aba
nem pelo ano do título (a Tabela19 tem abas com nome errado; 364 títulos dizem 2002-2022). Território ou atividade
diferente do esperado é erro. Células com erro do Excel (#REF!) ou vazias viram nulo e são registradas no log.

Tabelas gravadas (R$ nominais: os valores da fonte, em R$ milhão, são multiplicados por 1.000.000):
- `pib_uf`: uf, cod_ibge, ano, pib_corrente, vab, volume_pib_2002_100, edicao, fonte_dado, extraido_em;
- `pib_uf_atividade`: uf, cod_ibge, ano, atividade_cod, nivel, valor_producao, consumo_intermediario, vab,
  vab_indice_volume, edicao, fonte_dado, extraido_em.
27 UFs e o Brasil (uf "BR", de dicionarios/nacional/territorios.csv). Regiões ficam de fora. Detalhes em
docs/fontes/ibge_contas_regionais.md.
"""

import json
import logging
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd
import xlrd

from extractors import base
from extractors.nacional.ibge_contas_regionais import baixar as download

log = logging.getLogger(__name__)

CAMINHO_TERRITORIOS = base.RAIZ / "dicionarios" / "nacional" / "territorios.csv"
CAMINHO_ATIVIDADES = base.RAIZ / "dicionarios" / "nacional" / "atividades_ibge.csv"
MILHAO = 1_000_000
NOME_ARQUIVO = "ibge_contas_regionais"
FONTES = {"pib_uf": "ibge_cr_especiais", "pib_uf_atividade": "ibge_cr_conta_producao"}

# Blocos da Conta da Produção, na ordem em que aparecem na aba: início do título (sem acento) → coluna da tabela
BLOCOS = [("valor bruto da producao", "valor_producao"),
          ("consumo intermediario", "consumo_intermediario"),
          ("valor adicionado bruto", "vab")]
# Colunas de cada bloco (posição): ano, valor do ano anterior, índice de volume, valor a preços do ano anterior,
# índice de preço, valor a preço corrente. Conferidas pelo cabeçalho.
COL_ANO, COL_VOLUME, COL_CORRENTE = 0, 2, 5
# Tabelas especiais lidas: arquivo → (início do rótulo da medida, sem acento; coluna de pib_uf)
ESPECIAIS = {"tab01": ("produto interno bruto", "pib_corrente"),
             "tab03": ("serie encadeada do volume do produto interno bruto", "volume_pib_2002_100"),
             "tab04": ("valor adicionado bruto", "vab")}
TOLERANCIA = 0.01 * MILHAO  # R$ 0,01 milhão, em R$


def normalizar(texto):
    """'  Santa catarina ' → 'santa catarina' (sem acento, minúsculas, espaços internos simples)."""
    sem_acento = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", sem_acento).strip().lower()


# --- dicionários -----------------------------------------------------------------------------

def territorios(caminho_ufs=base.CAMINHO_UFS, caminho_territorios=CAMINHO_TERRITORIOS):
    """(nome normalizado → (uf, cod_ibge), nomes normalizados de regiões) a partir de ufs.csv e territorios.csv.

    Regiões aparecem como 'Norte' (Especiais) ou 'Região Norte' (Conta da Produção): as duas formas são aceitas.
    """
    ufs = pd.read_csv(caminho_ufs, dtype=str)
    outros = pd.read_csv(caminho_territorios, dtype=str)
    todos = pd.concat([ufs[["uf", "cod_ibge", "nome"]], outros[["uf", "cod_ibge", "nome"]]], ignore_index=True)
    mapa = {normalizar(n): (u, c) for n, u, c in zip(todos["nome"], todos["uf"], todos["cod_ibge"])}
    regioes = {normalizar(r) for r in ufs["regiao"].dropna().unique()}
    regioes |= {f"regiao {r}" for r in regioes}
    return mapa, regioes


def atividades(caminho=CAMINHO_ATIVIDADES):
    """Lista de (atividade_cod, nome normalizado), na ordem das abas (código "01" = Total)."""
    df = pd.read_csv(caminho, dtype=str)
    return [(c, normalizar(n)) for c, n in zip(df["atividade_cod"], df["nome"])]


# --- células ---------------------------------------------------------------------------------

def numero(folha, linha, coluna, ocorrencias=None, contexto=""):
    """Valor numérico da célula; vazia ou erro do Excel (#REF!...) → None. Texto inesperado é erro.

    Erros do Excel são anotados em `ocorrencias` (lista) e no log.
    """
    tipo = folha.cell_type(linha, coluna)
    if tipo == xlrd.XL_CELL_NUMBER:
        return float(folha.cell_value(linha, coluna))
    if tipo in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
        return None
    if tipo == xlrd.XL_CELL_ERROR:
        codigo = xlrd.error_text_from_code.get(folha.cell_value(linha, coluna), "?")
        mensagem = f"{contexto}: célula ({linha + 1}, {coluna + 1}) com erro do Excel {codigo}, gravada como nula"
        log.warning(mensagem)
        if ocorrencias is not None:
            ocorrencias.append(mensagem)
        return None
    raise base.ErroValidacao(f"{contexto}: célula ({linha + 1}, {coluna + 1}) não numérica: "
                             f"{folha.cell_value(linha, coluna)!r}")


def texto(folha, linha, coluna=0):
    return normalizar(folha.cell_value(linha, coluna)) if linha < folha.nrows else ""


# --- Conta da Produção -----------------------------------------------------------------------

def ler_aba_conta(folha, anos, territorio, atividade, ocorrencias=None):
    """Uma aba (território × atividade) → DataFrame (ano, valor_producao, consumo_intermediario, vab,
    vab_indice_volume), em R$ milhão. Confere território, atividade, blocos, cabeçalho e anos."""
    contexto = f"{folha.name} ({territorio}, {atividade})"
    passo = len(anos) + 6  # título, território, atividade, cabeçalho, anos, duas linhas vazias
    saida = pd.DataFrame({"ano": anos})
    for i, (titulo, coluna) in enumerate(BLOCOS):
        r0 = 2 + i * passo
        if not texto(folha, r0).startswith(titulo):
            raise base.ErroValidacao(f"{contexto}: bloco {i + 1} deveria ser '{titulo}', veio {texto(folha, r0)!r}")
        if texto(folha, r0 + 1) != territorio:
            raise base.ErroValidacao(f"{contexto}: território {texto(folha, r0 + 1)!r} ≠ esperado {territorio!r}")
        if texto(folha, r0 + 2) != atividade:
            raise base.ErroValidacao(f"{contexto}: atividade {texto(folha, r0 + 2)!r} ≠ esperada {atividade!r}")
        cabecalho = r0 + 3
        if not (texto(folha, cabecalho, COL_ANO) == "ano" and "volume" in texto(folha, cabecalho, COL_VOLUME)
                and "corrente" in texto(folha, cabecalho, COL_CORRENTE)):
            raise base.ErroValidacao(f"{contexto}: cabeçalho inesperado na linha {cabecalho + 1}")
        linhas = range(cabecalho + 1, cabecalho + 1 + len(anos))
        lidos = [folha.cell_value(r, COL_ANO) for r in linhas]
        if lidos != [float(a) for a in anos]:
            raise base.ErroValidacao(f"{contexto}: anos do bloco {i + 1} diferentes de {anos[0]}–{anos[-1]}")
        saida[coluna] = [numero(folha, r, COL_CORRENTE, ocorrencias, f"{contexto} {coluna} {a}")
                         for r, a in zip(linhas, anos)]
        if coluna == "vab":
            saida["vab_indice_volume"] = [numero(folha, r, COL_VOLUME, ocorrencias, f"{contexto} índice {a}")
                                          for r, a in zip(linhas, anos)]
    return saida


def ler_arquivo_conta(livro, anos, mapa, regioes, lista_atividades, ocorrencias=None):
    """Um arquivo da Conta da Produção → (uf, cod_ibge, DataFrame com atividade_cod), ou None se for região.

    O território é lido da aba 1 (linha 4) e conferido em todas as abas e blocos.
    """
    abas = livro.sheets()[1:]  # aba 0 = Sumário
    if len(abas) != len(lista_atividades):
        raise base.ErroValidacao(f"{len(abas)} abas de atividade; esperadas {len(lista_atividades)}")
    territorio = texto(abas[0], 3)
    if territorio in regioes:
        return None
    if territorio not in mapa:
        raise base.ErroValidacao(f"território desconhecido na Conta da Produção: {territorio!r}")
    partes = []
    for folha, (cod, atividade) in zip(abas, lista_atividades):
        partes.append(ler_aba_conta(folha, anos, territorio, atividade, ocorrencias).assign(atividade_cod=cod))
    uf, cod_ibge = mapa[territorio]
    return uf, cod_ibge, pd.concat(partes, ignore_index=True)


def ler_conta_producao(pasta, anos, mapa, regioes, lista_atividades, ocorrencias=None):
    """Todos os TabelaN.xls da pasta → pib_uf_atividade (sem edicao, fonte e data), em R$ nominais."""
    arquivos = sorted(Path(pasta).glob("Tabela*.xls"), key=lambda p: int(re.sub(r"\D", "", p.stem)))
    if not arquivos:
        raise base.ConsultaVazia(f"nenhum TabelaN.xls em {pasta}")
    partes = {}
    for arquivo in arquivos:
        lido = ler_arquivo_conta(xlrd.open_workbook(arquivo), anos, mapa, regioes, lista_atividades, ocorrencias)
        if lido is None:
            continue
        uf, cod_ibge, df = lido
        if uf in partes:
            raise base.ErroValidacao(f"{arquivo.name}: território {uf} repetido")
        partes[uf] = df.assign(uf=uf, cod_ibge=cod_ibge)
    faltando = sorted({u for u, _ in mapa.values()} - set(partes))
    if faltando:
        raise base.ErroValidacao(f"Conta da Produção sem os territórios {faltando}")
    tabela = pd.concat(partes.values(), ignore_index=True)
    for coluna in ("valor_producao", "consumo_intermediario", "vab"):
        tabela[coluna] = tabela[coluna] * MILHAO
    tabela["nivel"] = tabela["atividade_cod"].map(lambda c: "total" if c == lista_atividades[0][0] else "atividade")
    return tabela


# --- Especiais -------------------------------------------------------------------------------

def ler_especial(folha, anos, mapa, regioes, rotulo):
    """tab01/tab03/tab04 → DataFrame (uf, cod_ibge, ano, valor), valores como na fonte. Regiões ficam de fora."""
    if not texto(folha, 2, 1).startswith(rotulo):
        raise base.ErroValidacao(f"{folha.name}: medida {texto(folha, 2, 1)!r}, esperada '{rotulo}…'")
    colunas = range(1, 1 + len(anos))
    if [folha.cell_value(3, c) for c in colunas] != [float(a) for a in anos]:
        raise base.ErroValidacao(f"{folha.name}: anos do cabeçalho diferentes de {anos[0]}–{anos[-1]}")
    linhas = []
    for r in range(4, folha.nrows):
        nome = texto(folha, r)
        if nome.startswith("fonte"):
            break
        if not nome or nome in regioes:
            continue
        if nome not in mapa:
            raise base.ErroValidacao(f"{folha.name}: território desconhecido {nome!r}")
        uf, cod_ibge = mapa[nome]
        for c, ano in zip(colunas, anos):
            linhas.append((uf, cod_ibge, ano, numero(folha, r, c, contexto=f"{folha.name} {uf} {ano}")))
    df = pd.DataFrame(linhas, columns=["uf", "cod_ibge", "ano", "valor"])
    repetidos = df.duplicated(["uf", "ano"])
    if repetidos.any():
        raise base.ErroValidacao(f"{folha.name}: territórios repetidos {sorted(set(df.loc[repetidos, 'uf']))}")
    faltando = sorted({u for u, _ in mapa.values()} - set(df["uf"]))
    if faltando:
        raise base.ErroValidacao(f"{folha.name}: sem os territórios {faltando}")
    return df


def ler_especiais(pasta, anos, mapa, regioes):
    """tab01, tab03 e tab04 → pib_uf (sem edicao, fonte e data). PIB e VAB em R$ nominais."""
    tabela = None
    for arquivo, (rotulo, coluna) in ESPECIAIS.items():
        folha = xlrd.open_workbook(Path(pasta) / f"{arquivo}.xls").sheet_by_index(0)
        df = ler_especial(folha, anos, mapa, regioes, rotulo).rename(columns={"valor": coluna})
        tabela = df if tabela is None else tabela.merge(df, on=["uf", "cod_ibge", "ano"], how="outer")
    for coluna in ("pib_corrente", "vab"):
        tabela[coluna] = tabela[coluna] * MILHAO
    return tabela


def ler_volume_vab_atividades(caminho_tab05, anos, mapa, regioes, lista_atividades):
    """tab05 (volume do VAB por atividade, 2002 = 100) → DataFrame (uf, ano, atividade_cod, volume_2002_100).

    Só para conferência com os índices anuais da Conta da Produção: não é gravada.
    """
    abas = xlrd.open_workbook(caminho_tab05).sheets()[1:]
    if len(abas) != len(lista_atividades):
        raise base.ErroValidacao(f"tab05: {len(abas)} abas de atividade; esperadas {len(lista_atividades)}")
    partes = []
    for folha, (cod, atividade) in zip(abas, lista_atividades):
        if texto(folha, 4) != atividade:
            raise base.ErroValidacao(f"tab05 {folha.name}: atividade {texto(folha, 4)!r} ≠ esperada {atividade!r}")
        if [folha.cell_value(3, c) for c in range(1, 1 + len(anos))] != [float(a) for a in anos]:
            raise base.ErroValidacao(f"tab05 {folha.name}: anos do cabeçalho diferentes de {anos[0]}–{anos[-1]}")
        linhas = []
        for r in range(5, folha.nrows):
            nome = texto(folha, r)
            if nome.startswith("fonte"):
                break
            if not nome or nome in regioes:
                continue
            if nome not in mapa:
                raise base.ErroValidacao(f"tab05 {folha.name}: território desconhecido {nome!r}")
            for c, ano in enumerate(anos, start=1):
                linhas.append((mapa[nome][0], ano, cod, numero(folha, r, c, contexto=f"tab05 {folha.name}")))
        partes.append(pd.DataFrame(linhas, columns=["uf", "ano", "atividade_cod", "volume_2002_100"]))
    return pd.concat(partes, ignore_index=True)


# --- conferências ----------------------------------------------------------------------------

def conferir(pib_uf, pib_atividade, tolerancia=TOLERANCIA):
    """Confere, em cada território e ano: soma das atividades = total (VBP, CI e VAB), VBP − CI = VAB em cada
    atividade e VAB total da Conta = VAB da tab04. Nulos (Acre 2002) ficam fora. Devolve as maiores diferenças."""
    colunas = ["valor_producao", "consumo_intermediario", "vab"]
    total = pib_atividade[pib_atividade["nivel"] == "total"].set_index(["uf", "ano"])[colunas]
    partes = pib_atividade[pib_atividade["nivel"] == "atividade"]
    completo = partes.groupby(["uf", "ano"])[colunas].agg(lambda s: s.sum() if s.notna().all() else float("nan"))
    dif_soma = (completo - total).abs().max()
    dif_identidade = (pib_atividade["valor_producao"] - pib_atividade["consumo_intermediario"]
                      - pib_atividade["vab"]).abs().max()
    dif_tab04 = (total["vab"] - pib_uf.set_index(["uf", "ano"])["vab"]).abs().max()
    diferencas = {**{f"soma_{c}": dif_soma[c] for c in colunas},
                  "vbp_menos_ci_menos_vab": dif_identidade, "vab_conta_menos_tab04": dif_tab04}
    estouros = {k: v for k, v in diferencas.items() if v > tolerancia}
    if estouros:
        raise base.ErroValidacao(f"conferências das Contas Regionais fora da tolerância (R$): {estouros}")
    return diferencas


# --- extração --------------------------------------------------------------------------------

def pastas(config, dir_raw):
    """(pasta da Conta da Produção, pasta dos Especiais, chave do manifesto de cada zip) da edição."""
    urls = download.urls(config)
    zips = [k for k in urls if k.endswith(".zip")]
    conta = next(k for k in zips if "Conta_da_Producao" in k)
    especiais = next(k for k in zips if "Especiais" in k)
    return (Path(dir_raw) / conta).with_suffix(""), (Path(dir_raw) / especiais).with_suffix(""), conta, especiais


def extrair(config=None, dir_raw=download.DIR_RAW, dir_processed=base.DIR_PROCESSED, caminho_ufs=base.CAMINHO_UFS,
            caminho_territorios=CAMINHO_TERRITORIOS, caminho_atividades=CAMINHO_ATIVIDADES):
    """Lê os brutos da edição, confere e grava `pib_uf` e `pib_uf_atividade`.

    Devolve (pib_uf, pib_uf_atividade, ocorrências de células com erro, maiores diferenças das conferências).
    """
    config = config or download.ler_config()
    edicao, anos = config["edicao"], list(range(config["serie_inicio"], config["edicao"] + 1))
    mapa, regioes = territorios(caminho_ufs, caminho_territorios)
    lista_atividades = atividades(caminho_atividades)
    pasta_conta, pasta_especiais, zip_conta, zip_especiais = pastas(config, dir_raw)
    manifesto = json.loads((Path(dir_raw) / download.MANIFESTO).read_text(encoding="utf-8"))

    ocorrencias = []
    pib_atividade = ler_conta_producao(pasta_conta, anos, mapa, regioes, lista_atividades, ocorrencias)
    pib_uf = ler_especiais(pasta_especiais, anos, mapa, regioes)
    diferencas = conferir(pib_uf, pib_atividade)

    pib_uf = pib_uf.assign(edicao=edicao, fonte_dado=FONTES["pib_uf"],
                           extraido_em=manifesto[zip_especiais]["extraido_em"])
    pib_atividade = pib_atividade.assign(edicao=edicao, fonte_dado=FONTES["pib_uf_atividade"],
                                         extraido_em=manifesto[zip_conta]["extraido_em"])
    base.gravar(pib_uf, "pib_uf", NOME_ARQUIVO, dir_processed=dir_processed)
    base.gravar(pib_atividade, "pib_uf_atividade", NOME_ARQUIVO, dir_processed=dir_processed)
    return (base.validar_esquema(pib_uf, "pib_uf"), base.validar_esquema(pib_atividade, "pib_uf_atividade"),
            ocorrencias, diferencas)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    download.baixar(atualizar="--atualizar" in argv)
    pib_uf, pib_atividade, ocorrencias, diferencas = extrair()
    print(f"pib_uf: {len(pib_uf)} linhas, {pib_uf['uf'].nunique()} territórios, "
          f"anos {pib_uf['ano'].min()}–{pib_uf['ano'].max()}")
    print(f"pib_uf_atividade: {len(pib_atividade)} linhas; valores nulos: "
          f"{int(pib_atividade[['valor_producao', 'consumo_intermediario', 'vab']].isna().sum().sum())}")
    print(f"Células com erro do Excel (gravadas como nulas): {len(ocorrencias)}")
    print("Maiores diferenças nas conferências (R$): "
          + ", ".join(f"{k} = {v:.4f}" for k, v in diferencas.items()))


if __name__ == "__main__":
    main()
