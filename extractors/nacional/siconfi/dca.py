"""DCA (Declaração de Contas Anuais) do SICONFI.

extrair_despesa_funcao(uf, ano): Anexo I-E (despesa por função e subfunção) → tabela `despesa`.
extrair_natureza(uf, ano): Anexo I-D (despesa por natureza) → tabela `demonstrativo`, como veio.
extrair_receita(uf, ano): Anexo I-C (receita por natureza) → tabela `demonstrativo`, como veio.

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


# --- Anexo I-D: despesa por natureza -------------------------------------------------------

ANEXO_I_D = "DCA-Anexo I-D"
NOME_ARQUIVO_I_D = "siconfi_dca_anexo_i_d"

# Grupos de natureza da dívida. cod_conta: "DO" = exceto intra, "DI" = intra; níveis: categoria 3.0.00,
# grupo 3.2.00, modalidade 3.2.90 (3.2.91 = intra), elemento 3.2.90.21.
# ATENÇÃO: a linha do grupo ("DO3.2.00.00.00.00") INCLUI as modalidades intraorçamentárias ("DI3.2.91...").
# Conferido em 1.303 combinações (27 UFs, 2019–2025, grupos 3.2 e 4.6, todas as colunas): grupo =
# modalidades DO + modalidades DI. O valor exceto intra é a soma das modalidades DO, não a linha do grupo.
GRUPO_JUROS = "DO3.2.00.00.00.00"        # 3.2 Juros e Encargos da Dívida (com intra)
GRUPO_AMORTIZACAO = "DO4.6.00.00.00.00"  # 4.6 Amortização da Dívida (com intra)
RE_MODALIDADE = re.compile(r"^D([OI])(\d\.\d)\.(\d{2})\.00\.00\.00$")


def soma_modalidades(linhas, grupo, prefixos=("O",)):
    """Soma das modalidades de um grupo ("3.2" ou "4.6") nas linhas (DataFrame com cod_conta e valor).

    prefixos: ("O",) = exceto intra (padrão); ("O", "I") = com intra (o que a linha do grupo traz).
    """
    def da_modalidade(cod):
        m = RE_MODALIDADE.match(cod)
        return bool(m and m.group(1) in prefixos and m.group(2) == grupo and m.group(3) != "00")
    return float(linhas.loc[linhas["cod_conta"].map(da_modalidade), "valor"].sum())


def transformar_natureza(itens, uf, cod_ibge, ano):
    """Itens dos Anexos I-D ou I-C → DataFrame no formato da tabela `demonstrativo` (DCA é anual: periodo nulo)."""
    linhas = []
    for item in itens:
        if str(item["cod_ibge"]) != cod_ibge:
            raise base.ErroValidacao(f"item de outro ente: cod_ibge {item['cod_ibge']}, esperado {cod_ibge}")
        if int(item["exercicio"]) != ano:
            raise base.ErroValidacao(f"item de outro exercício: {item['exercicio']}")
        linhas.append({
            "uf": uf, "cod_ibge": cod_ibge, "ano": ano, "periodo": None,
            "demonstrativo": "DCA", "anexo": item["anexo"], "rotulo": item["rotulo"],
            "cod_conta": item["cod_conta"], "conta": item["conta"], "coluna": item["coluna"],
            "valor": float(item["valor"]),
        })
    return pd.DataFrame(linhas)


def validar_natureza(df, tolerancia=1.0):
    """Nos grupos da dívida (3.2 e 4.6), em cada coluna: grupo = modalidades DO + modalidades DI.

    Grupo ausente = sem despesa nesse grupo (nada a conferir).
    """
    for grupo in (GRUPO_JUROS, GRUPO_AMORTIZACAO):
        for coluna, parte in df.groupby("coluna"):
            total = parte[parte["cod_conta"] == grupo]
            if total.empty:
                continue
            soma = soma_modalidades(parte, grupo[2:5], prefixos=("O", "I"))
            informado = float(total["valor"].sum())
            if abs(soma - informado) > tolerancia:
                raise base.ErroValidacao(f"{coluna}: modalidades de {grupo} somam {soma:,.2f}, grupo {informado:,.2f}")


def extrair_natureza(uf, ano, *, dir_raw=cliente.DIR_RAW, dir_processed=base.DIR_PROCESSED, http=None):
    """Lê a DCA Anexo I-D do cache (baixa se faltar), confere os grupos da dívida e grava em `demonstrativo`."""
    uf, cod_ibge = base.ente(uf)
    params = {"an_exercicio": ano, "no_anexo": ANEXO_I_D, "id_ente": cod_ibge}
    itens = cliente.consultar("dca", params, dir_raw=dir_raw, http=http)
    if not itens:
        raise ConsultaVazia(f"DCA I-D vazia para {uf} {ano}")

    df = transformar_natureza(itens, uf, cod_ibge, ano)
    df["extraido_em"] = cliente.data_extracao("dca", params, dir_raw)
    validar_natureza(df)
    base.gravar(df, "demonstrativo", NOME_ARQUIVO_I_D, dir_processed=dir_processed)
    return base.validar_esquema(df, "demonstrativo")


# --- Anexo I-C: receita por natureza ---------------------------------------------------------

ANEXO_I_C = "DCA-Anexo I-C"
NOME_ARQUIVO_I_C = "siconfi_dca_anexo_i_c"

# cod_conta: "RO"/"RI" + natureza, e três totais. Colunas: bruta e três deduções (a líquida = bruta −
# deduções; não vem no anexo). Intra ou não é decidido pela CATEGORIA (1º dígito: 7 e 8 = intra), não
# pelo prefixo: em 2019 vários estados entregam as categorias 7 e 8 com prefixo "RO".
TOTAL_EXCETO_INTRA = "ReceitasExcetoIntraOrcamentarias"
TOTAL_INTRA = "ReceitasIntraOrcamentarias"
TOTAL_RECEITAS = "TotalReceitas"
COLUNAS_RECEITA = {
    "Receitas Brutas Realizadas": "bruta",
    "Deduções - Transferências Constitucionais": "ded_transferencias",
    "Deduções - FUNDEB": "ded_fundeb",
    "Outras Deduções da Receita": "ded_outras",
}


CATEGORIAS_INTRA = ("7", "8")


def e_intra(cod_conta):
    """Linha de natureza intraorçamentária? Pela categoria (7 ou 8), qualquer que seja o prefixo."""
    return cod_conta[2:3] in CATEGORIAS_INTRA


def _e_categoria(cod_conta):
    """'RO1.0.0.0.00.0.0' → True: só o 1º segmento é diferente de zero."""
    return all(int(s) == 0 for s in cod_conta[2:].split(".")[1:])


def validar_receita(df, tolerancia=1.0):
    """Em cada coluna: exceto intra = soma das categorias 1 e 2; intra = soma das categorias 7 e 8;
    total = exceto intra + intra. Linha de total ausente vale zero (coluna sem valor no anexo)."""
    natureza = df[df["cod_conta"].str.match(r"^R[OI]\d")]
    for coluna, parte in df.groupby("coluna"):
        total = lambda cod: float(parte.loc[parte["cod_conta"] == cod, "valor"].sum())
        nat = natureza[natureza["coluna"] == coluna]
        categorias = {False: 0.0, True: 0.0}
        for cod, valor in zip(nat["cod_conta"], nat["valor"]):
            if _e_categoria(cod):
                categorias[e_intra(cod)] += float(valor)
        for descricao, calculado, informado in [
            ("categorias exceto intra", categorias[False], total(TOTAL_EXCETO_INTRA)),
            ("categorias intra (7 e 8)", categorias[True], total(TOTAL_INTRA)),
            ("exceto intra + intra", total(TOTAL_EXCETO_INTRA) + total(TOTAL_INTRA), total(TOTAL_RECEITAS)),
        ]:
            if abs(calculado - informado) > tolerancia:
                raise base.ErroValidacao(f"{coluna}: {descricao} = {calculado:,.2f} difere do total {informado:,.2f}")


def extrair_receita(uf, ano, *, dir_raw=cliente.DIR_RAW, dir_processed=base.DIR_PROCESSED, http=None):
    """Lê a DCA Anexo I-C do cache (baixa se faltar), confere os totais e grava em `demonstrativo`, como veio."""
    uf, cod_ibge = base.ente(uf)
    params = {"an_exercicio": ano, "no_anexo": ANEXO_I_C, "id_ente": cod_ibge}
    itens = cliente.consultar("dca", params, dir_raw=dir_raw, http=http)
    if not itens:
        raise ConsultaVazia(f"DCA I-C vazia para {uf} {ano}")

    df = transformar_natureza(itens, uf, cod_ibge, ano)  # mesmo formato de linha da I-D
    df["extraido_em"] = cliente.data_extracao("dca", params, dir_raw)
    validar_receita(df)
    base.gravar(df, "demonstrativo", NOME_ARQUIVO_I_C, dir_processed=dir_processed)
    return base.validar_esquema(df, "demonstrativo")
