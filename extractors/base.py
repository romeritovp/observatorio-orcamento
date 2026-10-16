"""Contrato comum dos extractors: esquema canônico, identificação do ente, validação de totais e gravação.

Extractors só leem e mapeiam a fonte; depois chamam `gravar` (que valida o esquema)
e, antes disso, `validar_soma` para conferir totais.
"""

from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
DIR_PROCESSED = RAIZ / "data" / "processed"
CAMINHO_UFS = RAIZ / "dicionarios" / "nacional" / "ufs.csv"
CAMINHO_FUNCOES = RAIZ / "dicionarios" / "nacional" / "funcoes.csv"

# extraido_em: data da extração na API (texto ISO, UTC), vinda do cache bruto; nula se desconhecida.
# Tipos: "str" para códigos e textos, "int" para inteiros que podem ser nulos,
# "float" para valores em R$, "bool" para marcadores
ESQUEMAS = {
    "despesa": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "periodo": "int",
        "fonte_dado": "str",
        "extraido_em": "str",
        "nivel": "str",
        "intra": "bool",
        "orgao_cod": "str",
        "funcao_cod": "str",
        "subfuncao_cod": "str",
        "programa_cod": "str",
        "acao_cod": "str",
        "natureza_cod": "str",
        "fonte_recurso_cod": "str",
        "dotacao_inicial": "float",
        "dotacao_atualizada": "float",
        "empenhado": "float",
        "liquidado": "float",
        "pago": "float",
    },
    "demonstrativo": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "periodo": "int",
        "extraido_em": "str",
        "demonstrativo": "str",
        "anexo": "str",
        "rotulo": "str",
        "cod_conta": "str",
        "conta": "str",
        "coluna": "str",
        "valor": "float",
    },
    "compensacoes_anp": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "tipo": "str",
        "valor": "float",
        "fonte_dado": "str",
        "extraido_em": "str",
    },
    "populacao": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "fonte_dado": "str",
        "extraido_em": "str",
        "populacao": "int",
    },
    # PIB por UF (e Brasil, uf "BR") das Contas Regionais do IBGE, em R$ nominais
    "pib_uf": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "pib_corrente": "float",
        "vab": "float",
        "volume_pib_2002_100": "float",
        "edicao": "int",
        "fonte_dado": "str",
        "extraido_em": "str",
    },
    "pib_uf_atividade": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "atividade_cod": "str",
        "nivel": "str",
        "valor_producao": "float",
        "consumo_intermediario": "float",
        "vab": "float",
        "vab_indice_volume": "float",
        "edicao": "int",
        "fonte_dado": "str",
        "extraido_em": "str",
    },
    # IBID (INPI): escores de 0 a 1 por dimensão, das 27 UFs, das regiões (dicionarios/nacional/regioes.csv) e do
    # Brasil (uf "BR"); ranking oficial (1 = melhor) só das 27 UFs, para geral, contexto e resultado
    "ibid_escore": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "dimensao": "str",
        "escore": "float",
        "fonte_dado": "str",
        "extraido_em": "str",
    },
    "ibid_ranking": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "dimensao": "str",
        "posicao": "int",
        "fonte_dado": "str",
        "extraido_em": "str",
    },
    # IDEB (Inep), formato longo: 27 UFs, regiões (regioes.csv) e Brasil ("BR"); indicador: ideb, meta (só 2007–2021,
    # não exibir), rendimento (P, 0 a 1), nota_padronizada (N, 0 a 10), saeb_matematica, saeb_portugues (escala de cada
    # etapa), aprovacao (%, por série: "total" ou o número do ano/série); serie nula fora da aprovação
    "ideb": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "etapa": "str",
        "rede": "str",
        "indicador": "str",
        "serie": "str",
        "valor": "float",
        "edicao": "int",
        "fonte_dado": "str",
        "extraido_em": "str",
    },
    # FBSP (Anuário Brasileiro de Segurança Pública), formato longo e exploratório: uma linha por célula numérica das
    # tabelas do anuário em que a UF (ou o Brasil, "BR") e o ano foram identificados (nunca capital, região ou município);
    # `grupo_qualidade` é o grupo de qualidade dos dados que o FBSP dá à UF na tabela. `coluna` e `titulo` como vieram;
    # ainda sem dicionário de indicadores. Ver extractors/nacional/fbsp/fbsp.py
    "fbsp": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "edicao": "int",
        "tabela_id": "str",
        "arquivo": "str",
        "local": "str",
        "titulo": "str",
        "rotulo": "str",
        "grupo_qualidade": "str",
        "coluna": "str",
        "valor": "float",
        "valor_texto": "str",
        "ano_origem": "str",
        "fonte_dado": "str",
        "extraido_em": "str",
    },
    # FBSP, mortes violentas intencionais (MVI) por UF e Brasil ("BR") e ano, consolidadas das tabelas de MVI das
    # planilhas (mapeamento em docs/fbsp_temas.csv): vale a edição mais recente; a primeira publicação e a revisão
    # (final menos primeira) ficam ao lado. populacao_implicita = número / taxa × 100.000 (conferência)
    "fbsp_mvi": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "mvi_numero": "int",
        "mvi_taxa": "float",
        "edicao_fonte": "int",
        "tabela_fonte": "str",
        "edicao_primeira_publicacao": "int",
        "mvi_numero_primeira_publicacao": "int",
        "revisao_numero": "int",
        "mvi_taxa_primeira_publicacao": "float",
        "revisao_taxa": "float",
        "populacao_implicita": "float",
        "fonte_dado": "str",
        "extraido_em": "str",
    },
    # FBSP, mortes decorrentes de intervenção policial (MDIP, em serviço e fora de serviço, polícias civil e militar) por
    # UF e Brasil e ano, das tabelas "Mortes decorrentes de intervenções policiais, segundo corporação e situação"
    # (coluna Total; mapeamento em docs/fbsp_temas.csv). Mesmas regras de `fbsp_mvi`. As MDIP estão dentro das MVI.
    "fbsp_mdip": {
        "uf": "str",
        "cod_ibge": "str",
        "ano": "int",
        "mdip_numero": "int",
        "mdip_taxa": "float",
        "edicao_fonte": "int",
        "tabela_fonte": "str",
        "edicao_primeira_publicacao": "int",
        "mdip_numero_primeira_publicacao": "int",
        "revisao_numero": "int",
        "mdip_taxa_primeira_publicacao": "float",
        "revisao_taxa": "float",
        "populacao_implicita": "float",
        "fonte_dado": "str",
        "extraido_em": "str",
    },
}

# Colunas que não podem ser nulas em nenhuma tabela
OBRIGATORIAS = ("uf", "cod_ibge", "ano")

TIPOS_PANDAS = {"str": "string", "int": "Int64", "float": "float64", "bool": "boolean"}


class ErroValidacao(Exception):
    """Dado que não respeita o esquema ou cujos totais não conferem."""


class ConsultaVazia(ErroValidacao):
    """A API não devolveu nenhum item (ex.: demonstrativo ainda não entregue pelo ente)."""


def ente(uf, caminho_ufs=CAMINHO_UFS):
    """Devolve (uf, cod_ibge) a partir da sigla, usando dicionarios/nacional/ufs.csv."""
    ufs = pd.read_csv(caminho_ufs, dtype=str)
    linha = ufs[ufs["uf"] == uf.upper()]
    if linha.empty:
        raise ValueError(f"UF desconhecida: {uf}")
    return linha["uf"].iloc[0], linha["cod_ibge"].iloc[0]


def validar_esquema(df, tabela):
    """Devolve o DataFrame com as colunas do esquema, na ordem e nos tipos canônicos.

    Coluna canônica ausente vira nula. Coluna fora do esquema é erro.
    """
    esquema = ESQUEMAS[tabela]
    sobrando = set(df.columns) - set(esquema)
    if sobrando:
        raise ErroValidacao(f"colunas fora do esquema de '{tabela}': {sorted(sobrando)}")

    saida = pd.DataFrame(index=df.index)
    for coluna, tipo in esquema.items():
        if coluna in df.columns:
            saida[coluna] = df[coluna].astype(TIPOS_PANDAS[tipo])
        else:
            saida[coluna] = pd.Series(None, index=df.index, dtype=TIPOS_PANDAS[tipo])

    for coluna in OBRIGATORIAS:
        if saida[coluna].isna().any():
            raise ErroValidacao(f"coluna obrigatória '{coluna}' com nulos")
    return saida.reset_index(drop=True)


def validar_soma(partes, total, colunas, tolerancia=1.0):
    """Confere se a soma das linhas de `partes` é igual à linha única de `total`, coluna a coluna.

    tolerancia: diferença máxima aceita, em R$ (arredondamentos da fonte).
    Nulos são ignorados na soma, mas o total não pode ser nulo.
    """
    if len(total) != 1:
        raise ErroValidacao(f"esperada 1 linha de total, vieram {len(total)}")
    for coluna in colunas:
        esperado = total[coluna].iloc[0]
        if pd.isna(esperado):
            raise ErroValidacao(f"total de '{coluna}' é nulo")
        soma = partes[coluna].sum()
        if abs(soma - esperado) > tolerancia:
            raise ErroValidacao(
                f"soma de '{coluna}' = {soma:,.2f} difere do total {esperado:,.2f}"
            )


def gravar(df, tabela, nome_arquivo, dir_processed=DIR_PROCESSED):
    """Valida o esquema e grava um parquet por (uf, ano), em particionamento Hive.

    Caminho: <dir_processed>/<tabela>/uf=<UF>/ano=<ano>/<nome_arquivo>.parquet
    As colunas uf e ano ficam no caminho, não dentro do arquivo.
    Devolve a lista de arquivos gravados.
    """
    df = validar_esquema(df, tabela)
    gravados = []
    for (uf, ano), parte in df.groupby(["uf", "ano"]):
        pasta = Path(dir_processed) / tabela / f"uf={uf}" / f"ano={ano}"
        pasta.mkdir(parents=True, exist_ok=True)
        arquivo = pasta / f"{nome_arquivo}.parquet"
        parte.drop(columns=["uf", "ano"]).to_parquet(arquivo, index=False)
        gravados.append(arquivo)
    return gravados
