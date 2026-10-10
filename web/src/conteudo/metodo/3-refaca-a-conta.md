# Refaça a conta você mesmo {#refaca-a-conta}

## simples

Vamos refazer, com uma calculadora, um número que aparece no site: **quanto o governo {{exemplo.do_uf}} gastou em {{exemplo.area_minuscula}} por habitante em {{exemplo.ano}}**. Na tela, ele aparece como **{{exemplo.resultado_tela}}**. Todos os valores abaixo saem dos mesmos dados que o site usa.

### Passo 1: o gasto, direto da fonte {#conta-passo-gasto}

Abra este link do Tesouro Nacional (ele devolve um arquivo de texto com as contas do estado):

[contas de {{exemplo.ano}} {{exemplo.do_uf}} no SICONFI]({{exemplo.link_api}})

Procure o trecho em que aparece **"{{exemplo.conta}}"** junto de **"{{exemplo.coluna}}"**. O número ao lado (em "valor") é o que o estado gastou na área naquele ano: **{{exemplo.valor}}**.

"Liquidada" quer dizer que o serviço foi prestado ou o produto foi entregue naquele ano ([o que é despesa liquidada](#termo-liquidado)).

### Passo 2: a inflação de cada ano {#conta-passo-inflacao}

Para comparar anos diferentes, o site corrige os valores pela inflação até dezembro de {{anos.ano_base}}. Como {{exemplo.ano}} é o próprio ano mais recente, **não há inflação a descontar**:

{{exemplo.tabela_ipca}}

Isso fica mais claro com um ano antigo. Para o gasto de {{exemplo_antigo.ano}}, a inflação de cada ano seguinte, segundo o IBGE ([tabela do IPCA]({{fontes.ipca.pagina}})), é:

{{exemplo_antigo.tabela_ipca}}

### Passo 3: o fator de correção {#conta-passo-fator}

Multiplique os números da última coluna. Em {{exemplo.ano}}, não há nada a multiplicar: o fator é **{{exemplo.fator}}**.

Para {{exemplo_antigo.ano}}: {{exemplo_antigo.produto_ipca}} = **{{exemplo_antigo.fator}}**. Ou seja, cada real gasto em {{exemplo_antigo.ano}} vale {{exemplo_antigo.fator}} reais de dezembro de {{anos.ano_base}}. (O site usa o fator com todas as casas decimais; com quatro casas, a sua conta pode diferir em alguns centavos.)

### Passo 4: a população {#conta-passo-populacao}

No mesmo arquivo do passo 1, cada linha traz também a população do estado ("populacao"): **{{exemplo.populacao}}** pessoas em {{exemplo.ano}}. É a população que o Tesouro registra ([por que não a do IBGE](#decisao-populacao)).

### Passo 5: a divisão {#conta-passo-divisao}

Gasto × fator ÷ população:

{{exemplo.valor}} × {{exemplo.fator}} ÷ {{exemplo.populacao}} = **{{exemplo.resultado}}** por habitante.

Arredondado, é o **{{exemplo.resultado_tela}}** que aparece na tela.

> **E em {{exemplo_antigo.ano}}?** O estado gastou {{exemplo_antigo.valor}} ([link da fonte]({{exemplo_antigo.link_api}})) para {{exemplo_antigo.populacao}} habitantes. Corrigido: {{exemplo_antigo.valor}} × {{exemplo_antigo.fator}} = {{exemplo_antigo.real}}. Por habitante: **{{exemplo_antigo.resultado}}**.

## tecnico

Reprodução do indicador **despesa liquidada por habitante, a preços de dezembro de {{anos.ano_base}}**, para {{exemplo.uf}} (código IBGE {{exemplo.cod_ibge}}), função {{exemplo.funcao_cod}} ({{exemplo.area}}), exercício {{exemplo.ano}}. Os valores desta seção são gerados no navegador a partir de `despesa.json` e `ipca.json`, com `passosPorHabitante` (`calculos.js`), que usa as mesmas funções da tela; um teste confere que o resultado é igual ao de `indicadoresDaFuncao` (o número da tela) e ao `gabarito.json` (calculado em Python por `analytics/`). Valor exibido na tela: **{{exemplo.resultado_tela}}**.

### Passo 1: o gasto, direto da fonte {#conta-passo-gasto}

Requisição à API do SICONFI:

```
GET {{exemplo.link_api}}
```

Na resposta (`items`), a linha com `conta = "{{exemplo.conta}}"` e `coluna = "{{exemplo.coluna}}"` traz `valor` = **{{exemplo.valor}}** (R$ nominais). É a linha de nível função (`nivel = funcao`), fora das intraorçamentárias, que a DCA I-E não detalha por função. Linhas `"{{exemplo.funcao_cod}}.xxx - ..."` são subfunções e `"FU{{exemplo.funcao_cod}} - Demais Subfunções"` é o resto da função: não somar com a linha da função ([níveis](#termo-subfuncao)).

### Passo 2: a inflação de cada ano {#conta-passo-inflacao}

IPCA, variação dez/dez (SIDRA 1737, v2265; [tabela]({{fontes.ipca.pagina}})), dos anos posteriores ao exercício até o ano base {{anos.ano_base}}. Para {{exemplo.ano}}: anos = {{exemplo.anos_ipca}}.

{{exemplo.tabela_ipca}}

Para comparação, o primeiro ano da série, {{exemplo_antigo.ano}} (anos {{exemplo_antigo.anos_ipca}}):

{{exemplo_antigo.tabela_ipca}}

### Passo 3: o fator de correção {#conta-passo-fator}

```
I(t) = Π (1 + v(k)/100), para k do primeiro ano da série até t
fator(t → base) = I(base) / I(t) = Π (1 + v(k)/100), para k = t+1 … base
```

{{exemplo.ano}}: fator = **{{exemplo.fator}}** (produto vazio). {{exemplo_antigo.ano}}: {{exemplo_antigo.produto_ipca}} = **{{exemplo_antigo.fator}}**. O índice é encadeado a partir de `variacao_pct`, não do número-índice publicado (`indice_dez`), cujo arredondamento difere; é o mesmo método do Python (`analytics.deflacionar`). O gasto do ano é tratado como se estivesse a preços de dezembro daquele ano.

### Passo 4: a população {#conta-passo-populacao}

Campo `populacao` da mesma resposta (igual em todos os itens): **{{exemplo.populacao}}**. É a população cadastrada no SICONFI, não a estimativa anual do IBGE ([decisão](#decisao-populacao)).

### Passo 5: a divisão {#conta-passo-divisao}

```
por habitante = valor × fator ÷ população
              = {{exemplo.valor}} × {{exemplo.fator}} ÷ {{exemplo.populacao}}
              = {{exemplo.resultado}}
```

Exibido sem centavos: **{{exemplo.resultado_tela}}**. O mesmo indicador entra na [posição e na mediana](#calculo-ranking) entre as 27 UFs.

> **{{exemplo_antigo.ano}}:** `valor` = {{exemplo_antigo.valor}} ([requisição]({{exemplo_antigo.link_api}})); × {{exemplo_antigo.fator}} = {{exemplo_antigo.real}}; ÷ {{exemplo_antigo.populacao}} = **{{exemplo_antigo.resultado}}**.
