# Fonte: Tesouro Nacional — Raio X das Empresas dos Estados

> Dicionário gerado por script a partir desta fonte:
> - `dicionarios/nacional/estatais.csv`: gerado em 2026-10-08 por `uv run python -m extractors.nacional.tesouro_estatais`, a partir do commit `b7f456b` (abas `ex2024` e `ex2023`). Resultado: **exercício 2024: 298 empresas** (127 dependentes, 35 em liquidação); **exercício 2023: 295 empresas** (124 dependentes, 36 em liquidação). As 27 UFs aparecem nos dois.

Fonte nacional, no mesmo formato para todas as UFs.

## Atribuição

**Dados: Tesouro Nacional (Secretaria do Tesouro Nacional, Ministério da Fazenda), painel "Raio X das Empresas dos Estados Brasileiros", repositório público https://github.com/tesouro/empresas-estados.**

O repositório **não tem arquivo de licença**. Por isso o projeto usa só os dados cadastrais das empresas (nome, sigla, CNPJ, setor, dependência, situação), sempre com a atribuição acima e o commit usado, e não redistribui as planilhas nem os scripts do repositório. A mesma atribuição vai para o `meta.json` do front (`atribuicoes`).

## Origem

- Repositório: https://github.com/tesouro/empresas-estados (uma pasta por edição anual do painel, `v2019` a `v2025`, com scripts em R).
- **Commit usado:** `b7f456b3088064330c6230bac65a160d87224642` (13/04/2026, "planilha renomeada para dados_raw"). O script baixa deste commit fixo, não do ramo principal, para o resultado ser reproduzível.
- **Arquivo:** `v2025/dados/dados-originais/dados_raw.xlsx` (é a planilha que o script oficial `v2025/Analise R/Analise_R_2025_Definitiva.R` lê). SHA-256 `22a8c0e63f37d8fa84354878a257e3226ea235472244d2cd52f511432a1d3c7e`.
- **Cache bruto:** `data/raw/tesouro_estatais/<commit>/dados_raw.xlsx`, como veio. Se já existe, o script não baixa de novo.

## Abas usadas

| aba | exercício (`ano_referencia`) | linhas | observação |
|---|---|---|---|
| `ex2024` | 2024 | 298 | edição 2025 do painel |
| `ex2023` | 2023 | 295 | coluna `'Setor '` com espaço no fim; um setor com `\n` no início (`'\nDESENVOLVIMENTO REGIONAL'`). Tratados na leitura, a planilha não é editada |

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

1. Ver o commit novo e a pasta/arquivo da edição no repositório; atualizar `COMMIT`, `ARQUIVO` e `ABAS` em `extractors/nacional/tesouro_estatais.py`.
2. Conferir os nomes de coluna das abas novas (o script falha se faltar alguma) e se surgiu setor novo (o teste de `setor_funcao.csv` falha).
3. Rodar o script e atualizar o topo deste arquivo.
