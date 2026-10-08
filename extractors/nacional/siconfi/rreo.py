"""RREO (Relatório Resumido da Execução Orçamentária) do SICONFI.

extrair_anexo_02(uf, ano, periodo=6): Anexo 02 (despesa por função/subfunção) → tabela `demonstrativo`.

A tabela `demonstrativo` guarda as linhas como vieram (rótulo, cod_conta, conta, coluna, valor).
Este módulo só confere a estrutura antes de gravar. Formato do Anexo 02 (ver docs/fontes/siconfi.md):

- Dois blocos, identificados pelo `cod_conta` (o `rotulo` muda entre anos: em 2019 o bloco
  intra se chama "Total de Despesas"):
      RREO2TotalDespesas       → bloco "exceto intra"
      RREO2TotalDespesasIntra  → bloco intraorçamentário
- Linhas de total, identificadas pela `conta`:
      "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)"
      "DESPESAS (INTRA-ORÇAMENTÁRIAS) (II)"  ← aparece nos DOIS blocos
      "TOTAL (III) = (I + II)"
- Função: só o nome, sem código ("Saúde"), reconhecido por dicionarios/nacional/funcoes.csv.
- Subfunção: o nome ("Ação Legislativa") ou "FUnn - <nome>" ("FU01 - Administração Geral").
"""

import unicodedata

import pandas as pd

from extractors import base
from extractors.nacional.siconfi import cliente

ANEXO_02 = "RREO-Anexo 02"
FONTE_DADO = "siconfi_rreo"

BLOCOS = {"RREO2TotalDespesas": "exceto", "RREO2TotalDespesasIntra": "intra"}

# Colunas acumuladas no ano conferidas na validação (as demais são gravadas sem conferência)
COLUNAS_CONFERIDAS = ("DESPESAS EMPENHADAS ATÉ O BIMESTRE", "DESPESAS LIQUIDADAS ATÉ O BIMESTRE")


def _normalizar(texto):
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def nomes_de_funcoes(caminho=base.CAMINHO_FUNCOES):
    """Nomes normalizados das funções, de dicionarios/nacional/funcoes.csv."""
    return {_normalizar(n) for n in pd.read_csv(caminho, dtype=str)["funcao_nome"]}


def classificar_linha(cod_conta, conta, funcoes):
    """Devolve (bloco, tipo) de uma linha do Anexo 02.

    bloco: "exceto" ou "intra" (pelo cod_conta).
    tipo: "total_exceto" (I), "total_intra" (II), "total_geral" (III), "funcao" ou "subfuncao".
    """
    if cod_conta not in BLOCOS:
        raise base.ErroValidacao(f"cod_conta desconhecido no Anexo 02: {cod_conta!r}")
    bloco = BLOCOS[cod_conta]

    normalizada = _normalizar(conta)
    if normalizada.startswith("despesas (exceto intra"):
        tipo = "total_exceto"
    elif normalizada.startswith("despesas (intra"):
        tipo = "total_intra"
    elif normalizada.startswith("total"):
        tipo = "total_geral"
    elif normalizada in funcoes:
        tipo = "funcao"
    else:
        tipo = "subfuncao"
    return bloco, tipo


def transformar_anexo_02(itens, uf, cod_ibge, ano, periodo):
    """Itens da API → DataFrame no formato da tabela `demonstrativo`."""
    linhas = []
    for item in itens:
        if str(item["cod_ibge"]) != cod_ibge:
            raise base.ErroValidacao(f"item de outro ente: cod_ibge {item['cod_ibge']}, esperado {cod_ibge}")
        if int(item["periodo"]) != periodo or int(item["exercicio"]) != ano:
            raise base.ErroValidacao(f"item de outro período: {item['exercicio']}/{item['periodo']}")
        linhas.append({
            "uf": uf,
            "cod_ibge": cod_ibge,
            "ano": ano,
            "periodo": periodo,
            "demonstrativo": item["demonstrativo"],
            "anexo": item["anexo"],
            "rotulo": item["rotulo"],
            "cod_conta": item["cod_conta"],
            "conta": item["conta"],
            "coluna": item["coluna"],
            "valor": float(item["valor"]),
        })
    return pd.DataFrame(linhas)


def validar_anexo_02(df, funcoes, tolerancia=1.0):
    """Confere, nas colunas de empenhado e liquidado acumulados:

    - bloco exceto: soma das funções = (I)
    - bloco intra: soma das funções = (II)
    - (II) do bloco exceto = (II) do bloco intra
    - (I) + (II) = (III)
    """
    classes = [classificar_linha(c, n, funcoes) for c, n in zip(df["cod_conta"], df["conta"])]
    df = df.assign(bloco=[c[0] for c in classes], tipo=[c[1] for c in classes])

    for prefixo in COLUNAS_CONFERIDAS:
        coluna = df[df["coluna"].str.startswith(prefixo)]
        if coluna["coluna"].nunique() != 1:
            raise base.ErroValidacao(f"esperada 1 coluna '{prefixo}...', há {sorted(coluna['coluna'].unique())}")

        def linha(bloco, tipo):
            return coluna[(coluna["bloco"] == bloco) & (coluna["tipo"] == tipo)][["valor"]]

        def funcoes_do(bloco):
            return coluna[(coluna["bloco"] == bloco) & (coluna["tipo"] == "funcao")][["valor"]]

        base.validar_soma(funcoes_do("exceto"), linha("exceto", "total_exceto"), ["valor"], tolerancia)
        intra = linha("intra", "total_intra")
        if not intra.empty:
            base.validar_soma(funcoes_do("intra"), intra, ["valor"], tolerancia)
            base.validar_soma(linha("exceto", "total_intra"), intra, ["valor"], tolerancia)
        partes = pd.concat([linha("exceto", "total_exceto"), linha("exceto", "total_intra")])
        base.validar_soma(partes, linha("exceto", "total_geral"), ["valor"], tolerancia)


def extrair_anexo_02(uf, ano, periodo=6, *, dir_raw=cliente.DIR_RAW, dir_processed=base.DIR_PROCESSED,
                     http=None, caminho_funcoes=base.CAMINHO_FUNCOES):
    """Lê o RREO Anexo 02 do cache (baixa se faltar), confere a estrutura e grava em `demonstrativo`.

    Devolve o DataFrame gravado.
    """
    uf, cod_ibge = base.ente(uf)
    params = {
        "an_exercicio": ano, "nr_periodo": periodo, "co_tipo_demonstrativo": "RREO",
        "no_anexo": ANEXO_02, "co_esfera": "E", "id_ente": cod_ibge,
    }
    itens = cliente.consultar("rreo", params, dir_raw=dir_raw, http=http)
    if not itens:
        raise base.ConsultaVazia(f"RREO Anexo 02 vazio para {uf} {ano} período {periodo}")

    df = transformar_anexo_02(itens, uf, cod_ibge, ano, periodo)
    df["extraido_em"] = cliente.data_extracao("rreo", params, dir_raw)
    validar_anexo_02(df, nomes_de_funcoes(caminho_funcoes))
    base.gravar(df, "demonstrativo", f"{FONTE_DADO}_anexo_02_p{periodo}", dir_processed=dir_processed)
    return base.validar_esquema(df, "demonstrativo")
