"""IDEB (Inep) em JSON: data/nacional/inep/ideb.json, a partir da tabela `ideb` e de data/processed/ideb_fonte.json.

Uso:
    uv run python -m publicacao.ideb

Mesmo desenho do ibid.json: ficha da fonte (arquivos, hashes, data), anos, dicionários de etapas, redes e indicadores,
dados por UF e dos agregados (regiões e Brasil, lidos pelo nome), ressalvas (gerais e por UF, no estilo do
receita.json: {id, anos?, titulo, texto}) e o relatório de conferência do extrator. Ainda não vai para o site
(integração na tela fica para depois); valores como publicados, sem nenhuma conta.
"""

import json
import unicodedata

import pandas as pd

from analyses.carregar import RAIZ, carregar, carregar_dicionario

CAMINHO_FONTE = RAIZ / "data" / "processed" / "ideb_fonte.json"
SAIDA = RAIZ / "data" / "nacional" / "inep" / "ideb.json"

ETAPAS = [("anos_iniciais", "Anos iniciais do ensino fundamental (1º ao 5º ano)"),
          ("anos_finais", "Anos finais do ensino fundamental (6º ao 9º ano)"),
          ("medio", "Ensino médio")]
REDES = [("estadual", "Estadual (no DF, a rede distrital); a principal para o site"), ("municipal", "Municipal (só no Brasil)"),
         ("publica", "Pública (federal, estadual e municipal)"), ("privada", "Privada"), ("total", "Total")]
INDICADORES = [
    ("ideb", "IDEB observado", "0 a 10 (N × P, arredondado a uma casa)", None),
    ("rendimento", "Indicador de rendimento (P)", "0 a 1", "a partir das taxas de aprovação"),
    ("nota_padronizada", "Nota média padronizada (N)", "0 a 10", "média de matemática e língua portuguesa padronizadas"),
    ("saeb_matematica", "Nota Saeb de matemática", "escala Saeb da etapa", "não comparar entre etapas"),
    ("saeb_portugues", "Nota Saeb de língua portuguesa", "escala Saeb da etapa", "não comparar entre etapas"),
    ("aprovacao", "Taxa de aprovação", "%", "por série: 'total' e o número do ano (ou da série, no médio)"),
    ("meta", "Meta do 1º ciclo do IDEB", "0 a 10", "só 2007 a 2021; meta, não resultado: não exibir na tela"),
]
SERIES = ["total", "1", "2", "3", "4", "5", "6", "7", "8", "9"]


def id_agregado(nome):
    """"Centro-Oeste" → "centro_oeste" (como no ibid.json)."""
    return unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower().replace("-", "_").replace(" ", "_")


def ressalvas(fonte, anos):
    """Gerais (com `anos` e `etapas` quando valem só para eles) e por UF (notas de rodapé da planilha e o DF)."""
    gerais = [
        {"id": "ideb_formulacao_2007", "titulo": "Última edição na formulação de 2007",
         "texto": f"{anos[-1]} é a última edição do IDEB na formulação original de 2007. O Inep criou um grupo técnico para "
                  "atualizar o índice; a edição de 2027 pode mudar a metodologia e não ser comparável com esta série."},
        {"id": "ideb_metas_ate_2021", "titulo": "Metas só até 2021",
         "texto": "As metas oficiais do 1º ciclo do IDEB vão de 2007 a 2021. Para 2023 e 2025 não há meta oficial, e nenhuma "
                  "foi projetada aqui. Metas não são resultados: ficam fora da tela."},
        {"id": "ideb_pandemia_2021", "anos": [2021], "titulo": "2021: pandemia",
         "texto": "Em 2021, a aprovação foi inflada pelas regras de promoção na pandemia e a participação no Saeb foi menor. "
                  "O Inep pede cautela ao comparar 2021 com os outros anos (nota informativa do IDEB 2021)."},
        {"id": "ideb_medio_saeb_censitario", "anos": [2017, 2019], "etapas": ["medio"],
         "titulo": "Ensino médio: Saeb amostral até 2017, censitário a partir de 2019",
         "texto": "No ensino médio, o Saeb era amostral até 2017 e passou a ser censitário para as escolas públicas em 2019. "
                  "A passagem de 2017 para 2019 pode ser uma quebra de série."},
        {"id": "ideb_escalas_saeb", "titulo": "Notas Saeb não se comparam entre etapas",
         "texto": "Cada etapa tem sua escala de proficiência no Saeb: uma nota dos anos iniciais não se compara com uma do "
                  "ensino médio. O IDEB (de 0 a 10) também não deve ser comparado entre etapas."},
        {"id": "ideb_municipalizacao", "etapas": ["anos_iniciais"], "titulo": "Rede estadual nos anos iniciais",
         "texto": "Em estados que passaram os anos iniciais para os municípios, a rede estadual tem poucas escolas nessa etapa: "
                  "o resultado pode faltar ou representar pouco do estado."},
    ]
    por_uf = {"DF": [{"id": "ideb_df_distrital", "titulo": "Rede distrital",
                      "texto": "No DF, a rede \"estadual\" é a rede distrital, e não há rede municipal."}]}
    for r in fonte["ressalvas_por_linha"]:
        chave = (r["uf"], r["nota"], r["texto"])
        etapa_rede = {"etapa": r["etapa"], "rede": r["rede"]}
        existente = next((x for x in por_uf.get(r["uf"], []) if x.get("_chave") == chave), None)
        if existente:
            existente["linhas"].append(etapa_rede)
            continue
        por_uf.setdefault(r["uf"], []).append({
            # id pelo TEXTO da nota: o número "(1)", "(2)"... muda entre abas e arquivos
            "_chave": chave, "id": "ideb_nota_" + "_".join(id_agregado(r["texto"]).replace(",", "").replace(";", "").split("_")[:9]),
            "anos": r["anos"],
            "titulo": "Nota da planilha do Inep", "texto": r["texto"].rstrip(";").strip() + ".", "linhas": [etapa_rede]})
    for lista in por_uf.values():
        for x in lista:
            x.pop("_chave", None)
    return gerais, dict(sorted(por_uf.items()))


def _dados(df):
    """{etapa: {rede: {indicador: {ano: valor}} (aprovação: {serie: {ano: valor}})}} de um território."""
    saida = {}
    for (etapa, rede), parte in df.groupby(["etapa", "rede"], sort=False):
        bloco = {}
        for indicador, _, _, _ in INDICADORES:
            linhas = parte[parte["indicador"] == indicador].sort_values("ano")
            if linhas.empty:
                continue
            valor = lambda v: None if pd.isna(v) else float(v)
            if indicador == "aprovacao":
                bloco[indicador] = {s: {str(int(a)): valor(v) for a, v in zip(g["ano"], g["valor"])}
                                    for s in SERIES for g in [linhas[linhas["serie"] == s]] if not g.empty}
            else:
                bloco[indicador] = {str(int(a)): valor(v) for a, v in zip(linhas["ano"], linhas["valor"])}
        saida.setdefault(etapa, {})[rede] = bloco
    ordem_etapas = [e for e, _ in ETAPAS]
    ordem_redes = [r for r, _ in REDES]
    return {e: {r: saida[e][r] for r in ordem_redes if r in saida[e]} for e in ordem_etapas if e in saida}


def montar_ideb_json(ideb, fonte, ufs, agregados):
    """ideb: tabela `ideb`; fonte: ideb_fonte.json; ufs: ufs.csv; agregados: regioes.csv + territorios.csv (uf, nome)."""
    anos = fonte["anos"]
    gerais, por_uf = ressalvas(fonte, anos)
    return {
        "fonte": {
            "nome": "Índice de Desenvolvimento da Educação Básica (IDEB)",
            "orgao": "Inep (Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira), MEC",
            "pagina": "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados",
            "edicao": fonte["edicao"], "formulacao": "original_2007", "nota_original": fonte["nota_original"],
            "arquivos": fonte["arquivos"], "extraido_em": max(a["extraido_em"] for a in fonte["arquivos"])[:10],
        },
        "anos": anos,
        "etapas": [{"id": i, "nome": n} for i, n in ETAPAS],
        "redes": [{"id": i, "nome": n} for i, n in REDES],
        "indicadores": [{"id": i, "nome": n, "unidade": u, **({"observacao": o} if o else {})} for i, n, u, o in INDICADORES],
        "ufs": {uf: {"nome": nome, "etapas": _dados(ideb[ideb["uf"] == uf])} for uf, nome in sorted(zip(ufs["uf"], ufs["nome"]))},
        "agregados": {id_agregado(nome): {"nome": nome, "etapas": _dados(ideb[ideb["uf"] == uf])}
                      for uf, nome in zip(agregados["uf"], agregados["nome"])},
        "ressalvas": gerais,
        "ressalvas_por_uf": por_uf,
        "conferencia": {**fonte["conferencias"], "codigos_da_planilha": fonte["codigos_ausentes"]},
    }


def main(saida=SAIDA):
    fonte = json.loads(CAMINHO_FONTE.read_text(encoding="utf-8"))
    agregados = pd.concat([carregar_dicionario("nacional/regioes.csv"), carregar_dicionario("nacional/territorios.csv")])
    dados = montar_ideb_json(carregar("ideb"), fonte, carregar_dicionario("nacional/ufs.csv"), agregados)
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{saida.relative_to(RAIZ)}: {len(dados['ufs'])} UFs, {len(dados['agregados'])} agregados, "
          f"{dados['anos'][0]}–{dados['anos'][-1]}, {saida.stat().st_size / 1024:,.0f} KB")


if __name__ == "__main__":
    main()


# --- site (tela "Educação") ------------------------------------------------------------------------------

ETAPA_PADRAO, REDE_PADRAO = "medio", "estadual"  # ensino médio e rede estadual: a responsabilidade principal do estado


def _lista(por_ano, anos):
    """{ano: valor} → [valor por ano de `anos`] (nulo onde não há)."""
    return [por_ano.get(str(a)) for a in anos]


def _sem(dados_territorio, anos, chaves_fora, aprovacao_so_total):
    """Dados de um território para o site: sem os indicadores `chaves_fora`, cada série como lista alinhada a `anos`
    (economiza as chaves de ano) e, se pedido, só a aprovação total."""
    saida = {}
    for etapa, redes in dados_territorio.items():
        saida[etapa] = {}
        for rede, bloco in redes.items():
            novo = {}
            for indicador, valores in bloco.items():
                if indicador in chaves_fora:
                    continue
                if indicador == "aprovacao":
                    series = {"total": valores.get("total", {})} if aprovacao_so_total else valores
                    novo[indicador] = {serie: _lista(v, anos) for serie, v in series.items()}
                else:
                    novo[indicador] = _lista(valores, anos)
            saida[etapa][rede] = novo
    return saida


def montar_ideb_site(ideb_json):
    """{caminho: objeto} para web/public/data: ideb.json (geral, sem metas, aprovação só total) e ideb/<UF>.json
    (aprovação por série da UF), com as séries como listas alinhadas a `anos`. Metas nunca vão para o site."""
    anos = ideb_json["anos"]
    geral = {
        **{k: ideb_json[k] for k in ("fonte", "anos", "etapas", "redes", "ressalvas", "ressalvas_por_uf")},
        "formato": "cada indicador é uma lista alinhada a `anos` (nulo = sem dado); aprovação por série: {serie: lista}",
        "indicadores": [i for i in ideb_json["indicadores"] if i["id"] != "meta"],
        "conferencia": {"controles_2025": ideb_json["conferencia"]["controles_2025"],
                        "n_x_p": {k: v for k, v in ideb_json["conferencia"]["n_x_p"].items() if k != "ideb_sem_n_ou_p"}},
        "ufs": {uf: {"nome": d["nome"], "etapas": _sem(d["etapas"], anos, {"meta"}, True)} for uf, d in ideb_json["ufs"].items()},
        "agregados": {a: {"nome": d["nome"], "etapas": _sem(d["etapas"], anos, {"meta"}, True)} for a, d in ideb_json["agregados"].items()},
        "por_uf": "ideb/<UF>.json",
    }
    arquivos = {"ideb.json": geral}
    for uf, d in ideb_json["ufs"].items():
        completo = _sem(d["etapas"], anos, {"meta"}, False)
        arquivos[f"ideb/{uf}.json"] = {etapa: {rede: {"aprovacao": bloco.get("aprovacao", {})} for rede, bloco in redes.items()}
                                       for etapa, redes in completo.items()}
    return arquivos


def bloco_meta(ideb_json):
    """Bloco "ideb" do meta.json: anos, etapas e redes (para a URL da tela antes de o arquivo chegar) e os padrões."""
    redes_ufs = sorted({r for d in ideb_json["ufs"].values() for e in d["etapas"].values() for r in e})
    return {"anos": ideb_json["anos"], "etapas": [e["id"] for e in ideb_json["etapas"]],
            "redes": [r["id"] for r in ideb_json["redes"] if r["id"] in redes_ufs],
            "etapa_padrao": ETAPA_PADRAO, "rede_padrao": REDE_PADRAO}


def gabarito_ideb(ideb, ufs):
    """Para o teste do front: posição de cada UF no IDEB (1 = maior) por etapa, rede e ano, e a variação em pontos
    sobre a edição anterior. ideb: tabela `ideb`; ufs: siglas das 27 UFs."""
    from analytics import ranking

    df = ideb[(ideb["indicador"] == "ideb") & ideb["uf"].isin(ufs)][["uf", "ano", "etapa", "rede", "valor"]].copy()
    df = ranking(df, "valor", ["etapa", "rede", "ano"]).sort_values(["etapa", "rede", "uf", "ano"])
    df["variacao_pontos"] = df.groupby(["etapa", "rede", "uf"])["valor"].diff()
    from publicacao.exportar import registros
    return registros(df.rename(columns={"valor": "ideb", "valor_posicao": "posicao", "valor_n_ufs": "n_ufs"})[
        ["uf", "ano", "etapa", "rede", "ideb", "posicao", "n_ufs", "variacao_pontos"]])
