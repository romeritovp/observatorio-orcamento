# Glossário {#glossario}

## simples

### Despesa liquidada {#termo-liquidado}

Gasto reconhecido como entregue: o serviço foi prestado ou o produto foi recebido. É a medida de gasto usada no site. Antes dela vem o **empenho** (o dinheiro é reservado para uma compra); depois, o **pagamento** (o dinheiro sai do caixa).

### Despesa intraorçamentária {#termo-intraorcamentaria}

Pagamento de um órgão do estado para outro órgão do mesmo estado. Exemplo: a Secretaria de Saúde paga ao fundo de previdência do estado a contribuição dos seus servidores. Fica fora das contas do site para não contar o mesmo dinheiro duas vezes.

### Área e subárea (função e subfunção) {#termo-subfuncao}

As **áreas** do orçamento (saúde, educação, segurança...) são definidas por lei e iguais para todos os estados. Cada área se divide em **subáreas**: saúde, por exemplo, em atenção básica, assistência hospitalar, vigilância sanitária. "Demais subfunções" é o que o estado gastou na área fora das subáreas listadas.

### Receita líquida {#termo-receita-liquida}

O que o estado arrecadou menos o que ele é obrigado a repassar: a parte dos municípios nos impostos estaduais e a parte que vai para o FUNDEB.

### FUNDEB {#termo-fundeb}

Fundo da educação básica. Parte do ICMS, do IPVA e de outras receitas de cada estado vai para ele e volta para o estado e os municípios conforme o número de alunos. Por isso aparece duas vezes: como desconto na receita e como "FUNDEB, retorno".

### Royalties e participação especial {#termo-royalties}

Pagamentos que as empresas de petróleo e gás fazem ao governo pela exploração. Parte vai para a União, parte para estados e municípios, conforme a produção.

### FEP {#termo-fep}

Fundo Especial do Petróleo: uma parte dos royalties que o Tesouro reparte entre todos os estados, produtores ou não. Por isso estados sem petróleo também recebem algum valor.

### Operações de crédito {#termo-operacoes-de-credito}

Empréstimos que o estado toma. Entram como receita no ano, mas são dívida nova, a ser paga depois.

### Dívida consolidada {#termo-divida-consolidada}

Tudo o que o estado deve com prazo de pagamento acima de um ano: empréstimos, renegociações com a União, parcelamentos, precatórios vencidos e não pagos.

### Dívida consolidada líquida (DCL) {#termo-dcl}

A dívida consolidada menos o dinheiro que o estado tem em caixa e a receber. É a medida usada pela Lei de Responsabilidade Fiscal.

### Receita corrente líquida (RCL) {#termo-rcl}

A receita do ano usada pela Lei de Responsabilidade Fiscal como régua: tira da receita do dia a dia o que vai para os municípios e algumas outras parcelas. A dívida líquida não pode passar de 200% dela.

### Juros e amortização {#termo-juros-amortizacao}

O que o estado pagou pela dívida no ano. **Juros** são o custo do empréstimo; **amortização** é a devolução do valor emprestado.

### Estatal dependente e não dependente {#termo-estatal-dependente}

Uma empresa do estado é **dependente** quando precisa do dinheiro do estado para pagar salários e despesas do dia a dia; aí os gastos dela entram nas contas do estado. A **não dependente** vive da própria receita (como uma companhia de água que cobra tarifa), e os gastos dela não aparecem nas contas do estado.

### Inflação de dezembro a dezembro (IPCA) {#termo-ipca}

Quanto os preços subiram de dezembro de um ano a dezembro do seguinte, segundo o IBGE. É o que usamos para corrigir valores antigos.

### Valores corrigidos e valores da época {#termo-valores-corrigidos}

**Corrigidos:** valores antigos atualizados pela inflação até dezembro do ano mais recente, para comparar anos diferentes. **Da época:** os valores como foram registrados naquele ano.

### Mediana {#termo-mediana}

O valor do meio quando todos os estados são postos em ordem: metade fica acima, metade abaixo.

### DCA, RREO e RGF {#termo-dca-rreo-rgf}

Os três documentos de contas que os estados entregam ao Tesouro. **DCA** (Declaração de Contas Anuais): as contas do ano fechado. **RREO** (Relatório Resumido da Execução Orçamentária): a execução do orçamento a cada dois meses. **RGF** (Relatório de Gestão Fiscal): dívida e outros limites da Lei de Responsabilidade Fiscal, a cada quatro meses.

## tecnico

### Despesa liquidada {#termo-liquidado}

Segundo estágio da despesa (Lei 4.320/1964, art. 63): verificação do direito do credor, com base nos documentos que comprovam a entrega. Estágios: empenho → liquidação → pagamento. Na DCA I-E, coluna `Despesas Liquidadas`. Empenhado e não liquidado no fim do ano vira resto a pagar não processado; liquidado e não pago, resto a pagar processado.

### Despesa intraorçamentária {#termo-intraorcamentaria}

Despesa entre órgãos, fundos e entidades integrantes dos orçamentos fiscal e da seguridade do mesmo ente, com a receita correspondente no outro lado (modalidade de aplicação 91; receitas nas categorias 7 e 8). Na DCA I-E aparece só como linha agregada (`Despesas Intraorçamentárias`, `intra = true`); no RREO Anexo 02, por função.

### Área e subárea (função e subfunção) {#termo-subfuncao}

Classificação funcional (Portaria MOG 42/1999): função (2 dígitos, ex.: 10 Saúde) e subfunção (3 dígitos, ex.: 302 Assistência Hospitalar e Ambulatorial), comum a todos os entes. Na DCA I-E: `"10 - Saúde"` (função), `"10.302 - ..."` (subfunção), `"FU10 - Demais Subfunções"` (resto). Níveis no site: `total`, `funcao`, `subfuncao`, `demais`, `demais_calculado`; nunca somados entre si. Programa, ação e órgão não são comparáveis entre UFs e não são usados.

### Receita líquida {#termo-receita-liquida}

Receita bruta realizada − deduções (transferências constitucionais e legais aos municípios, FUNDEB, outras), das categorias 1 e 2 (exceto intra). DCA Anexo I-C.

### FUNDEB {#termo-fundeb}

Fundo de Manutenção e Desenvolvimento da Educação Básica (EC 108/2020; antes, EC 53/2006). A contribuição do estado (20% de ICMS, IPVA, ITCMD, FPE e outras) aparece como dedução da receita; o retorno, pelo número de matrículas, como transferência (`fundeb_retorno`); a complementação da União, em item próprio. Não somar dedução e retorno.

### Royalties e participação especial {#termo-royalties}

Compensações financeiras pela exploração de petróleo e gás (Lei 7.990/1989 e Lei 9.478/1997): royalties (mensais, sobre a produção) e participação especial (trimestral, em campos de grande volume). Na DCA, transferências (1.7.1.8.02.3 a .6 em 2018–2021; 1.7.1.2.52 a partir de 2022; 1.7.2.1.22.30 a .70 até 2017) ou receita patrimonial (1.3.4 até 2017). Na ANP, só a parcela do estado, por ano de caixa.

### FEP {#termo-fep}

Fundo Especial do Petróleo: parcela dos royalties distribuída pelo Tesouro a todos os estados e municípios. Códigos: 1.7.2.1.22.70 (até 2017), 1.7.1.8.02.6 (2018–2021), 1.7.1.2.52.4 (2022 em diante). A ANP por estado não inclui o FEP; a DCA inclui.

### Operações de crédito {#termo-operacoes-de-credito}

Receitas de capital (2.1) de empréstimos e financiamentos contratados. Entram na receita orçamentária do ano e aumentam a dívida consolidada.

### Dívida consolidada {#termo-divida-consolidada}

Montante total das obrigações com prazo de amortização superior a 12 meses (LRF, art. 29, I), no RGF Anexo 02: dívida mobiliária, contratual (empréstimos, financiamentos, reestruturação com a União, parcelamentos), precatórios posteriores a 05/05/2000 vencidos e não pagos, outras. Fora dela, no mesmo anexo: passivo atuarial, RP não processados, depósitos judiciais, PPP.

### Dívida consolidada líquida (DCL) {#termo-dcl}

DC − deduções (disponibilidade de caixa e haveres financeiros, líquidos dos restos a pagar processados). Pode ser negativa. Linha `DividaConsolidadaLiquida` do RGF Anexo 02.

### Receita corrente líquida (RCL) {#termo-rcl}

Receitas correntes deduzidas das transferências constitucionais e legais aos municípios, da contribuição dos servidores ao RPPS e de outras parcelas (LRF, art. 2º, IV). Para os limites de endividamento, a RCL ajustada (linha do RGF a partir de 2019). Limite da DCL: 200% (Resolução do Senado nº 40/2001); alerta: 90% do limite.

### Juros e amortização {#termo-juros-amortizacao}

Grupos de natureza da despesa 3.2 (juros e encargos da dívida) e 4.6 (amortização da dívida), DCA Anexo I-D, liquidado, soma das modalidades exceto intra.

### Estatal dependente e não dependente {#termo-estatal-dependente}

Empresa controlada que recebe do ente recursos para pessoal, custeio ou capital, excluídos os de aumento de participação acionária (LRF, art. 2º, III): dependente, integra o orçamento fiscal e da seguridade. Classificação do Raio X do Tesouro, informada pelos estados.

### Inflação de dezembro a dezembro (IPCA) {#termo-ipca}

IPCA, SIDRA 1737, variável 2265 em dezembro (variação acumulada em 12 meses). Índice encadeado a partir dessa variação.

### Valores corrigidos e valores da época {#termo-valores-corrigidos}

Corrigidos: `nominal × I(base)/I(ano)`, base = dezembro do último ano da série. Da época: nominal (fator = 1). O % do orçamento é igual nas duas versões.

### Mediana {#termo-mediana}

Mediana dos valores não nulos entre as UFs no ano; com número par de valores, média dos dois centrais. Inclui os zeros de "sem gasto declarado".

### DCA, RREO e RGF {#termo-dca-rreo-rgf}

Demonstrativos entregues no SICONFI: DCA (Declaração de Contas Anuais, LRF art. 51), RREO (bimestral, LRF arts. 52–53) e RGF (quadrimestral ou semestral, LRF arts. 54–55; no caso dos estados, por poder). Este site usa DCA I-C, I-D e I-E, RGF Anexo 02 (3º quadrimestre, Executivo) e, para conferência, RREO Anexos 01 e 02 (6º bimestre).
