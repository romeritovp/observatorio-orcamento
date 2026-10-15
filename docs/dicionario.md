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
| extraido_em | str | data da extração na API (ISO 8601, UTC), copiada do cache bruto (`data/raw/`) pelo extrator; nula se desconhecida |

## Tabela `despesa` (formato largo)

| coluna | tipo | escopo | descrição |
|---|---|---|---|
| nivel | str | nacional | nível de agregação da linha: `total`, `funcao`, `subfuncao`, `demais` (subfunções não listadas da função, linhas `FUxx` da DCA) ou `demais_calculado` (função − soma das subfunções, calculado onde a DCA não traz `FUxx`, como em 2015–2016; não declarado pelo ente). Nulo quando a fonte não tem hierarquia. **Nunca somar níveis diferentes** |
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

## Tabela `pib_uf`

Uma linha por território e ano (27 UFs e Brasil, `uf = BR`, `cod_ibge = 1`). IBGE, Contas Regionais, Especiais (ver `fontes/ibge_contas_regionais.md`). Valores em R$ nominais.

| coluna | tipo | descrição |
|---|---|---|
| pib_corrente | float | PIB a preços correntes (tab01) |
| vab | float | valor adicionado bruto a preços correntes (tab04). Impostos líquidos = `pib_corrente − vab`, calculados em `analytics/` |
| volume_pib_2002_100 | float | série encadeada do volume do PIB, 2002 = 100 (tab03). Variação real do ano = valor do ano / valor do ano anterior |
| edicao | int | edição das Contas Regionais (ano final da série); cada edição revisa a série inteira |
| fonte_dado | str | `ibge_cr_especiais` |

Arquivo: `data/processed/pib_uf/uf=<UF>/ano=<ano>/ibge_contas_regionais.parquet`.

## Tabela `pib_uf_atividade`

Uma linha por território, ano e atividade. IBGE, Contas Regionais, Conta da Produção. Valores em R$ nominais, a preço corrente.

| coluna | tipo | descrição |
|---|---|---|
| atividade_cod | str | `01` a `13`, texto com zero à esquerda (sufixo da aba; nomes em `dicionarios/nacional/atividades_ibge.csv`) |
| nivel | str | `total` (atividade `01`) ou `atividade` (`02` a `13`). Nunca somar os dois níveis |
| valor_producao | float | valor bruto da produção |
| consumo_intermediario | float | consumo intermediário |
| vab | float | valor adicionado bruto (= valor_producao − consumo_intermediario) |
| vab_indice_volume | float | índice de volume anual do VAB (razão, 1,0587 = +5,87%); nulo no primeiro ano da série |
| edicao | int | edição das Contas Regionais |
| fonte_dado | str | `ibge_cr_conta_producao` |

Nulos conhecidos: Acre 2002, atividades `09` a `13`, `valor_producao` e `vab` (#REF! na fonte).

Arquivo: `data/processed/pib_uf_atividade/uf=<UF>/ano=<ano>/ibge_contas_regionais.parquet`.

## Tabela `fbsp`

Formato longo e **exploratório**: uma linha por célula numérica das tabelas do Anuário Brasileiro de Segurança Pública (FBSP) em que a UF (ou o Brasil, `BR`) e o ano foram identificados (linhas de capital, região ou município nunca entram, mesmo com a UF ao lado) pelo extrator genérico (`extractors/nacional/fbsp/fbsp.py`). Ainda sem dicionário de indicadores: `titulo` e `coluna` vêm como estão no anuário.

| coluna | tipo | descrição |
|---|---|---|
| edicao | int | edição do anuário (do nome do arquivo) |
| tabela_id | str | identificador da tabela (hash de arquivo + página/aba) |
| arquivo, local | str | arquivo bruto e página (`p12`) ou aba (`aba:T01`) |
| titulo | str | título da tabela ("Tabela 12 - ...") |
| rotulo | str | textos das colunas de identificação da linha, unidos por " \| " (ex.: `Grupo 1 \| Alagoas`), como vieram, com notas |
| grupo_qualidade | str | grupo de qualidade dos dados atribuído pelo FBSP à UF naquela tabela (`Grupo 1`, `Grupo 2`, `Grupo 3`...); nulo na linha Brasil e nas tabelas sem grupo |
| coluna | str | cabeçalho da coluna (indicador e/ou ano, cabeçalhos mesclados unidos por " \| ") |
| valor, valor_texto | float, str | valor numérico e o texto original da célula |
| fonte_dado | str | `fbsp_anuario` |

`extraido_em` fica nulo (arquivos baixados à mão); o SHA-256 de cada arquivo está no catálogo. Tabela completa (inclusive células sem UF ou ano, com `nivel_territorial`: `uf`, `brasil`, `capital`, `total_capitais`, `regiao`, `municipio` ou nulo, e `capital`), catálogo e CSV de cada tabela em `data/interim/fbsp/`. Uma mesma estatística pode aparecer em várias edições, às vezes revisada: filtrar por `edicao`.

Arquivo: `data/processed/fbsp/uf=<UF>/ano=<ano>/fbsp.parquet`.

## Dicionários (`dicionarios/`)

| arquivo | origem | colunas |
|---|---|---|
| nacional/ufs.csv | manual (IBGE) | uf, cod_ibge, nome, regiao, artigo (`o`, `a` ou vazio: "o RJ", "a BA", "SP"; usado nos textos do front), capital (nome oficial; o extrator do FBSP usa para separar linha de capital de linha de UF) |
| nacional/territorios.csv | manual (IBGE) | uf, cod_ibge, nome. Territórios que não são UF: hoje só o Brasil (`BR`, `1`). Fica fora do `ufs.csv`, que é a lista das 27 UFs |
| nacional/atividades_ibge.csv | manual (IBGE, Contas Regionais) | atividade_cod (`01` a `13`, texto), nome (texto oficial), nome_curto (tela), grande_setor (`total`, `agropecuaria`, `industria`, `servicos`) |
| nacional/entes.csv | SICONFI `/entes` | conforme a API (registrar em `fontes/siconfi.md`) |
| nacional/funcoes.csv | SICONFI DCA Anexo I-E em cache (script `extractors/nacional/siconfi/dicionario_funcoes.py`) | funcao_cod, funcao_nome |
| nacional/subfuncoes.csv | idem | subfuncao_cod, subfuncao_nome |
| nacional/estatais.csv | Tesouro Nacional, Raio X das Empresas dos Estados (script `extractors/nacional/tesouro_estatais.py`; ver `fontes/tesouro_estatais.md`) | uf, cod_ibge, empresa (como veio), empresa_normalizada, sigla, cnpj (14 dígitos), setor, dependente (`true`/`false`), situacao (`ATIVA`/`EM LIQUIDAÇÃO`), ano_referencia (exercício), fonte. Uma linha por empresa, UF e exercício |
| nacional/setor_funcao.csv | manual | setor (como em estatais.csv), funcao_cod (nulo quando não há correspondência clara), correspondencia (`direta`, `parcial`, `nenhuma`), justificativa |
| nacional/estatais_ajustes.csv | manual | cnpj (14 dígitos), funcao_cod, justificativa. Exceções por empresa; têm prioridade sobre `setor_funcao.csv` |
| nacional/estatais_nomes_exibicao.csv | manual | cnpj (14 dígitos), sigla_exibicao, nome_exibicao. Só exibição no front; prioridade sobre a escolha automática. O nome original continua em `estatais.csv` |
| nacional/receita_itens.csv | manual (a partir da DCA I-C, 27 UFs, 2019–2025) | item, codigo (prefixo da natureza da receita, sem os zeros finais), ano_inicio, ano_fim (vazios = sem limite). Prefixo mais longo vigente no ano decide o item; os itens "outros/outras" cobrem os grupos inteiros |
| nacional/natureza_despesa.csv | STN (MCASP) | natureza_cod, nivel, descricao |
| ufs/<uf>/orgaos.csv | fonte estadual | orgao_cod, orgao_nome, ano_inicio, ano_fim |
| ufs/<uf>/correspondencias.csv | manual | campo, cod_antigo, cod_novo, ano_mudanca, observacao |

## Séries de referência (`data/reference/`)

| arquivo | uso |
|---|---|
| ipca.csv | deflação: `ano`, `variacao_pct` (dez/dez, %), `indice_dez`. Fonte em `docs/fontes/ibge.md` |

A população não tem arquivo de referência: vem da tabela `populacao` (acima).

A RCL não precisa de arquivo próprio: sai do RREO Anexo 03 na tabela `demonstrativo`.
