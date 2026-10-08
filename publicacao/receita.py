"""Receita do estado para o front: DCA Anexo I-C (tabela `demonstrativo`) por item de dicionarios/nacional/receita_itens.csv.

Cada linha da natureza da receita vale pelo seu valor próprio (valor − filhos diretos: analytics.valores_proprios)
e cai no item de prefixo mais longo vigente no ano (analytics.mapear_por_prefixo). Os itens "outros/outras"
pegam o grupo inteiro, então nada some: a soma dos itens = total do anexo (conferido, senão é erro).

Uso para conferir (valida e imprime o relatório de quebra 2021→2022):
    uv run python -m publicacao.receita
"""

import pandas as pd

from analytics import deflacionar, mapear_por_prefixo, segmentos, valores_proprios

TOTAL_EXCETO_INTRA = "ReceitasExcetoIntraOrcamentarias"
TOTAL_RECEITAS = "TotalReceitas"
COLUNAS = {
    "Receitas Brutas Realizadas": "bruta",
    "Deduções - Transferências Constitucionais": "ded_transferencias",
    "Deduções - FUNDEB": "ded_fundeb",
    "Outras Deduções da Receita": "ded_outras",
}
VALORES = list(COLUNAS.values())

# Item → nome e grupo, na ordem de exibição. Grupo: impostos, transferencias, outras_correntes, capital, intra.
ITENS = [
    ("icms", "ICMS", "impostos"),
    ("icms_fecp", "Adicional do ICMS (combate à pobreza)", "impostos"),
    ("ipva", "IPVA", "impostos"),
    ("itcmd", "ITCMD", "impostos"),
    ("ir_retido", "IR retido na fonte", "impostos"),
    ("outros_impostos_taxas", "Outros impostos e taxas", "impostos"),
    ("fpe", "FPE", "transferencias"),
    ("sus", "Transferências do SUS", "transferencias"),
    ("fundeb_retorno", "FUNDEB (retorno ao estado)", "transferencias"),
    ("fundeb_complementacao", "FUNDEB (complementação da União)", "transferencias"),
    ("royalties", "Royalties e compensações financeiras", "transferencias"),
    ("convenios", "Transferências de convênios", "transferencias"),
    ("outras_transferencias_uniao", "Outras transferências da União", "transferencias"),
    ("outras_transferencias", "Outras transferências", "transferencias"),
    ("receita_patrimonial", "Receita patrimonial", "outras_correntes"),
    ("outras_receitas_correntes", "Outras receitas correntes", "outras_correntes"),
    ("operacoes_credito", "Operações de crédito", "capital"),
    ("alienacao_bens", "Alienação de bens", "capital"),
    ("outras_receitas_capital", "Outras receitas de capital", "capital"),
    ("intraorcamentarias", "Receitas intraorçamentárias", "intra"),
]

# Peso das fontes, pelo código (igual nos dois períodos): impostos próprios = 1.1; transferências da
# União = 1.7.1 (correntes) + 2.4.1 (de capital). Valores líquidos das deduções.
PREFIXOS_IMPOSTOS = [segmentos("1.1")]
PREFIXOS_UNIAO = [segmentos("1.7.1"), segmentos("2.4.1")]


def _natureza(ic):
    """Linhas de natureza (RO/RI + código) do I-C → uma linha por UF, ano e código, com as quatro colunas."""
    nat = ic[ic["cod_conta"].str.match(r"^R[OI]\d")].assign(codigo=lambda t: t["cod_conta"].str[2:])
    nat = nat[nat["coluna"].isin(COLUNAS)]
    largo = nat.pivot_table(index=["uf", "ano", "codigo"], columns="coluna", values="valor", aggfunc="sum")
    return largo.rename(columns=COLUNAS).reindex(columns=VALORES).reset_index()


def _totais(ic, cod):
    linhas = ic[(ic["cod_conta"] == cod) & ic["coluna"].isin(COLUNAS)]
    largo = linhas.pivot_table(index=["uf", "ano"], columns="coluna", values="valor", aggfunc="sum")
    return largo.rename(columns=COLUNAS).reindex(columns=VALORES).fillna(0.0)


def montar_receita(ic, dicionario, tolerancia=1.0):
    """I-C (linhas da tabela demonstrativo) + dicionário → (linhas por UF, ano e item; totais por UF e ano).

    linhas: uf, ano, item, bruta, ded_transferencias, ded_fundeb, ded_outras, liquida (R$ nominais).
    totais: uf, ano, liquida_exceto_intra, impostos_proprios, transferencias_uniao (líquidas, R$ nominais).
    Erro se algum código ficar sem item ou se a soma dos itens não bater com o total do anexo.
    """
    nat = _natureza(ic)
    nat = valores_proprios(nat, "codigo", VALORES, ["uf", "ano"])
    nat = mapear_por_prefixo(nat, "codigo", "ano", dicionario)
    sem_item = nat[nat["item"].isna()]
    if not sem_item.empty:
        raise ValueError(f"códigos sem item no dicionário: {sem_item[['uf', 'ano', 'codigo']].head().values.tolist()}")

    proprios = [f"{v}_proprio" for v in VALORES]
    linhas = nat.groupby(["uf", "ano", "item"], as_index=False)[proprios].sum()
    linhas = linhas.rename(columns=dict(zip(proprios, VALORES)))
    linhas["liquida"] = linhas["bruta"] - linhas[["ded_transferencias", "ded_fundeb", "ded_outras"]].sum(axis=1)

    # Soma dos itens = total do anexo, em cada coluna
    soma = linhas.groupby(["uf", "ano"])[VALORES].sum()
    total = _totais(ic, TOTAL_RECEITAS).reindex(soma.index).fillna(0.0)
    diferenca = (soma - total).abs()
    if (diferenca > tolerancia).any().any():
        uf, ano = diferenca[(diferenca > tolerancia).any(axis=1)].index[0]
        raise ValueError(f"{uf} {ano}: soma dos itens difere do total da I-C: {(soma - total).loc[(uf, ano)].to_dict()}")

    # Totais por UF e ano (líquidos): exceto intra, impostos próprios e transferências da União
    nat["liquida_proprio"] = nat["bruta_proprio"] - nat[["ded_transferencias_proprio", "ded_fundeb_proprio",
                                                         "ded_outras_proprio"]].sum(axis=1)
    def do_prefixo(prefixos):
        return nat["codigo"].map(lambda c: any(segmentos(c)[:len(p)] == p for p in prefixos))
    nat["e_imposto"], nat["e_uniao"] = do_prefixo(PREFIXOS_IMPOSTOS), do_prefixo(PREFIXOS_UNIAO)
    totais = nat.groupby(["uf", "ano"]).apply(lambda g: pd.Series({
        "liquida_exceto_intra": g.loc[g["item"] != "intraorcamentarias", "liquida_proprio"].sum(),
        "impostos_proprios": g.loc[g["e_imposto"], "liquida_proprio"].sum(),
        "transferencias_uniao": g.loc[g["e_uniao"], "liquida_proprio"].sum(),
    }), include_groups=False).reset_index()

    exceto = _totais(ic, TOTAL_EXCETO_INTRA)
    exceto_liquida = (exceto["bruta"] - exceto[["ded_transferencias", "ded_fundeb", "ded_outras"]].sum(axis=1))
    confere = totais.set_index(["uf", "ano"])["liquida_exceto_intra"] - exceto_liquida.reindex(
        totais.set_index(["uf", "ano"]).index).fillna(0.0)
    if (confere.abs() > tolerancia).any():
        raise ValueError(f"líquida exceto intra difere do total da I-C em {confere[confere.abs() > tolerancia].head().to_dict()}")
    return linhas.sort_values(["uf", "ano", "item"]).reset_index(drop=True), totais


def quebras(linhas, ipca, ano_antes=2021, ano_depois=2022, limite_pct=50.0, minimo_ufs=5):
    """Itens com variação real (líquida) acima de `limite_pct` (em módulo) entre os dois anos em mais de
    `minimo_ufs` estados: candidatos a efeito da recodificação de 2022. Devolve (resumo por item, detalhe)."""
    df = linhas[linhas["ano"].isin([ano_antes, ano_depois])][["uf", "ano", "item", "liquida"]]
    df = deflacionar(df, ["liquida"], ano_depois, ipca)
    largo = df.pivot_table(index=["uf", "item"], columns="ano", values="liquida_real", aggfunc="sum").fillna(0.0)
    detalhe = pd.DataFrame({"antes_real": largo[ano_antes], "depois_real": largo[ano_depois]}).reset_index()
    tem_antes = detalhe["antes_real"].abs() > 0
    detalhe["var_real_pct"] = ((detalhe["depois_real"] / detalhe["antes_real"] - 1) * 100).where(tem_antes)
    detalhe["salto"] = (detalhe["var_real_pct"].abs() > limite_pct) | (~tem_antes & (detalhe["depois_real"] != 0))
    resumo = detalhe[detalhe["salto"]].groupby("item").agg(
        ufs=("uf", "count"), lista=("uf", lambda u: ", ".join(sorted(u)))).reset_index()
    return resumo[resumo["ufs"] > minimo_ufs].sort_values("ufs", ascending=False), detalhe


def main():
    from analyses.carregar import carregar, carregar_dicionario, carregar_ipca

    demonstrativo = carregar("demonstrativo")
    ic = demonstrativo[(demonstrativo["demonstrativo"] == "DCA") & (demonstrativo["anexo"] == "DCA-Anexo I-C")]
    dicionario = carregar_dicionario("nacional/receita_itens.csv")
    linhas, totais = montar_receita(ic, dicionario)
    print(f"Receita: {len(totais)} UF-anos, {linhas['item'].nunique()} itens; nenhum código sem item; "
          "soma dos itens = total da I-C e líquida exceto intra = total do anexo em todos.")
    resumo, detalhe = quebras(linhas, carregar_ipca())
    print("\nItens com variação real acima de 50% entre 2021 e 2022 em mais de 5 estados:")
    if resumo.empty:
        print("  nenhum")
    for r in resumo.itertuples():
        d = detalhe[(detalhe["item"] == r.item) & detalhe["salto"]]
        mediana = d["var_real_pct"].median()
        print(f"  {r.item}: {r.ufs} estados (variação real mediana {mediana:+.0f}%): {r.lista}")


if __name__ == "__main__":
    main()
