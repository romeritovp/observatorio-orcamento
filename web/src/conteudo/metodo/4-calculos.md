# Como cada número é calculado {#calculos}

## simples

### Despesa por área {#calculo-despesa-area}

É o que o estado gastou em cada área do orçamento (saúde, educação, segurança...) no ano, na etapa "liquidada": o serviço foi prestado ou o produto entregue ([o que é liquidado](#termo-liquidado)). As áreas são as mesmas para todos os estados, definidas por lei, o que permite comparar. Cada área se divide em subáreas (por exemplo, saúde em atenção básica, hospitais...). Se um estado não declarou gasto numa área, ele aparece com zero e com um aviso ([por quê](#decisao-zero)).

Ficam de fora os pagamentos entre órgãos do próprio estado, para não contar o mesmo dinheiro duas vezes ([entenda](#decisao-intra)).

### Por habitante {#calculo-por-habitante}

O gasto da área dividido pela população do estado. Serve para comparar estados de tamanhos diferentes. Por padrão, os valores de anos antigos são corrigidos pela inflação até dezembro do ano mais recente, para que R$ 100 de {{anos.primeiro}} e R$ 100 de hoje não pareçam a mesma coisa. Você pode trocar para "valores da época" na tela. O passo a passo está em [refaça a conta](#refaca-a-conta).

### Percentual do orçamento {#calculo-pct-orcamento}

Quanto a área pesa no total que o estado gastou no ano: gasto da área ÷ soma do gasto em todas as áreas × 100. Não muda com a inflação nem com a população, por isso é um bom complemento ao "por habitante" ([por que usamos os dois](#decisao-normalizar)).

### Posição entre os estados {#calculo-ranking}

Os 27 estados são ordenados do maior para o menor valor; o 1º é o que mais gasta. Estados empatados ficam com a mesma posição. Quem não declarou gasto na área entra com zero e fica no fim. A posição só é calculada para números comparáveis: por habitante ou em % do orçamento, nunca o valor total em reais.

### Mediana dos estados {#calculo-mediana}

O valor do meio quando os 27 estados são postos em ordem: metade gasta mais, metade gasta menos. Usamos a mediana, e não a média, porque um ou dois estados muito diferentes não a puxam.

### Receita líquida {#calculo-receita-liquida}

O que o estado arrecadou no ano (impostos, transferências da União, royalties, empréstimos...) **menos** o que ele é obrigado a repassar: a parte dos municípios nos impostos estaduais e a parte que vai para o FUNDEB ([o que é](#termo-fundeb)). É o dinheiro que de fato fica com o estado. Também mostramos o peso dos impostos do próprio estado e das transferências da União nessa receita.

### Dívida sobre a receita {#calculo-divida-receita}

Quanto o estado deve, descontado o dinheiro que ele tem em caixa e a receber ([dívida consolidada líquida](#termo-dcl)), dividido pela receita do ano usada pela Lei de Responsabilidade Fiscal ([receita corrente líquida](#termo-rcl)). Não refazemos essa conta: usamos o percentual que o próprio estado publica no relatório oficial. O limite legal é 200%; acima de 180%, o estado entra em alerta.

### Juros e amortização {#calculo-juros-amortizacao}

Quanto o estado pagou no ano pela dívida: **juros** (o custo do empréstimo) e **amortização** (a devolução do valor emprestado). Vêm das contas anuais, na etapa "liquidada", sem os pagamentos entre órgãos do próprio estado ([por quê](#decisao-juros)).

## tecnico

Todas as contas estão em `web/src/calculos.js` (funções puras) e espelham `analytics/` em Python. O `gabarito.json`, calculado pelo Python, cobre as 27 UFs em todos os anos e todas as funções; `npm test` confere o front contra ele (diferença relativa da ordem de 1e-16).

### Despesa por área {#calculo-despesa-area}

`despesa.json`, `fonte_dado = siconfi_dca`, `nivel = funcao`, `intra = false`, estágio `liquidado` (padrão). Linhas de níveis diferentes (`total`, `funcao`, `subfuncao`, `demais`, `demais_calculado`) nunca são somadas juntas. Validação na extração: Σ funções = total (exceto intra); subfunções + demais = função. UF que entregou a DCA no ano sem a linha da função (ou com a linha sem liquidado) entra com 0 e `sem_gasto_declarado = true` (`completarComZero`; [decisão](#decisao-zero)).

### Por habitante {#calculo-por-habitante}

```
real(t) = nominal(t) × I(base) / I(t)
por habitante = real(t) / população(t)
```

`I` encadeado da `variacao_pct` (IPCA dez/dez) de `ipca.json`; base = {{anos.ano_base}} (`meta.deflacao.ano_base_padrao`). Com "valores da época", `fator = 1`. População: campo `populacao` da DCA ([decisão](#decisao-populacao)). Funções: `indiceEncadeado`, `fatorDeflacao`, `deflacionar`, `perCapita`.

### Percentual do orçamento {#calculo-pct-orcamento}

```
% do orçamento = liquidado(função) / Σ liquidado(todas as funções da UF no ano) × 100
```

Denominador: soma das linhas `nivel = funcao`, sem intra (igual à linha `total` exceto intra, validada na extração). Nas subáreas, o denominador continua sendo o orçamento total da UF, para que a soma das subáreas dê o % da área. Função: `participacao`.

### Posição entre os estados {#calculo-ranking}

`posição = 1 + número de UFs com valor estritamente maior`, por ano: empates ficam com a melhor posição; valor nulo fica sem posição e fora do `n_ufs`. Os zeros de "sem gasto declarado" entram e ficam empatados no fim. Só sobre medidas normalizadas (por habitante real e da época, % do orçamento). Função: `ranking`.

### Mediana dos estados {#calculo-mediana}

Mediana dos valores não nulos entre as UFs no ano (média dos dois centrais quando o número é par), incluindo os zeros de "sem gasto declarado". Funções: `mediana`, `medianaPorAno`.

### Receita líquida {#calculo-receita-liquida}

DCA Anexo I-C. Para cada linha, o valor próprio (valor − filhos diretos) é atribuído ao item de prefixo de código mais longo vigente no ano (`receita_itens.csv`). Receita líquida exceto intra = Σ (bruta − deduções) das categorias 1 (correntes) e 2 (capital); categorias 7 e 8 são intraorçamentárias. Deduções: transferências constitucionais aos municípios, FUNDEB e outras. Impostos próprios = grupo 1.1 (líquido); transferências da União = 1.7.1 + 2.4.1 (até 2017, 1.7.2.1 + 2.4.2.1). Por habitante real: mesmo fator do IPCA. Posições: por habitante real e % de impostos próprios. Função: `indicadoresReceita`.

### Dívida sobre a receita {#calculo-divida-receita}

RGF Anexo 02, 3º quadrimestre, poder Executivo, linha oficial `PercentualDaDCLSobreARCL` (DCL ÷ RCL ajustada para os limites de endividamento, linha que o relatório traz a partir de 2019; antes, DCL ÷ RCL), **sem recálculo**. Conferido na extração: DC − deduções = DCL e, em cada nível, soma das subcontas = conta-mãe. Limite legal fixo: 200% da RCL (Resolução do Senado nº 40/2001), alerta em 180% (90% do limite, LRF art. 59). A tabela mostra também o limite **declarado** no relatório, que às vezes diverge do legal. Posição e mediana com as mesmas regras acima. Função: `indicadoresDivida`.

### Juros e amortização {#calculo-juros-amortizacao}

DCA Anexo I-D, coluna `Despesas Liquidadas`: juros e encargos = grupo de natureza 3.2; amortização = 4.6. Exceto intra = soma das modalidades `DO` do grupo (a linha do grupo inclui as modalidades intra `DI…91`). Grupo ausente = 0; UF/ano sem I-D = nulo. Valores reais com o mesmo fator do IPCA. Função: `indicadoresDivida` (`pago = juros + amortizacao`).
