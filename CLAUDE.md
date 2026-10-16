# CLAUDE.md — orcamento-estados

Contexto para a IA. Leia antes de qualquer tarefa.

## O projeto
Observatório dos Orçamentos: pipeline Python (dados públicos → tabelas canônicas → JSON) e site estático (`web/`) com as contas dos 27 governos estaduais e o contexto de cada estado (PIB, educação, inovação, violência). Começou pelo Rio de Janeiro, mas **é agnóstico de UF**: qualquer estado entra sem alterar o núcleo. Visão geral em `docs/arquitetura.md`.

Duas famílias de fontes:
- **Nacionais** (servem a todas as UFs com o mesmo código): API do SICONFI (Tesouro Nacional), fonte principal para comparar estados; ANP (royalties e participação especial por estado, `docs/fontes/anp.md`); Tesouro, Raio X das estatais (`docs/fontes/tesouro_estatais.md`); IBGE, Contas Regionais (PIB por UF, `docs/fontes/ibge_contas_regionais.md`); INPI, IBID (índice de inovação por UF, `docs/fontes/inpi_ibid.md`); Inep, IDEB (por UF, etapa e rede, `docs/fontes/inep_ideb.md`); FBSP, Anuário Brasileiro de Segurança Pública (planilhas 2018–2026: mortes violentas intencionais e letalidade policial por UF, `docs/fontes/fbsp.md`).
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
- `nacional/`: UFs (`ufs.csv`, com região, artigo e capital), territórios que não são UF (`territorios.csv`: Brasil; `regioes.csv`), funções e subfunções, itens da receita, estatais e seus ajustes, atividades do PIB, dimensões do IBID, nomes de território do IDEB. Previstos e ainda não criados: `entes.csv`, `natureza_despesa.csv`. `ufs/<uf>/`: órgãos e correspondências entre anos daquele estado (ainda vazio).
- Extractors gravam **códigos**. Nomes entram por join com os dicionários na análise (evita grafias diferentes entre anos).
- Dicionário gerado por script (ex.: `entes.csv` vindo do endpoint `/entes`) registra no topo do arquivo `docs/fontes/` a data de geração.

## Caminhos
- Brutos SICONFI: `data/raw/siconfi/<endpoint>/<cod_ibge>/<ano>_<periodo>_<anexo>.json`
- Brutos ANP: `data/raw/anp/royalties-estados/<ano>.csv` e `data/raw/anp/participacao-especial/pe_estado.csv`, com `data/raw/anp/manifesto.json` (URL e data da extração)
- Brutos IBGE Contas Regionais: `data/raw/ibge/contas-regionais/<edicao>/` (zips intactos, índices e zips extraídos), com `data/raw/ibge/contas-regionais/manifesto.json` (URL, data, tamanho e SHA-256)
- Brutos INPI (IBID): `data/raw/inpi/ibid/ibid-serie-historica.xlsx`, com `data/raw/inpi/manifesto.json` (URL, data, tamanho e SHA-256)
- Brutos Inep (IDEB): `data/raw/inep/ideb/<edicao>/` (zips de regiões/UFs e do Brasil, intactos e extraídos), com `data/raw/inep/manifesto.json`
- Brutos FBSP (Anuário Brasileiro de Segurança Pública): `data/raw/fbsp/anuario-<edição>.xlsx` (baixados à mão; a edição vem do nome; só as planilhas, 2018 em diante, são lidas)
- Material de conferência que não é tabela canônica (ex.: todas as células do anuário do FBSP, catálogo, CSV por tabela): `data/interim/<fonte>/`
- Brutos estaduais: `data/raw/ufs/<uf>/<fonte>/<ano>.csv` (uf minúscula no caminho)
- Séries de referência: `data/reference/` (IPCA; fonte em `docs/fontes/ibge.md`)
- Processados: `data/processed/<tabela>/uf=<UF>/ano=<ano>/<fonte>.parquet` (particionamento Hive)
- Mapeamento das colunas do Anuário do FBSP usadas nas tabelas consolidadas: `docs/fbsp_temas.csv` (tema, edição, aba, padrão do cabeçalho)
- Diagnósticos (medir antes e depois de mudar um extrator): `scripts/` (ex.: `scripts/diagnostico_fbsp.py`)

## Versionamento
- No git: código, `dicionarios/`, `config/`, `docs/`, `data/processed/`, `data/reference/` e `web/public/data/`.
- Fora do git (`.gitignore`): `data/raw/` e `data/interim/` (os brutos que já estavam no git continuam; bruto novo só entra com `git add -f`), `backups/`, `web/dist/`.

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

**`ibid_escore`** e **`ibid_ranking`** — IBID (INPI): escores de 0 a 1 das 27 UFs, regiões (`dicionarios/nacional/regioes.csv`) e Brasil; posição oficial (1 = melhor) das 27 UFs. Escores entre anos só com `config/ibid.yaml → escores_comparaveis_entre_anos`:
uf, cod_ibge, ano, dimensao, escore, fonte_dado, extraido_em
uf, cod_ibge, ano, dimensao, posicao, fonte_dado, extraido_em

**`ideb`** — IDEB (Inep), formato longo, UFs, regiões e Brasil; `meta` (2007–2021) nunca exibida como resultado; notas Saeb e IDEB não se comparam entre etapas:
uf, cod_ibge, ano, etapa, rede, indicador, serie, valor, edicao, fonte_dado, extraido_em

**`fbsp`** — todas as células numéricas de linhas de UF e Brasil das planilhas do Anuário (exploratória; sem colunas de variação; ano só de fonte inequívoca):
uf, cod_ibge, ano, edicao, tabela_id, arquivo, local, titulo, rotulo, grupo_qualidade, coluna, valor, valor_texto, ano_origem, fonte_dado, extraido_em

**`fbsp_mvi`** e **`fbsp_mdip`** — mortes violentas intencionais e mortes decorrentes de intervenção policial por UF, Brasil e ano, consolidadas (`extractors/nacional/fbsp/mvi.py`, mapeamento em `docs/fbsp_temas.csv`): vale a edição mais recente, com a primeira publicação e a revisão ao lado; soma das UFs = Brasil; MDIP ≤ MVI. A taxa muda de base de população entre 2020→2021 e 2022→2023:
uf, cod_ibge, ano, <tema>_numero, <tema>_taxa, edicao_fonte, tabela_fonte, edicao_primeira_publicacao, <tema>_numero_primeira_publicacao, revisao_numero, <tema>_taxa_primeira_publicacao, revisao_taxa, populacao_implicita, fonte_dado, extraido_em

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
- Comparações entre estados sempre normalizadas (per capita, por 100 mil habitantes, % da RCL ou % de um total). Número absoluto só para a série de um território ou como índice (primeiro ano = 100).

## Front (`web/`)
Vite + React, site estático publicado na Hostgator.
- **Todas as contas ficam em `web/src/calculos.js`** (deflação, per capita, % da despesa total, ranking): funções puras, espelho de `analytics/`. Componentes só exibem: nada de conta, filtro de nível ou soma dentro de componente.
- **Dados só de `web/public/data/`**, gerados por `uv run python -m publicacao.exportar`; nunca editar à mão. O front recebe R$ nominais e calcula o resto. Deflação encadeando `variacao_pct` do `ipca.json` (como diz o `meta.json`), não `indice_dez`. Testes juntam as partes (`src/testes/publicados.js`). Carga (`src/dados.js`):
  - na abertura: `meta`, `dicionarios`, `ipca`, `despesa_funcoes.json` (total e funções das 27 UFs), `receita.json` (sem linhas por item), `estatais.json` (sem a lista completa), `divida.json`;
  - Orçamento de um estado (`/<uf>/orcamento`): `despesa/<UF>.json`, `receita/<UF>.json`, `estatais/<UF>.json`;
  - PIB (`/<uf>/pib`): `pib.json` e `pib/<UF>.json`, com anos próprios na URL (`pano`, `desde`);
  - Pesquisa e Inovação (`/<uf>/pesquisa-e-inovacao`): `ibid.json` (com `mediana_ufs`, o "estado típico" calculado pelo pipeline) e `despesa_ensino_superior.json` (subfunção 364), com ano próprio (`iano`);
  - Educação (`/<uf>/educacao`): `ideb.json` (sem metas, séries em listas alinhadas a `anos`) e `ideb/<UF>.json` (aprovação por série), com `eano`, `etapa`, `erede`, `ejan`;
  - Violência (`/<uf>/violencia`): `violencia.json` (MVI e letalidade policial: número em destaque, ranking pela taxa no último ano, índice do número e % das MDIP nas MVI para comparar com região e Brasil);
  - painel do estado (`/<uf>`): os arquivos de cada indicador, para os cartões.
- **Exceção:** a análise de tendência (`web/src/estatistica/`, parâmetros em `configuracao.json`) é testada contra o statsmodels (`src/testes/referencia_tendencia.py` → `.json`), não contra o gabarito.
- **`calculos.js` é testado contra `gabarito.json`** (`npm test`, Vitest): toda mudança em conta tem de continuar batendo com o Python. O gabarito não vai para o site (o build o remove de `dist/`).
- **Navegação: matriz estado × indicador.** Fonte única em `web/src/navegacao.config.js` (eixos e indicadores escritos ali; as UFs vêm do `dicionarios.json`, nunca de lista no código). Menus, abas, seletores e títulos ("O PIB de São Paulo") saem dela: indicador novo = uma entrada em `INDICADORES` (+ a tela, se tiver). Componentes em `web/src/componentes/navegacao/`.
- **Rotas em caminho** (`web/src/rotas.js`, sem biblioteca): `/` início, `/sp` painel do estado, `/sp/pib` indicador no estado, `/indicadores/pib` visão nacional, `/comparar?ufs=sp,pe&indicador=pib`, `/metodologia`. URLs antigas (`?view=...`) são redirecionadas (301 no `index.php`, `replaceState` no navegador).
- **Estado da tela na URL:** a página e a UF no caminho; o resto (ano, área, medida, pares...) em parâmetros de busca. Qualquer visão pode ser copiada, compartilhada e recarregada. Nada de estado só em memória para o que muda a visão.
- **Site estático para Hostgator:** `npm run build` gera `web/dist/` para subir por FTP. Sem servidor de aplicação nem API. As rotas são resolvidas no navegador; no servidor, só o `.htaccess` (todo caminho que não é arquivo → `index.php`). A base do Vite é a subpasta do domínio em `config/site.yaml` (`/orcamento/`), em caminho absoluto: mudar de pasta = mudar o `dominio` e gerar o build de novo.
- **Prévias de compartilhamento:** os robôs (WhatsApp, Facebook, X) não executam JavaScript, então as metatags por página vêm do `web/public/index.php` (Hostgator roda PHP), que só escolhe entre textos de `data/compartilhar.json` (gerado por `publicacao/og.py`, junto com as imagens `og/`). Domínio, nome do site e indexação ficam só em `config/site.yaml`. Fonte do site e das imagens: Inter (`web/src/fontes/`, `publicacao/fontes/`).
- **Página "Como fazemos"** (`/metodologia`, `?nivel=tecnico`): o texto fica em `web/src/conteudo/metodo/*.md` (um arquivo por seção, com `## simples` e `## tecnico`, e `## formulas` nas seções com contas, para auditoria: `?nivel=formulas`), nunca nos componentes. Os exemplos das fórmulas vêm de `web/src/telas/metodo/formulas.js` e são testados contra o gabarito e o statsmodels. Números entram por marcadores `{{...}}` preenchidos a partir dos JSON publicados (`web/src/telas/metodo/valores.js`). Toda ressalva nova precisa de ligação "entenda" em `web/src/conteudo/metodo/ligacoes.js` (o teste falha sem ela).
- As mesmas regras de dados valem no front: nunca somar níveis diferentes, intraorçamentárias à parte, comparar UFs só normalizado (per capita ou %).

## Stack
Python 3.12+, pandas, pyarrow, duckdb, httpx, matplotlib, pyyaml, openpyxl e xlrd (planilhas), pytest. Gerenciador: uv. Referências pontuais sem virar dependência: `uv run --no-project --with statsmodels ...`.
Front: Node 20+, Vite, React, Vitest (`web/`, gerenciador npm).

## Como trabalhar
- Um passo por vez, conforme `docs/guia-desenvolvimento.md`.
- Todo código novo em `extractors/`, `analytics/` ou `publicacao/` vem com teste. Testes de analytics usam pelo menos duas UFs fictícias. Testes de extractor **não** chamam a rede: usam JSON ou recortes reais de planilha em `tests/fixtures/`.
- Conta nova no site: em `web/src/calculos.js` **e** em Python (`analytics/` ou `publicacao/`), conferida no `gabarito.json`. Indicador novo: o passo a passo está em `docs/arquitetura.md`, seção 14.
- Antes de dar por pronto: `uv run pytest` e `cd web && npm test`; para mudança visual, `npm run build` e conferir a tela.
- Código simples e legível > código esperto. Comentários e nomes em português.
- Decisões relevantes sobre tratamento de dados: registrar em `docs/decisoes.md`.
