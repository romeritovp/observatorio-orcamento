# Fonte: INPI, Índice Brasil de Inovação e Desenvolvimento (IBID)

> Tabelas geradas por script a partir desta fonte:
> - `ibid_escore` e `ibid_ranking`: geradas em 2026-10-14 por `uv run python -m extractors.nacional.inpi.ibid`. 27 UFs, 5 regiões e Brasil, 2014–2025, 10 dimensões; ranking oficial de geral, contexto e resultado. Conferência: ranking oficial = ordenação dos escores em 100% dos casos (0 divergências).

Fonte nacional, no mesmo formato para todas as UFs. Publicada pelo INPI (Coordenação-Geral de Economia e Inovação).

## Origem

- Página: https://www.gov.br/inpi/pt-br/inpi-data/indice-brasil-de-inovacao-e-desenvolvimento-ibid
- Planilha: https://www.gov.br/inpi/pt-br/inpi-data/indice-brasil-de-inovacao-e-desenvolvimento-ibid/ibid-serie-historica.xlsx (sem API).
- Bruto: `data/raw/inpi/ibid/ibid-serie-historica.xlsx`, intacto, com `data/raw/inpi/manifesto.json` (URL, data, tamanho, SHA-256). Download: `uv run python -m extractors.nacional.inpi.baixar` (só baixa o que falta; `--atualizar` baixa de novo). O extrator confere o SHA-256 do arquivo contra o manifesto.

## Layout

- Abas anuais `IBID AAAA` (2014 a 2025): A1 = ano; cabeçalho na linha 3 (colunas C a L: índice geral, Contexto, 5 pilares, Resultado, 2 pilares); uma linha por UF (nome, sigla, escores) e, depois, as regiões e o Brasil.
- Abas `IBID_série hist`, `IBID-contexto_série hist`, `IBID-resultado_série hist`: posição no ranking por UF (linhas) e ano (colunas, cabeçalho na linha 7). A nota "Fonte: INPI, …" está na aba do índice geral.

## Armadilhas (tratadas pelo extrator; não desfazer)

- A sigla `SE` aparece para Sergipe (UF) e para o Sudeste (região): agregados são lidos pelo **nome**. As regiões usam `NO`, `NE`, `SE`, `SU`, `CO` como sigla na planilha.
- As colunas N:O das abas anuais trazem um "PIB pc (R$10k)" auxiliar, sem fonte nem unidade clara: não são lidas (o PIB do projeto vem do IBGE).
- Os escores das regiões e do Brasil **não** são a média simples das UFs (Brasil 2014: 0,2945 publicado × 0,2428 média dos 27): o INPI calcula o índice para o território. A tela os chama de "escore da região/do país", nunca de média.

## Comparabilidade

A média do Brasil fica entre 0,29 e 0,30 em toda a série, o que sugere normalização anual. Até confirmação do INPI, `config/ibid.yaml → escores_comparaveis_entre_anos: false`: evolução só por posição, escores só no mesmo ano (ver `docs/decisoes.md`).

## Saída original do extrator

`data/nacional/inpi/ibid.json` foi gerado pela versão original do extrator (fornecida pelo usuário), antes da integração. O `web/public/data/ibid.json` montado pelo pipeline (`publicacao/ibid.py`) é idêntico a ele, em conteúdo e em texto com `indent=1`, exceto `fonte.extraido_em` e a chave acrescentada depois, `mediana_ufs` (o "estado típico", calculado pelo projeto).
