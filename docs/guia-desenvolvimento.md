# Guia de desenvolvimento — orcamento-estados

Repositório Python para análises rápidas de orçamentos estaduais brasileiros.
Começa pelo Rio de Janeiro, mas é **agnóstico de UF** desde o primeiro commit.
Desenvolvido por vibecoding: cada fase vira uma ou poucas sessões com a IA, sempre com o `CLAUDE.md` como contexto.

---

## Princípios (não negociáveis)

1. **Fluxo numa direção só:** `data/raw` → `extractors` → `data/processed` → `analytics` → `analyses` → `outputs`.
2. **Raw é sagrado:** arquivo baixado ou resposta da API nunca é editado. Toda limpeza é código.
3. **Tabelas canônicas nacionais:** toda UF, fonte e ano viram as mesmas colunas, com `uf` e `cod_ibge` obrigatórios.
4. **Nacional primeiro, estadual depois:** o SICONFI cobre todos os estados com o mesmo formato. Fontes estaduais entram só para o que ele não tem.
5. **O que é específico de UF fica em quatro lugares:** `extractors/ufs/<uf>/`, `config/ufs/<uf>.yaml`, `dicionarios/ufs/<uf>/` e `docs/fontes/<uf>.md`.
6. **Códigos nos dados, nomes nos dicionários.**
7. **Funções puras em `analytics`.**
8. **Validar antes de analisar.**
9. **Um passo, um commit.**

---

## Estrutura

```
orcamento-estados/
├── config/
│   ├── siconfi.yaml            # URL base, pausa entre chamadas, anexos de interesse
│   └── ufs/
│       └── rj.yaml             # fontes estaduais e totais oficiais
├── dicionarios/                # VERSIONADO: código → nome
│   ├── nacional/
│   │   ├── ufs.csv             # sigla, cod_ibge, nome, região
│   │   ├── entes.csv           # gerado do endpoint /entes do SICONFI
│   │   ├── funcoes.csv
│   │   ├── subfuncoes.csv
│   │   └── natureza_despesa.csv
│   └── ufs/
│       └── rj/
│           ├── orgaos.csv
│           └── correspondencias.csv
├── data/                       # NÃO versionado
│   ├── raw/
│   │   ├── siconfi/<endpoint>/<cod_ibge>/...json
│   │   └── ufs/<uf>/<fonte>/<ano>.csv
│   ├── reference/              # IPCA, população, RCL
│   └── processed/<tabela>/uf=<UF>/ano=<ano>/<fonte>.parquet
├── extractors/
│   ├── base.py                 # contrato comum + validação + gravação
│   ├── nacional/
│   │   └── siconfi/
│   │       ├── cliente.py      # HTTP, paginação, cache, pausa
│   │       ├── entes.py
│   │       ├── rreo.py
│   │       ├── rgf.py
│   │       └── dca.py
│   └── ufs/
│       └── rj/
│           └── tce.py
├── analytics/
├── analyses/
├── outputs/<uf>/<tema>/
├── tests/
│   └── fixtures/               # JSON/CSV de exemplo para testes sem rede
├── docs/
│   ├── guia-desenvolvimento.md
│   ├── dicionario.md
│   ├── decisoes.md
│   └── fontes/
│       ├── siconfi.md
│       └── rj.md
├── CLAUDE.md
├── README.md
└── pyproject.toml
```

---

## O que é comparável entre UFs (e o que não é)

- **Comparável:** função e subfunção (padrão nacional), natureza da despesa (padrão STN), estágios da despesa e todos os demonstrativos do SICONFI.
- **Não comparável:** programa, ação e órgão. Cada estado define os seus. Servem para análise *dentro* de uma UF.
- **Para comparar estados com justiça:** per capita ou % da Receita Corrente Líquida (a RCL sai do próprio RREO).

---

## Fase 0 — Setup (1 sessão)

- [ ] Repositório com a estrutura acima (o esqueleto já vem pronto)
- [ ] `uv sync` para instalar as dependências do `pyproject.toml`
- [ ] `git init` e primeiro commit

**Pronto quando:** `uv run pytest` roda e a estrutura está no git.

---

## Fase 1 — Dicionários de base e exploração do SICONFI (1–2 sessões)

- [ ] Conferir `dicionarios/nacional/ufs.csv` (já vem preenchido)
- [ ] Explorar a API no navegador ou com um script descartável: endpoints `/entes`, `/anexos-relatorios`, `/extrato_entregas`, `/rreo`, `/dca`
- [ ] Para o RJ (`id_ente=33`) e um ano: ver quais anexos existem, o formato das linhas (`cod_conta`, `conta`, `coluna`, `valor`) e se há paginação
- [ ] Registrar em `docs/fontes/siconfi.md` o que encontrou: parâmetros obrigatórios de cada endpoint, nomes exatos dos anexos, limite por página, comportamento de erro
- [ ] Listar em `config/siconfi.yaml` os anexos de interesse (ponto de partida: RREO Anexo 02 por função/subfunção, RREO Anexo 03 para a RCL, DCA para natureza e função anuais)

**Pronto quando:** você sabe responder "que pergunta cada anexo responde".

---

## Fase 2 — Tabelas canônicas (1 sessão)

Duas tabelas, documentadas em `docs/dicionario.md`:

- **`despesa`** (largo): uma linha por combinação de classificações, colunas de estágio (dotação, empenhado, liquidado, pago). Recebe dados da DCA, MSC e fontes estaduais.
- **`demonstrativo`** (longo): uma linha por conta × coluna de cada anexo do RREO/RGF/DCA. É quase o formato nativo do SICONFI, só padronizado.

Por que duas: os demonstrativos têm estrutura de relatório (linhas de conta, colunas variáveis por anexo) e forçar isso num formato largo perde informação. A tabela `despesa` é para análise orçamentária granular, a `demonstrativo` para indicadores fiscais.

**Pronto quando:** esquemas escritos e você concorda com eles.

---

## Fase 3 — Cliente SICONFI e primeiros extractors (2–3 sessões)

- [x] `extractors/nacional/siconfi/cliente.py`: chamada HTTP com paginação, pausa entre requisições (ver `config/siconfi.yaml`), retentativa simples e **cache**: se o JSON já existe em `data/raw/siconfi/`, não chama de novo
- [ ] `extractors/nacional/siconfi/entes.py`: gera `dicionarios/nacional/entes.csv`
- [x] `extractors/base.py`: valida esquema canônico, adiciona `uf`/`cod_ibge` via `dicionarios/nacional/ufs.csv`, grava parquet particionado
- [x] `extractors/nacional/siconfi/rreo.py`: baixa e transforma um anexo em `demonstrativo`
- [ ] Ponto de entrada único: `python -m extractors siconfi rreo --uf RJ --ano 2025 --periodo 6`
- [ ] Testes com JSON salvo em `tests/fixtures/` (sem rede)

**Validação:** total da despesa no RREO Anexo 01 do 6º bimestre deve bater com o total da DCA do mesmo ano (com pequena tolerância). Divergência grande vira registro em `docs/decisoes.md`.

**Teste de agnosticismo:** rodar o mesmo comando com `--uf SP`. Se funcionar sem mexer em código, a arquitetura está certa.

**Pronto quando:** um ano do RJ está em parquet e confere.

---

## Fase 4 — Analytics básicos (1–2 sessões)

Em `analytics/`, todas agnósticas:
- [x] `deflacionar(df, colunas, ano_base, ipca)` — IPCA em `data/reference/ipca.csv`
- [x] `variacao(df, coluna, por)` — nominal e real
- [ ] `taxa_execucao(df)` — pago/dotação atualizada, liquidado/empenhado
- [x] `participacao(df, coluna, por)`
- [x] `agregar(df, colunas, por)` (soma por grupo + uf; recusa níveis misturados)
- [x] `nomear(df, dicionario)` — join de códigos com nomes
- [ ] `per_capita(df, colunas, populacao)` (feito) e `pct_rcl(df, colunas, rcl)` (falta)

Testes com DataFrames pequenos feitos à mão e **duas UFs fictícias**.

**Pronto quando:** testes passam e nenhuma função lê arquivo (os dados de referência entram como argumento).

---

## Fase 5 — Primeira análise ponta a ponta (1 sessão)

- [x] `analyses/carregar.py`: `carregar(tabela, ufs=None, anos=None)` lendo os parquets particionados
- [x] `analyses/saude.py`: `python -m analyses.saude --uf RJ`
- [ ] Evolução real da despesa em Saúde (função 10) e % da RCL, com saída em `outputs/RJ/saude/` (feito: real per capita, variação e ranking; falta % da RCL)
- [ ] Rodar também com `--uf RJ,SP,MG` para a primeira comparação
- [x] Conferir um número manualmente (DCA × RREO Anexo 02, ver `docs/fontes/siconfi.md`)

**Pronto quando:** um comando gera uma resposta confiável.

---

## Fase 6 — Fonte estadual do RJ (2 sessões)

Só agora, para o detalhe que o SICONFI não traz.

- [ ] Mapear TCE-RJ e Portal da Transparência do RJ; baixar um ano
- [ ] Registrar em `docs/fontes/rj.md` e `config/ufs/rj.yaml` (encoding, separador, decimal)
- [ ] `extractors/ufs/rj/tce.py` grava na tabela `despesa` com programa e ação
- [ ] `dicionarios/ufs/rj/orgaos.csv`
- [ ] **Validação cruzada:** total por função da fonte estadual vs. SICONFI no mesmo ano

**Armadilhas comuns:** `latin-1`, separador `;`, decimal com vírgula, códigos com zero à esquerda, classificações que mudam entre anos, intraorçamentárias, restos a pagar.

---

## Fase 7 — Escalar (contínuo)

- [ ] Mais anos (um por vez, validando)
- [ ] Correspondências entre anos em `dicionarios/ufs/<uf>/correspondencias.csv`
- [ ] RGF (pessoal, dívida) e MSC quando precisar de mais granularidade mensal
- [ ] Fonte estadual de uma segunda UF, se precisar de programa/ação dela

---

## Fase 8 — Conforto (quando doer)

- [ ] DuckDB para SQL direto: `SELECT * FROM 'data/processed/demonstrativo/**/*.parquet'`
- [ ] `Makefile`: `make siconfi UF=RJ ANO=2025`, `make analise UF=RJ TEMA=saude`
- [ ] Notebook de exploração (sem lógica nova)

---

## Fluxo de trabalho no vibecoding

1. Abrir a sessão com o `CLAUDE.md` (e `docs/dicionario.md` quando mexer em dados).
2. Pedir **um passo por vez**, citando a fase.
3. Exigir teste ou validação junto com o código.
4. Rodar, conferir um número na mão, commitar.
5. Decisões relevantes vão para `docs/decisoes.md`.

**Prompts-modelo:**

> Leia o CLAUDE.md e docs/fontes/siconfi.md. Fase 3. Crie `extractors/nacional/siconfi/cliente.py` com uma função `consultar(endpoint, params)` que pagina, pausa entre chamadas conforme `config/siconfi.yaml`, tenta de novo até 3 vezes em erro de rede e usa cache em `data/raw/siconfi/`. Teste sem rede usando um JSON em `tests/fixtures/`.

> Leia o CLAUDE.md. Fase 3. Crie `extractors/nacional/siconfi/rreo.py` com `extrair(uf, ano, periodo, anexo)` que usa o cliente, transforma a resposta na tabela canônica `demonstrativo` e delega validação e gravação ao `base.py`. A UF entra como sigla e é convertida para cod_ibge pelo dicionário.

> Leia o CLAUDE.md. Fase 5. Crie `analyses/saude.py` que recebe uma ou mais UFs por argumento e mostra a evolução real da despesa liquidada em Saúde (função 10) e seu % da RCL. Use só funções de `analytics/`. Saída em `outputs/<uf>/saude/`.
