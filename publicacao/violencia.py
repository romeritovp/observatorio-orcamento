"""Violência para o front: tabelas `fbsp_mvi` (mortes violentas intencionais) e `fbsp_mdip` (mortes decorrentes de
intervenção policial, a letalidade policial), do FBSP, em JSON.

Arquivo (gravado por publicacao.exportar):
- violencia.json: número de mortes violentas intencionais (MVI) e taxa por 100 mil de cada UF e do Brasil, por ano,
  com a edição de onde vem cada valor, a primeira publicação e a revisão; o mesmo para as mortes por intervenção
  policial (colunas mdip_*); anos em que a taxa muda de base de
  população; ressalvas e a ficha da fonte. Carregado só pela tela "Violência" (e pelo painel do estado).

O front calcula o ranking por taxa, o índice (primeiro ano = 100) da UF, da região e do Brasil e o % das mortes por
intervenção policial nas MVI (web/src/calculos.js);
`gabarito_violencia` calcula o mesmo com analytics/ para o teste do front.
"""

import pandas as pd

from analytics import ranking, rebasear

FONTE = "Fórum Brasileiro de Segurança Pública (FBSP), Anuário Brasileiro de Segurança Pública"
PAGINA = "https://forumseguranca.org.br/anuario-brasileiro-seguranca-publica/"
COLUNAS = ["uf", "ano", "mvi_numero", "mvi_taxa", "edicao_fonte", "tabela_fonte", "edicao_primeira_publicacao",
           "mvi_numero_primeira_publicacao", "revisao_numero", "mvi_taxa_primeira_publicacao", "revisao_taxa"]
# letalidade policial: mesmas colunas, com o prefixo da medida; edição e revisão próprias (outra tabela do Anuário)
COLUNAS_MDIP = {"mdip_numero": "mdip_numero", "mdip_taxa": "mdip_taxa", "edicao_fonte": "mdip_edicao_fonte",
                "tabela_fonte": "mdip_tabela_fonte", "edicao_primeira_publicacao": "mdip_edicao_primeira_publicacao",
                "mdip_numero_primeira_publicacao": "mdip_numero_primeira_publicacao",
                "revisao_numero": "mdip_revisao_numero"}
LIMITE_QUEBRA = 0.02  # variação da população implícita do país, de um ano para o outro, que indica troca de base


def quebras_de_base(mvi, pais, limite=LIMITE_QUEBRA):
    """Anos em que a taxa muda de base de população: a população implícita do país (número ÷ taxa × 100 mil) varia
    mais que `limite` sobre o ano anterior. O ano devolvido é o primeiro da base nova."""
    serie = mvi[mvi["uf"] == pais].sort_values("ano").set_index("ano")
    populacao = serie["mvi_numero"] / serie["mvi_taxa"] * 100_000
    variacao = populacao / populacao.shift() - 1
    return [int(a) for a, v in variacao.items() if pd.notna(v) and abs(v) > limite]


def ressalvas(ultimo_ano, edicao_ultimo_ano, quebras):
    """Notas obrigatórias da tela (cada uma com ligação "entenda" na página de metodologia)."""
    quebras_texto = " e ".join(f"{a - 1}→{a}" for a in quebras)
    return [
        {"id": "mvi_edicao_mais_recente", "titulo": "Vale a edição mais recente",
         "texto": "Cada edição do Anuário traz dois anos: o anterior, revisado, e o mais recente. Para cada estado e "
                  "ano mostramos o número da edição mais recente que traz o ano; o da primeira publicação e a "
                  "diferença entre os dois (a revisão) ficam na tabela."},
        {"id": "mvi_sujeito_a_revisao", "titulo": f"{ultimo_ano}: sujeito a revisão",
         "texto": f"{ultimo_ano} saiu numa edição só (a de {edicao_ultimo_ano}). A próxima edição do Anuário costuma "
                  "revisar o ano anterior, quase sempre para cima, porque mortes registradas depois entram na conta."},
        {"id": "mvi_quebra_taxa", "titulo": "A taxa muda de base de população",
         "texto": f"A taxa por 100 mil habitantes de cada ano (das mortes violentas e das mortes por intervenção policial) "
                  "usa a população da edição de onde vem. Entre "
                  f"{quebras_texto} a base muda (Censo 2022 e, depois, estimativas novas do IBGE), e a taxa sobe ou "
                  "cai também por isso. Para ver a evolução, use o número de mortes; para comparar estados no mesmo "
                  "ano, a taxa (todas vêm da mesma edição)."},
        {"id": "mdip_dentro_das_mvi", "titulo": "Mortes por intervenção policial estão dentro das MVI",
         "texto": "As mortes decorrentes de intervenção policial (policiais civis e militares, em serviço e fora de "
                  "serviço) são uma das quatro parcelas das mortes violentas intencionais: não se somam a elas. São os "
                  "registros oficiais de cada estado; a forma de registrar muda entre estados e ao longo do tempo."},
    ]


def juntar(mvi, mdip):
    """Uma linha por território e ano com as colunas das MVI e as da letalidade policial (prefixo mdip_)."""
    mvi, mdip = mvi.copy(), mdip.copy()
    mvi["ano"], mdip["ano"] = mvi["ano"].astype(int), mdip["ano"].astype(int)
    mdip = mdip[["uf", "ano", *COLUNAS_MDIP]].rename(columns=COLUNAS_MDIP)
    return mvi.merge(mdip, on=["uf", "ano"], how="left", validate="one_to_one")


def montar_violencia_json(mvi, ufs, territorios, mdip=None):
    """violencia.json. mvi: tabela `fbsp_mvi`; mdip: `fbsp_mdip`; ufs: dicionarios/nacional/ufs.csv; territorios:
    territorios.csv (o país)."""
    mvi = mvi.copy()
    mvi["ano"] = mvi["ano"].astype(int)
    colunas = COLUNAS
    if mdip is not None:
        mvi = juntar(mvi, mdip)
        colunas = COLUNAS + list(COLUNAS_MDIP.values())
    pais = territorios["uf"].iloc[0]
    anos = sorted(mvi["ano"].unique().tolist())
    ultimo = mvi[mvi["ano"] == anos[-1]]
    quebras = quebras_de_base(mvi, pais)
    return {
        "fonte": FONTE,
        "fonte_curta": "FBSP, Anuário Brasileiro de Segurança Pública",
        "pagina": PAGINA,
        "edicoes": sorted({*mvi["edicao_fonte"].astype(int), *mvi["edicao_primeira_publicacao"].astype(int)}),
        "anos": anos,
        "pais": pais,
        "ultimo_ano": anos[-1],
        # o último ano saiu numa edição só: a próxima pode revisá-lo (marca "sujeito a revisão" na tela)
        "ano_sujeito_a_revisao": anos[-1],
        "quebras_taxa": quebras,
        "territorios": [{"uf": pais, "nome": territorios["nome"].iloc[0], "regiao": None},
                        *[{"uf": u, "nome": n, "regiao": r} for u, n, r in zip(ufs["uf"], ufs["nome"], ufs["regiao"])]],
        "unidade": "mvi_numero: número de vítimas; mvi_taxa: por 100 mil habitantes (população da edição de origem)",
        "ressalvas": ressalvas(anos[-1], int(ultimo["edicao_fonte"].max()), quebras),
        "linhas": _registros(mvi[colunas].sort_values(["uf", "ano"])),
    }


def gabarito_violencia(mvi, ufs, pais, mdip=None):
    """Contas da tela para o teste do front: ranking das UFs pela taxa em cada ano (1 = maior) e o índice do número
    com o primeiro ano = 100, para cada UF, cada região (soma das UFs) e o país; com `mdip`, também o ranking pela taxa
    de mortes por intervenção policial e o % delas nas MVI (soma das MDIP / soma das MVI × 100, por território)."""
    mvi = mvi.copy()
    mvi["ano"] = mvi["ano"].astype(int)
    letalidade = {}
    if mdip is not None:
        juntos = juntar(mvi, mdip)
        so = juntos[juntos["uf"] != pais]
        pos = ranking(so[["uf", "ano", "mdip_taxa"]], "mdip_taxa", ["ano"])
        regiao_de = dict(zip(ufs["uf"], ufs["regiao"]))
        somas = pd.concat([juntos[["uf", "ano", "mdip_numero", "mvi_numero"]],
                           so.assign(uf=so["uf"].map(regiao_de)).groupby(["uf", "ano"], as_index=False)[
                               ["mdip_numero", "mvi_numero"]].sum()], ignore_index=True)
        somas["pct"] = somas["mdip_numero"] / somas["mvi_numero"] * 100
        letalidade = {
            "ranking_mdip": _registros(pos[["uf", "ano", "mdip_taxa", "mdip_taxa_posicao", "mdip_taxa_n_ufs"]]
                                       .rename(columns={"mdip_taxa_posicao": "posicao", "mdip_taxa_n_ufs": "n_ufs"})
                                       .sort_values(["ano", "uf"])),
            "pct_mdip_nas_mvi": _registros(somas[["uf", "ano", "pct"]].sort_values(["uf", "ano"])),
        }
    primeiro = int(mvi["ano"].min())
    so_ufs = mvi[mvi["uf"] != pais]
    posicoes = ranking(so_ufs[["uf", "ano", "mvi_taxa"]], "mvi_taxa", ["ano"])
    regiao = dict(zip(ufs["uf"], ufs["regiao"]))
    por_regiao = (so_ufs.assign(uf=so_ufs["uf"].map(regiao)).groupby(["uf", "ano"], as_index=False)["mvi_numero"].sum())
    territorios = pd.concat([mvi[["uf", "ano", "mvi_numero"]], por_regiao], ignore_index=True)
    indice = rebasear(territorios, "mvi_numero", primeiro).rename(columns={f"mvi_numero_base_{primeiro}": "indice"})
    return {
        "metodo": {
            "posicao": "1 = maior taxa entre as 27 UFs no ano; empate fica com a melhor posição",
            "pct_mdip_nas_mvi": "soma das mortes por intervenção policial / soma das MVI do território × 100",
            "indice": f"soma do número de MVI do território (UF, região = soma das UFs dela, ou país) no ano / no "
                      f"primeiro ano da série ({primeiro}) × 100",
        },
        "ranking": _registros(posicoes[["uf", "ano", "mvi_taxa", "mvi_taxa_posicao", "mvi_taxa_n_ufs"]]
                              .rename(columns={"mvi_taxa_posicao": "posicao", "mvi_taxa_n_ufs": "n_ufs"})
                              .sort_values(["ano", "uf"])),
        "indice": _registros(indice[["uf", "ano", "indice"]].sort_values(["uf", "ano"])),
        "base": primeiro,
        **letalidade,
    }


def _registros(df):
    """DataFrame → lista de dicts (nulos viram None, números viram tipos nativos)."""
    from publicacao.exportar import registros

    return registros(df)
