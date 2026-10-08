"""Despesa liquidada em Saúde (função 10): per capita real e % da despesa total, UF contra pares e mediana.

Uso:
    uv run python -m analyses.saude --uf RJ
    uv run python -m analyses.saude --uf RJ --pares SP MG ES --anos 2019 2025

Para cada UF pedida, grava em outputs/<UF>/saude/:
    saude.csv   por ano, para a UF, os pares e a mediana das UFs: valor real per capita,
                variação anual, % da despesa total e posição entre as UFs nas duas medidas
    saude.png   dois painéis (per capita e % da despesa total) com a UF em destaque
    robustez_intra.csv   todas as UFs: liquidado da função 10 com e sem intraorçamentárias
                (RREO Anexo 02, 6º bim.), peso das intra e posição no per capita nas duas versões

Fonte: DCA Anexo I-E (tabela despesa, nivel funcao, sem intraorçamentárias).
Despesa executada = liquidado (docs/decisoes.md). Valores a preços de dezembro do
último ano, pelo IPCA. O per capita tem vieses de população e de divisão de
responsabilidades com os municípios (docs/decisoes.md); o % da despesa total não
depende da população.
"""

import argparse

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib.ticker import FuncFormatter, MultipleLocator  # noqa: E402

from analyses.carregar import RAIZ, carregar, carregar_dicionario, carregar_ipca  # noqa: E402
from analytics import (  # noqa: E402
    agregar, deflacionar, mediana_entre_ufs, nomear, participacao, per_capita, ranking, variacao,
)

FUNCAO = "10"
ESTAGIO = "liquidado"
PARES_PADRAO = ["SP", "MG", "BA", "PR", "RS"]
DIR_OUTPUTS = RAIZ / "outputs"

# Colunas produzidas pelas funções de analytics
PER_CAPITA = f"{ESTAGIO}_real_per_capita"
PCT_TOTAL = f"{ESTAGIO}_part_pct"

# Nomes das colunas no CSV de saída
SAIDA = {
    ESTAGIO: "liquidado_nominal",
    f"{ESTAGIO}_real": "liquidado_real",
    PER_CAPITA: "per_capita_real",
    f"{PER_CAPITA}_var_pct": "per_capita_real_var_pct",
    f"{PER_CAPITA}_posicao": "posicao_per_capita",
    PCT_TOTAL: "pct_despesa_total",
    f"{PCT_TOTAL}_posicao": "posicao_pct_despesa_total",
    f"{PER_CAPITA}_n_ufs": "n_ufs",
}

# Paleta de referência da skill de visualização: slot 1 para o destaque,
# slots 2 a 8 para os pares (sempre na ordem de --pares), neutro para a mediana
COR_DESTAQUE = "#2a78d6"
CORES_PARES = ["#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]
COR_MEDIANA = "#52514e"
COR_TEXTO = "#3d3d3a"
COR_SECUNDARIA = "#6b6a64"
COR_GRADE = "#e8e6dc"


def montar_tabela(ano_inicial, ano_final):
    """Todas as UFs, função 10: per capita real, variação, % da despesa total, posições e medianas."""
    anos = range(ano_inicial, ano_final + 1)
    despesa = carregar("despesa", anos=anos)
    funcoes = despesa[(despesa["nivel"] == "funcao") & ~despesa["intra"]]
    funcoes = funcoes[["uf", "cod_ibge", "ano", "nivel", "funcao_cod", ESTAGIO]]

    # Soma das funções = total sem intraorçamentárias (validado na extração da DCA)
    df = participacao(funcoes, ESTAGIO, ["ano"])
    df = df[df["funcao_cod"] == FUNCAO]

    df = deflacionar(df, [ESTAGIO], ano_final, carregar_ipca())
    df = per_capita(df, [f"{ESTAGIO}_real"], carregar("populacao", anos=anos))
    df = variacao(df, PER_CAPITA, ["funcao_cod"])
    df = ranking(df, PER_CAPITA, ["ano"])
    df = ranking(df, PCT_TOTAL, ["ano"])
    df = nomear(df, carregar_dicionario("nacional/funcoes.csv"))
    return df.sort_values(["uf", "ano"]).reset_index(drop=True)


def medianas(tabela):
    """Mediana entre as UFs, por ano, das duas medidas."""
    pc = mediana_entre_ufs(tabela, PER_CAPITA, ["ano"])
    pct = mediana_entre_ufs(tabela, PCT_TOTAL, ["ano"]).drop(columns="n_ufs")
    return pc.merge(pct, on="ano").rename(columns={
        f"{PER_CAPITA}_mediana": PER_CAPITA, f"{PCT_TOTAL}_mediana": PCT_TOTAL,
    })


def tabela_de_saida(tabela, uf, pares):
    """Linhas da UF, dos pares e da mediana das UFs, ano a ano."""
    grupos = [("destaque", [uf]), ("par", pares)]
    partes = []
    for grupo, ufs in grupos:
        parte = tabela[tabela["uf"].isin(ufs)].copy()
        parte["grupo"] = grupo
        parte["ordem"] = parte["uf"].map({u: i for i, u in enumerate(ufs)})
        partes.append(parte)
    mediana = medianas(tabela).assign(grupo="mediana das UFs", uf=pd.NA, ordem=0)
    mediana = mediana.rename(columns={"n_ufs": f"{PER_CAPITA}_n_ufs"})
    partes.append(mediana)

    saida = pd.concat(partes, ignore_index=True)
    saida["ordem_grupo"] = saida["grupo"].map({"destaque": 0, "par": 1, "mediana das UFs": 2})
    saida = saida.sort_values(["ordem_grupo", "ordem", "ano"])
    colunas = ["grupo", "uf", "ano", "funcao_cod", "funcao_nome", *SAIDA]
    saida = saida.reindex(columns=colunas).rename(columns=SAIDA)
    saida["funcao_cod"] = FUNCAO
    saida["funcao_nome"] = tabela["funcao_nome"].dropna().iloc[0]
    for coluna in ["posicao_per_capita", "posicao_pct_despesa_total", "n_ufs"]:
        saida[coluna] = saida[coluna].astype("Int64")
    return saida.round(2)


# RREO Anexo 02: blocos pelo cod_conta (o rótulo muda entre anos; ver docs/fontes/siconfi.md)
ANEXO_RREO = "RREO-Anexo 02"
BLOCO_INTRA = {"RREO2TotalDespesas": False, "RREO2TotalDespesasIntra": True}
COLUNA_LIQUIDADO_RREO = "DESPESAS LIQUIDADAS ATÉ O BIMESTRE"


def robustez_intra(tabela, ano_inicial, ano_final):
    """Função 10 com e sem intraorçamentárias, pelo RREO Anexo 02 do 6º bimestre, todas as UFs.

    Também confere o liquidado sem intra do RREO contra o da DCA (`tabela`).
    """
    anos = range(ano_inicial, ano_final + 1)
    dem = carregar("demonstrativo", anos=anos)
    nome_funcao = tabela["funcao_nome"].dropna().iloc[0]
    dem = dem[(dem["anexo"] == ANEXO_RREO) & (dem["periodo"] == 6) & (dem["conta"] == nome_funcao)
              & dem["coluna"].str.startswith(COLUNA_LIQUIDADO_RREO) & dem["cod_conta"].isin(BLOCO_INTRA)]
    longo = dem.assign(intra=dem["cod_conta"].map(BLOCO_INTRA), liquidado=dem["valor"])
    longo = longo[["uf", "cod_ibge", "ano", "intra", "liquidado"]]

    # Peso das intra: participação da linha intra no total (sem + intra) da UF no ano.
    # UF sem linha intra na função: peso 0 (a soma das funções do bloco intra fecha com (II) na extração).
    pesos = participacao(longo, "liquidado", ["ano"])
    peso = pesos[pesos["intra"]][["uf", "ano", "liquidado", "liquidado_part_pct"]].rename(
        columns={"liquidado": "liquidado_intra", "liquidado_part_pct": "peso_intra_pct"})

    versoes = {
        "sem_intra": longo[~longo["intra"]].drop(columns="intra"),
        "com_intra": agregar(longo, ["liquidado"], ["cod_ibge", "ano"]),
    }
    populacao = carregar("populacao", anos=anos)
    resultado = None
    for nome, df in versoes.items():
        df = deflacionar(df, ["liquidado"], ano_final, carregar_ipca())
        df = per_capita(df, ["liquidado_real"], populacao)
        df = ranking(df, "liquidado_real_per_capita", ["ano"])
        df = df[["uf", "ano", "liquidado", "liquidado_real_per_capita", "liquidado_real_per_capita_posicao"]]
        df = df.rename(columns={
            "liquidado": f"liquidado_{nome}",
            "liquidado_real_per_capita": f"per_capita_real_{nome}",
            "liquidado_real_per_capita_posicao": f"posicao_{nome}",
        })
        resultado = df if resultado is None else resultado.merge(df, on=["uf", "ano"], how="outer")

    resultado = resultado.merge(peso, on=["uf", "ano"], how="left")
    resultado["peso_intra_pct"] = resultado["peso_intra_pct"].fillna(0.0)
    resultado["liquidado_intra"] = resultado["liquidado_intra"].fillna(0.0)
    resultado["mudanca_posicao"] = resultado["posicao_sem_intra"] - resultado["posicao_com_intra"]

    # Conferência: RREO sem intra × DCA (nosso número principal)
    dca = tabela[["uf", "ano", ESTAGIO]].rename(columns={ESTAGIO: "liquidado_dca"})
    resultado = resultado.merge(dca, on=["uf", "ano"], how="left")
    resultado["dif_rreo_dca_pct"] = (resultado["liquidado_sem_intra"] / resultado["liquidado_dca"] - 1) * 100

    colunas = [
        "uf", "ano", "liquidado_dca", "liquidado_sem_intra", "dif_rreo_dca_pct", "liquidado_intra",
        "liquidado_com_intra", "peso_intra_pct", "per_capita_real_sem_intra", "posicao_sem_intra",
        "per_capita_real_com_intra", "posicao_com_intra", "mudanca_posicao",
    ]
    resultado = resultado[colunas].sort_values(["ano", "uf"]).reset_index(drop=True)
    for coluna in ["posicao_sem_intra", "posicao_com_intra", "mudanca_posicao"]:
        resultado[coluna] = resultado[coluna].astype("Int64")
    return resultado.round(2)


def _reais(valor, _posicao=None):
    return "R$ " + f"{valor:,.0f}".replace(",", ".")


def _pct(valor, _posicao=None):
    return f"{valor:g}%"


def _afastar(posicoes, distancia):
    """Afasta rótulos verticalmente para não se sobreporem (posições em unidades do dado)."""
    ordem = sorted(range(len(posicoes)), key=lambda i: posicoes[i])
    ajustadas = list(posicoes)
    for anterior, atual in zip(ordem, ordem[1:]):
        if ajustadas[atual] - ajustadas[anterior] < distancia:
            ajustadas[atual] = ajustadas[anterior] + distancia
    return ajustadas


def _painel(ax, series, coluna, coluna_posicao, uf, titulo, formatador, passo):
    """Um painel: linhas da UF, dos pares e da mediana, com rótulos diretos no fim."""
    for nome, dados, estilo in series:
        ax.plot(dados["ano"], dados[coluna], label=nome, **estilo)

    destaque = series[0][1]
    for linha in destaque.itertuples(index=False):
        ax.annotate(f"{getattr(linha, coluna_posicao)}º", (linha.ano, getattr(linha, coluna)),
                    textcoords="offset points", xytext=(0, -15), ha="center", fontsize=8, color=COR_TEXTO)

    ax.yaxis.set_major_locator(MultipleLocator(passo))
    ax.set_ylim(bottom=0)
    topo = ax.get_ylim()[1]
    finais = [dados[coluna].iloc[-1] for _, dados, _ in series]
    for (nome, dados, estilo), y in zip(series, _afastar(finais, topo * 0.035)):
        ax.annotate(nome, (dados["ano"].iloc[-1], y), xytext=(8, 0), textcoords="offset points",
                    va="center", fontsize=8.5, color=COR_TEXTO,
                    fontweight="bold" if nome == uf else "normal", annotation_clip=False)

    ax.set_title(titulo, loc="left", fontsize=10.5, color=COR_TEXTO)
    ax.yaxis.set_major_formatter(FuncFormatter(formatador))
    ax.set_xticks(sorted(destaque["ano"].unique()))
    ax.grid(axis="y", color=COR_GRADE, linewidth=1)
    ax.set_axisbelow(True)
    for lado in ["top", "right", "left"]:
        ax.spines[lado].set_visible(False)
    ax.spines["bottom"].set_color("#c3c2b7")
    ax.tick_params(colors=COR_SECUNDARIA, length=0, labelsize=8.5)


def grafico(tabela, uf, pares, ano_final, caminho):
    """Dois painéis (per capita real e % da despesa total): UF em destaque, pares e mediana."""
    mediana = medianas(tabela)
    n_ufs = int(mediana["n_ufs"].max())
    series = [(uf, tabela[tabela["uf"] == uf], {
        "color": COR_DESTAQUE, "linewidth": 2.5, "zorder": 4, "marker": "o", "markersize": 6,
        "markeredgecolor": "white", "markeredgewidth": 1.5})]
    for par, cor in zip(pares, CORES_PARES):
        series.append((par, tabela[tabela["uf"] == par], {"color": cor, "linewidth": 1.5, "zorder": 2}))
    series.append((f"Mediana ({n_ufs} UFs)", mediana, {"color": COR_MEDIANA, "linewidth": 2, "zorder": 3}))

    fig, (esq, dir_) = plt.subplots(1, 2, figsize=(13, 5.6), dpi=150)
    _painel(esq, series, PER_CAPITA, f"{PER_CAPITA}_posicao", uf,
            f"Per capita, em R$ de dez/{ano_final}", _reais, passo=200)
    _painel(dir_, series, PCT_TOTAL, f"{PCT_TOTAL}_posicao", uf,
            "% da despesa total do estado (sem intraorçamentárias)", _pct, passo=5)

    fig.suptitle(f"Saúde: despesa liquidada de {uf}, pares e mediana das UFs",
                 x=0.01, ha="left", fontsize=13, color=COR_TEXTO)
    fig.text(0.01, 0.905, "Número sob os pontos: posição de " + uf + f" entre as {n_ufs} UFs (1º = maior).",
             fontsize=8.5, color=COR_SECUNDARIA)
    handles, rotulos = esq.get_legend_handles_labels()
    fig.legend(handles, rotulos, loc="upper right", ncol=len(rotulos), frameon=False, fontsize=8.5,
               bbox_to_anchor=(0.99, 0.93))
    fig.text(0.01, 0.01, "Fonte: SICONFI/Tesouro Nacional (DCA Anexo I-E, função 10); IBGE (IPCA). "
             "População: cadastro do SICONFI. Per capita sofre efeito do tamanho da população e da "
             "divisão de gastos entre estado e municípios.", fontsize=7.5, color="#8a8980")
    fig.tight_layout(rect=(0, 0.03, 0.97, 0.88), w_pad=5)
    fig.savefig(caminho)
    plt.close(fig)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--uf", nargs="+", required=True, help="uma ou mais siglas de UF")
    parser.add_argument("--pares", nargs="+", default=PARES_PADRAO,
                        help=f"UFs de comparação (até {len(CORES_PARES)}; padrão: {' '.join(PARES_PADRAO)})")
    parser.add_argument("--anos", nargs=2, type=int, default=[2019, 2025], metavar=("INICIAL", "FINAL"))
    args = parser.parse_args(argv)
    ano_inicial, ano_final = args.anos

    tabela = montar_tabela(ano_inicial, ano_final)
    disponiveis = set(tabela["uf"])
    for uf in [u.upper() for u in args.uf]:
        pares = [p.upper() for p in args.pares if p.upper() != uf]
        if len(pares) > len(CORES_PARES):
            raise SystemExit(f"no máximo {len(CORES_PARES)} pares")
        faltando = [u for u in [uf, *pares] if u not in disponiveis]
        if faltando:
            raise SystemExit(f"sem dados de saúde para {faltando}")

        pasta = DIR_OUTPUTS / uf / "saude"
        pasta.mkdir(parents=True, exist_ok=True)
        saida = tabela_de_saida(tabela, uf, pares)
        saida.to_csv(pasta / "saude.csv", index=False)
        grafico(tabela, uf, pares, ano_final, pasta / "saude.png")

        robustez = robustez_intra(tabela, ano_inicial, ano_final)
        robustez.to_csv(pasta / "robustez_intra.csv", index=False)

        print(f"gravado em {pasta}")
        resumo = saida[saida["ano"] == ano_final][
            ["grupo", "uf", "per_capita_real", "posicao_per_capita",
             "pct_despesa_total", "posicao_pct_despesa_total"]]
        print(resumo.to_string(index=False))
        print(f"\nRobustez (intraorçamentárias), {uf}:")
        print(robustez[robustez["uf"] == uf][[
            "ano", "liquidado_sem_intra", "liquidado_intra", "peso_intra_pct",
            "posicao_sem_intra", "posicao_com_intra", "dif_rreo_dca_pct"]].to_string(index=False))


if __name__ == "__main__":
    main()
