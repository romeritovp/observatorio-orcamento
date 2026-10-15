# Fonte: Fórum Brasileiro de Segurança Pública (FBSP), Anuário Brasileiro de Segurança Pública

> Tabela gerada por script a partir desta fonte:
> - `fbsp`: gerada em 2026-10-15 por `uv run python -m extractors.nacional.fbsp.fbsp --ignorar anuario-2016.xlsx`. 19 arquivos (edições 2007–2026, sem 2009; 2016 pelo PDF), 3.015 tabelas, 375.989 valores; 231.783 de linhas de UF (ou BR) com ano inequívoco → `data/processed/fbsp/` (873 arquivos, 28 territórios). Diagnóstico: `uv run python scripts/diagnostico_fbsp.py`.

## Origem

- Brutos baixados à mão em `data/raw/fbsp/anuario-<edição>.pdf|xlsx` (edições até 2015 e 2017 em PDF; 2018 em diante em planilha). Sem manifesto: o SHA-256 de cada arquivo lido vai no catálogo.
- **`anuario-2016.xlsx` é uma cópia do `anuario-2022.xlsx`** (mesmo SHA-256; conteúdo da edição 2022). A edição 2016 entra pelo `anuario-2016.pdf`; até apagar ou trocar o `.xlsx`, rodar com `--ignorar anuario-2016.xlsx` (o extrator para quando acha arquivos iguais). Falta a edição 2009.

## Extração (genérica e exploratória)

O extrator lê **todas** as tabelas (`pdfplumber` nos PDFs, todas as abas nas planilhas) e as transforma em formato longo (uma linha por célula numérica), detectando cabeçalho, células mescladas, território e ano pelo cabeçalho. O território (UF por sigla ou nome, Brasil, capital, total das capitais, região, município) é procurado em todas as colunas de identificação (as primeiras colunas de texto), pelos dicionários; vale o mais à direita, e o que fica à esquerda vira atributo (`grupo_qualidade`, `capital`). Colunas de código e de posição em ranking nunca viram valor (ver `docs/decisoes.md`, 2026-10-15). Não há ainda dicionário de indicadores: `titulo` e `coluna` vêm como estão.

- `data/processed/fbsp/`: só as células com UF (ou BR) e ano identificados (tabela canônica `fbsp`).
- `data/interim/fbsp/`: todas as células (`fbsp_longo.parquet`), o catálogo de tabelas (`catalogo.parquet`: 1.986 com números, 858 sem números, 11 páginas de PDF sem texto, que precisariam de OCR: 2007 p67; 2014 p12, p108, p142; 2015 p10, p106, p122, p150; 2017 p1, p4, p10) e cada tabela em CSV (`brutos/`).

## Limitações conhecidas

- **Ano:** só de uma fonte inequívoca: o cabeçalho da coluna com exatamente um ano (`ano_origem = coluna`) ou o título com exatamente um ano (`titulo`); intervalo ("2022-2026") e vários anos deixam o ano nulo e a célula fora de `processed/` (ver `docs/decisoes.md`, 2026-10-15). Caso de teste: Tabela 64 da edição 2026 (`tests/fixtures/fbsp/`).
- **Edições se repetem:** a mesma estatística aparece em várias edições, às vezes revisada (RJ, mortes violentas intencionais de 2021: 4.755 na edição 2022, 4.762 nas seguintes). Todas ficam na tabela com `edicao`; ao usar, **prevalece a edição mais recente** para cada indicador, UF e ano.
- **Fora de `processed/`:** 144.206 valores, por motivo, em `data/interim/fbsp/fora_de_processed.csv` (capital, região, município, total das capitais, sem território identificado, sem ano inequívoco). Por grupo, antes e depois de cada mudança: `scripts/diagnostico_fbsp.py` → `data/interim/fbsp/diagnostico/resumo_grupos.csv`.
- **Aceitação (MVI por UF, 27 UFs e soma das UFs = Brasil):** passa nas edições 2018–2026 (planilhas). Nos PDFs (2007–2017) a tabela não é achada ou sai em bloco de texto (2017): precisaria de outra leitura do PDF.
- **Anos fora do esperado:** 453 valores com ano posterior à edição ou anterior a 2000 (ex.: projeções 2015–2030 na edição 2014, p130–131), vindos do cabeçalho da coluna; a regra do ano não foi mexida. Inventário (edicao, titulo, coluna) com contagens em `data/interim/fbsp/inventario.csv`, base do dicionário de indicadores.
- **PDFs:** extração por `pdfplumber` (tabelas detectadas por linhas); tabelas sem borda ou quebradas entre páginas podem sair incompletas; títulos herdados da página anterior quando a tabela continua.
