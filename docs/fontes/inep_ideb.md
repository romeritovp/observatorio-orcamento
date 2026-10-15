# Fonte: Inep, Índice de Desenvolvimento da Educação Básica (IDEB)

> Tabela gerada por script a partir desta fonte:
> - `ideb`: gerada em 2026-10-14 por `uv run python -m extractors.nacional.inep.ideb`, edição 2025 (série 2005–2025, 11 edições), 27 UFs, 5 regiões e Brasil, 3 etapas, 44.651 valores. JSON de saída completo: `data/nacional/inep/ideb.json` (`uv run python -m publicacao.ideb`). No site: `web/public/data/ideb.json` e `ideb/<UF>.json` (sem metas), gerados por `publicacao.exportar`, tela "Educação".

Fonte nacional, no mesmo formato para todas as UFs. **Formulação original de 2007**: 2025 é a última edição nela; o Inep criou um grupo técnico para atualizar o índice (a edição de 2027 pode mudar a metodologia).

## Origem

- Página: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados (links carregados por JavaScript; não dá para raspar).
- Arquivos (padrão de URL conferido para 2023 e 2025): `https://download.inep.gov.br/ideb/resultados/<arquivo>_<edicao>.zip`, com `divulgacao_regioes_ufs_ideb` (27 UFs e 5 regiões) e `divulgacao_brasil_ideb` (o país). Cada zip tem a planilha em `.xlsx` e `.ods` e um `md5_*.txt` do Inep; o extrator confere o MD5 da planilha lida e o SHA-256 do zip contra o manifesto.
- Brutos: `data/raw/inep/ideb/<edicao>/` (zips intactos e extraídos), com `data/raw/inep/manifesto.json`. Download: `uv run python -m extractors.nacional.inep.baixar`.
- **Certificado:** `download.inep.gov.br` não envia o certificado intermediário (RNP ICPEdu GR46 OV TLS CA 2025). O `baixar.py` busca o intermediário no endereço indicado no próprio certificado e o usa só para montar a cadeia até uma raiz do `certifi`, com a cadeia parcial desligada. A verificação nunca é desligada. Se o Inep trocar de certificado, conferir `URL_INTERMEDIARIO`.

## Layout

Uma aba por etapa (`UF e Regiões (AI|AF|EM)`; no arquivo do Brasil, `Brasil (Anos Iniciais|Anos Finais|EM)`); título da etapa em A4. Cabeçalho nas linhas 7 a 9, com mesclagens: linha 7 = bloco ("Taxa de Aprovação - 2025", "Nota SAEB - 2025", "IDEB\n2025\n(N x P)", "Metas do 1º ciclo..."); linha 8 = disciplina do Saeb; linha 9 = série da aprovação ou ano da meta. Linha 10 = código técnico (`VL_APROVACAO_2025_SI_4`, `VL_OBSERVADO_2025`...). Dados a partir da linha 11: território (A), rede (B). Notas de rodapé abaixo dos dados.

Redes: nas UFs e regiões, Total, Estadual, Pública e Privada (ensino médio: Total, Estadual e Privada); **a rede Municipal só existe no arquivo do Brasil**. Séries da aprovação: anos iniciais 1º a 5º, anos finais 6º a 9º, médio 1ª a 4ª (a 4ª só em parte das UFs), além do total.

## Armadilhas (tratadas pelo extrator)

- **Colunas pelo texto do cabeçalho**, nunca pela posição; o código técnico só confere. Dois problemas do código na edição 2025:
  - `UF e Regiões (AI)`, coluna CA: o P de 2025 está rotulado `VL_INDICADOR_REND_2023`. A coluna está no bloco "Taxa de Aprovação - 2025" e os valores são de 2025; o N × P de 2025 confere. Erro conhecido, listado em `CODIGOS_COM_ERRO`.
  - `Brasil (Anos Finais)`, coluna DG: IDEB 2023 sem código. Lido pelo cabeçalho; registrado.
- **Ano com nota colada** no cabeçalho: "20215" = 2021 + nota 5 (pandemia). Lê-se `20\d\d`.
- **Nomes abreviados** ("R. G. do Norte", "R. G. do Sul", "M. G. do Sul"): tabela fixa `dicionarios/nacional/ideb_territorios.csv`; nome fora dela é erro. Regiões e Brasil também pelo nome (lição do "SE" do IBID).
- **Notas no rótulo da rede** ("Privada (1)", "Total (3)(4)"): a numeração muda entre abas e arquivos, então o texto de cada nota é lido do rodapé da própria aba e vira ressalva da linha (`ressalvas_por_uf` no JSON). Notas da edição 2025: 2009 só com escolas urbanas; 2009 sem escolas privadas; 2009 não calculado por perda amostral; 2011 sem escolas federais.
- **Ausentes:** "-" (a única marca que aparece) e "ND" viram nulo, nunca 0. Vírgula decimal é aceita, mas não aparece: os números já vêm como número.
- **Metas** (2007–2021) gravadas com `indicador = meta`; 2023 e 2025 sem meta oficial (nada projetado). Não exibir.

## Conferências (edição 2025)

- **Valores de controle de 2025:** 7 de 7 conferem: RS estadual 6,4, 5,4 e 4,7; médio total PR 5,1, PI 5,0, ES 4,9 e RS 4,9.
- **IDEB = N × P:** 4.000 combinações conferidas, nenhuma fora de ±0,1 (maior diferença: 0,05, arredondamento).
- **Amplitude:** IDEB e N entre 0 e 10, P entre 0 e 1, aprovação entre 0 e 100. Nenhum fora.
- **Cobertura:** 27 UFs × 3 etapas × 11 edições por rede; 22 combinações de UF, etapa e rede com algum ano sem IDEB:
  - privada, 2009, nas 7 UFs do Norte, nas 3 etapas (21): nota "perda amostral";
  - RR, estadual, anos iniciais, 2017 a 2025: há aprovação, mas não Saeb nem IDEB (provável efeito da municipalização dos anos iniciais; não confirmado).
- Relatório completo em `data/processed/ideb_fonte.json` e no bloco `conferencia` do JSON de saída.

## Cuidados de leitura

- 2021: pandemia (aprovação inflada, menor participação no Saeb).
- Ensino médio: Saeb amostral até 2017, censitário para escolas públicas a partir de 2019 (possível quebra 2017 → 2019).
- Notas Saeb e IDEB não se comparam entre etapas (escalas diferentes).
- DF: a rede "estadual" é a distrital, e não há rede municipal.
