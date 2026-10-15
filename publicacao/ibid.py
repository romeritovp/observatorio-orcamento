"""IBID (INPI) para o front: tabelas `ibid_escore` e `ibid_ranking` em JSON.

- ibid.json: escores (6 casas) e ranking oficial das 27 UFs, escores das regiões e do Brasil, dimensões e a ficha
  da fonte, no formato da saída original do extrator (data/nacional/inpi/ibid.json), mais `mediana_ufs`: o
  "estado típico", mediana das 27 UFs em cada dimensão e ano, calculada aqui (não pelo INPI). Carregado só pela
  tela "Pesquisa e Inovação".
- despesa_ensino_superior.json (`linhas_ensino_superior`): linhas da subfunção 364 (Ensino Superior) dentro de
  Educação (função 12), das 27 UFs, em R$ nominais, para o cruzamento com o orçamento.
- bloco "ibid" do meta.json (`bloco_meta`): anos, a comparabilidade dos escores entre anos (config/ibid.yaml,
  único ponto de configuração) e as ressalvas da tela.
"""

import unicodedata

from analytics import mediana_entre_ufs

CASAS = 6
ESCALA = "Escore de 0 a 1 (maior = melhor). Ranking: 1 = melhor posição entre as 27 UFs."
RANKING_OFICIAL_PARA = ["geral", "contexto", "resultado"]
FUNCAO_EDUCACAO, SUBFUNCAO_ENSINO_SUPERIOR = "12", "364"
MEDIANA = {"nome": "Estado típico (mediana das UFs)",
           "calculado_por": "Observatório: mediana dos escores das 27 UFs publicados pelo INPI (não é um número do INPI)"}


def id_agregado(nome):
    """"Centro-Oeste" → "centro_oeste", "Brasil" → "brasil" (chave dos agregados no JSON)."""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return sem_acento.lower().replace("-", "_").replace(" ", "_")


def _por_ano(df, coluna, converter):
    return {str(int(a)): converter(v) for a, v in zip(df["ano"], df[coluna])}


def montar_ibid_json(escore, ranking, dimensoes, ufs, agregados, fonte, config):
    """ibid.json. escore, ranking: tabelas processadas; dimensoes: ibid_dimensoes.csv; ufs: ufs.csv;
    agregados: regioes.csv + territorios.csv (uf, nome); fonte: data/processed/ibid_fonte.json; config: config/ibid.yaml."""
    anos = sorted(int(a) for a in escore["ano"].unique())
    ordem_dims = list(dimensoes["dimensao"])
    escore = escore.sort_values("ano")
    ranking = ranking.sort_values("ano")

    def escores_de(uf):
        parte = escore[escore["uf"] == uf]
        return {d: _por_ano(parte[parte["dimensao"] == d], "escore", lambda v: round(float(v), CASAS)) for d in ordem_dims}

    saida_ufs = {}
    for uf, nome in sorted(zip(ufs["uf"], ufs["nome"])):  # ordem da sigla, como na saída original do extrator
        parte = ranking[ranking["uf"] == uf]
        saida_ufs[uf] = {"nome": nome, "escores": escores_de(uf),
                         "ranking": {d: _por_ano(parte[parte["dimensao"] == d], "posicao", int) for d in RANKING_OFICIAL_PARA}}
    saida_agregados = {id_agregado(nome): {"nome": nome, "escores": escores_de(uf)} for uf, nome in zip(agregados["uf"], agregados["nome"])}
    divergencias = fonte["divergencias_ranking"]
    mediana = mediana_entre_ufs(escore[escore["uf"].isin(ufs["uf"])][["uf", "ano", "dimensao", "escore"]], "escore",
                                ["dimensao", "ano"])
    if (mediana["n_ufs"] != len(ufs)).any():
        raise ValueError(f"mediana do IBID sem as {len(ufs)} UFs em algum ano ou dimensão")
    mediana = mediana.sort_values("ano")
    return {
        "fonte": {
            "nome": config["nome"], "orgao": config["orgao"], "url": fonte["url"], "nota_original": fonte["nota_original"],
            "arquivo_sha256": fonte["arquivo_sha256"], "extraido_em": fonte["extraido_em"][:10],
        },
        "escala": ESCALA,
        "anos": anos,
        "dimensoes": [{"id": d, "nome": n, "pai": p or None}
                      for d, n, p in zip(dimensoes["dimensao"], dimensoes["nome"], dimensoes["pai"])],
        "ranking_oficial_para": RANKING_OFICIAL_PARA,
        "ufs": saida_ufs,
        "agregados": saida_agregados,
        "conferencia": {"ranking_oficial_vs_escore": "ok" if not divergencias else "divergente", "divergencias": divergencias},
        "mediana_ufs": {**MEDIANA, "escores": {d: _por_ano(mediana[mediana["dimensao"] == d], "escore_mediana",
                                                             lambda v: round(float(v), CASAS)) for d in ordem_dims}},
    }


def linhas_ensino_superior(tabela):
    """Linhas da subfunção 364 dentro de Educação (sem intra, DCA), do formato da tabela despesa publicada
    (publicacao.exportar.montar_despesa), em R$ nominais: o front calcula por habitante e % do orçamento."""
    return tabela[(tabela["nivel"] == "subfuncao") & (tabela["funcao_cod"] == FUNCAO_EDUCACAO)
                  & (tabela["subfuncao_cod"] == SUBFUNCAO_ENSINO_SUPERIOR) & ~tabela["intra"]
                  & (tabela["fonte_dado"] == "siconfi_dca")]


def ressalvas(ibid_json, comparaveis):
    """Notas obrigatórias da tela (cada uma com ligação "entenda" na página "Como fazemos")."""
    brasil = list(ibid_json["agregados"]["brasil"]["escores"]["geral"].values())
    faixa = f"entre {min(brasil):.2f} e {max(brasil):.2f}".replace(".", ",")
    return [
        *([] if comparaveis else [{
            "id": "ibid_escores_entre_anos", "titulo": "Escores só se comparam dentro do mesmo ano",
            "texto": f"Ainda não está confirmado se o escore do IBID pode ser comparado entre anos: a média do Brasil fica "
                     f"quase parada ({faixa}), o que sugere que o índice é recalculado a cada ano. Por isso a evolução no "
                     "tempo aparece só pela posição no ranking, e os escores só são comparados dentro de um mesmo ano."}]),
        {"id": "ibid_ct_ensino_superior", "titulo": "Ciência e Tecnologia e Ensino Superior",
         "texto": "A área Ciência e Tecnologia (função 19) concentra as fundações de amparo à pesquisa; as universidades "
                  "estaduais aparecem em Ensino Superior (subfunção 364, dentro de Educação). Somar as duas dá um retrato "
                  "mais completo do apoio do estado à pesquisa, mas o Ensino Superior também inclui o ensino, não só a "
                  "pesquisa. Onde o estado não declara a subfunção 364 num ano, o Ensino Superior entra como zero, marcado."},
        {"id": "ibid_lado_a_lado", "titulo": "Lado a lado não quer dizer causa",
         "texto": "O gasto do governo estadual e a posição no índice aparecem juntos para comparação. O IBID mede a "
                  "economia e as instituições do estado inteiro, não só a ação do governo estadual: um número não "
                  "explica o outro sozinho."},
    ]


def bloco_meta(ibid_json, config):
    """Bloco "ibid" do meta.json: anos, comparabilidade dos escores (config/ibid.yaml) e ressalvas."""
    comparaveis = bool(config["escores_comparaveis_entre_anos"])
    return {"anos": ibid_json["anos"], "escores_comparaveis_entre_anos": comparaveis,
            "pagina_oficial": config["pagina_oficial"], "ressalvas": ressalvas(ibid_json, comparaveis)}
