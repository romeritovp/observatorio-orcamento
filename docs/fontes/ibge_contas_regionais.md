# Fonte: IBGE, Contas Regionais (PIB por UF)

> Tabelas geradas por script a partir desta fonte:
> - `pib_uf` e `pib_uf_atividade`: geradas em 2026-10-12 por `uv run python -m extractors.nacional.ibge_contas_regionais.pib`, edição 2023 (série 2002–2023), 27 UFs e Brasil.

Fonte nacional, no mesmo formato para todas as UFs. Referência 2010 das Contas Nacionais.

## Origem

- Pasta da edição: `https://ftp.ibge.gov.br/Contas_Regionais/<edicao>/xls/`. Arquivos usados (edição 2023):
  - `Conta_da_Producao_2002_2023_xls.zip` e o índice `Conta_da_Producao_2002_2023_indice_das_tabelas.txt`;
  - `Especiais_2002_2023_xls.zip` e o índice `Especiais_2002_2023_indice_das_tabelas.txt`.
- **Edição e cobertura:** a edição N traz a série de 2002 até N. **Defasagem de cerca de 2 anos** (a edição 2023 saiu em 2025). Cada edição revisa a série inteira: por isso as tabelas guardam a coluna `edicao`.
- O ano da edição fica em `config/ibge_contas_regionais.yaml` (`edicao`, `serie_inicio`); a próxima edição só troca o ano.
- **Unidade original:** R$ milhão (`1 000 000 R$`), a preços correntes. Índices de volume e de preço da Conta da Produção são razões anuais (1,0587); as tabelas 3 e 5 dos Especiais são séries encadeadas com 2002 = 100.

## Layout

- **Conta da Produção:** 33 arquivos `TabelaN.xls` (Excel 97), um por território (27 UFs, 5 regiões e Brasil, na ordem do IBGE: 1 = Região Norte, 22 = Rio de Janeiro, 33 = Brasil). Aba 0 = Sumário; abas 1 a 13 = Total das Atividades e as 12 atividades (`dicionarios/nacional/atividades_ibge.csv`). Cada aba tem três blocos empilhados (valor bruto da produção, consumo intermediário, valor adicionado bruto) com título, território, atividade, cabeçalho e uma linha por ano; colunas: ano, valor do ano anterior, índice de volume, valor a preços do ano anterior, índice de preço, valor a preço corrente. Em 2002 só há o valor corrente.
- **Especiais:** `tab01` (PIB corrente), `tab02` (participação no PIB), `tab03` (volume do PIB, 2002 = 100), `tab04` (VAB) com territórios nas linhas e anos nas colunas; `tab05` (volume do VAB) e `tab06` (participação no VAB), uma aba por atividade; `tab07`, uma aba por território, com a participação das atividades no VAB e os subtotais Indústria e Serviços.
- **Não há tabela de impostos:** impostos líquidos sobre produtos = PIB − VAB (calculado em `analytics/`, não gravado).

## Brutos e tabelas

- `data/raw/ibge/contas-regionais/<edicao>/`: zips intactos, índices `.txt` e o conteúdo de cada zip extraído numa pasta com o nome do zip. `data/raw/ibge/contas-regionais/manifesto.json` guarda URL, data da extração, tamanho e SHA-256 de cada arquivo baixado (`extractors/nacional/ibge_contas_regionais/baixar.py`; só baixa o que falta, `--atualizar` baixa tudo).
- Lidos: Conta da Produção (`pib_uf_atividade`) e Especiais 1, 3 e 4 (`pib_uf`). A tab05 é lida só para conferência. As tab02, tab06 e tab07 não são lidas (deriváveis).
- Valores gravados em R$ nominais (× 1.000.000). Brasil com `uf = BR`, `cod_ibge = 1` (`dicionarios/nacional/territorios.csv`). Regiões ficam de fora.

## Problemas conhecidos (edição 2023)

- **#REF! no Acre:** Tabela3.xls, abas 3.9 a 3.13 (atividades `09` a `13`, Informação e comunicação a Outros serviços), ano 2002: o valor corrente do VBP e do VAB é um erro do Excel. Gravados como nulos (o CI existe). Não preenchidos pela tab07.
- **Abas mal nomeadas:** em `Tabela19.xls` (Região Sudeste) as abas se chamam `Tabela1.1`…`Tabela1.13`. O extractor localiza as abas pela posição e confere território e atividade pelo conteúdo.
- **Títulos com o ano errado:** 364 dos 429 títulos de bloco da Conta da Produção dizem `2002-2022`, embora os dados vão até 2023. O título não é usado para ler os anos.
- **Brasil arredondado:** nas tab01 e tab04, o Brasil de 2010 a 2021 vem arredondado ao inteiro (R$ milhão). Mesmo assim, a soma das 27 UFs bate com o Brasil (maior diferença relativa: 2e-16).
- **Grafias:** `Santa catarina` (minúsculo) na Conta da Produção; `Mato Grosso ` com espaço no fim nos Especiais; regiões e Brasil indentados nos Especiais (`          Norte`) e com "Região" na Conta; o índice `.txt` chama a Tabela 4 de "Amazônia" (a planilha diz Amazonas). Os nomes são normalizados (sem acento, minúsculas, sem espaços nas pontas) antes da ligação com `ufs.csv`.
- **Cabeçalho:** às vezes com espaço antes da quebra de linha (`ANTERIOR \n`); o extractor confere só as palavras-chave (`ano`, `volume`, `corrente`).

## Conferências (feitas a cada extração e nos testes)

Todos os territórios e anos, edição 2023 (diferenças máximas, em R$ milhão):
- soma das 12 atividades = Total das Atividades, para VBP, CI e VAB: 2e-9 (Acre 2002 fora, por causa dos nulos);
- VBP − CI = VAB em cada atividade: 2e-9;
- VAB total da Conta da Produção = VAB da tab04: 5e-10;
- soma das 27 UFs = Brasil, para PIB e VAB, ano a ano: diferença relativa máxima 2e-16;
- produto acumulado dos índices de volume anuais da Conta da Produção = tab05 (2002 = 100): diferença relativa máxima 3e-11.
