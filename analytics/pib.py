"""PIB por UF (Contas Regionais do IBGE): composição do VAB, participação no total do país e volume.

Entradas no formato das tabelas `pib_uf` e `pib_uf_atividade`. Nada é lido de arquivo: o território que
representa o país (ex.: "BR") e o grande setor de cada atividade vêm como parâmetro.
"""

import pandas as pd


def participacao_no_vab(atividades, grupos=None):
    """Participação % de cada atividade (ou grupo de atividades) no VAB total da UF no ano.

    atividades: linhas de `pib_uf_atividade` (colunas uf, ano, atividade_cod, nivel, vab). O denominador é a
    linha de nivel "total"; as linhas de nivel "atividade" nunca são somadas com ela.
    grupos: {atividade_cod: grupo} (ex.: grande setor). Sem ele, uma linha por atividade.
    Grupo com alguma atividade nula fica nulo (nunca soma parcial). Devolve uf, ano, chave, vab, pct.
    """
    total = atividades[atividades["nivel"] == "total"]
    if total.duplicated(["uf", "ano"]).any():
        raise ValueError("mais de uma linha de total por uf e ano")
    partes = atividades[atividades["nivel"] == "atividade"].copy()
    if grupos is None:
        partes["chave"] = partes["atividade_cod"]
    else:
        partes["chave"] = partes["atividade_cod"].map(grupos)
        if partes["chave"].isna().any():
            raise ValueError(f"atividades sem grupo: {sorted(partes.loc[partes['chave'].isna(), 'atividade_cod'].unique())}")
    soma = (partes.groupby(["uf", "ano", "chave"], observed=True)["vab"]
            .agg(lambda s: s.sum() if s.notna().all() else float("nan")).reset_index())
    soma = soma.merge(total[["uf", "ano", "vab"]].rename(columns={"vab": "vab_total"}), on=["uf", "ano"], how="left")
    if soma["vab_total"].isna().any():
        raise ValueError("uf e ano com atividades e sem a linha de total")
    soma["pct"] = soma["vab"] / soma["vab_total"] * 100
    return soma.drop(columns="vab_total").sort_values(["uf", "ano", "chave"]).reset_index(drop=True)


def participacao_no_pais(pib_uf, coluna, pais):
    """`coluna` de cada território / a do território `pais` no mesmo ano × 100. Cria `<coluna>_pct_pais`."""
    do_pais = pib_uf.loc[pib_uf["uf"] == pais, ["ano", coluna]].rename(columns={coluna: "_pais"})
    if do_pais["ano"].duplicated().any():
        raise ValueError(f"mais de uma linha de {pais} por ano")
    saida = pib_uf.merge(do_pais, on="ano", how="left")
    saida[f"{coluna}_pct_pais"] = saida[coluna] / saida["_pais"] * 100
    return saida.drop(columns="_pais")


def rebasear(df, coluna, ano_base):
    """Índice com `ano_base` = 100, por UF: `coluna` / `coluna` no ano_base × 100. Cria `<coluna>_base_<ano_base>`.

    UF sem o ano_base (ou com valor nulo nele) fica nula: nunca se inventa a base.
    """
    base = df.loc[df["ano"] == ano_base, ["uf", coluna]].rename(columns={coluna: "_base"})
    if base["uf"].duplicated().any():
        raise ValueError("mais de uma linha por uf no ano base")
    saida = df.merge(base, on="uf", how="left")
    saida[f"{coluna}_base_{ano_base}"] = saida[coluna] / saida["_base"] * 100
    return saida.drop(columns="_base")


def crescimento_acumulado(df, coluna, inicio, fim):
    """Variação % de um índice de volume entre `inicio` e `fim`, por UF: (fim / inicio − 1) × 100.

    Devolve uf, crescimento_pct. Ano ausente ou nulo deixa a UF nula.
    """
    largo = df[df["ano"].isin([inicio, fim])].pivot_table(index="uf", columns="ano", values=coluna, aggfunc="first")
    largo = largo.reindex(columns=[inicio, fim])
    saida = ((largo[fim] / largo[inicio] - 1) * 100).rename("crescimento_pct").reset_index()
    return saida.reindex(columns=["uf", "crescimento_pct"])
