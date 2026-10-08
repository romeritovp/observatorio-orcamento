# Dicionário de dados

Descreve as tabelas canônicas em `data/processed/`. Os valores de código → nome ficam em `dicionarios/`.

## Colunas de identificação (todas as tabelas)

| coluna | tipo | descrição |
|---|---|---|
| uf | str | sigla maiúscula (`RJ`) |
| cod_ibge | str | código IBGE do ente (`33` para o estado do RJ). Chave com o SICONFI (`id_ente`) |
| ano | int | exercício |
| periodo | int | bimestre (RREO, 1–6), quadrimestre (RGF, 1–3), mês (MSC, 1–12) ou nulo para dado anual |
| fonte_dado | str | origem (`siconfi_dca`, `siconfi_msc`, `rj_tce`...) |

## Tabela `despesa` (formato largo)

| coluna | tipo | escopo | descrição |
|---|---|---|---|
| nivel | str | nacional | nível de agregação da linha: `total`, `funcao`, `subfuncao`, `demais` (subfunções não listadas da função, linhas `FUxx` da DCA). Nulo quando a fonte não tem hierarquia. **Nunca somar níveis diferentes** |
| intra | bool | nacional | `true` para despesas intraorçamentárias (dupla contagem se somadas ao resto) |
| orgao_cod | str | **estadual** | unidade orçamentária |
| funcao_cod | str | nacional | ex.: `10` Saúde |
| subfuncao_cod | str | nacional | ex.: `301` Atenção Básica |
| programa_cod | str | **estadual** | definido no PPA de cada estado |
| acao_cod | str | **estadual** | |
| natureza_cod | str | nacional | natureza da despesa (padrão STN) |
| fonte_recurso_cod | str | nacional* | *padronização nacional recente; conferir por ano |
| dotacao_inicial | float | | R$ nominais |
| dotacao_atualizada | float | | R$ nominais |
| empenhado | float | | R$ nominais |
| liquidado | float | | R$ nominais |
| pago | float | | R$ nominais |

Campos **estaduais** nunca são comparados entre UFs.

## Tabela `demonstrativo` (formato longo)

| coluna | tipo | descrição |
|---|---|---|
| demonstrativo | str | `RREO`, `RGF`, `DCA` |
| anexo | str | nome exato do anexo no SICONFI (ex.: `RREO-Anexo 02`) |
| rotulo | str | bloco do anexo como veio da API (ex.: `Total das Despesas Exceto Intra-Orçamentárias`); necessário para separar intraorçamentárias |
| cod_conta | str | identificador da linha no anexo |
| conta | str | rótulo da linha como veio da API |
| coluna | str | rótulo da coluna como veio da API |
| valor | float | R$ nominais (ou unidade indicada pelo anexo) |

Rótulos de `conta` e `coluna` podem variar entre anos. Quando isso quebrar uma série, criar correspondência e registrar em `decisoes.md`.

## Tabela `populacao`

Uma linha por UF e ano. Usada em `analytics.per_capita`.

| coluna | tipo | descrição |
|---|---|---|
| fonte_dado | str | `siconfi_dca`: campo `populacao` da DCA (gravado por `extrair_despesa_funcao`) |
| populacao | int | população cadastrada pelo Tesouro no SICONFI. **Não é necessariamente a estimativa do IBGE do ano**: o valor repete entre alguns anos (ex.: 2022 = 2023, 2024 = 2025) |

Arquivo: `data/processed/populacao/uf=<UF>/ano=<ano>/siconfi_dca_anexo_i_e.parquet`.

## Dicionários (`dicionarios/`)

| arquivo | origem | colunas |
|---|---|---|
| nacional/ufs.csv | manual (IBGE) | uf, cod_ibge, nome, regiao |
| nacional/entes.csv | SICONFI `/entes` | conforme a API (registrar em `fontes/siconfi.md`) |
| nacional/funcoes.csv | SICONFI DCA Anexo I-E em cache (script `extractors/nacional/siconfi/dicionario_funcoes.py`) | funcao_cod, funcao_nome |
| nacional/subfuncoes.csv | idem | subfuncao_cod, subfuncao_nome |
| nacional/natureza_despesa.csv | STN (MCASP) | natureza_cod, nivel, descricao |
| ufs/<uf>/orgaos.csv | fonte estadual | orgao_cod, orgao_nome, ano_inicio, ano_fim |
| ufs/<uf>/correspondencias.csv | manual | campo, cod_antigo, cod_novo, ano_mudanca, observacao |

## Séries de referência (`data/reference/`)

| arquivo | uso |
|---|---|
| ipca.csv | deflação: `ano`, `variacao_pct` (dez/dez, %), `indice_dez`. Fonte em `docs/fontes/ibge.md` |

A população não tem arquivo de referência: vem da tabela `populacao` (acima).

A RCL não precisa de arquivo próprio: sai do RREO Anexo 03 na tabela `demonstrativo`.
