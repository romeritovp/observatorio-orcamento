"""Baixa e extrai a dívida para todas as UFs, sem parar no primeiro erro.

Uso:
    uv run python -m extractors.nacional.siconfi.lote_divida                # 2015 a 2025
    uv run python -m extractors.nacional.siconfi.lote_divida 2023 2024      # outro intervalo

Três etapas, cada uma com o resumo de sempre (certos, vazios, falhas):
1. Estoque: RGF Anexo 02, 3º quadrimestre, poder Executivo → `demonstrativo`.
2. Fluxo: DCA Anexo I-D (natureza da despesa) → `demonstrativo`.
3. Conferência, só com aviso: juros + amortização da I-D × subfunções 841–844 da I-E × RREO Anexo 01.
"""

import logging
import sys

import pandas as pd

from extractors import base
from extractors.nacional.siconfi import conferencia_divida, dca, rgf
from extractors.nacional.siconfi.lote import ANOS_PADRAO, anos_dos_argumentos, executar, resumo, ufs_do_dicionario



def resumo_conferencia(linhas):
    """Texto com quantas combinações batem, quantas diferem e a lista das diferenças."""
    df = pd.DataFrame(linhas)
    texto = [f"Combinações conferidas: {len(df)}"]
    for coluna, nome in [("subfuncoes", "subfunções 841–844"), ("rreo", "RREO Anexo 01")]:
        com_valor = df[df[coluna].notna() & df["referencia"].notna()]
        iguais = (abs(com_valor[coluna] - com_valor["referencia"]) <= conferencia_divida.TOLERANCIA).sum()
        texto.append(f"  {nome}: {iguais} iguais à DCA I-D, {len(com_valor) - iguais} diferentes, "
                     f"{len(df) - len(com_valor)} sem dado")
    com_aviso = df[df["avisos"].map(len) > 0]
    if not com_aviso.empty:
        texto.append("\nDiferenças (aviso, não falha):")
        for r in com_aviso.itertuples():
            texto += [f"  {r.uf} {r.ano}: {aviso}" for aviso in r.avisos]
    return "\n".join(texto)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    ufs = ufs_do_dicionario()
    anos = anos_dos_argumentos(argv, ANOS_PADRAO)

    print("=== 1. Estoque: RGF Anexo 02 (3º quadrimestre, Executivo)")
    estoque = executar(ufs, anos, lambda uf, ano: rgf.extrair_anexo_02(uf, ano))
    print("\n=== 2. Fluxo: DCA Anexo I-D")
    fluxo = executar(ufs, anos, lambda uf, ano: dca.extrair_natureza(uf, ano))

    print("\n=== 3. Conferência do pagamento da dívida")
    conferidas = []
    for uf in ufs:
        _, cod_ibge = base.ente(uf)
        for ano in anos:
            try:
                conferidas.append({"uf": uf, "ano": ano, **conferencia_divida.conferir(uf, cod_ibge, ano)})
            except Exception as erro:  # conferência nunca derruba o lote
                print(f"{uf} {ano}: conferência não feita ({type(erro).__name__}: {erro})")

    print("\n######## Estoque (RGF Anexo 02)\n" + resumo(estoque))
    print("\n######## Fluxo (DCA I-D)\n" + resumo(fluxo))
    print("\n######## Conferência\n" + resumo_conferencia(conferidas))


if __name__ == "__main__":
    logging.basicConfig(level=logging.ERROR)
    main()
