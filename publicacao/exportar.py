"""Camada de publicação: exporta os dados processados em JSON para o front (web/public/data/).

Uso:
    uv run python -m publicacao.exportar

Arquivos gerados:
    meta.json          descrição dos arquivos, colunas, níveis, regras de uso e método de deflação
    dicionarios.json   UFs, funções e subfunções (código → nome)
    ipca.json          variação anual dez/dez do IPCA
    despesa.json       tabela despesa em R$ NOMINAIS, com população e data da extração
    receita.json       receita por UF, ano e item (DCA I-C): bruta, deduções e líquida, em R$ nominais
    divida.json        dívida por UF e ano (estoque do RGF Anexo 02 e pagamento da DCA I-D), em R$ nominais
    estatais.json      estatais ativas e não dependentes por edição, UF e função (só informativo: gera avisos,
                       nunca altera valores de despesa)
    gabarito.json      só para TESTE do front: per capita real e % da despesa total da saúde,
                       calculados por analytics/. Não é para exibição.

O export não calcula per capita nem valores reais: isso é feito no front, a partir de
despesa.json, ipca.json e da população. O gabarito permite conferir se o front calcula igual.
"""

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from analyses.carregar import RAIZ, carregar, carregar_dicionario, carregar_ipca
from publicacao import divida as divida_mod
from publicacao import receita as receita_mod
from analytics import (
    agregar, completar_com_zero, deflacionar, edicao_para_ano, estatais_fora_das_contas, funcao_das_estatais, mudancas_de_dependencia, nomes_de_exibicao,
    mediana_entre_ufs, participacao, per_capita, ranking, variacao,
)

DIR_SAIDA = RAIZ / "web" / "public" / "data"
CAMINHO_SITE = RAIZ / "config" / "site.yaml"
VERSAO_ESQUEMA = 1

COLUNAS_DESPESA = {
    "uf": "sigla da UF",
    "ano": "exercício",
    "nivel": "nível da linha: total, funcao, subfuncao ou demais (subfunções não listadas da função)",
    "funcao_cod": "código da função (2 dígitos); nulo no nível total",
    "subfuncao_cod": "código da subfunção (3 dígitos); só no nível subfuncao",
    "empenhado": "R$ nominais; nulo se a fonte não informa",
    "liquidado": "R$ nominais; nulo se a fonte não informa (padrão de despesa executada)",
    "pago": "R$ nominais; nulo se a fonte não informa",
    "intra": "true para despesas intraorçamentárias (dupla contagem se somadas às demais)",
    "populacao": "população da UF no ano (cadastro do SICONFI, não estimativa do IBGE)",
    "fonte_dado": "origem da linha (ex.: siconfi_dca)",
    "extraido_em": "data da extração na API (ISO 8601, UTC)",
}

FONTES = {
    "siconfi_dca": {
        "descricao": "SICONFI/Tesouro Nacional, DCA Anexo I-E (despesa por função e subfunção), dado anual",
        "nome_curto": "SICONFI, DCA Anexo I-E",
    },
}

ORDEM_NIVEIS = ["total", "funcao", "subfuncao", "demais"]

# Ressalvas para o leitor, exibidas abaixo dos gráficos do front
RESSALVAS = [
    {"id": "municipios", "titulo": "Não inclui os municípios",
     "texto": "Os números mostram só a despesa do governo estadual. O que as prefeituras gastam com "
              "recursos próprios não aparece, então o gasto total com a área dentro do estado é maior. "
              "A divisão de tarefas entre estado e municípios muda de um estado para outro."},
    {"id": "intra", "titulo": "Intraorçamentárias excluídas",
     "texto": "Pagamentos entre órgãos e entidades do próprio estado (despesas intraorçamentárias) ficam "
              "de fora para não contar o mesmo gasto duas vezes. Em alguns estados eles são grandes, "
              "sobretudo na saúde, e incluí-los mudaria a posição no ranking."},
    {"id": "populacao", "titulo": "População do cadastro do Tesouro",
     "texto": "O valor por habitante usa a população cadastrada pelo Tesouro Nacional no SICONFI, que se "
              "repete entre alguns anos. Não é a estimativa anual do IBGE."},
    {"id": "valores", "titulo": "Despesa liquidada, corrigida pela inflação",
     "texto": "Despesa liquidada é a que foi reconhecida como entregue no ano. Valores por habitante "
              "estão corrigidos pelo IPCA até dezembro do último ano disponível."},
    {"id": "declarado", "titulo": "Dados declarados pelos estados",
     "texto": "Os dados vêm da Declaração de Contas Anuais enviada por cada estado ao Tesouro Nacional "
              "(SICONFI) e podem ser retificados depois."},
]

# Ressalvas específicas de uma função (código), exibidas junto às gerais
RESSALVAS_POR_FUNCAO = {
    "17": [
        {"id": "saneamento_companhias", "titulo": "Companhias estaduais de saneamento",
         "texto": "Boa parte do saneamento é feita por companhias estaduais com orçamento próprio, "
                  "que não aparecem nestas contas."},
    ],
}

# Atribuição exigida pelas fontes sem licença explícita (docs/fontes/tesouro_estatais.md)
ATRIBUICAO_ESTATAIS = {
    "id": "tesouro_estatais",
    "dicionario": "dicionarios/nacional/estatais.csv",
    "texto": "Dados de empresas estatais: Tesouro Nacional, painel \"Raio X das Empresas dos Estados "
             "Brasileiros\" (github.com/tesouro/empresas-estados).",
    "fonte_curta": "Tesouro Nacional, Raio X das Empresas dos Estados Brasileiros",
    # Painel publicado: a pasta vAAAA traz os dados do exercício AAAA-1 (conferido em 2026-10-08)
    "painel": "https://tesouro.github.io/empresas-estados/v{edicao_painel}/",
    "url": "https://github.com/tesouro/empresas-estados",
    "licenca": "o repositório não declara licença; usados só dados cadastrais, com atribuição",
}

# Ressalvas da parte "As dívidas do estado"
RESSALVAS_DIVIDA = [
    {"id": "pagar_pouco", "titulo": "Pagar pouco não é dever pouco",
     "texto": "Estados em regime de recuperação fiscal ou com pagamentos à União suspensos aparecem pagando "
              "menos juros e amortização, mesmo devendo muito."},
    {"id": "suspensao_2020", "titulo": "2020: pagamentos à União suspensos",
     "texto": "Em 2020, os pagamentos das dívidas dos estados com a União foram suspensos por lei durante a "
              "pandemia. O valor pago naquele ano não é comparável com os outros."},
    {"id": "passivo_atuarial", "titulo": "Previdência fora da conta",
     "texto": "O passivo atuarial da previdência dos servidores, que em vários estados é maior que a dívida, "
              "não entra nestes números."},
]
NOTA_COMPOSICAO = "O relatório separa a dívida por tipo, não por credor. A maior parte da 'reestruturação' é com a União."

# Ressalvas da parte "De onde vem o dinheiro"
RESSALVAS_RECEITA = [
    {"id": "recodificacao_2022", "titulo": "Códigos novos a partir de 2022",
     "texto": "A classificação das receitas mudou em 2022 (ICMS, IPVA, FPE e FUNDEB, entre outros, ganharam códigos "
              "novos). Cada item aqui junta os códigos antigos e os novos; os itens principais não mostram salto por "
              "causa da troca, mas itens pequenos (\"outras\") podem mudar de composição entre 2021 e 2022."},
    {"id": "icms_2022", "titulo": "ICMS de combustíveis, energia e telecomunicações (2022)",
     "texto": "Em 2022, a Lei Complementar nº 194 limitou o ICMS sobre combustíveis, energia elétrica e "
              "telecomunicações. A arrecadação caiu em vários estados a partir daquele ano, e a União passou a "
              "compensar parte da perda (em \"outras transferências da União\")."},
    {"id": "fundeb", "titulo": "FUNDEB: sai e volta",
     "texto": "Parte do ICMS, do IPVA e de outras receitas vai para o FUNDEB (aparece como dedução) e volta ao estado "
              "conforme o número de alunos (aparece como \"FUNDEB, retorno\"). Não somar a dedução com o retorno."},
    {"id": "operacoes_credito", "titulo": "Empréstimo não é arrecadação",
     "texto": "Operações de crédito são dinheiro emprestado: entram na receita do ano, mas são dívida nova."},
]
RESSALVAS_RECEITA_POR_UF = {
    "RJ": [{"id": "royalties_rj", "titulo": "Royalties do petróleo não identificáveis",
            "texto": "O RJ não separa royalties e participações especiais do petróleo nas contas que entrega ao "
                     "Tesouro: eles devem estar em \"Demais receitas patrimoniais\" (R$ 25,9 bi em 2024, 26% da "
                     "receita), dentro de \"receita patrimonial\". Por isso o item royalties do RJ aparece quase zerado."}],
}

# Parâmetros do gabarito
ESTAGIO_GABARITO = "liquidado"


def registros(df):
    """DataFrame → lista de dicts prontos para JSON (nulos viram None, números viram tipos nativos)."""
    saida = []
    for linha in df.to_dict(orient="records"):
        saida.append({chave: _nativo(valor) for chave, valor in linha.items()})
    return saida


def _nativo(valor):
    if valor is None:
        return None
    try:
        if valor != valor:  # NaN, pd.NA
            return None
    except TypeError:  # pd.NA em comparação booleana
        return None
    if hasattr(valor, "item"):  # escalares numpy
        valor = valor.item()
    if isinstance(valor, float) and math.isinf(valor):
        return None
    return valor


def montar_despesa(despesa, populacao):
    """Tabela despesa com a população da UF no ano, só com as colunas publicadas."""
    pop = populacao[["uf", "ano", "populacao"]]
    if pop.duplicated(["uf", "ano"]).any():
        raise ValueError("população com mais de uma linha por uf e ano")
    df = despesa.merge(pop, on=["uf", "ano"], how="left")
    df["intra"] = df["intra"].astype(bool)
    df = df[list(COLUNAS_DESPESA)]
    ordem_nivel = df["nivel"].map({nivel: i for i, nivel in enumerate(ORDEM_NIVEIS)})
    df = df.assign(_ordem=ordem_nivel).sort_values(
        ["uf", "ano", "fonte_dado", "intra", "funcao_cod", "_ordem", "subfuncao_cod"], na_position="first")
    return df.drop(columns="_ordem").reset_index(drop=True)


def montar_dicionarios(ufs, funcoes, subfuncoes):
    return {
        "ufs": registros(ufs),
        "funcoes": registros(funcoes),
        "subfuncoes": registros(subfuncoes),
    }


def montar_ipca(ipca):
    return {
        "fonte": "IBGE, SIDRA tabela 1737 (variação acumulada em 12 meses em dezembro)",
        "descricao": "variacao_pct = variação dez/dez do ano, em %; indice_dez = número-índice de dezembro",
        "serie": registros(ipca[["ano", "variacao_pct", "indice_dez"]].sort_values("ano")),
    }


def indicadores_por_funcao(despesa, populacao, ipca, ano_base):
    """Todas as funções, UFs e anos: nominal, per capita (real e da época), % da despesa total e posições.

    UF que entregou a DCA no ano mas não tem linha na função entra com 0 e
    `sem_gasto_declarado = True` (docs/decisoes.md). Mesmo cálculo que o front faz em calculos.js.
    """
    e = ESTAGIO_GABARITO
    funcoes = despesa[(despesa["fonte_dado"] == "siconfi_dca") & (despesa["nivel"] == "funcao")
                      & ~despesa["intra"].astype(bool)]
    funcoes = funcoes[["uf", "ano", "nivel", "funcao_cod", e]]
    universo = funcoes[["uf", "ano"]].drop_duplicates()

    df = participacao(funcoes, e, ["ano"])
    # Linha da função sem valor no estágio (ex.: só empenhado) conta como ausência: entra com 0
    df = df[df[e].notna()]
    df = completar_com_zero(df, universo, ["uf", "ano"], ["nivel", "funcao_cod"], [e, f"{e}_part_pct"])
    df = deflacionar(df, [e], ano_base, ipca)
    df = per_capita(df, [e, f"{e}_real"], populacao)
    for coluna in [f"{e}_real_per_capita", f"{e}_per_capita", f"{e}_part_pct"]:
        df = ranking(df, coluna, ["funcao_cod", "ano"])
    return df.rename(columns={
        e: "nominal",
        f"{e}_real_per_capita": "per_capita_real",
        f"{e}_per_capita": "per_capita_nominal",
        f"{e}_part_pct": "pct_despesa_total",
        f"{e}_real_per_capita_posicao": "posicao_per_capita_real",
        f"{e}_per_capita_posicao": "posicao_per_capita_nominal",
        f"{e}_part_pct_posicao": "posicao_pct_despesa_total",
        f"{e}_real_per_capita_n_ufs": "n_ufs",
    })


def totais_por_uf(despesa, populacao, ipca, ano_base):
    """Despesa total de cada UF e ano (soma das funções, sem intra), corrigida, por habitante e variação.

    Mesmo cálculo que o front faz em calculos.js (totaisPorUfAno), para o resumo da tela "Por estado".
    """
    e = ESTAGIO_GABARITO
    funcoes = despesa[(despesa["fonte_dado"] == "siconfi_dca") & (despesa["nivel"] == "funcao")
                      & ~despesa["intra"].astype(bool)][["uf", "ano", "nivel", e]]
    df = agregar(funcoes, [e], ["ano"])
    df = deflacionar(df, [e], ano_base, ipca)
    df = per_capita(df, [e, f"{e}_real"], populacao)
    df = variacao(df, e, [])
    df = variacao(df, f"{e}_real", [])
    return df.rename(columns={
        e: "total_nominal", f"{e}_real": "total_real",
        f"{e}_per_capita": "per_capita_nominal", f"{e}_real_per_capita": "per_capita_real",
        f"{e}_var_pct": "var_nominal_pct", f"{e}_real_var_pct": "var_real_pct",
    })[["uf", "ano", "total_nominal", "total_real", "per_capita_nominal", "per_capita_real",
        "var_nominal_pct", "var_real_pct"]].sort_values(["uf", "ano"])


def divida_gabarito(registros, ipca, ano_base):
    """DCL/RCL com posição e mediana, e juros, amortização e total pago corrigidos (gabarito do front)."""
    df = divida_mod.tabela_divida(registros)
    df["pago"] = df["juros"] + df["amortizacao"]
    df = deflacionar(df, ["juros", "amortizacao", "pago"], ano_base, ipca)
    df = ranking(df, "dcl_rcl_pct", ["ano"])
    medianas = mediana_entre_ufs(df, "dcl_rcl_pct", ["ano"]).rename(columns={"dcl_rcl_pct_mediana": "dcl_rcl_pct"})
    valores = df.rename(columns={"dcl_rcl_pct_posicao": "posicao_dcl_rcl", "dcl_rcl_pct_n_ufs": "n_ufs"})[
        ["uf", "ano", "dcl_rcl_pct", "posicao_dcl_rcl", "n_ufs", "juros_real", "amortizacao_real", "pago_real"]]
    return valores.sort_values(["uf", "ano"]), medianas.sort_values("ano")


def receita_gabarito(totais, populacao, ipca, ano_base):
    """Receita líquida total (exceto intra), real e por habitante, e peso de impostos próprios e de
    transferências da União (% da líquida), com posições (1 = maior) e medianas."""
    df = totais.copy()
    df = deflacionar(df, ["liquida_exceto_intra"], ano_base, ipca)
    df = per_capita(df, ["liquida_exceto_intra_real"], populacao)
    df["pct_impostos_proprios"] = df["impostos_proprios"] / df["liquida_exceto_intra"] * 100
    df["pct_transferencias_uniao"] = df["transferencias_uniao"] / df["liquida_exceto_intra"] * 100
    df = df.rename(columns={"liquida_exceto_intra": "receita_liquida", "liquida_exceto_intra_real": "receita_liquida_real",
                            "liquida_exceto_intra_real_per_capita": "per_capita_real"})
    for coluna in ["per_capita_real", "pct_impostos_proprios"]:
        df = ranking(df, coluna, ["ano"])
    medianas = None
    for medida in ["per_capita_real", "pct_impostos_proprios"]:
        m = mediana_entre_ufs(df, medida, ["ano"]).drop(columns="n_ufs").rename(columns={f"{medida}_mediana": medida})
        medianas = m if medianas is None else medianas.merge(m, on="ano")
    valores = df.rename(columns={"per_capita_real_posicao": "posicao_per_capita_real",
                                 "pct_impostos_proprios_posicao": "posicao_pct_impostos", "per_capita_real_n_ufs": "n_ufs"})[
        ["uf", "ano", "receita_liquida", "receita_liquida_real", "per_capita_real", "pct_impostos_proprios",
         "pct_transferencias_uniao", "posicao_per_capita_real", "posicao_pct_impostos", "n_ufs"]]
    return valores.sort_values(["uf", "ano"]), medianas.sort_values("ano")


def montar_receita_json(linhas, totais, extraido_em):
    return {
        "fonte": "SICONFI/Tesouro Nacional: DCA Anexo I-C (receita orçamentária por natureza)",
        "extraido_em": extraido_em,
        "unidade": "R$ nominais",
        "campos": {
            "bruta": "receita bruta realizada",
            "ded_transferencias": "dedução: transferências constitucionais aos municípios",
            "ded_fundeb": "dedução: parcela destinada ao FUNDEB",
            "ded_outras": "outras deduções (restituições etc.)",
            "liquida": "bruta − deduções (padrão de exibição; é o que fecha com o RREO Anexo 01)",
            "totais.impostos_proprios": "líquida do grupo 1.1 (impostos, taxas e contribuições de melhoria)",
            "totais.transferencias_uniao": "líquida dos grupos 1.7.1 e 2.4.1 (transferências da União, correntes e de capital)",
            "totais.liquida_exceto_intra": "receita líquida total, sem as intraorçamentárias",
        },
        "itens": [{"item": i, "nome": n, "grupo": g} for i, n, g in receita_mod.ITENS],
        "ressalvas": RESSALVAS_RECEITA,
        "ressalvas_por_uf": RESSALVAS_RECEITA_POR_UF,
        "totais": registros(totais),
        "linhas": registros(linhas),
    }


def montar_divida_json(registros, extraido_em):
    return {
        "fonte": "SICONFI/Tesouro Nacional: RGF Anexo 02 (3º quadrimestre, poder Executivo) e DCA Anexo I-D",
        "extraido_em": extraido_em,
        "unidade": "R$ nominais; percentuais em %",
        # Limites legais para estados (Resolução do Senado nº 40/2001 e LRF, art. 59, § 1º, III): fixos.
        # Os campos limite/alerta de cada linha são os DECLARADOS no RGF e às vezes divergem (ex.: CE 2019–2022 = 0).
        "limite_legal_pct": 200,
        "alerta_legal_pct": 180,
        "campos": divida_mod.DESCRICAO_CAMPOS,
        "nota_composicao": NOTA_COMPOSICAO,
        "ressalvas": RESSALVAS_DIVIDA,
        "linhas": [{k: _nativo(v) if not isinstance(v, dict) else {kk: _nativo(vv) for kk, vv in v.items()}
                    for k, v in r.items()} for r in registros],
    }


def montar_gabarito(despesa, populacao, ipca, ano_base, divida=None, receita_totais=None):
    """Gabarito de teste do front: todas as funções, liquidado, sem intra, com a regra do zero."""
    df = indicadores_por_funcao(despesa, populacao, ipca, ano_base)
    medidas = ["per_capita_real", "per_capita_nominal", "pct_despesa_total"]
    medianas = None
    for medida in medidas:
        m = mediana_entre_ufs(df, medida, ["funcao_cod", "ano"]).drop(columns="n_ufs")
        m = m.rename(columns={f"{medida}_mediana": medida})
        medianas = m if medianas is None else medianas.merge(m, on=["funcao_cod", "ano"])

    colunas = ["funcao_cod", "uf", "ano", "nominal", *medidas, "posicao_per_capita_real",
               "posicao_per_capita_nominal", "posicao_pct_despesa_total", "n_ufs", "sem_gasto_declarado"]
    valores = df[colunas].sort_values(["funcao_cod", "uf", "ano"])
    return {
        "aviso": "Arquivo só para teste do front. Não exibir.",
        "parametros": {
            "estagio": ESTAGIO_GABARITO,
            "intra": False,
            "fonte_dado": "siconfi_dca",
            "ano_base_precos": ano_base,
            "precos": f"R$ de dezembro de {ano_base}",
        },
        "metodo": {
            "ausencia": "UF que entregou a DCA no ano e não tem linha na função (ou tem a linha sem "
                        "valor no estágio) entra com 0 (sem_gasto_declarado = true) no ranking, na "
                        "mediana e na tabela",
            "pct_despesa_total": "liquidado da função / soma do liquidado das linhas nivel=funcao, "
                                 "intra=false, da mesma UF e ano × 100",
            "per_capita_nominal": "liquidado / populacao (valores da época)",
            "per_capita_real": "liquidado × fator / populacao; fator = I(ano_base) / I(ano), com "
                               "I(ano) = produto de (1 + variacao_pct/100) do primeiro ano da série até o ano. "
                               "Usar variacao_pct de ipca.json, não indice_dez (o arredondamento difere).",
            "posicoes": "1 = maior valor; empate fica com a melhor posição",
            "mediana": "entre todas as UFs do ano, incluindo as com 0",
            "totais": "total = soma do liquidado das linhas nivel=funcao, intra=false, da UF e ano; "
                       "var_*_pct = variação sobre o ano anterior (nula no primeiro ano)",
            "receita": "receita_liquida = DCA I-C, bruta − deduções, sem intra; per_capita_real a preços do ano base; "
                       "pct_impostos_proprios = grupo 1.1 / receita_liquida × 100; pct_transferencias_uniao = "
                       "grupos 1.7.1 + 2.4.1 / receita_liquida × 100; posições: 1 = maior",
            "divida": "dcl_rcl_pct = linha oficial do RGF Anexo 02; posicao_dcl_rcl: 1 = maior DCL/RCL; "
                      "*_real = liquidado da DCA I-D (3.2 juros, 4.6 amortização) a preços do ano base; "
                      "pago = juros + amortização",
            "tolerancia_sugerida": "diferença relativa < 1e-9 (ou absoluta < 1e-9 quando o valor é 0)",
        },
        "valores": registros(valores),
        "medianas": registros(medianas.sort_values(["funcao_cod", "ano"])),
        "totais": registros(totais_por_uf(despesa, populacao, ipca, ano_base)),
        **({} if receita_totais is None else dict(zip(["receita", "medianas_receita"], [
            registros(t) for t in receita_gabarito(receita_totais, populacao, ipca, ano_base)]))),
        **({} if divida is None else dict(zip(["divida", "medianas_divida"],
                                              [registros(t) for t in divida_gabarito(divida, ipca, ano_base)]))),
    }


def montar_estatais(estatais, setor_funcao, ajustes, anos, correcoes_nomes=None):
    """estatais.json: estatais ativas e não dependentes de cada edição, por UF e função.

    Só informativo: a operação dessas empresas não aparece na despesa do estado, e o front
    apenas avisa. `dependente` vem do CSV como 'true'/'false'. `anos`: anos da despesa;
    `edicao_por_ano` diz que edição vale para cada um (o front recalcula e o teste compara).
    Cada empresa leva o nome original (`empresa`) e o de exibição (`nome_exibicao`, `sigla_exibicao`,
    `nome_manual`), escolhido por analytics.nomes_de_exibicao com `correcoes_nomes`.
    """
    if correcoes_nomes is None:
        correcoes_nomes = pd.DataFrame(columns=["cnpj", "sigla_exibicao", "nome_exibicao"])
    valores = set(estatais["dependente"])
    if not valores <= {"true", "false"}:
        raise ValueError(f"dependente fora de true/false: {sorted(valores - {'true', 'false'})}")
    df = estatais.assign(dependente=estatais["dependente"] == "true",
                         ano_referencia=estatais["ano_referencia"].astype(int))
    edicoes = sorted(int(e) for e in df["ano_referencia"].unique())
    com_funcao = funcao_das_estatais(df, setor_funcao, ajustes)
    exibicao = nomes_de_exibicao(df, correcoes_nomes).set_index(["uf", "cnpj"])

    def com_exibicao(linha, campos):
        nome = exibicao.loc[(linha["uf"], linha["cnpj"])]
        return {**{campo: linha[campo] for campo in campos}, "sigla_exibicao": nome["sigla_exibicao"],
                "nome_exibicao": nome["nome_exibicao"], "nome_manual": bool(nome["nome_manual"])}
    df = estatais_fora_das_contas(com_funcao)

    # Mudanças de dependência entre edições: viram aviso de quebra de série no gráfico de evolução
    mudancas = {}
    for linha in mudancas_de_dependencia(com_funcao).to_dict(orient="records"):
        mudanca = com_exibicao(linha, ["ano", "ano_anterior", "sentido", "sigla", "empresa", "cnpj"])
        mudancas.setdefault(linha["uf"], {}).setdefault(linha["funcao_cod"], []).append(mudanca)

    # Lista completa (dependentes ou não, qualquer situação) para a tela "Por estado"; sem valores financeiros
    lista = {str(e): {} for e in edicoes}
    for linha in com_funcao.sort_values(["ano_referencia", "uf", "sigla"]).to_dict(orient="records"):
        empresa = com_exibicao(linha, ["sigla", "empresa", "cnpj", "setor", "situacao"])
        empresa["funcao_cod"] = None if pd.isna(linha["funcao_cod"]) else linha["funcao_cod"]
        empresa["dependente"] = bool(linha["dependente"])
        lista[str(linha["ano_referencia"])].setdefault(linha["uf"], []).append(empresa)

    por_edicao = {str(e): {} for e in edicoes}
    for linha in df.to_dict(orient="records"):
        empresa = com_exibicao(linha, ["sigla", "empresa", "cnpj", "setor", "correspondencia"])
        por_edicao[str(linha["ano_referencia"])].setdefault(linha["uf"], {}) \
            .setdefault(linha["funcao_cod"], []).append(empresa)
    return {
        "aviso": "Só informativo: gera avisos na tela, nunca altera valores de despesa.",
        "criterio": "estatais ativas e não dependentes, com função orçamentária pelo setor "
                    "(setor_funcao.csv) ou por ajuste da empresa (estatais_ajustes.csv)",
        "edicoes": edicoes,
        "regra_edicao": "para cada ano, a edição mais recente que não passa do ano; anos anteriores "
                        "à primeira edição usam a primeira",
        "edicao_por_ano": {str(ano): edicao_para_ano(edicoes, ano) for ano in sorted(int(a) for a in anos)},
        "atribuicao": ATRIBUICAO_ESTATAIS["texto"],
        "fonte_curta": ATRIBUICAO_ESTATAIS["fonte_curta"],
        "correspondencia": {"direta": "o setor corresponde à função",
                            "parcial": "parte do setor cai em outra função",
                            "ajuste": "função definida para a empresa, não pelo setor"},
        "paineis": {str(e): ATRIBUICAO_ESTATAIS["painel"].format(edicao_painel=e + 1) for e in edicoes},
        "por_edicao": por_edicao,
        "lista_por_edicao": lista,
        "mudancas_dependencia": mudancas,
    }


def montar_atribuicoes(estatais):
    """Atribuições das fontes de dicionários, com a versão exata usada (coluna `fonte`)."""
    return [{**ATRIBUICAO_ESTATAIS, "versoes": sorted(estatais["fonte"].unique().tolist())}]


def ler_site(ufs, caminho=CAMINHO_SITE):
    """config/site.yaml → {"uf_padrao": sigla}. UF fora de ufs.csv é erro (nunca publicar um padrão inválido)."""
    import yaml

    with open(caminho, encoding="utf-8") as f:
        site = yaml.safe_load(f) or {}
    uf = site.get("uf_padrao")
    if uf is not None:
        uf = str(uf).upper()
        if uf not in set(ufs["uf"]):
            raise ValueError(f"uf_padrao {uf!r} de {caminho} não está em dicionarios/nacional/ufs.csv")
    return {"uf_padrao": uf}


def montar_meta(despesa, ipca, ano_base, gerado_em, atribuicoes=(), site=None):
    datas = despesa.groupby("fonte_dado")["extraido_em"].agg(["min", "max"])
    return {
        "gerado_em": gerado_em,
        "versao_esquema": VERSAO_ESQUEMA,
        # Estado aberto quando a URL não diz qual (config/site.yaml)
        "uf_padrao": (site or {}).get("uf_padrao"),
        "arquivos": {
            "meta.json": "este arquivo",
            "dicionarios.json": "UFs, funções e subfunções (código → nome)",
            "ipca.json": "variação anual dez/dez do IPCA, para deflacionar no front",
            "despesa.json": "despesa por UF, ano, função e subfunção, em R$ nominais",
            "receita.json": "receita por UF, ano e item (DCA I-C): bruta, deduções e líquida, em R$ nominais",
            "divida.json": "dívida por UF e ano: estoque (RGF Anexo 02) e pagamento (DCA I-D), em R$ nominais",
            "estatais.json": "estatais ativas e não dependentes por edição, UF e função (só para avisos)",
            "gabarito.json": "só para teste do front; não exibir",
        },
        "ufs": sorted(despesa["uf"].unique().tolist()),
        "anos": sorted(int(a) for a in despesa["ano"].unique()),
        "fontes": [
            {"fonte_dado": fonte, **FONTES.get(fonte, {"descricao": "", "nome_curto": fonte}),
             "extraido_em_min": linha["min"], "extraido_em_max": linha["max"]}
            for fonte, linha in datas.iterrows()
        ],
        "atribuicoes": list(atribuicoes),
        "ressalvas": RESSALVAS,
        "ressalvas_por_funcao": RESSALVAS_POR_FUNCAO,
        "colunas_despesa": COLUNAS_DESPESA,
        "niveis": {
            "total": "total do ente (uma linha sem intra e uma intra)",
            "funcao": "uma linha por função",
            "subfuncao": "uma linha por subfunção listada",
            "demais": "soma das subfunções não listadas daquela função",
        },
        "regras": [
            "Nunca somar linhas de níveis diferentes: filtrar um nivel antes de agregar.",
            "Soma das linhas nivel=funcao com intra=false = linha nivel=total com intra=false.",
            "Subfunções + demais de uma função = a função.",
            "As intraorçamentárias (intra=true) vêm só como total, sem detalhe por função; "
            "somá-las às demais conta o mesmo gasto duas vezes.",
            "Despesa executada padrão: liquidado.",
            "Valores em R$ nominais. Valores reais e per capita são calculados no front.",
            "Comparar UFs só com valores normalizados (per capita ou % da despesa total).",
            "UF que entregou a DCA no ano e não tem linha numa função entra com 0 nessa função "
            "(sem gasto declarado), no ranking, na mediana e na tabela.",
            "A população é a do cadastro do SICONFI e repete entre alguns anos.",
        ],
        "deflacao": {
            "fonte": "ipca.json",
            "metodo": "fator = I(ano_base) / I(ano), com I encadeado de variacao_pct (dez/dez)",
            "ano_base_padrao": ano_base,
            "anos_ipca": sorted(int(a) for a in ipca["ano"]),
        },
        "linhas": {"despesa": int(len(despesa))},
    }


def gravar_json(objeto, caminho, compacto=False):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        if compacto:
            json.dump(objeto, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        else:
            json.dump(objeto, f, ensure_ascii=False, indent=2, allow_nan=False)
    return caminho


def main(dir_saida=DIR_SAIDA):
    despesa = carregar("despesa")
    populacao = carregar("populacao")
    ipca = carregar_ipca()
    ano_base = int(ipca["ano"].max())
    gerado_em = datetime.now(timezone.utc).isoformat(timespec="seconds")

    tabela = montar_despesa(despesa, populacao)
    demonstrativo = carregar("demonstrativo")
    rgf_linhas = demonstrativo[(demonstrativo["demonstrativo"] == "RGF") & (demonstrativo["anexo"] == "RGF-Anexo 02")]
    i_d = demonstrativo[(demonstrativo["demonstrativo"] == "DCA") & (demonstrativo["anexo"] == "DCA-Anexo I-D")]
    divida = divida_mod.montar_divida(rgf_linhas, i_d)
    i_c = demonstrativo[(demonstrativo["demonstrativo"] == "DCA") & (demonstrativo["anexo"] == "DCA-Anexo I-C")]
    receita_linhas, receita_totais = receita_mod.montar_receita(i_c, carregar_dicionario("nacional/receita_itens.csv"))
    dir_saida = Path(dir_saida)
    arquivos = [
        gravar_json(montar_meta(tabela, ipca, ano_base, gerado_em,
                                montar_atribuicoes(carregar_dicionario("nacional/estatais.csv")),
                                ler_site(carregar_dicionario("nacional/ufs.csv"))),
                    dir_saida / "meta.json"),
        gravar_json(montar_dicionarios(
            carregar_dicionario("nacional/ufs.csv"),
            carregar_dicionario("nacional/funcoes.csv"),
            carregar_dicionario("nacional/subfuncoes.csv"),
        ), dir_saida / "dicionarios.json"),
        gravar_json(montar_ipca(ipca), dir_saida / "ipca.json"),
        gravar_json(montar_estatais(
            carregar_dicionario("nacional/estatais.csv"),
            carregar_dicionario("nacional/setor_funcao.csv"),
            carregar_dicionario("nacional/estatais_ajustes.csv"),
            tabela["ano"].unique(),
            carregar_dicionario("nacional/estatais_nomes_exibicao.csv"),
        ), dir_saida / "estatais.json"),
        gravar_json(registros(tabela), dir_saida / "despesa.json", compacto=True),
        gravar_json(montar_receita_json(receita_linhas, receita_totais, i_c["extraido_em"].max()),
                    dir_saida / "receita.json", compacto=True),
        gravar_json(montar_divida_json(divida, rgf_linhas["extraido_em"].max()), dir_saida / "divida.json"),
        gravar_json(montar_gabarito(despesa, populacao, ipca, ano_base, divida, receita_totais), dir_saida / "gabarito.json"),
    ]
    for arquivo in arquivos:
        print(f"{arquivo.relative_to(RAIZ)}  {arquivo.stat().st_size / 1024:,.0f} KB")


if __name__ == "__main__":
    main()
