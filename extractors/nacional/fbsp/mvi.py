"""
mvi.py — séries por UF e ano consolidadas das planilhas do Anuário, um tema por tabela canônica:
    mvi   mortes violentas intencionais                         → fbsp_mvi
    mdip  mortes decorrentes de intervenção policial (letalidade) → fbsp_mdip

Uso:
    uv run python -m extractors.nacional.fbsp.mvi       (depois de extractors.nacional.fbsp.fbsp)

Entrada:
    data/processed/fbsp/          tabela `fbsp` (todas as células de UF e Brasil das planilhas)
    docs/fbsp_temas.csv           qual aba de cada edição e qual coluna (padrão no cabeçalho) é o número e a taxa

Saídas:
    data/processed/fbsp_<tema>/uf=<UF>/ano=<ano>/fbsp.parquet  tabelas `fbsp_mvi` e `fbsp_mdip` (extractors/base.py)
    data/interim/fbsp/fbsp_<tema>.csv                          a mesma tabela num CSV só (UTF-8 com BOM, para o Excel)
    data/interim/fbsp/fbsp_<tema>_populacao_implicita.csv      UFs em que a população implícita varia mais de 5% de
                                                               um ano para o outro (conferência; não para a extração)

Cada edição traz dois anos: o anterior (revisado) e o mais recente. Para cada UF e ano vale a edição mais recente;
o valor da primeira publicação e a revisão (final menos primeira) ficam ao lado (analytics.consolidar_edicoes).
Param a extração: coluna do mapeamento que não acha exatamente um cabeçalho por ano, ano sem as 27 UFs e o Brasil,
soma das UFs diferente do Brasil no número e, entre os temas, MDIP maior que MVI (as mortes por intervenção policial
estão dentro das mortes violentas intencionais).
"""
import pandas as pd

from analytics import consolidar_edicoes
from extractors import base
from extractors.nacional.fbsp import fbsp

CAMINHO_TEMAS = base.RAIZ / "docs" / "fbsp_temas.csv"
DIR_CONFERENCIA = fbsp.DIR_CONFERENCIA
LIMITE_POPULACAO = 0.05  # variação da população implícita de um ano para o outro que entra na lista de conferência
TEMAS = ["mvi", "mdip"]  # tema do docs/fbsp_temas.csv → tabela fbsp_<tema>, medidas <tema>_numero e <tema>_taxa


def ler_mapeamento(tema="mvi", caminho=CAMINHO_TEMAS):
    """Linhas do docs/fbsp_temas.csv do tema: medida, edicao, aba, anos (lista de int), padrao_coluna."""
    m = pd.read_csv(caminho, dtype=str)
    m = m[m["tema"] == tema].copy()
    m["edicao"] = m["edicao"].astype(int)
    m["anos"] = m["anos"].str.split(";").map(lambda a: [int(x) for x in a])
    return m


def selecionar(tabela_fbsp, mapeamento, siglas):
    """Valores do mapeamento, em formato longo: uf, ano, edicao, tabela_fonte, medida, valor.
    Cada (edição, medida, ano) tem de achar exatamente uma coluna, com todas as `siglas` (27 UFs e BR)."""
    erros, partes = [], []
    for m in mapeamento.itertuples():
        aba = tabela_fbsp[(tabela_fbsp["edicao"] == m.edicao) & (tabela_fbsp["local"] == f"aba:{m.aba}")]
        achado = aba[aba["coluna"].str.contains(m.padrao_coluna, regex=True)]
        for ano in m.anos:
            do_ano = achado[achado["ano"] == ano]
            colunas = do_ano["coluna"].unique()
            if len(colunas) != 1:
                erros.append(f"{m.edicao} {m.aba} {m.medida} {ano}: {len(colunas)} colunas (esperada 1)")
                continue
            faltam = sorted(set(siglas) - set(do_ano["uf"]))
            if faltam or do_ano["uf"].duplicated().any():
                erros.append(f"{m.edicao} {m.aba} {m.medida} {ano}: faltam {faltam}" if faltam
                             else f"{m.edicao} {m.aba} {m.medida} {ano}: UF repetida")
                continue
            partes.append(do_ano.assign(medida=m.medida, tabela_fonte=m.aba)[
                ["uf", "ano", "edicao", "tabela_fonte", "medida", "valor"]])
    if erros:
        raise base.ErroValidacao("mapeamento do MVI não confere:\n  " + "\n  ".join(erros))
    return pd.concat(partes, ignore_index=True)


def consolidar(longo, codigos, tema="mvi"):
    """Uma linha por UF e ano: edição mais recente, primeira publicação, revisão e população implícita.
    Medidas <tema>_numero e <tema>_taxa."""
    largo = longo.pivot_table(index=["uf", "ano", "edicao", "tabela_fonte"], columns="medida", values="valor",
                              aggfunc="first").reset_index()
    largo.columns.name = None
    numero, taxa = f"{tema}_numero", f"{tema}_taxa"
    c = consolidar_edicoes(largo, ["uf", "ano"], [numero, taxa])
    c = c.rename(columns={f"revisao_{numero}": "revisao_numero", f"revisao_{taxa}": "revisao_taxa"})
    tabela = largo.set_index(["uf", "ano", "edicao"])["tabela_fonte"]
    c["tabela_fonte"] = [tabela[(u, a, e)] for u, a, e in zip(c["uf"], c["ano"], c["edicao_fonte"])]
    c["populacao_implicita"] = c[numero] / c[taxa] * 100_000
    c["cod_ibge"] = c["uf"].map(codigos)
    c["fonte_dado"] = fbsp.FONTE_DADO
    c["extraido_em"] = None  # planilhas baixadas à mão (o SHA-256 está no catálogo do fbsp)
    return c


def conferir_soma(c, tema="mvi"):
    """Por ano: soma das UFs, número do Brasil e diferença."""
    ufs = c[c["uf"] != "BR"].groupby("ano")[f"{tema}_numero"].sum()
    brasil = c[c["uf"] == "BR"].set_index("ano")[f"{tema}_numero"]
    return pd.DataFrame({"soma_ufs": ufs, "brasil": brasil, "diferenca": ufs - brasil}).reset_index()


def variacoes_de_populacao(c, limite=LIMITE_POPULACAO):
    """UF e ano em que a população implícita varia mais que `limite` em relação ao ano anterior da mesma UF."""
    c = c.sort_values(["uf", "ano"]).copy()
    c["populacao_ano_anterior"] = c.groupby("uf")["populacao_implicita"].shift()
    c["variacao_populacao"] = c["populacao_implicita"] / c["populacao_ano_anterior"] - 1
    fora = c[c["variacao_populacao"].abs() > limite]
    return fora[["uf", "ano", "edicao_fonte", "populacao_ano_anterior", "populacao_implicita", "variacao_populacao"]]


def conferir_mdip_dentro_da_mvi(mvi, mdip):
    """UF e ano em que as mortes por intervenção policial passam das mortes violentas intencionais (não pode)."""
    juntos = mvi[["uf", "ano", "mvi_numero"]].merge(mdip[["uf", "ano", "mdip_numero"]], on=["uf", "ano"])
    return juntos[juntos["mdip_numero"] > juntos["mvi_numero"]]


def gerar(tema, tabela_fbsp, codigos):
    """Consolida um tema, confere (27 UFs e o Brasil; soma das UFs = Brasil) e grava a tabela e os CSV."""
    siglas = sorted(codigos)  # 27 UFs + BR
    c = consolidar(selecionar(tabela_fbsp, ler_mapeamento(tema), siglas), codigos, tema)
    numero, taxa = f"{tema}_numero", f"{tema}_taxa"
    incompletos = c.groupby("ano").apply(lambda g: sorted(set(siglas) - set(g.dropna(subset=[numero, taxa])["uf"])))
    incompletos = incompletos[incompletos.map(len) > 0]
    if not incompletos.empty:
        raise base.ErroValidacao(f"{tema}: anos sem as 27 UFs e o Brasil (número e taxa): {incompletos.to_dict()}")
    soma = conferir_soma(c, tema)
    if (soma["diferenca"].abs() > 0.5).any():
        raise base.ErroValidacao(f"{tema}: soma das UFs diferente do Brasil:\n" + soma.to_string(index=False))

    tabela = f"fbsp_{tema}"
    gravados = base.gravar(c, tabela, "fbsp")
    DIR_CONFERENCIA.mkdir(parents=True, exist_ok=True)
    base.validar_esquema(c, tabela).sort_values(["ano", "uf"]).to_csv(
        DIR_CONFERENCIA / f"{tabela}.csv", index=False, encoding="utf-8-sig")
    populacao = variacoes_de_populacao(c)
    populacao.to_csv(DIR_CONFERENCIA / f"{tabela}_populacao_implicita.csv", index=False, encoding="utf-8-sig")

    print(f"\n{tabela}: {len(c)} linhas ({c['uf'].nunique()} territórios × {c['ano'].nunique()} anos, "
          f"{c['ano'].min()}–{c['ano'].max()}) → {len(gravados)} arquivos em data/processed/{tabela}/")
    print("Soma das UFs x Brasil (número):")
    print(soma.to_string(index=False))
    print(f"População implícita com variação acima de {LIMITE_POPULACAO:.0%} de um ano para o outro: {len(populacao)}")
    return c


def main():
    codigos = fbsp.fbsp_codigos()
    tabela_fbsp = pd.read_parquet(base.DIR_PROCESSED / "fbsp")
    tabela_fbsp["uf"] = tabela_fbsp["uf"].astype(str)
    tabela_fbsp["ano"] = tabela_fbsp["ano"].astype(int)
    consolidados = {tema: gerar(tema, tabela_fbsp, codigos) for tema in TEMAS}
    acima = conferir_mdip_dentro_da_mvi(consolidados["mvi"], consolidados["mdip"])
    if not acima.empty:
        raise base.ErroValidacao("mortes por intervenção policial acima das MVI:\n" + acima.to_string(index=False))
    print("\nMDIP ≤ MVI em todas as UFs e anos.")
    return consolidados


if __name__ == "__main__":
    main()
