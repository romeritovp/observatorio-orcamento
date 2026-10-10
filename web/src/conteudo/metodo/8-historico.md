# Histórico de versões {#historico}

## simples

Cada vez que os dados são atualizados ou uma regra muda, registramos aqui o que mudou. Os números de uma versão para outra podem mudar porque os estados corrigiram as contas ou porque mudamos uma regra; quando é uma regra, ela está em [decisões](#decisoes).

### Versão 2: série desde 2015 {#versao-2}

Outubro de 2026.

- A série passa a começar em **2015** (antes, 2019). São {{anos.quantos}} anos, de {{anos.primeiro}} a {{anos.ultimo}}.
- Nova página: **Como fazemos**, com fontes, contas, decisões e limitações.
- Royalties separados em petróleo e gás, mineração, recursos hídricos e outras compensações, com os números da ANP ao lado.
- Listas de empresas estaduais também para 2019 a 2022; anos (e estados) sem lista mostram "sem informação de estatais". Avisos de mudança de classificação para todas as empresas com área correspondente.
- O site carrega mais rápido: os dados de cada estado só são baixados quando você abre o estado.
- Avisos novos nas telas: a concessão da Cedae no RJ e o petróleo do RJ, separado só até 2017. Cada aviso tem um link "entenda" para esta página.
- Nova limitação registrada: parte do ICMS do CE em 2018 lançada num código antigo.
- **Nenhum número de 2019 a 2025 mudou** em despesa, receita total e dívida. Mudou a divisão de alguns itens da receita (royalties).

### Versão 1: 2019 a 2025 {#versao-1}

Outubro de 2026.

- Primeira versão publicada: despesa por área, receita, dívida e empresas estaduais dos 27 estados, de 2019 a 2025.
- Telas "Por estado" e "Comparar".

## tecnico

Versões dos dados publicados (`web/public/data/`). Mudança de regra sempre tem entrada em `docs/decisoes.md`.

### Versão 2: série desde 2015 {#versao-2}

Outubro de 2026. Dados extraídos até {{fontes.siconfi.extraido_em}} (SICONFI).

- Série {{anos.primeiro}}–{{anos.ultimo}} em todas as partes. IPCA 2015–2018 acrescentado. Lotes 2015–2018: DCA I-C, I-D e I-E, RGF Anexo 02, RREO Anexos 01 e 02, 108/108 cada.
- Receita: terceira codificação (até 2017) em `receita_itens.csv`; 2018 na codificação de 2019–2021; multas, juros e dívida ativa somados ao imposto até 2017; exceto intra pelas categorias 1 e 2 onde não há totais.
- Dívida: layout do RGF de 2015–2016 (composição, limite e alerta nulos).
- Despesa: regra de `demais_calculado` (não acionada); função 05 Defesa Nacional no dicionário.
- Compensações financeiras em quatro itens; tabela `compensacoes_anp` (ANP) exibida ao lado da DCA; regra dos 95% para UFs que não separam o petróleo.
- Estatais: exercícios 2019 a 2022 (v2020 a v2023 do Raio X; 2019 com setor e situação herdados de 2021); edição do exercício para cada ano; cobertura por UF (`ufs_por_edicao`); regra fixa de avisos de mudança de dependência (26); limpeza de anotações nos nomes exibidos.
- Dados divididos em arquivo geral + arquivos por UF carregados sob demanda (celular médio: 10,8 s → 6,5 s; 1.136 → 340 KB).
- Página "Como fazemos" (`?view=metodo`).
- **Invariância conferida** contra a versão 1 (commit `d5698fa`): nenhum valor de 2019–2025 mudou em despesa, totais da receita, dívida e gabarito. Diferenças esperadas: variação de 2019 sobre 2018 (antes nula), linhas zeradas da função 05 e divisão do item royalties.

### Versão 1: 2019 a 2025 {#versao-1}

Outubro de 2026 (commit `d5698fa`). Série 2019–2025: despesa (DCA I-E), receita (DCA I-C), dívida (RGF Anexo 02 e DCA I-D), estatais (Raio X, exercícios 2023 e 2024). Telas "Por estado" e "Comparar".
