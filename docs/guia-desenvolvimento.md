# Guia de desenvolvimento — orcamento-estados (Observatório dos Orçamentos)

Pipeline Python de dados públicos dos estados brasileiros e site estático que os mostra. Começou pelo Rio de Janeiro, mas é **agnóstico de UF** desde o primeiro commit. Desenvolvido por vibecoding: cada passo vira uma ou poucas sessões com a IA, sempre com o `CLAUDE.md` como contexto.

Este guia diz **como trabalhar** e **onde o projeto está**. Como ele funciona (camadas, telas, comandos, mapa de pastas) está em `docs/arquitetura.md`; o porquê de cada escolha de dados, em `docs/decisoes.md`.

---

## Princípios (não negociáveis)

1. **Fluxo numa direção só:** `data/raw` → `extractors` → `data/processed` → `publicacao` → `web/public/data` → site. Em paralelo, `data/processed` → `analytics` → `analyses` → `outputs` para relatórios avulsos.
2. **Raw é sagrado:** arquivo baixado ou resposta da API nunca é editado. Toda limpeza é código.
3. **Tabelas canônicas nacionais:** toda UF, fonte e ano viram as mesmas colunas, com `uf` e `cod_ibge` obrigatórios.
4. **Nacional primeiro, estadual depois:** fontes nacionais cobrem todos os estados com o mesmo formato. Fontes estaduais entram só para o que elas não têm.
5. **O que é específico de UF fica em quatro lugares:** `extractors/ufs/<uf>/`, `config/ufs/<uf>.yaml`, `dicionarios/ufs/<uf>/` e `docs/fontes/<uf>.md`.
6. **Códigos nos dados, nomes nos dicionários.**
7. **Funções puras em `analytics/`; contas do site em `web/src/calculos.js`,** conferidas contra o mesmo cálculo em Python (`gabarito.json`).
8. **Validar antes de gravar:** o extrator confere totais e layout e para em vez de gravar dado duvidoso.
9. **Comparar estados só normalizado** (per capita, por 100 mil, % de um total); número absoluto só para a série de um território ou como índice.
10. **Um passo, um commit,** com os testes passando.

---

## Estrutura

O mapa de pastas está em `docs/arquitetura.md` (seção 15). Em resumo: `extractors/` (um por fonte, em `nacional/` e `ufs/`), `analytics/`, `analyses/`, `publicacao/`, `scripts/` (diagnósticos), `config/`, `dicionarios/`, `data/` (`raw/` e `interim/` fora do git; `processed/` e `reference/` versionados), `docs/`, `tests/` e `web/` (site).

---

## O que é comparável entre UFs (e o que não é)

- **Comparável:** função e subfunção (padrão nacional), natureza da despesa (padrão STN), estágios da despesa, todos os demonstrativos do SICONFI e os indicadores das fontes nacionais (PIB, IBID, IDEB, Anuário do FBSP).
- **Não comparável:** programa, ação e órgão. Cada estado define os seus. Servem para análise *dentro* de uma UF.
- **Para comparar estados com justiça:** per capita, por 100 mil habitantes, % da Receita Corrente Líquida ou % de um total.

---

## Onde o projeto está

Legenda: [x] feito · [ ] a fazer · (–) substituído por outro caminho

### Fase 0 — Setup
- [x] Estrutura, `uv sync`, git, `uv run pytest`

### Fase 1 — Dicionários de base e exploração do SICONFI
- [x] `dicionarios/nacional/ufs.csv` (com região, artigo e capital) e `territorios.csv` (Brasil)
- [x] Exploração da API e ficha em `docs/fontes/siconfi.md`
- [x] `config/siconfi.yaml`
- [ ] `dicionarios/nacional/entes.csv` (gerado do endpoint `/entes`)

### Fase 2 — Tabelas canônicas
- [x] `despesa` (largo) e `demonstrativo` (longo), documentadas em `docs/dicionario.md`

### Fase 3 — Cliente SICONFI e extractors
- [x] `cliente.py` (paginação, pausa, retentativa, cache em `data/raw/`), `base.py`, `rreo.py`, `rgf.py`, `dca.py`
- [x] Testes com JSON em `tests/fixtures/` (sem rede)
- (–) Ponto de entrada único `python -m extractors ...`: no lugar dele, os lotes (`lote_dca`, `lote_receita`, `lote_divida`, `lote_rreo`), que rodam as 27 UFs
- [ ] `entes.py`

### Fase 4 — Analytics básicos
- [x] `deflacionar`, `variacao`, `participacao`, `agregar`, `nomear`, `per_capita`, `ranking`, `mediana_entre_ufs`, `completar_com_zero`
- [ ] `taxa_execucao` (pago/dotação, liquidado/empenhado) e `pct_rcl`

### Fase 5 — Primeira análise ponta a ponta
- [x] `analyses/carregar.py` e `analyses/saude.py` (uma ou mais UFs, com pares)
- [ ] % da RCL na análise de saúde

### Fase 6 — Fonte estadual do RJ
- [x] Candidatas mapeadas em `docs/fontes/rj.md`
- [ ] Extrator (`extractors/ufs/rj/`), `config/ufs/rj.yaml` com a fonte, `dicionarios/ufs/rj/orgaos.csv`, validação cruzada com o SICONFI

### Fase 7 — Escalar
- [x] Série 2015–2025 das 27 UFs (DCA, receita, dívida, RREO)
- [x] RGF (dívida) e DCA I-C (receita) e I-D (juros e amortização)
- [ ] MSC, correspondências entre anos por UF

### Fase 8 — Conforto
- [ ] `Makefile` com os comandos de atualização
- [x] `visualizar-parquet.py` para olhar uma tabela pelo terminal

### Além do plano original (feito)
- [x] **Site** (`web/`): Vite + React, estático, contas em `calculos.js` testadas contra o gabarito do Python; telas Orçamento, PIB, Educação, Pesquisa e Inovação, Violência; painel do estado; navegação estado × indicador com rotas em caminho; página "Como fazemos" em três níveis (simples, técnica, fórmulas); prévias de compartilhamento (`index.php`)
- [x] **Fontes nacionais de contexto:** ANP (royalties), Tesouro (estatais), IBGE (IPCA, Contas Regionais), INPI (IBID), Inep (IDEB), FBSP (Anuário: mortes violentas e letalidade policial, só as planilhas 2018–2026)
- [x] **Tendência** por regressão log-linear (`web/src/estatistica/`), testada contra o statsmodels

### Próximos passos possíveis
- [ ] Fonte estadual (Fase 6), começando pelo RJ
- [ ] Policiais vítimas e aberturas da letalidade policial (por corporação e situação): exige distinguir "-" (zero) de "..." (não disponível) no extrator do FBSP
- [ ] Taxa das MVI com uma série de população única (hoje muda de base em 2021 e 2023)
- [ ] Cruzar a educação com o gasto por aluno (Censo Escolar)
- [ ] `Makefile` e `entes.csv`

---

## Fluxo de trabalho no vibecoding

1. Abrir a sessão com o `CLAUDE.md` (e `docs/dicionario.md` quando mexer em dados; `docs/arquitetura.md` para ter o todo).
2. Pedir **um passo por vez**.
3. Exigir teste ou validação junto com o código; para fonte nova, uma conferência que faça o extrator parar se o dado não fechar.
4. Rodar `uv run pytest` e `cd web && npm test`; mudança visual: `npm run build` e conferir a tela. Conferir um número na mão.
5. Decisões relevantes vão para `docs/decisoes.md`. Commitar.

**Prompts-modelo:**

> Leia o CLAUDE.md e docs/fontes/<fonte>.md. Crie o extrator em `extractors/nacional/<fonte>/` que baixa o bruto para `data/raw/<fonte>/` (com manifesto: URL, data, SHA-256), confere os totais e grava a tabela canônica pelo `base.py`. Teste sem rede com um recorte real em `tests/fixtures/`.

> Leia o CLAUDE.md e a seção 14 do docs/arquitetura.md. Crie o indicador "<nome>" no site, com PIB como modelo: `publicacao/<tema>.py` gerando o JSON e o gabarito, as contas em `calculos.js` conferidas no gabarito, a entrada em `INDICADORES`, a tela em `web/src/telas/` e o bloco na metodologia.

> Leia o CLAUDE.md. Antes de mudar o extrator X, rode o diagnóstico e guarde o "antes"; depois da mudança, mostre o antes e o depois.
