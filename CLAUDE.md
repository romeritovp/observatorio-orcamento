# CLAUDE.md — orcamento-estados

Contexto para a IA. Leia antes de qualquer tarefa.

## O projeto
Repositório Python para análises rápidas de orçamentos estaduais brasileiros com dados públicos. Começa pelo Rio de Janeiro, mas **é agnóstico de UF**: qualquer estado entra sem alterar o núcleo.

Duas famílias de fontes:
- **Nacionais** (servem a todas as UFs com o mesmo código): API do SICONFI (Tesouro Nacional), fonte principal para comparar estados; ANP (royalties e participação especial por estado, `docs/fontes/anp.md`); Tesouro, Raio X das estatais (`docs/fontes/tesouro_estatais.md`); IBGE, Contas Regionais (PIB por UF, `docs/fontes/ibge_contas_regionais.md`).
- **Estaduais** (formato próprio de cada UF): TCE e portal da transparência do estado. Usadas para o detalhe que o SICONFI não tem (programa, ação, órgão).

## Regra de ouro do agnosticismo
O que é específico de uma UF vive **apenas** em:
- `extractors/ufs/<uf>/`
- `config/ufs/<uf>.yaml` (inclusive ressalvas e marcações do site, em `publicacao:`)
- `dicionarios/ufs/<uf>/`
- `docs/fontes/<uf>.md`

Em qualquer outro lugar, a UF é parâmetro. Nunca escrever "RJ", "33" ou outra sigla/código fixo no código fora dessas pastas.

## Identificação de entes
- Toda tabela tem `uf` (sigla maiúscula, `RJ`) **e** `cod_ibge` (str, `33`).
- `cod_ibge` é a chave de ligação com o SICONFI (parâmetro `id_ente`) e com dados do IBGE. `uf` é para leitura humana.
- A tradução sigla ↔ código vem sempre de `dicionarios/nacional/ufs.csv`, nunca de dicionário escrito no código.

## Regras de arquitetura
- Fluxo numa direção só: `data/raw` → `extractors` → `data/processed` → `analytics` → `analyses` → `outputs`. Publicação: `data/processed` → `publicacao` → `web/public/data`.
- Nunca editar `data/raw/`. Respostas da API são guardadas como vieram (JSON).
- `extractors/base.py`: contrato comum (valida esquema, valida totais, grava parquet). Extractors só leem e mapeiam, depois delegam ao base.
- `extractors/nacional/siconfi/`: cliente da API (paginação, cache em `data/raw/`, pausa entre chamadas) + um módulo por endpoint. Recebe a UF como parâmetro.
- `analytics/`: funções puras (DataFrame entra, DataFrame sai). Não leem arquivos, não conhecem tema nem UF específica. Agrupamentos sempre incluem `uf`.
- `publicacao/exportar.py`: gera os JSON do front em `web/public/data/` (meta, dicionários, IPCA, despesa em R$ nominais). Não calcula valor real nem per capita: isso é do front. `gabarito.json` (calculado por `analytics/`) serve só para testar o front.
- `analyses/`: um script por tema, recebe `uf` (ou lista de UFs) como argumento. Só lê `data/processed/`, só usa `analytics/`. Grava em `outputs/<uf>/<tema>/`.
- Lógica reutilizável vai para `analytics/`, nunca fica em `analyses/`.

## Dicionários
- `dicionarios/` é versionado no git: tabelas pequenas e curadas de código → nome.
- `nacional/`: UFs, entes, funções, subfunções, natureza da despesa. `ufs/<uf>/`: órgãos e correspondências entre anos daquele estado.
- Extractors gravam **códigos**. Nomes entram por join com os dicionários na análise (evita grafias diferentes entre anos).
- Dicionário gerado por script (ex.: `entes.csv` vindo do endpoint `/entes`) registra no topo do arquivo `docs/fontes/` a data de geração.

## Caminhos
- Brutos SICONFI: `data/raw/siconfi/<endpoint>/<cod_ibge>/<ano>_<periodo>_<anexo>.json`
- Brutos ANP: `data/raw/anp/royalties-estados/<ano>.csv` e `data/raw/anp/participacao-especial/pe_estado.csv`, com `data/raw/anp/manifesto.json` (URL e data da extração)
- Brutos IBGE Contas Regionais: `data/raw/ibge/contas-regionais/<edicao>/` (zips intactos, índices e zips extraídos), com `data/raw/ibge/contas-regionais/manifesto.json` (URL, data, tamanho e SHA-256)
- Brutos FBSP (Anuário Brasileiro de Segurança Pública): `data/raw/fbsp/anuario-<edição>.pdf|xlsx` (baixados à mão; a edição vem do nome)
- Material de conferência que não é tabela canônica (ex.: todas as células do anuário do FBSP, catálogo, CSV por tabela): `data/interim/<fonte>/`
- Brutos estaduais: `data/raw/ufs/<uf>/<fonte>/<ano>.csv` (uf minúscula no caminho)
- Séries de referência: `data/reference/` (IPCA; fonte em `docs/fontes/ibge.md`)
- Processados: `data/processed/<tabela>/uf=<UF>/ano=<ano>/<fonte>.parquet` (particionamento Hive)

## Tabelas canônicas
**`despesa`** — execução por classificação (formato largo):
uf, cod_ibge, ano, periodo, fonte_dado, extraido_em, nivel, intra, orgao_cod, funcao_cod, subfuncao_cod, programa_cod, acao_cod, natureza_cod, fonte_recurso_cod, dotacao_inicial, dotacao_atualizada, empenhado, liquidado, pago

**`demonstrativo`** — RREO, RGF e DCA do SICONFI (formato longo):
uf, cod_ibge, ano, periodo, extraido_em, demonstrativo, anexo, rotulo, cod_conta, conta, coluna, valor

**`populacao`** — uma linha por UF e ano (campo `populacao` da DCA do SICONFI):
uf, cod_ibge, ano, fonte_dado, extraido_em, populacao

**`compensacoes_anp`** — royalties e participação especial do petróleo destinados ao estado (nunca aos municípios), por ano de caixa (ANP):
uf, cod_ibge, ano, tipo, valor, fonte_dado, extraido_em

**`pib_uf`** e **`pib_uf_atividade`** — PIB, VAB e conta da produção por UF e Brasil (`uf` BR, `cod_ibge` 1, de `dicionarios/nacional/territorios.csv`), IBGE Contas Regionais, R$ nominais:
uf, cod_ibge, ano, pib_corrente, vab, volume_pib_2002_100, edicao, fonte_dado, extraido_em
uf, cod_ibge, ano, atividade_cod, nivel, valor_producao, consumo_intermediario, vab, vab_indice_volume, edicao, fonte_dado, extraido_em

Detalhes em `docs/dicionario.md`.

## Convenções de dados
- Códigos sempre como `str` (preservar zeros à esquerda).
- Valores em `processed` sempre em R$ nominais. Deflação e per capita só via `analytics`.
- Coluna ausente na fonte fica nula; nunca preencher com valor inventado.
- Atenção a intraorçamentárias (dupla contagem) e restos a pagar.
- Linhas de `nivel` diferentes (total, funcao, subfuncao, demais) nunca são somadas juntas: sempre filtrar um nível antes de agregar.
- Dados do SICONFI são **declarados pelo ente** e podem ser retificados: guardar a data da extração e não presumir que nunca mudam.

## Comparabilidade entre UFs
- Comparáveis: função, subfunção, natureza da despesa, estágios da despesa, demonstrativos do SICONFI.
- **Não comparáveis**: programa, ação e órgão. Nunca cruzar entre UFs.
- Comparações entre estados sempre normalizadas (per capita ou % da RCL).

## Front (`web/`)
Vite + React, site estático publicado na Hostgator.
- **Todas as contas ficam em `web/src/calculos.js`** (deflação, per capita, % da despesa total, ranking): funções puras, espelho de `analytics/`. Componentes só exibem: nada de conta, filtro de nível ou soma dentro de componente.
- **Dados só de `web/public/data/`**, gerados por `uv run python -m publicacao.exportar`; nunca editar à mão. Arquivos gerais (abertura: `despesa_funcoes.json` com total e funções das 27 UFs, `receita.json` sem linhas por item, `estatais.json` sem a lista completa, meta, dicionários, IPCA, dívida) e por UF, carregados sob demanda pela tela "Por estado" (`despesa/<UF>.json`, `receita/<UF>.json`, `estatais/<UF>.json`; `src/dados.js`). Testes juntam as partes (`src/testes/publicados.js`). O front recebe R$ nominais e calcula o resto. Deflação encadeando `variacao_pct` do `ipca.json` (como diz o `meta.json`), não `indice_dez`.
- **`calculos.js` é testado contra `gabarito.json`** (`npm test`, Vitest): toda mudança em conta tem de continuar batendo com o Python. O gabarito não vai para o site (o build o remove de `dist/`).
- **Estado da tela na URL** (UF, pares, função, ano, medida...), em parâmetros de busca: qualquer visão pode ser copiada, compartilhada e recarregada. Nada de estado só em memória para o que muda a visão.
- **Site estático para Hostgator:** `npm run build` gera `web/dist/` para subir por FTP. Sem servidor, sem API, sem rotas no servidor; `base: './'` no Vite para funcionar em qualquer pasta.
- **Prévias de compartilhamento:** os robôs (WhatsApp, Facebook, X) não executam JavaScript, então as metatags por página vêm do `web/public/index.php` (Hostgator roda PHP), que só escolhe entre textos de `data/compartilhar.json` (gerado por `publicacao/og.py`, junto com as imagens `og/`). Domínio, nome do site e indexação ficam só em `config/site.yaml`. Fonte do site e das imagens: Inter (`web/src/fontes/`, `publicacao/fontes/`).
- **Página "Como fazemos"** (`?view=metodo`, `&nivel=tecnico`): o texto fica em `web/src/conteudo/metodo/*.md` (um arquivo por seção, com `## simples` e `## tecnico`), nunca nos componentes. Números entram por marcadores `{{...}}` preenchidos a partir dos JSON publicados (`web/src/telas/metodo/valores.js`). Toda ressalva nova precisa de ligação "entenda" em `web/src/conteudo/metodo/ligacoes.js` (o teste falha sem ela).
- As mesmas regras de dados valem no front: nunca somar níveis diferentes, intraorçamentárias à parte, comparar UFs só normalizado (per capita ou %).

## Stack
Python 3.12+, pandas, pyarrow, duckdb, httpx, matplotlib, pytest, pyyaml. Gerenciador: uv.
Front: Node 20+, Vite, React, Vitest (`web/`, gerenciador npm).

## Como trabalhar
- Um passo por vez, conforme `docs/guia-desenvolvimento.md`.
- Todo código novo em `extractors/` ou `analytics/` vem com teste. Testes de analytics usam pelo menos duas UFs fictícias. Testes de extractor **não** chamam a API: usam JSON de exemplo em `tests/fixtures/`.
- Código simples e legível > código esperto. Comentários e nomes em português.
- Decisões relevantes sobre tratamento de dados: registrar em `docs/decisoes.md`.
