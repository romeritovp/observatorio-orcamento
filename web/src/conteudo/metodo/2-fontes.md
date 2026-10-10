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

### E a população? {#fonte-populacao}

Campo `populacao` da resposta da DCA Anexo I-E (o mesmo valor em todos os itens da resposta), gravado na tabela `populacao`. É a população cadastrada pelo Tesouro, não necessariamente a estimativa do IBGE daquele ano: repete em alguns anos (ex.: no RJ, 2017 = 2018, 2022 = 2023 e 2024 = 2025) e pode mudar de patamar de um ano para o outro (RJ: −4,9% de 2023 para 2024). Ver [a decisão](#decisao-populacao).
