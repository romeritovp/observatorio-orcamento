# Fonte: Tesouro Nacional — Raio X das Empresas dos Estados

> Dicionário gerado por script a partir desta fonte:
> - `dicionarios/nacional/estatais.csv`: gerado em 2026-10-10 (exercícios 2019 a 2024) por `uv run python -m extractors.nacional.tesouro_estatais`, a partir do commit `b7f456b`. Resultado: **exercício 2024: 298 empresas** (127 dependentes, 35 em liquidação); **2023: 295** (124 dependentes, 36 em liquidação); **2022: 292** (124 dependentes, 38 em liquidação); **2021: 302** (133 dependentes, 42 em liquidação). As 27 UFs aparecem nos quatro. As linhas de 2023 e 2024 são as mesmas da geração de 2026-10-08 (conferido; só a coluna `fonte` mudou, porque o caminho do bruto passou a ser o caminho completo no repositório).

Fonte nacional, no mesmo formato para todas as UFs.

## Atribuição

**Dados: Tesouro Nacional (Secretaria do Tesouro Nacional, Ministério da Fazenda), painel "Raio X das Empresas dos Estados Brasileiros", repositório público https://github.com/tesouro/empresas-estados.**

O repositório **não tem arquivo de licença**. Por isso o projeto usa só os dados cadastrais das empresas (nome, sigla, CNPJ, setor, dependência, situação), sempre com a atribuição acima e o commit usado, e não redistribui as planilhas nem os scripts do repositório. A mesma atribuição vai para o `meta.json` do front (`atribuicoes`).

## Origem

- Repositório: https://github.com/tesouro/empresas-estados (uma pasta por edição anual do painel, `v2019` a `v2025`, com scripts em R).
- **Commit usado:** `b7f456b3088064330c6230bac65a160d87224642` (13/04/2026, "planilha renomeada para dados_raw"). O script baixa deste commit fixo, não do ramo principal, para o resultado ser reproduzível.
- **Arquivo:** `v2025/dados/dados-originais/dados_raw.xlsx` (é a planilha que o script oficial `v2025/Analise R/Analise_R_2025_Definitiva.R` lê). SHA-256 `22a8c0e63f37d8fa84354878a257e3226ea235472244d2cd52f511432a1d3c7e`.
- **Cache bruto:** `data/raw/tesouro_estatais/<commit>/<caminho no repositório>`, como veio (até 2026-10-08 o arquivo da v2025 ficava em `<commit>/dados_raw.xlsx`; mesmo SHA-256, mantido como estava). Se já existe, o script não baixa de novo.

## Edições e exercícios

Cada pasta `vAAAA` do repositório é a edição do painel publicada em AAAA, com dados do **exercício AAAA−1** (conferido no texto das páginas: a v2020 fala de "rentabilidade em 2019", a v2023 de 292 estatais, 254 ativas e 38 em liquidação, o mesmo total da planilha). O script R de cada edição diz qual planilha ela lê:

| edição | exercício | planilha lida pelo script R | usada? |
|---|---|---|---|
| v2025 | 2024 e 2023 | `v2025/dados/dados-originais/dados_raw.xlsx`, abas `ex2024` e `ex2023` | sim |
| v2024 | 2023 | `quadro_estatais_v3.xlsx` (não está no repositório) | não: o exercício 2023 vem da v2025 |
| v2023 | 2022 | `v2023/dados/dados-originais/quadro_estatais.xlsx`, aba `Todos` | sim |
| v2022 | 2021 | `v2022/dados/dados-originais/quadro_estatais.xlsx`, aba `Todos` | sim |
| v2021 | 2020 | `v2021/dados/dados-originais/quadro_estatais.xls`, aba `Estatais` (Excel 97, lido com `xlrd`) | sim; sem sigla; AP ausente |
| v2020 | 2019 | `v2020/.../Quadro das Empresas Estatais Estaduais PAF 2020v1.xlsx`, aba `Dados`, 2 linhas de título, cabeçalho em dois níveis | sim, com setor e situação herdados de 2021; AP e MA ausentes |
| v2019 | 2018 | `v2019/dados/Estatais_rev2.xlsx`, aba `PL` | não (sem CNPJ): 2018 fica sem informação |

**Edições antigas (decisões do usuário, 2026-10-10; detalhes em `docs/decisoes.md`):**
- **v2021 (exercício 2020):** 302 empresas, 26 UFs (sem o AP), sem coluna de sigla (fica nula). Setores na classificação atual.
- **v2020 (exercício 2019):** sem sigla e sem situação; setor numa classificação antiga, não usado. **Setor e situação são herdados da edição de 2021 pelo mesmo UF e CNPJ** (`HERANCA` no extractor), com `campos_herdados = "setor,situacao"` e `herdado_de = "2021"`; a **dependência é só a desta edição**. 242 de 254 empresas têm par em 2021; as 12 sem par ficam sem setor e situação. **9 linhas sem CNPJ de 14 dígitos foram descartadas**, sem correção à mão: GASMAR, EMAP, MAPA e CAEMA (MA, em branco: o MA fica sem informação em 2019), EMAE "ações preferenciais" (SP, em branco), CEHAP (PB), Estrada de Ferro Paraná Oeste (PR), SUAPE (PE) e RIOTRILHOS (RJ), com dígitos a mais ou a menos. O AP não aparece.
- **v2019 (exercício 2018):** sem CNPJ (só nome abreviado), sigla em 24 de 258 linhas, dependência "Não Informado" em 15. Não incorporada: 2018 fica "sem informação de estatais".

## Abas usadas

| aba | exercício (`ano_referencia`) | linhas | observação |
|---|---|---|---|
| `ex2024` | 2024 | 298 | edição 2025 do painel |
| `ex2023` | 2023 | 295 | coluna `'Setor '` com espaço no fim; um setor com `\n` no início (`'\nDESENVOLVIMENTO REGIONAL'`). Tratados na leitura, a planilha não é editada |

| `Todos` (v2023) | 2022 | 292 | nomes com marcador `▪` no início; coluna `' Sigla '` com espaços. Tratados na exibição e na leitura |
| `Todos` (v2022) | 2021 | 302 | algumas anotações no nome ("(Baixada em 16/11/2021)", "(Torna-se subsidiária da CELGPAR)") e na sigla ("CODISC - Extinta"), retiradas só na exibição (`analytics.limpar_anotacoes`) |

As demais abas (`ex2024 (fórmulas)`, `Estatais Ausentes`, `Estatisticas`, `rentabilidade`) são de trabalho da equipe do Tesouro e não são usadas.

Outras planilhas da mesma pasta **não** são usadas: `quadro_estatais_2024_v4.xlsx` tem o mesmo conteúdo da aba `ex2024` (conferido por UF + CNPJ); `Dados para Raio-x 2025 (...v3).xlsx` é uma versão anterior, com 36 empresas ainda em `OUTROS` que depois foram reclassificadas.

## Colunas lidas

| planilha | dicionário | tratamento |
|---|---|---|
| `UF` | `uf` (+ `cod_ibge` por join com `ufs.csv`) | UF fora de `ufs.csv` é erro |
| `Estatal` | `empresa` | **como veio**, sem alteração |
| — | `empresa_normalizada` | maiúsculas, sem acentos, só letras e números, espaços simples (para comparar nomes entre edições) |
| `Sigla` | `sigla` | espaços das pontas removidos |
| `CNPJ` | `cnpj` | só os 14 dígitos |
| `Setor` | `setor` | espaços e quebras de linha das pontas removidos; 17 setores (definições em `v2025/dados/dados-originais/tab_setores.xlsx`, aba `def`) |
| `Dependência` | `dependente` | `DEPENDENTE` → true, `NÃO DEPENDENTE` → false; outro valor é erro |
| `Situação` | `situacao` | `ATIVA` ou `EM LIQUIDAÇÃO` |

"Dependente" segue a classificação da fonte (empresa estatal dependente, no sentido da LRF: recebe do ente recursos para pessoal, custeio ou capital que não sejam aumento de participação acionária).

## Cuidados

- **O mesmo CNPJ pode aparecer em duas UFs:** o BRDE (Banco Regional de Desenvolvimento do Extremo Sul) está no RS e em SC. Fica uma linha por UF, como na fonte.
- **Nome e sigla mudam entre edições** (ex.: CEDAE: "Companhia Estadual de Águas e Esgotos" em 2023, "... - CEDAE" em 2024). Para seguir a mesma empresa entre anos, usar `cnpj`.
- Setor e dependência são **classificação do Tesouro**, informada pelos estados, e podem mudar entre edições.

## Para atualizar (nova edição)

1. Ver o commit novo e a pasta/arquivo da edição no repositório; atualizar `COMMIT` e `PLANILHAS` (arquivo → {aba: exercício}) em `extractors/nacional/tesouro_estatais.py`.
2. Conferir os nomes de coluna das abas novas (o script falha se faltar alguma) e se surgiu setor novo (o teste de `setor_funcao.csv` falha).
3. Rodar o script e atualizar o topo deste arquivo.
