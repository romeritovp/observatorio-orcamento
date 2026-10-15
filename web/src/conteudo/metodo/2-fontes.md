# De onde vêm os dados {#fontes}

## simples

Todos os números vêm de fontes públicas e oficiais. Abaixo, uma ficha para cada uma: o que é, o que usamos dela, onde conferir e quando baixamos os dados pela última vez. Os estados podem corrigir o que entregaram; por isso a data importa.

### SICONFI, do Tesouro Nacional {#fonte-siconfi}

**O que é:** o sistema onde estados e municípios entregam ao Tesouro Nacional as contas do ano e os relatórios exigidos pela Lei de Responsabilidade Fiscal.

**O que usamos:**

- **Contas anuais (DCA):** quanto o estado gastou em cada área, quanto arrecadou em cada tipo de receita, quanto pagou de juros e de dívida, e a população usada nas contas por habitante. Última extração: {{fontes.siconfi.dca}}.
- **Relatório de gestão fiscal (RGF):** quanto o estado deve e a receita usada para medir o tamanho da dívida. Última extração: {{fontes.siconfi.rgf}}.
- **Relatório resumido da execução orçamentária (RREO):** não aparece no site; só usamos para conferir as contas anuais. Última extração: {{fontes.siconfi.rreo}}.

**Onde conferir:** [página do SICONFI]({{fontes.siconfi.pagina}}) · [documentação da API]({{fontes.siconfi.documentacao_api}})

### ANP: royalties do petróleo {#fonte-anp}

**O que é:** a Agência Nacional do Petróleo publica quanto cada estado recebeu de royalties e de participação especial (pagamentos das empresas que exploram petróleo e gás).

**O que usamos:** só para comparar com o que os estados declaram ao Tesouro. Os números da ANP aparecem ao lado, nunca mudam os totais do estado.

**Onde conferir:** [dados abertos da ANP]({{fontes.anp.pagina}}). Não há API: são planilhas. Última extração: {{fontes.anp.extraido_em}}.

### Raio X das Empresas dos Estados, do Tesouro Nacional {#fonte-estatais}

**O que é:** um painel anual do Tesouro com as empresas de cada estado (companhias de água, energia, transporte, bancos...), dizendo se cada uma depende do dinheiro do estado.

**O que usamos:** só o cadastro (nome, setor, se depende do estado, se está ativa). Nenhum valor em reais. Edições usadas: exercícios de {{fontes.estatais.edicoes}}.

**Onde conferir:** [painel do Tesouro]({{fontes.estatais.pagina}}) · [planilhas no GitHub]({{fontes.estatais.repositorio}}). Versão dos dados: de {{fontes.estatais.versao_de}}.

### IBGE: inflação (IPCA) {#fonte-ipca}

**O que é:** o índice oficial de inflação do país.

**O que usamos:** a inflação de cada ano, de dezembro a dezembro, para corrigir valores antigos e comparar anos diferentes.

**Onde conferir:** [tabela 1737 no SIDRA]({{fontes.ipca.pagina}}) · [documentação da API do SIDRA]({{fontes.ipca.documentacao_api}}). Última consulta: {{fontes.ipca.extraido_em}}.

### IBGE: PIB dos estados (Contas Regionais) {#fonte-pib}

**O que é:** o cálculo oficial do tamanho da economia de cada estado (o PIB) e do que ela produz em cada atividade (agropecuária, indústria, comércio, serviços públicos...).

**O que usamos:** o PIB, o valor adicionado por atividade e o crescimento da economia de cada estado e do país, de {{fontes.pib.primeiro}} a {{fontes.pib.ultimo}}, na tela [PIB dos Estados](?view=pib). Não entram em nenhuma conta do orçamento.

**Onde conferir:** [página das Contas Regionais]({{fontes.pib.pagina}}) · [arquivos da edição {{fontes.pib.edicao}}]({{fontes.pib.arquivos}}). Não há API: são planilhas. Última extração: {{fontes.pib.extraido_em}}.

### INPI: Índice Brasil de Inovação e Desenvolvimento (IBID) {#fonte-ibid}

**O que é:** um índice do INPI (Instituto Nacional da Propriedade Industrial) que compara as 27 UFs em inovação. Junta dois grupos de indicadores: o Contexto (condições para inovar) e o Resultado (o que se produz de conhecimento, tecnologia e economia criativa).

**O que usamos:** os escores (de 0 a 1) e a posição no ranking de cada estado, de {{fontes.ibid.primeiro}} a {{fontes.ibid.ultimo}}, na tela [Pesquisa e Inovação](?view=inovacao). Não entram em nenhuma conta do orçamento.

**Onde conferir:** [página do índice]({{fontes.ibid.pagina}}) · [planilha da série histórica]({{fontes.ibid.planilha}}). Não há API: é uma planilha. Última extração: {{fontes.ibid.extraido_em}}.

### Inep: Índice de Desenvolvimento da Educação Básica (IDEB) {#fonte-ideb}

**O que é:** o principal indicador de qualidade da educação básica do país, calculado pelo Inep a cada dois anos. Junta o aprendizado (notas do Saeb) e a aprovação num número de 0 a 10, para os anos iniciais e finais do fundamental e o ensino médio, por rede.

**O que usamos:** o IDEB, as notas do Saeb e as taxas de aprovação de cada estado, região e do Brasil, de {{fontes.ideb.primeiro}} a {{fontes.ideb.ultimo}}, na tela [Educação](?view=educacao). As metas do IDEB não aparecem: não são resultado.

**Onde conferir:** [página de resultados]({{fontes.ideb.pagina}}). Não há API: são planilhas. Última extração: {{fontes.ideb.extraido_em}}.

### E a população? {#fonte-populacao}

A população **não** vem direto do IBGE: usamos a que o próprio Tesouro registra nas contas anuais de cada estado (dentro do SICONFI). Ela às vezes se repete de um ano para o outro, o que pode fazer o valor por habitante dar um pequeno salto. [Entenda a decisão](#decisao-populacao).

## tecnico

Fontes nacionais, com o mesmo formato para as 27 UFs. Tudo o que chega ao site passa por `data/raw` (respostas guardadas como vieram) → `data/processed` (tabelas validadas) → `web/public/data` (JSON). As datas abaixo são a maior `extraido_em` de cada fonte, lida do `meta.json`.

### SICONFI, do Tesouro Nacional {#fonte-siconfi}

API REST do Tesouro (`{{fontes.siconfi.api}}`), paginada (`offset`, `limit`, `hasMore`), com cache em `data/raw/siconfi/<endpoint>/<cod_ibge>/`. Parâmetro de ente: `id_ente` = código IBGE da UF.

| Demonstrativo | Endpoint e parâmetros | Usado para | Última extração |
|---|---|---|---|
| DCA Anexo I-E | `/dca`, `no_anexo=DCA-Anexo I-E` | despesa por função e subfunção (empenhado, liquidado, pago) e campo `populacao` | {{fontes.siconfi.dca}} |
| DCA Anexo I-C | `/dca`, `no_anexo=DCA-Anexo I-C` | receita por natureza: bruta e deduções | {{fontes.siconfi.dca}} |
| DCA Anexo I-D | `/dca`, `no_anexo=DCA-Anexo I-D` | juros (grupo 3.2) e amortização (4.6), liquidado, modalidades exceto intra | {{fontes.siconfi.dca}} |
| RGF Anexo 02 | `/rgf`, `in_periodicidade=Q`, `nr_periodo=3`, `co_poder=E` | dívida consolidada, deduções, DCL, RCL, DCL/RCL | {{fontes.siconfi.rgf}} |
| RREO Anexos 01 e 02 | `/rreo`, `nr_periodo=6` | só conferência da DCA (não exibidos) | {{fontes.siconfi.rreo}} |

Cuidado conhecido: sem `co_poder=E`, o `/rgf` devolve zero itens, sem erro. **Onde conferir:** [página do SICONFI]({{fontes.siconfi.pagina}}) · [documentação da API]({{fontes.siconfi.documentacao_api}}).

### ANP: royalties do petróleo {#fonte-anp}

Dados abertos de participações governamentais: royalties por estado (um CSV por ano, formato largo, mensal) e participação especial por estado (`pe_estado.csv`, trimestral). Somados por **ano de caixa**, só a parcela destinada ao estado (sem municípios e sem o FEP). Tabela `compensacoes_anp`; exibida ao lado da DCA, sem alterar totais. Sem API (arquivos CSV, latin1, separador `;`). [Página da ANP]({{fontes.anp.pagina}}). Última extração: {{fontes.anp.extraido_em}}.

### Raio X das Empresas dos Estados, do Tesouro Nacional {#fonte-estatais}

Repositório `tesouro/empresas-estados`, commit fixo `{{fontes.estatais.commit}}` (de {{fontes.estatais.versao_de}}), para o resultado ser reproduzível. A pasta `vAAAA` traz o exercício AAAA−1. Usamos só colunas cadastrais (UF, nome, sigla, CNPJ, setor, dependência, situação), com o CNPJ como chave entre edições. Exercícios incorporados: {{fontes.estatais.edicoes}}. O repositório não declara licença; usamos só dados cadastrais, com atribuição. [Painel]({{fontes.estatais.pagina}}) · [repositório]({{fontes.estatais.repositorio}}).

### IBGE: inflação (IPCA) {#fonte-ipca}

SIDRA, tabela 1737, variável 2265 (variação acumulada em 12 meses, tomada em dezembro = variação dez/dez) e 2266 (número-índice, só para conferência). Consulta usada: `{{fontes.ipca.consulta}}`. [Tabela 1737]({{fontes.ipca.pagina}}) · [ajuda da API do SIDRA]({{fontes.ipca.documentacao_api}}). Última consulta: {{fontes.ipca.extraido_em}}.

### IBGE: PIB dos estados (Contas Regionais) {#fonte-pib}

Contas Regionais do Brasil, edição {{fontes.pib.edicao}} (série {{fontes.pib.primeiro}}–{{fontes.pib.ultimo}}, referência 2010), planilhas do FTP do IBGE ([arquivos]({{fontes.pib.arquivos}})), guardadas intactas com URL, data e SHA-256. Lidos: Conta da Produção (um arquivo por território, uma aba por atividade: valor bruto da produção, consumo intermediário e valor adicionado bruto, a preço corrente, e índice de volume anual) → tabela `pib_uf_atividade`; Especiais tab01 (PIB corrente), tab03 (volume do PIB, 2002 = 100) e tab04 (VAB) → tabela `pib_uf`. 27 UFs e Brasil (`uf = BR`); regiões fora. Unidade original R$ milhão, gravada em R$. Abas localizadas pela posição e conferidas pelo conteúdo (território e atividade). Conferências a cada extração: soma das atividades = total, VBP − CI = VAB, VAB da Conta = tab04, soma das UFs = Brasil. [Página do IBGE]({{fontes.pib.pagina}}). Última extração: {{fontes.pib.extraido_em}}.

### INPI: Índice Brasil de Inovação e Desenvolvimento (IBID) {#fonte-ibid}

Planilha `ibid-serie-historica.xlsx` ([arquivo]({{fontes.ibid.planilha}})), guardada intacta com URL, data e SHA-256 (`{{fontes.ibid.sha256}}`). Abas anuais (`IBID AAAA`): escores das 27 UFs, das 5 regiões e do Brasil no índice geral, nos subíndices Contexto e Resultado e nos sete pilares → tabela `ibid_escore`. Abas de série histórica: posição oficial no ranking geral, de Contexto e de Resultado → tabela `ibid_ranking`. A sigla "SE" aparece para Sergipe e para o Sudeste: os agregados são lidos pelo nome. As colunas N:O ("PIB pc R$10k") não são lidas. Conferência a cada extração: o ranking oficial é igual à ordenação dos escores em todos os anos e dimensões. Os escores das regiões e do Brasil são os do INPI e **não** são a média simples dos estados (Brasil em {{fontes.ibid.ultimo}}: índice geral publicado acima da média dos 27). O "estado típico" (`ibid.json → mediana_ufs`) é a mediana dos escores das 27 UFs em cada dimensão e ano, calculada pelo projeto (`publicacao/ibid.py`, `analytics.mediana_entre_ufs`), não pelo INPI; é ela que divide os quadrantes da dispersão. [Página do INPI]({{fontes.ibid.pagina}}). Última extração: {{fontes.ibid.extraido_em}}.

### Inep: Índice de Desenvolvimento da Educação Básica (IDEB) {#fonte-ideb}

Edição {{fontes.ideb.edicao}} (série {{fontes.ideb.primeiro}}–{{fontes.ideb.ultimo}}, formulação original de 2007), dois zips do Inep: regiões e UFs, e Brasil (o único com a rede municipal), guardados intactos com SHA-256; o MD5 publicado pelo Inep é conferido. Tabela `ideb` (formato longo: território × ano × etapa × rede × indicador × série). Colunas localizadas pelo texto do cabeçalho (linhas 7 a 9), com o código técnico da linha 10 só como conferência (na edição 2025, um código errado e um ausente, documentados em `docs/fontes/inep_ideb.md`). Notas de rodapé nos rótulos de rede viram ressalvas por linha. Conferências a cada extração: valores de controle, IDEB = N × P (±0,1) em todos os casos, amplitude. Metas extraídas e nunca publicadas no site. [Página do Inep]({{fontes.ideb.pagina}}). Última extração: {{fontes.ideb.extraido_em}}.

### E a população? {#fonte-populacao}

Campo `populacao` da resposta da DCA Anexo I-E (o mesmo valor em todos os itens da resposta), gravado na tabela `populacao`. É a população cadastrada pelo Tesouro, não necessariamente a estimativa do IBGE daquele ano: repete em alguns anos (ex.: no RJ, 2017 = 2018, 2022 = 2023 e 2024 = 2025) e pode mudar de patamar de um ano para o outro (RJ: −4,9% de 2023 para 2024). Ver [a decisão](#decisao-populacao).
