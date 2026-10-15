# Fonte: Fórum Brasileiro de Segurança Pública (FBSP), Anuário Brasileiro de Segurança Pública

> Tabela gerada por script a partir desta fonte:
> - `fbsp`: gerada em 2026-10-15 por `uv run python -m extractors.nacional.fbsp.fbsp`. 9 planilhas (edições 2018–2026), 1.283 abas, 258.258 valores; 185.867 de linhas de UF (ou BR) com ano inequívoco, sem colunas de variação → `data/processed/fbsp/` (672 arquivos, 28 territórios, 806 tabelas). Diagnóstico: `uv run python scripts/diagnostico_fbsp.py`.

## Origem

- Brutos baixados à mão em `data/raw/fbsp/anuario-<edição>.xlsx` (2018 em diante). Sem manifesto: o SHA-256 de cada arquivo lido vai no catálogo. `data/raw/` não é versionado.
- **Só as planilhas são lidas.** As edições até 2017 existem só em PDF (`anuario-2007.pdf` a `anuario-2017.pdf`, sem 2009) e ficam na pasta, mas o extrator não as lê (ver `docs/decisoes.md`, 2026-10-15). Qualquer arquivo fora do padrão `anuario-<edição>.xlsx` (planilhas de trabalho, temporários do Excel "~$...") é listado e ignorado.
- Dois arquivos com o mesmo conteúdo (SHA-256) param a extração (a edição, tirada do nome, sairia trocada); `--ignorar <arquivo>` pula um arquivo.

## Extração (genérica e exploratória)

O extrator lê **todas** as abas das planilhas e as transforma em formato longo (uma linha por célula numérica), detectando cabeçalho, células mescladas, território e ano pelo cabeçalho. O território (UF por sigla ou nome, Brasil, capital, total das capitais, região, município) é procurado em todas as colunas de identificação (as primeiras colunas de texto), pelos dicionários; vale o mais à direita, e o que fica à esquerda vira atributo (`grupo_qualidade`, `capital`). Colunas de código e de posição em ranking nunca viram valor. Não há ainda dicionário de indicadores: `titulo` e `coluna` vêm como estão.

- `data/processed/fbsp/`: só as células de UF (ou BR) com ano identificado, sem colunas de variação (tabela canônica `fbsp`).
- `data/interim/fbsp/` (não versionado): todas as células (`fbsp_longo.parquet`), o catálogo de abas (`catalogo.parquet`), cada aba em CSV (`brutos/`), o inventário (edicao, titulo, coluna) com contagens (`inventario.csv`, base do dicionário de indicadores) e o que ficou fora, por motivo (`fora_de_processed.csv`).

## Limitações conhecidas

- **Ano:** só de uma fonte inequívoca: o cabeçalho da coluna com exatamente um ano (`ano_origem = coluna`) ou o título com exatamente um ano (`titulo`); intervalo ("2022-2026") e vários anos deixam o ano nulo e a célula fora de `processed/`. Ano com notas ("2019 (1) (2)") é ano. Casos de teste: Tabelas 64 e 45 da edição 2026 (`tests/fixtures/fbsp/`).
- **Variação:** colunas "Variação (%)" ficam fora de `processed/` (motivo `variacao`): recalculáveis a partir dos anos.
- **Edições se repetem:** a mesma estatística aparece em várias edições, às vezes revisada (RJ, mortes violentas intencionais de 2021: 4.755 na edição 2022, 4.762 nas seguintes). Todas ficam na tabela com `edicao`; ao usar, **prevalece a edição mais recente** para cada indicador, UF e ano.
- **Fora de `processed/`:** 72.391 valores, por motivo, em `data/interim/fbsp/fora_de_processed.csv` (variação, capital, região, município, total das capitais, sem território identificado, sem ano inequívoco). Por grupo, antes e depois de cada mudança: `scripts/diagnostico_fbsp.py` → `data/interim/fbsp/diagnostico/resumo_grupos.csv`.
- **Aceitação (MVI por UF, 27 UFs e soma das UFs = Brasil):** passa em todas as edições 2018–2026.
- **Sem as edições até 2017:** a série de cada indicador começa nos anos cobertos pelas planilhas (2003 é o mais antigo, em séries históricas das edições recentes).
