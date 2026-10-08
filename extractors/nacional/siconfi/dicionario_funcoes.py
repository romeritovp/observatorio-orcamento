"""Gera dicionarios/nacional/funcoes.csv e subfuncoes.csv a partir das DCA Anexo I-E em cache.

Uso:
    python -m extractors.nacional.siconfi.dicionario_funcoes

Lê todos os JSONs de data/raw/siconfi/dca/*/ do Anexo I-E (qualquer ente, qualquer ano).
Quando o mesmo código aparece com nomes diferentes, vale o nome do exercício mais recente
(e a divergência vai para o log). Linhas "FUxx - Demais Subfunções" e totais não entram.
"""

import json
import logging
from pathlib import Path

import pandas as pd

from extractors.nacional.siconfi import cliente
from extractors.nacional.siconfi.dca import ANEXO_I_E, classificar_conta

log = logging.getLogger(__name__)

DIR_DICIONARIOS = Path(__file__).resolve().parents[3] / "dicionarios" / "nacional"


def arquivos_em_cache(dir_raw=cliente.DIR_RAW):
    """JSONs da DCA Anexo I-E em cache, de todos os entes."""
    return sorted(Path(dir_raw).glob(f"dca/*/*_{cliente.limpar_nome(ANEXO_I_E)}.json"))


def ler_itens(arquivos):
    """Junta os itens de todas as páginas de todos os arquivos."""
    itens = []
    for arquivo in arquivos:
        with open(arquivo, encoding="utf-8") as f:
            bruto = json.load(f)
        for pagina in bruto["paginas"]:
            itens.extend(pagina.get("items", []))
    return itens


def gerar_dicionarios(itens):
    """Itens da DCA I-E → (funcoes, subfuncoes) como DataFrames ordenados por código."""
    funcoes, subfuncoes = {}, {}
    # Do exercício mais antigo para o mais recente: o último nome visto prevalece
    for item in sorted(itens, key=lambda i: i["exercicio"]):
        classe = classificar_conta(item["conta"])
        if classe["nivel"] == "funcao":
            destino, codigo = funcoes, classe["funcao_cod"]
        elif classe["nivel"] == "subfuncao":
            destino, codigo = subfuncoes, classe["subfuncao_cod"]
        else:
            continue
        nome = classe["nome"].strip()
        anterior = destino.get(codigo)
        if anterior is not None and anterior != nome:
            log.warning("código %s com nomes diferentes: %r e %r (fica o mais recente)", codigo, anterior, nome)
        destino[codigo] = nome

    df_funcoes = pd.DataFrame(sorted(funcoes.items()), columns=["funcao_cod", "funcao_nome"])
    df_subfuncoes = pd.DataFrame(sorted(subfuncoes.items()), columns=["subfuncao_cod", "subfuncao_nome"])
    return df_funcoes, df_subfuncoes


def main(dir_raw=cliente.DIR_RAW, dir_saida=DIR_DICIONARIOS):
    arquivos = arquivos_em_cache(dir_raw)
    if not arquivos:
        raise SystemExit("nenhuma DCA Anexo I-E em cache; rode extrair_despesa_funcao antes")
    funcoes, subfuncoes = gerar_dicionarios(ler_itens(arquivos))
    Path(dir_saida).mkdir(parents=True, exist_ok=True)
    funcoes.to_csv(Path(dir_saida) / "funcoes.csv", index=False)
    subfuncoes.to_csv(Path(dir_saida) / "subfuncoes.csv", index=False)
    print(f"{len(arquivos)} arquivo(s) lido(s): {len(funcoes)} funções, {len(subfuncoes)} subfunções")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
