"""PIB por UF para o front: tabelas `pib_uf` e `pib_uf_atividade` (IBGE, Contas Regionais) em JSON, em R$ nominais.

Arquivos (gravados por publicacao.exportar):
- pib.json: PIB, VAB e volume do PIB de cada território e ano (27 UFs e o país), dicionário das atividades,
  ressalvas e a ficha da fonte. Carregado só pela tela "PIB dos estados".
- pib/<UF>.json: a conta da produção da UF por atividade (VBP, CI, VAB e índice de volume do VAB).

O front calcula participações, rebase e crescimento (web/src/calculos.js); `gabarito_pib` calcula o mesmo
com analytics/ para o teste do front.
"""

import pandas as pd

from analytics import crescimento_acumulado, participacao_no_pais, participacao_no_vab, rebasear

FONTE = "IBGE, Contas Regionais do Brasil"
GRANDES_SETORES = [("agropecuaria", "Agropecuária"), ("industria", "Indústria"), ("servicos", "Serviços")]
COLUNAS_UF = ["uf", "ano", "pib_corrente", "vab", "volume_pib_2002_100"]
COLUNAS_ATIVIDADE = ["uf", "ano", "atividade_cod", "nivel", "valor_producao", "consumo_intermediario", "vab",
                     "vab_indice_volume"]


def ressalvas(ultimo_ano):
    """Notas obrigatórias da tela (cada uma com ligação "entenda" na página "Como fazemos")."""
    return [
        {"id": "pib_administracao_publica", "titulo": "Administração pública não é a despesa do estado",
         "texto": "A atividade \"Administração, defesa, educação e saúde públicas e seguridade social\" mede o peso do setor "
                  "público na economia do estado: inclui escolas, hospitais, defesa e seguridade de todos os níveis de "
                  "governo (federal, estadual e municipal). Não é a despesa do governo estadual."},
        {"id": "pib_nominal", "titulo": "Participações a preços correntes",
         "texto": "As participações no valor adicionado são calculadas com valores da época (nominais). Uma atividade "
                  "pode ganhar peso só porque o preço do que ela produz subiu, sem produzir mais: é o caso das "
                  "indústrias extrativas quando o preço do petróleo sobe."},
        {"id": "pib_defasagem", "titulo": f"Último ano disponível: {ultimo_ano}",
         "texto": "O IBGE publica o PIB dos estados com cerca de dois anos de defasagem, e cada edição revisa a série "
                  f"inteira. O último ano disponível é {ultimo_ano}."},
    ]


def montar_pib_json(pib_uf, atividades, dicionario_atividades, territorios, ufs, pagina):
    """{caminho relativo: objeto} com pib.json e pib/<UF>.json.

    territorios: dicionarios/nacional/territorios.csv (o país); ufs: dicionarios/nacional/ufs.csv;
    pagina: pasta da edição no FTP do IBGE (config/ibge_contas_regionais.yaml).
    """
    edicao = int(pib_uf["edicao"].max())
    anos = sorted(int(a) for a in pib_uf["ano"].unique())
    pais = territorios["uf"].iloc[0]
    geral = {
        "fonte": f"{FONTE} (edição {edicao}, referência 2010)",
        "fonte_curta": FONTE,
        "edicao": edicao,
        "pagina": pagina,
        "extraido_em": max(pib_uf["extraido_em"].max(), atividades["extraido_em"].max()),
        "anos": anos,
        "pais": pais,
        "territorios": [{"uf": pais, "nome": territorios["nome"].iloc[0]},
                        *[{"uf": u, "nome": n} for u, n in zip(ufs["uf"], ufs["nome"])]],
        "atividades": dicionario_atividades[["atividade_cod", "nome", "nome_curto", "grande_setor"]].to_dict(orient="records"),
        "grandes_setores": [{"id": i, "nome": n} for i, n in GRANDES_SETORES],
        "unidade": "R$ nominais (a fonte publica em R$ milhão); volume_pib_2002_100: série encadeada, 2002 = 100",
        "ressalvas": ressalvas(anos[-1]),
        "linhas": _registros(pib_uf[COLUNAS_UF].sort_values(["uf", "ano"])),
        "atividades_por_uf": "pib/<UF>.json",
    }
    arquivos = {"pib.json": geral}
    tabela = atividades[COLUNAS_ATIVIDADE].sort_values(["uf", "atividade_cod", "ano"])
    for uf, parte in tabela.groupby("uf"):
        arquivos[f"pib/{uf}.json"] = _registros(parte)
    return arquivos


def gabarito_pib(pib_uf, atividades, dicionario_atividades, pais, inicios=(2015,), periodos=((2015, 2023),)):
    """Contas do PIB para o teste do front: participação de cada atividade e grande setor no VAB, participação no
    PIB do país, volume do PIB rebaseado (primeiro ano da série e `inicios`) e crescimento real acumulado."""
    anos = sorted(int(a) for a in pib_uf["ano"].unique())
    grupos = dict(zip(dicionario_atividades["atividade_cod"], dicionario_atividades["grande_setor"]))
    rebases = pd.concat([rebasear(pib_uf, "volume_pib_2002_100", b)
                         .rename(columns={f"volume_pib_2002_100_base_{b}": "valor"})
                         .assign(base=b)[["uf", "ano", "base", "valor"]]
                         for b in sorted({anos[0], *inicios})], ignore_index=True)
    crescimentos = pd.concat([crescimento_acumulado(pib_uf, "volume_pib_2002_100", i, f).assign(inicio=i, fim=f)
                              for i, f in sorted({(anos[0], anos[-1]), *periodos})], ignore_index=True)
    return {
        "metodo": {
            "pct": "VAB da atividade (ou soma das atividades do grande setor) / VAB da linha nivel=total × 100; "
                   "grupo com atividade nula fica nulo",
            "pct_pais": "pib_corrente do território / pib_corrente do país no mesmo ano × 100",
            "rebase": "volume_pib_2002_100 / volume_pib_2002_100 no ano base × 100",
            "crescimento_pct": "(volume no fim / volume no início − 1) × 100",
        },
        "atividades": _registros(participacao_no_vab(atividades)[["uf", "ano", "chave", "pct"]]),
        "setores": _registros(participacao_no_vab(atividades, grupos)[["uf", "ano", "chave", "pct"]]),
        "pct_pais": _registros(participacao_no_pais(pib_uf, "pib_corrente", pais)[["uf", "ano", "pib_corrente_pct_pais"]]
                               .rename(columns={"pib_corrente_pct_pais": "pct"})),
        "rebase": _registros(rebases),
        "crescimento": _registros(crescimentos[["uf", "inicio", "fim", "crescimento_pct"]]),
    }


def _registros(df):
    """DataFrame → lista de dicts (nulos viram None, números viram tipos nativos)."""
    from publicacao.exportar import registros

    return registros(df)
