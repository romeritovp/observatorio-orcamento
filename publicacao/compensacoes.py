"""Petróleo e gás: prestação de contas (DCA I-C) × repasses da ANP aos estados (tabela compensacoes_anp).

Nenhum total da DCA muda: a ANP só é mostrada ao lado, com a fonte. Funções sem leitura de arquivo, mais:
    uv run python -m publicacao.compensacoes      # conferência das 27 UFs (relatório e CSV em outputs/)

Cuidados (docs/fontes/anp.md):
- A DCA inclui o FEP (Fundo Especial do Petróleo, que o Tesouro distribui a todos os estados); os royalties da
  ANP por estado não incluem o FEP (estados não produtores aparecem com zero na ANP). A comparação justa é
  DCA sem o FEP × ANP. Onde o estado não separa o FEP (AC, AP, MG lançam como royalties), sobra diferença.
- O arquivo aberto de participação especial termina em nov/2024: anos depois do último ano com participação
  especial ficam sem total da ANP (só royalties, marcados como parciais).
"""

import pandas as pd

from analytics import segmentos

# FEP dentro do item petróleo e gás da DCA (até 2017 / 2018–2021 / a partir de 2022)
FEP = {"ate_2017": segmentos("1.7.2.1.22.70"), "antigo": segmentos("1.7.1.8.02.6"), "novo": segmentos("1.7.1.2.52.4")}


def codigo_fep(ano):
    """Código do FEP na codificação da receita vigente no ano."""
    return FEP["ate_2017"] if ano <= 2017 else FEP["antigo"] if ano <= 2021 else FEP["novo"]
DEMAIS_PATRIMONIAIS = "1.3.9"
FAIXA = (0.90, 1.10)


def _bruta_por_codigo(ic, alvo_de_ano):
    """Soma da receita bruta das linhas cujo código (sem zeros finais) é igual a alvo_de_ano(ano)."""
    bruta = ic[(ic["coluna"] == "Receitas Brutas Realizadas") & ic["cod_conta"].str.match(r"^R[OI]\d")]
    bruta = bruta.assign(seg=bruta["cod_conta"].str[2:].map(segmentos))
    bruta = bruta[[s == alvo_de_ano(a) for s, a in zip(bruta["seg"], bruta["ano"])]]
    return bruta.groupby(["uf", "ano"])["valor"].sum()


def fep_dca(ic):
    """FEP declarado na DCA I-C (bruta), por UF e ano."""
    return _bruta_por_codigo(ic, codigo_fep)


def demais_patrimoniais(ic):
    """'Demais Receitas Patrimoniais' (1.3.9) da DCA I-C (bruta), por UF e ano."""
    return _bruta_por_codigo(ic, lambda ano: segmentos(DEMAIS_PATRIMONIAIS))


def anp_por_uf_ano(anp):
    """compensacoes_anp → royalties, participação especial, total (nulo se parcial) e parcial, por UF e ano.

    Parcial: ano depois do último ano com participação especial no arquivo da ANP (o total ficaria incompleto).
    """
    largo = anp.pivot_table(index=["uf", "ano"], columns="tipo", values="valor", aggfunc="sum").fillna(0.0)
    largo = largo.reindex(columns=["royalties", "participacao_especial"], fill_value=0.0)
    ultimo_pe = int(anp.loc[anp["tipo"] == "participacao_especial", "ano"].max())
    largo["parcial"] = largo.index.get_level_values("ano") > ultimo_pe
    largo["total"] = (largo["royalties"] + largo["participacao_especial"]).where(~largo["parcial"])
    largo.loc[largo["parcial"], "participacao_especial"] = float("nan")
    return largo, ultimo_pe


def conferencia(receita_linhas, ic, anp, anos):
    """Item petróleo e gás da DCA (bruta) × ANP (royalties + participação especial), por UF e ano.

    razao = DCA / ANP; razao_sem_fep = (DCA − FEP declarado) / ANP. fora_da_faixa olha a razão sem FEP
    (fora de 90%–110%), só onde há total da ANP e algum valor dos dois lados.
    """
    dca = receita_linhas[receita_linhas["item"] == "petroleo_gas"].set_index(["uf", "ano"])["bruta"]
    anp_largo, _ = anp_por_uf_ano(anp)
    indice = pd.MultiIndex.from_product([sorted(receita_linhas["uf"].unique()), list(anos)], names=["uf", "ano"])
    t = pd.DataFrame(index=indice)
    t["dca_petroleo"] = dca.reindex(indice).fillna(0.0)
    t["dca_fep"] = fep_dca(ic).reindex(indice).fillna(0.0)
    t["dca_sem_fep"] = t["dca_petroleo"] - t["dca_fep"]
    for coluna in ["royalties", "participacao_especial", "total", "parcial"]:
        t[f"anp_{coluna}"] = anp_largo[coluna].reindex(indice)
    t["anp_parcial"] = t["anp_parcial"].fillna(False).astype(bool)
    t["anp_total"] = t["anp_total"].where(~t["anp_parcial"])
    com_anp = t["anp_total"] > 0
    t["razao"] = (t["dca_petroleo"] / t["anp_total"]).where(com_anp)
    t["razao_sem_fep"] = (t["dca_sem_fep"] / t["anp_total"]).where(com_anp)
    t["fora_da_faixa"] = com_anp & ~t["razao_sem_fep"].between(*FAIXA)
    return t.reset_index()


def montar_petroleo(receita_linhas, ic, anp, anos):
    """Bloco "petroleo" do receita.json: por UF e ano, DCA (bruta, com o FEP) e ANP, e "Demais receitas patrimoniais"."""
    conf = conferencia(receita_linhas, ic, anp, anos)
    demais = demais_patrimoniais(ic)
    conf["demais_patrimoniais"] = [demais.get((u, a), 0.0) for u, a in zip(conf["uf"], conf["ano"])]
    _, ultimo_pe = anp_por_uf_ano(anp)
    colunas = ["uf", "ano", "dca_petroleo", "dca_fep", "anp_royalties", "anp_participacao_especial", "anp_total",
               "anp_parcial", "demais_patrimoniais"]
    return conf[colunas], ultimo_pe


def main():
    from analyses.carregar import RAIZ, carregar, carregar_dicionario
    from publicacao.receita import montar_receita

    demonstrativo = carregar("demonstrativo")
    ic = demonstrativo[(demonstrativo["demonstrativo"] == "DCA") & (demonstrativo["anexo"] == "DCA-Anexo I-C")]
    linhas, _ = montar_receita(ic, carregar_dicionario("nacional/receita_itens.csv"))
    anp = carregar("compensacoes_anp")
    anos = sorted(int(a) for a in ic["ano"].unique())
    conf = conferencia(linhas, ic, anp, anos)

    saida = RAIZ / "outputs" / "nacional" / "compensacoes"
    saida.mkdir(parents=True, exist_ok=True)
    conf.to_csv(saida / "conferencia_dca_anp.csv", index=False)

    mi = lambda v: "" if pd.isna(v) else f"{v / 1e6:,.1f}"
    pct = lambda v: "" if pd.isna(v) else f"{v * 100:.0f}%"
    com = conf[conf["anp_total"] > 0]
    print(f"Conferência DCA × ANP (petróleo e gás), {len(com)} UF-anos com total da ANP")
    print(f"  razão DCA/ANP dentro de 90%–110%: {(com['razao'].between(*FAIXA)).sum()}; "
          f"sem o FEP: {(com['razao_sem_fep'].between(*FAIXA)).sum()}")
    nao_produtores = conf[(conf["anp_royalties"].fillna(0) == 0) & (conf["dca_fep"] > 0)]
    print(f"  UF-anos com FEP na DCA e zero de royalties na ANP: {len(nao_produtores)} "
          f"(confirma que a ANP por estado não inclui o FEP)")
    print("\nFora de 90%–110% (razão sem o FEP), R$ milhões:")
    print(f"  {'UF':3} {'ano':5} {'DCA':>10} {'FEP':>8} {'DCA−FEP':>10} {'ANP':>10} {'razão':>6} {'s/ FEP':>7}")
    for r in conf[conf["fora_da_faixa"]].itertuples():
        print(f"  {r.uf:3} {r.ano:<5} {mi(r.dca_petroleo):>10} {mi(r.dca_fep):>8} {mi(r.dca_sem_fep):>10} "
              f"{mi(r.anp_total):>10} {pct(r.razao):>6} {pct(r.razao_sem_fep):>7}")
    print(f"\nCSV completo: {(saida / 'conferencia_dca_anp.csv').relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
