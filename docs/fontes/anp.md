# Fonte: ANP (Agência Nacional do Petróleo, Gás Natural e Biocombustíveis)

> Tabela gerada por script a partir desta fonte:
> - `compensacoes_anp`: gerada em 2026-10-08 por `uv run python -m extractors.nacional.anp.compensacoes`. 26 estados com royalties (o DF não aparece nos arquivos de royalties), caixa de 2006 a 2025. Royalties: 12 meses em todos os anos. Participação especial: última data de caixa **01/11/2024**.

Fonte nacional, no mesmo formato para todas as UFs. Valores **destinados aos estados** (nunca aos municípios).

## Origem

- Página: https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/participacoes-governamentais (dados abertos, "Participações Governamentais").
- **Royalties – Estados:** um CSV por ano (2009 a 2025), formato **largo**: `competencia;caixa;<estado>;<estado>;...`, uma linha por mês. Nomes de arquivo variam: `royalties_estado_2018.csv`, `royalties-estado-2019.csv`, `royalties-estados-2022.csv`.
- **Participação especial – estados:** `pe_estado.csv`, formato **longo**: `competencia;caixa;estado;valor`, pagamentos trimestrais.
- Os dois: latin1, separador `;`, vírgula decimal, datas como **número de série do Excel** (dias desde 30/12/1899), linhas vazias no fim, `;` final na linha de cabeçalho. Estados pelo nome, em minúsculas e sem acento (`sao paulo`), ligados à sigla por `dicionarios/nacional/ufs.csv`.

## Brutos e tabela

- `data/raw/anp/royalties-estados/<ano>.csv` e `data/raw/anp/participacao-especial/pe_estado.csv`, **como vieram**; `data/raw/anp/manifesto.json` guarda a URL e a data da extração de cada arquivo. O extractor só baixa o que falta (`--atualizar` baixa tudo de novo; a participação especial é um arquivo único que a ANP reescreve).
- `compensacoes_anp` (uf, cod_ibge, ano, tipo, valor, fonte_dado, extraido_em): soma por **ano de caixa** (quando o dinheiro chegou ao estado, critério da receita realizada da DCA). `tipo`: `royalties` ou `participacao_especial`; `fonte_dado`: `anp_royalties_estados` ou `anp_pe_estado`.

## Cuidados

- **Não inclui o FEP** (Fundo Especial do Petróleo, distribuído pelo Tesouro a todos os estados). Conferido: em 86 UF-anos a DCA tem FEP e a ANP mostra zero de royalties (estados não produtores). A DCA (item petróleo e gás) inclui o FEP; compare **DCA sem o FEP** com a ANP.
- **Participação especial em dados abertos só até nov/2024.** Há planilhas trimestrais mais recentes (até o 2º trimestre de 2026) em outra página, fora dos dados abertos e em outro formato (XLS por trimestre): https://www.gov.br/anp/pt-br/assuntos/royalties-e-outras-participacoes/participacao-especial. Não usadas: 2025 fica **sem total** (só royalties, marcados como parciais).
- Valores repassados pela ANP, em R$ nominais do mês de caixa.

## Conferência com a DCA (2019–2025, 27 UFs)

`uv run python -m publicacao.compensacoes` (relatório; CSV em `outputs/nacional/compensacoes/conferencia_dca_anp.csv`). Item petróleo e gás da DCA (receita bruta) × royalties + participação especial da ANP:
- 66 UF-anos com total da ANP. Dentro de 90%–110%: **10** pela razão bruta (DCA/ANP), **47** descontando o FEP declarado na DCA.
- Fora da faixa (sem o FEP), 19 UF-anos: **RJ 2019–2024** (a DCA não separa o petróleo: razão 0%); **AL e MA 2019–2021** (lançavam todo o petróleo no código do FEP: a DCA inteira bate com a ANP, ex.: AL 2020 = 99%); **ES 2019–2021** (67%–87%), **AM 2019** (124%), **SP 2021** (90%, no limite) e **PR 2022–2023** (DCA 5 a 9 vezes a ANP), não explicados.

## RJ: "Demais receitas patrimoniais" × ANP

| ano | ANP: royalties + PE ao estado (R$ mi) | DCA 1.3.9 (R$ mi) | ANP / DCA |
|---|---|---|---|
| 2019 | 13.409,6 | 24.822,3 | 54% |
| 2020 | 11.028,7 | 22.228,9 | 50% |
| 2021 | 21.697,2 | 19.439,3 | 112% |
| 2022 | 30.254,9 | 30.795,9 | 98,2% |
| 2023 | 24.943,8 | 25.407,5 | 98,2% |
| 2024 | 25.626,5 | 25.946,9 | 98,8% |
| 2025 | só royalties: 14.198,4 | 26.300,8 | parcial |

A recodificação de 2022 não explica a sobra de ~R$ 11 bi em 2019–2020: a linha 1.3.9 tem o mesmo código nos dois períodos, e as linhas novas de 2022 em diante na receita patrimonial são recodificações de linhas antigas (juros, aluguéis, cessão de direitos), fora da 1.3.9.
