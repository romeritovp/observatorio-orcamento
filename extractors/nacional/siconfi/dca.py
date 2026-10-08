"""DCA (Declaração de Contas Anuais) do SICONFI.

extrair_despesa_funcao(uf, ano): Anexo I-E (despesa por função e subfunção) → tabela `despesa`.

Formato das linhas de `conta` no Anexo I-E (ver docs/fontes/siconfi.md):
    "Despesas Exceto Intraorçamentárias"   → nivel total,     intra = False
    "Despesas Intraorçamentárias"          → nivel total,     intra = True (sem detalhe por função)
    "10 - Saúde"                           → nivel funcao
    "10.302 - Assistência Hospitalar ..."  → nivel subfuncao
    "FU10 - Demais Subfunções"             → nivel demais (subfunções não listadas da função 10)

Linhas de níveis diferentes nunca devem ser somadas juntas.
"""

import re
import unicodedata

import pandas as pd

from extractors import base
from extractors.nacional.siconfi import cliente

ANEXO_I_E = "DCA-Anexo I-E"
FONTE_DADO = "siconfi_dca"
NOME_ARQUIVO = "siconfi_dca_anexo_i_e"

# coluna da API → coluna da tabela despesa (as de inscrição em restos a pagar ficam de fora)
COLUNAS_VALOR = {
    "Despesas Empenhadas": "empenhado",
    "Despesas Liquidadas": "liquidado",
    "Despesas Pagas": "pago",
}


ConsultaVazia = base.ConsultaVazia  # mantido aqui por compatibilidade


RE_FUNCAO = re.compile(r"^(\d{2}) - (.+)$")
RE_SUBFUNCAO = re.compile(r"^(\d{2})\.(\d{3}) - (.+)$")
RE_DEMAIS = re.compile(r"^FU(\d{2}) - (.+)$")


def _normalizar(texto):
    """Minúsculas, sem acentos e sem espaços nas pontas (para comparar rótulos)."""
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return sem_acento.lower().strip()


def classificar_conta(conta):
    """Lê o texto de `conta` e devolve dict com nivel, funcao_cod, subfuncao_cod, nome e intra.

    Linha em formato desconhecido é erro: melhor parar do que perder valor em silêncio.
    """
    if m := RE_SUBFUNCAO.match(conta):
        return {"nivel": "subfuncao", "funcao_cod": m[1], "subfuncao_cod": m[2], "nome": m[3], "intra": False}
    if m := RE_FUNCAO.match(conta):
        return {"nivel": "funcao", "funcao_cod": m[1], "subfuncao_cod": None, "nome": m[2], "intra": False}
    if m := RE_DEMAIS.match(conta):
        return {"nivel": "demais", "funcao_cod": m[1], "subfuncao_cod": None, "nome": m[2], "intra": False}

    normalizada = _normalizar(conta)
    if normalizada.startswith("despesas exceto intra"):
        return {"nivel": "total", "funcao_cod": None, "subfuncao_cod": None, "nome": conta, "intra": False}
    if normalizada.startswith("despesas intra"):
        return {"nivel": "total", "funcao_cod": None, "subfuncao_cod": None, "nome": conta, "intra": True}
    raise ValueError(f"linha de conta em formato desconhecido na DCA I-E: {conta!r}")


def _rotulo_intra(rotulo):
    """Rótulo que indica bloco de despesas intraorçamentárias (não visto em 2024, mas possível)."""
    return "intra" in _normalizar(rotulo or "") and "exceto" not in _normalizar(rotulo or "")


def transformar_despesa_funcao(itens, uf, cod_ibge, ano):
    """Itens da API (DCA Anexo I-E) → DataFrame no formato da tabela `despesa`."""
    # Uma linha por conta; cada coluna da API vira uma coluna de valor.
    # Coluna ausente na fonte (ex.: só empenhado) fica nula.
    linhas = {}
    for item in itens:
        if str(item["cod_ibge"]) != cod_ibge:
            raise base.ErroValidacao(f"item de outro ente: cod_ibge {item['cod_ibge']}, esperado {cod_ibge}")
        coluna = COLUNAS_VALOR.get(item["coluna"])
        if coluna is None:
            continue
        classe = classificar_conta(item["conta"])
        intra = classe["intra"] or _rotulo_intra(item.get("rotulo"))
        chave = (classe["nivel"], intra, classe["funcao_cod"], classe["subfuncao_cod"])
        linha = linhas.setdefault(chave, {
            "nivel": classe["nivel"],
            "intra": intra,
            "funcao_cod": classe["funcao_cod"],
            "subfuncao_cod": classe["subfuncao_cod"],
        })
        if coluna in linha:
            raise base.ErroValidacao(f"linha repetida na DCA I-E: {item['conta']!r}, {item['coluna']!r}")
        linha[coluna] = float(item["valor"])
    if not linhas:
        raise base.ErroValidacao("nenhuma linha de empenhado/liquidado/pago na DCA I-E")

    largo = pd.DataFrame(list(linhas.values()))
    for coluna in COLUNAS_VALOR.values():
        if coluna not in largo.columns:
            largo[coluna] = float("nan")

    largo["uf"] = uf
    largo["cod_ibge"] = cod_ibge
    largo["ano"] = ano
    largo["fonte_dado"] = FONTE_DADO
    return largo


def transformar_populacao(itens, uf, cod_ibge, ano):
    """Campo `populacao` dos itens → DataFrame de uma linha no formato da tabela `populacao`.

    É a população cadastrada pelo Tesouro no SICONFI (repete entre alguns anos);
    precisa ser igual em todos os itens da resposta.
    """
    valores = {item.get("populacao") for item in itens}
    if len(valores) != 1 or None in valores:
        raise base.ErroValidacao(f"populacao ausente ou diferente entre os itens: {sorted(map(str, valores))}")
    return pd.DataFrame([{
        "uf": uf, "cod_ibge": cod_ibge, "ano": ano,
        "fonte_dado": FONTE_DADO, "populacao": int(valores.pop()),
    }])


def validar_despesa_funcao(df):
    """Soma das linhas de nível funcao = linha de nível total (fora as intraorçamentárias)."""
    fora_intra = df[~df["intra"].astype(bool)]
    base.validar_soma(
        partes=fora_intra[fora_intra["nivel"] == "funcao"],
        total=fora_intra[fora_intra["nivel"] == "total"],
        colunas=list(COLUNAS_VALOR.values()),
    )


def extrair_despesa_funcao(uf, ano, *, dir_raw=cliente.DIR_RAW, dir_processed=base.DIR_PROCESSED, http=None):
    """Lê a DCA Anexo I-E do cache (baixa se faltar), valida e grava em data/processed/.

    Grava a tabela `despesa` e, do campo `populacao` da API, a tabela `populacao`.
    Devolve o DataFrame de despesa gravado.
    """
    uf, cod_ibge = base.ente(uf)
    params = {"an_exercicio": ano, "no_anexo": ANEXO_I_E, "id_ente": cod_ibge}
    itens = cliente.consultar("dca", params, dir_raw=dir_raw, http=http)
    if not itens:
        raise ConsultaVazia(f"DCA I-E vazia para {uf} {ano}")

    extraido_em = cliente.data_extracao("dca", params, dir_raw)
    df = transformar_despesa_funcao(itens, uf, cod_ibge, ano).assign(extraido_em=extraido_em)
    validar_despesa_funcao(df)
    populacao = transformar_populacao(itens, uf, cod_ibge, ano).assign(extraido_em=extraido_em)
    base.gravar(df, "despesa", NOME_ARQUIVO, dir_processed=dir_processed)
    base.gravar(populacao, "populacao", NOME_ARQUIVO, dir_processed=dir_processed)
    return base.validar_esquema(df, "despesa")
