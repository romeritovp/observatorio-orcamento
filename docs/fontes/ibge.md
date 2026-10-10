# Fonte: IBGE

Séries de referência nacionais, guardadas em `data/reference/`.

## IPCA (`data/reference/ipca.csv`)

- **Origem:** SIDRA/IBGE, tabela 1737 (IPCA: série histórica com número-índice, variação mensal e variações acumuladas em 3, 6 e 12 meses).
- **Consulta usada:** `https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2265,2266/p/201512,201612,201712,201812,201912,202012,202112,202212,202312,202412,202512`
  - variável 2265: variação acumulada em 12 meses (em dezembro = variação anual dez/dez)
  - variável 2266: número-índice (base dezembro de 1993 = 100)
- **Gerado em:** 2026-10-08 (2019–2025) e 2026-10-09 (2015–2018), à mão a partir da resposta acima (sem script). Conferido o encadeamento: índice de dez/2018 × 1,0431 = índice de dez/2019.
- **Colunas:** `ano`, `variacao_pct` (dez/dez, em %), `indice_dez` (número-índice de dezembro, só para conferência).

| ano | variação (%) |
|---|---|
| 2015 | 10,67 |
| 2016 | 6,29 |
| 2017 | 2,95 |
| 2018 | 3,75 |
| 2019 | 4,31 |
| 2020 | 4,52 |
| 2021 | 10,06 |
| 2022 | 5,79 |
| 2023 | 4,62 |
| 2024 | 4,83 |
| 2025 | 4,26 |

Para acrescentar um ano: consultar o período `<ano>12` na mesma URL e adicionar a linha. `analytics.deflacionar` exige anos sem lacuna.

## População

O projeto usa, por enquanto, a população que vem no campo `populacao` da DCA do SICONFI (tabela `populacao`, ver `docs/dicionario.md` e `docs/fontes/siconfi.md`), e não a estimativa do IBGE.
