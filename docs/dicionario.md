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

## Tabela `ibid_escore`

Uma linha por território, ano e dimensão. INPI, Índice Brasil de Inovação e Desenvolvimento (IBID), abas anuais. Território: as 27 UFs, as 5 regiões (`dicionarios/nacional/regioes.csv`, `uf` = `NORTE`…`CENTRO_OESTE`) e o Brasil (`BR`, de `territorios.csv`).

| coluna | tipo | descrição |
|---|---|---|
| dimensao | str | `geral`, `contexto`, `resultado` e os sete pilares (nomes e hierarquia em `dicionarios/nacional/ibid_dimensoes.csv`) |
| escore | float | de 0 a 1 (maior = melhor), sem arredondar. Os das regiões e do Brasil são os do INPI, **não** a média simples das UFs |
| fonte_dado | str | `inpi_ibid` |

Atenção: o `cod_ibge` das regiões é o código de região do IBGE (1 a 5) e o do Brasil é `1` (o mesmo do `pib_uf` e o `id_ente` da União no SICONFI, por isso não muda): Norte e Brasil dividem o código. Nesta tabela, ligar territórios **sempre pela coluna `uf`**. O teste `tests/test_inpi_ibid.py::test_cod_ibge_do_ibid_e_ambiguo_e_ninguem_usa` falha se a publicação ou a tela do IBID usarem `cod_ibge`; o `ibid.json` publicado não traz o campo.

No `ibid.json` publicado, além dos escores do INPI, vai `mediana_ufs`: o "estado típico", mediana dos escores das 27 UFs em cada dimensão e ano, **calculada pelo projeto** (`publicacao/ibid.py`, com `analytics.mediana_entre_ufs`), não pelo INPI. Não é gravada em tabela (deriva de `ibid_escore`).

Arquivo: `data/processed/ibid_escore/uf=<UF>/ano=<ano>/inpi_ibid.parquet`.

## Tabela `ibid_ranking`

Uma linha por UF, ano e dimensão (`geral`, `contexto`, `resultado`): `posicao` (int, 1 = melhor entre 27), a oficial das abas de série histórica. O extrator confere que ela é igual à ordenação dos escores (divergências em `data/processed/ibid_fonte.json`, com a nota da planilha, o SHA-256 e a data da extração).

Arquivo: `data/processed/ibid_ranking/uf=<UF>/ano=<ano>/inpi_ibid.parquet`.

## Tabela `ideb`

Formato longo, uma linha por território, ano, etapa, rede, indicador e série. Inep, IDEB, edição 2025 (série 2005–2025). Território: 27 UFs, 5 regiões (`regioes.csv`) e Brasil (`BR`); ligar pela coluna `uf`, como no IBID.

| coluna | tipo | descrição |
|---|---|---|
| etapa | str | `anos_iniciais`, `anos_finais`, `medio` |
| rede | str | `estadual` (no DF, a distrital), `municipal` (só no Brasil), `publica`, `privada`, `total` |
| indicador | str | `ideb` (0 a 10), `meta` (2007–2021, **não exibir**), `rendimento` (P, 0 a 1), `nota_padronizada` (N, 0 a 10), `saeb_matematica` e `saeb_portugues` (escala Saeb da etapa: não comparar entre etapas), `aprovacao` (%) |
| serie | str | só na aprovação: `total` ou o número do ano (1 a 9) ou da série do médio (1 a 4); nulo nos demais |
| valor | float | como publicado; "-" na fonte vira nulo (nunca 0) |
| edicao | int | edição do IDEB (2025) |
| fonte_dado | str | `inep_ideb` |

Ressalvas por linha (notas de rodapé no rótulo da rede), códigos técnicos com problema e conferências em `data/processed/ideb_fonte.json`.

Arquivo: `data/processed/ideb/uf=<UF>/ano=<ano>/inep_ideb.parquet`. JSON de saída: `data/nacional/inep/ideb.json` (`publicacao/ideb.py`).

## Tabela `fbsp`

Formato longo e **exploratório**: uma linha por célula numérica das tabelas do Anuário Brasileiro de Segurança Pública (FBSP) em que a UF (ou o Brasil, `BR`) e o ano foram identificados (linhas de capital, região ou município nunca entram, mesmo com a UF ao lado) pelo extrator genérico (`extractors/nacional/fbsp/fbsp.py`). Ainda sem dicionário de indicadores: `titulo` e `coluna` vêm como estão no anuário. Só as planilhas (edições 2018–2026); colunas de variação ("Variação (%)") nunca entram: são recalculáveis a partir dos anos.

| coluna | tipo | descrição |
|---|---|---|
| edicao | int | edição do anuário (do nome do arquivo) |
| tabela_id | str | identificador da tabela (hash de arquivo + página/aba) |
| arquivo, local | str | planilha bruta e aba (`aba:T01`) |
| titulo | str | título da tabela ("Tabela 12 - ...") |
| rotulo | str | textos das colunas de identificação da linha, unidos por " \| " (ex.: `Grupo 1 \| Alagoas`), como vieram, com notas |
| grupo_qualidade | str | grupo de qualidade dos dados atribuído pelo FBSP à UF naquela tabela (`Grupo 1`, `Grupo 2`, `Grupo 3`...); nulo na linha Brasil e nas tabelas sem grupo |
| coluna | str | cabeçalho da coluna (indicador e/ou ano, cabeçalhos mesclados unidos por " \| ") |
| valor, valor_texto | float, str | valor numérico e o texto original da célula |
| fonte_dado | str | `fbsp_anuario` |

`extraido_em` fica nulo (arquivos baixados à mão); o SHA-256 de cada arquivo está no catálogo. Tabela completa (inclusive células sem UF ou ano, com `nivel_territorial`: `uf`, `brasil`, `capital`, `total_capitais`, `regiao`, `municipio` ou nulo, e `capital`), catálogo e CSV de cada tabela em `data/interim/fbsp/`. Uma mesma estatística pode aparecer em várias edições, às vezes revisada: filtrar por `edicao`.

Arquivo: `data/processed/fbsp/uf=<UF>/ano=<ano>/fbsp.parquet`.

## Tabela `fbsp_mvi`

Mortes violentas intencionais (MVI) por UF e Brasil (`BR`) e ano, 2016–2025, consolidadas das tabelas de MVI das planilhas do Anuário (mapeamento em `docs/fbsp_temas.csv`; gerada por `extractors/nacional/fbsp/mvi.py`). Uma linha por território e ano.

| coluna | tipo | descrição |
|---|---|---|
| mvi_numero | int | número de vítimas, da edição mais recente que traz o ano |
| mvi_taxa | float | taxa por 100 mil habitantes, da mesma edição (a base de população muda entre edições: ver `docs/decisoes.md`) |
| edicao_fonte, tabela_fonte | int, str | edição e aba de onde vêm os valores finais (ex.: 2026, `T01`) |
| edicao_primeira_publicacao | int | edição em que o ano saiu pela primeira vez |
| mvi_numero_primeira_publicacao, mvi_taxa_primeira_publicacao | int, float | valores da primeira publicação |
| revisao_numero, revisao_taxa | int, float | final menos primeira publicação (0 se o ano saiu numa edição só) |
| populacao_implicita | float | número ÷ taxa × 100.000 (conferência da base de população da taxa) |
| fonte_dado | str | `fbsp_anuario` |

Soma das 27 UFs = Brasil no número, em todos os anos (conferido na geração). Arquivo: `data/processed/fbsp_mvi/uf=<UF>/ano=<ano>/fbsp.parquet`; CSV único em `data/interim/fbsp/fbsp_mvi.csv`.

## Tabela `fbsp_mdip`

Mortes decorrentes de intervenção policial (MDIP: pessoas mortas por policiais civis e militares, em serviço e fora de serviço; a letalidade policial) por UF e Brasil e ano, 2016–2025. Coluna Total das tabelas "Mortes decorrentes de intervenções policiais, segundo corporação e situação" de cada edição (mapeamento em `docs/fbsp_temas.csv`, tema `mdip`), com as mesmas colunas e regras de `fbsp_mvi` (`mdip_numero`, `mdip_taxa`, edição mais recente, primeira publicação e revisão, `populacao_implicita`). As MDIP estão dentro das MVI (conferido na geração: MDIP ≤ MVI em todas as UFs e anos). Arquivo: `data/processed/fbsp_mdip/uf=<UF>/ano=<ano>/fbsp.parquet`; CSV em `data/interim/fbsp/fbsp_mdip.csv`.

## Arquivos publicados `ideb.json` e `ideb/<UF>.json`

Tela "Educação". `ideb.json`: `fonte`, `anos` (2005–2025, bienal), `etapas`, `redes`, `indicadores`, `ressalvas`, `ressalvas_por_uf`, um resumo da `conferencia`, e `ufs`/`agregados` → `etapas[etapa][rede]` com `ideb`, `nota_padronizada`, `rendimento`, `saeb_matematica`, `saeb_portugues` e `aprovacao.total`, cada um uma **lista alinhada a `anos`** (nulo = sem dado). Sem metas. `ideb/<UF>.json`: `[etapa][rede].aprovacao` com a série `total` e uma por ano/série (listas alinhadas a `anos`). Gerados por `publicacao/ideb.py` (`montar_ideb_site`).

## Arquivo publicado `violencia.json`

Tela "Violência" (e o cartão do painel do estado). `fonte`, `pagina`, `edicoes` (2018–2026), `anos` (2016–2025), `pais` (`BR`), `ultimo_ano` e `ano_sujeito_a_revisao`, `quebras_taxa` (primeiro ano de cada base nova de população da taxa: 2021 e 2023), `territorios` (com `regiao`), `ressalvas` e `linhas`: as colunas da tabela `fbsp_mvi` (sem `cod_ibge` e `populacao_implicita`) e as da letalidade policial (`mdip_numero`, `mdip_taxa`, `mdip_edicao_fonte`, `mdip_tabela_fonte`, `mdip_edicao_primeira_publicacao`, `mdip_numero_primeira_publicacao`, `mdip_revisao_numero`, de `fbsp_mdip`). O front calcula o ranking pela taxa (MVI e MDIP), o índice do número (primeiro ano = 100) e o % das MDIP nas MVI, conferidos no `gabarito.json → violencia` (`publicacao/violencia.py`).

## Arquivo publicado `despesa_ensino_superior.json`

Linhas da tabela `despesa` (formato de `despesa_funcoes.json`) com `nivel = subfuncao`, `funcao_cod = 12` (Educação), `subfuncao_cod = 364` (Ensino Superior), sem intra, DCA, das 27 UFs, em R$ nominais. Usado pela tela "Pesquisa e Inovação" ao lado da função 19; o front calcula por habitante e % do orçamento com as contas das subáreas (`indicadoresDaSubfuncao`), conferidas no `gabarito.json → ensino_superior` (`publicacao.exportar.indicadores_da_subfuncao`). UF que entregou a DCA sem a linha 12.364 entra com 0 e `sem_gasto_declarado`.

## Dicionários (`dicionarios/`)

| arquivo | origem | colunas |
|---|---|---|
| nacional/ufs.csv | manual (IBGE) | uf, cod_ibge, nome, regiao, artigo (`o`, `a` ou vazio: "o RJ", "a BA", "SP"; usado nos textos do front), capital (nome oficial; o extrator do FBSP usa para separar linha de capital de linha de UF) |
| nacional/territorios.csv | manual (IBGE) | uf, cod_ibge, nome. Territórios que não são UF: hoje só o Brasil (`BR`, `1`). Fica fora do `ufs.csv`, que é a lista das 27 UFs |
| nacional/regioes.csv | manual (IBGE) | uf (`NORTE`, `NORDESTE`, `SUDESTE`, `SUL`, `CENTRO_OESTE`; nunca a sigla de duas letras, que colide com UF: "SE"), cod_ibge (código de região do IBGE), nome. Usado pelos agregados do IBID |
| nacional/ideb_territorios.csv | manual (nomes como vêm na planilha do Inep) | nome_planilha (ex.: `R. G. do Sul`), uf (sigla da UF, `uf` da região em `regioes.csv` ou `BR`). Território fora da tabela faz o extrator do IDEB falhar |
| nacional/ibid_dimensoes.csv | manual (INPI, cabeçalho das abas anuais) | dimensao, nome, pai (vazio = topo), cabecalho_planilha (conferido pelo extrator; vazio = coluna do índice geral). Na ordem das colunas C a L |
| nacional/atividades_ibge.csv | manual (IBGE, Contas Regionais) | atividade_cod (`01` a `13`, texto), nome (texto oficial), nome_curto (tela), grande_setor (`total`, `agropecuaria`, `industria`, `servicos`) |
| nacional/entes.csv | SICONFI `/entes` | conforme a API (registrar em `fontes/siconfi.md`) (**previsto**, ainda não existe) |
| nacional/funcoes.csv | SICONFI DCA Anexo I-E em cache (script `extractors/nacional/siconfi/dicionario_funcoes.py`) | funcao_cod, funcao_nome |
| nacional/subfuncoes.csv | idem | subfuncao_cod, subfuncao_nome |
| nacional/estatais.csv | Tesouro Nacional, Raio X das Empresas dos Estados (script `extractors/nacional/tesouro_estatais.py`; ver `fontes/tesouro_estatais.md`) | uf, cod_ibge, empresa (como veio), empresa_normalizada, sigla, cnpj (14 dígitos), setor, dependente (`true`/`false`), situacao (`ATIVA`/`EM LIQUIDAÇÃO`), ano_referencia (exercício), fonte. Uma linha por empresa, UF e exercício |
| nacional/setor_funcao.csv | manual | setor (como em estatais.csv), funcao_cod (nulo quando não há correspondência clara), correspondencia (`direta`, `parcial`, `nenhuma`), justificativa |
| nacional/estatais_ajustes.csv | manual | cnpj (14 dígitos), funcao_cod, justificativa. Exceções por empresa; têm prioridade sobre `setor_funcao.csv` |
| nacional/estatais_nomes_exibicao.csv | manual | cnpj (14 dígitos), sigla_exibicao, nome_exibicao. Só exibição no front; prioridade sobre a escolha automática. O nome original continua em `estatais.csv` |
| nacional/receita_itens.csv | manual (a partir da DCA I-C, 27 UFs, 2019–2025) | item, codigo (prefixo da natureza da receita, sem os zeros finais), ano_inicio, ano_fim (vazios = sem limite). Prefixo mais longo vigente no ano decide o item; os itens "outros/outras" cobrem os grupos inteiros |
| nacional/natureza_despesa.csv | STN (MCASP) | natureza_cod, nivel, descricao (**previsto**, ainda não existe) |
| ufs/<uf>/orgaos.csv | fonte estadual | orgao_cod, orgao_nome, ano_inicio, ano_fim (**previsto**, ainda não existe) |
| ufs/<uf>/correspondencias.csv | manual | campo, cod_antigo, cod_novo, ano_mudanca, observacao (**previsto**, ainda não existe) |

## Séries de referência (`data/reference/`)

| arquivo | uso |
|---|---|
| ipca.csv | deflação: `ano`, `variacao_pct` (dez/dez, %), `indice_dez`. Fonte em `docs/fontes/ibge.md` |

A população não tem arquivo de referência: vem da tabela `populacao` (acima).

A RCL não precisa de arquivo próprio: sai do RREO Anexo 03 na tabela `demonstrativo`.
