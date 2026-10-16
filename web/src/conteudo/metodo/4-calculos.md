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

### PIB dos estados {#calculo-pib}

- **Peso de cada setor:** o valor adicionado da atividade ÷ o valor adicionado de toda a economia do estado × 100. Os grandes setores somam as atividades de cada um: agropecuária; indústria (extrativas, transformação, energia e água, construção); serviços (o resto, inclusive a administração pública). Usa valores da época, por isso o peso muda também com os preços ([entenda](#limite-pib-nominal)).
- **Participação no país:** PIB do estado ÷ PIB do Brasil no mesmo ano × 100.
- **Crescimento:** pelo índice de volume do IBGE, que mede quanto se produziu, sem o efeito dos preços. Escolhido um ano inicial, o índice vira 100 nesse ano; 110 num ano depois quer dizer que a economia produziu 10% a mais. Não usamos o IPCA aqui: o IBGE já separa preço e volume para cada atividade.

### Tendência das atividades {#calculo-tendencia}

Na tela PIB dos Estados, ao tocar numa atividade, mostramos se o peso dela na economia do estado está subindo, caindo ou estável, em quatro períodos: os últimos 3, 5 e 10 anos e a série inteira.

- **Taxa anual:** passamos uma reta pelos valores (em escala logarítmica, que mede variações proporcionais) e lemos quanto, em média, o peso muda por ano. "+2% ao ano" quer dizer que o peso cresce cerca de 2% de si mesmo a cada ano (de 10% para 10,2%), e não 2 pontos percentuais.
- **Categoria:** queda acentuada (−5% ao ano ou menos), queda leve (entre −5% e −1%), manutenção (de −1% a +1%), crescimento leve (entre +1% e +5%) e crescimento acentuado (+5% ou mais). São limites que escolhemos, não regras oficiais.
- **O que os dados confirmam:** a categoria diz o tamanho da tendência, mas não se ela é real ou fruto de oscilações. Para isso calculamos um intervalo de confiança de {{tendencia.confianca}}: se ele fica todo acima de zero, a alta está confirmada; todo abaixo, a queda; se fica todo entre −{{tendencia.margem}}% e +{{tendencia.margem}}% ao ano, a estabilidade. Fora disso, a direção é incerta, e dizemos isso.
- **Cuidado com poucos anos:** com 4 ou 6 pontos (últimos 3 ou 5 anos), qualquer conclusão é frágil, e não dá para saber se um ano influencia o seguinte. Os cards avisam.

A conta usa o peso da atividade (% do valor adicionado), não o valor em reais, que cresce com a inflação.

### IDEB: posição, variação e tendência {#calculo-ideb}

O IDEB vem pronto do Inep (aprendizado × aprovação). Nós só o ordenamos e o comparamos: a **posição** é o lugar do estado entre os 27 no mesmo ano, etapa e rede (1º = maior); a **variação** é a diferença em pontos para a edição anterior (dois anos antes); a **tendência** usa a mesma reta das atividades do PIB ([como](#calculo-tendencia)), sobre as edições do IDEB.

## tecnico

Todas as contas estão em `web/src/calculos.js` (funções puras) e espelham `analytics/` em Python. O `gabarito.json`, calculado pelo Python, cobre as 27 UFs em todos os anos e todas as funções; `npm test` confere o front contra ele (diferença relativa da ordem de 1e-16).

### Despesa por área {#calculo-despesa-area}

`despesa_funcoes.json` (total e funções das 27 UFs; subfunções em `despesa/<UF>.json`), `fonte_dado = siconfi_dca`, `nivel = funcao`, `intra = false`, estágio `liquidado` (padrão). Linhas de níveis diferentes (`total`, `funcao`, `subfuncao`, `demais`, `demais_calculado`) nunca são somadas juntas. Validação na extração: Σ funções = total (exceto intra); subfunções + demais = função. UF que entregou a DCA no ano sem a linha da função (ou com a linha sem liquidado) entra com 0 e `sem_gasto_declarado = true` (`completarComZero`; [decisão](#decisao-zero)).

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

### PIB dos estados {#calculo-pib}

- **Participação no VAB:** `vab da atividade / vab da linha nivel = total × 100`, por UF e ano; as linhas `atividade` nunca são somadas com a `total`. Grande setor (`grande_setor` em `atividades_ibge.csv`): Agropecuária = 02; Indústria = 03 a 06; Serviços = 07 a 13. Grupo com alguma atividade nula fica nulo, e o ano sai do gráfico de composição (ex.: Acre 2002). Funções: `participacao_no_vab` / `participacaoNoVab`, `setoresPorAno`.
- **Participação no país:** `pib_corrente da UF / pib_corrente de BR × 100`; posição com a regra de `ranking`. Funções: `participacao_no_pais` / `participacaoNoPais`, `participacoesNoPais`.
- **Volume:** `volume_pib_2002_100` (tab03, encadeado) rebaseado: `volume no ano / volume no ano inicial × 100`; crescimento acumulado = `(volume no fim / volume no início − 1) × 100`. Funções: `rebasear`, `crescimento_acumulado` / `crescimentoAcumulado`.
- Impostos líquidos sobre produtos = PIB − VAB (não exibidos). Valores sempre em R$ da época: o PIB não é deflacionado pelo IPCA.

### Tendência das atividades {#calculo-tendencia}

Série: participação % da atividade no VAB da UF (`participacaoNoVab`), por ano. Janelas terminando no ano escolhido: últimos N anos = de ano − N até o ano (N + 1 observações), N ∈ {3, 5, 10}, e a série completa. Módulo `src/estatistica/tendencia.js`; parâmetros em `src/estatistica/configuracao.json`.

- **Modelo:** ln Y_t = α + β·t + ε_t, β por MQO (ano centrado). Taxa anual g = 100(e^β − 1); variação acumulada G = 100(e^(β·(ano final − ano inicial)) − 1), pela distância entre os anos, não pelo número de observações. R² sobre ln Y.
- **Dados:** valores ausentes, não numéricos ou ≤ 0 (sem logaritmo) e anos repetidos ficam fora, com o motivo listado; nada é preenchido. Anos faltando no meio são avisados.
- **Inferência:** erro-padrão de MQO, intervalo t com n − 2 graus de liberdade, teste H₀: β = 0. Hipóteses: erros com média zero, variância constante, independentes e aproximadamente normais (com poucos anos, a t depende disso). Com n < {{tendencia.minimo_inferencia}}, só a estimativa pontual.
- **Autocorrelação:** com n ≥ {{tendencia.minimo_autocorrelacao}}, ρ₁ dos resíduos, Durbin–Watson e Ljung–Box Q(1). Se p < {{tendencia.nivel_autocorrelacao}}, o intervalo e o valor-p passam a usar Newey–West (Bartlett, ⌊4(n/100)^(2/9)⌋ defasagens, correção n/(n − 2), t com n − 2 gl), com aviso: é um ajuste assintótico, impreciso com 8 a 22 anos. Com menos anos a independência não é verificável, e a leitura é marcada como frágil.
- **Classificação × evidência:** a categoria vem só de g (limites na configuração: ≤ −5; (−5, −1); [−1, 1]; (1, 5); ≥ 5). A evidência vem do intervalo de {{tendencia.confianca}} de β: positiva, negativa ou inconclusiva. Manutenção é testada à parte por equivalência (TOST): intervalo de 90% de g dentro de ±{{tendencia.margem}}% ao ano. Não rejeitar β = 0 nunca é tratado como estabilidade.
- **Validação:** regressão, erros-padrão (MQO e Newey–West), intervalos, valores-p, Durbin–Watson e Ljung–Box conferidos contra o statsmodels (`src/testes/referencia_tendencia.py`), com erro relativo < 1e-9.

### IDEB: posição, variação e tendência {#calculo-ideb}

Posição: `ranking` sobre o IDEB publicado, por etapa, rede e ano, só as 27 UFs (empate com a mesma posição; nulo sem posição). Variação: IDEB(ano) − IDEB(edição anterior), em pontos. Tendência: `analisarTendencia` sobre ln IDEB das edições da janela (últimos 6 anos = 4 edições, 10 anos = 6 edições, série completa), mesmos limites e testes da tendência do PIB. Funções: `rankingIdeb`, `tendenciasDoIdeb`; espelho em `publicacao.ideb.gabarito_ideb` (`gabarito.json → ideb`).

## formulas

Notação: Σ é soma, Π é produto, ln é o logaritmo natural, e^x é a exponencial. Valores em R$ com centavos, sem arredondar, para a conta poder ser refeita.

### Despesa por área {#calculo-despesa-area}

```
despesa(uf, área, ano) = liquidado da linha com nivel = "funcao", intra = false, funcao_cod = área
despesa total(uf, ano) = Σ despesa(uf, área, ano), sobre todas as áreas
```

| Termo | De onde vem |
|---|---|
| liquidado | `despesa_funcoes.json` → `liquidado` (DCA Anexo I-E, coluna "Despesas Liquidadas") |
| nivel, intra, funcao_cod | `despesa_funcoes.json` (só linhas `nivel = funcao`, sem intraorçamentárias) |

Exemplo ({{exemplo.uf}}, {{exemplo.area}}, {{formulas.ano}}):

```
despesa  = {{formulas.despesa.liquidado}}
total    = {{formulas.despesa.total}}
```

Área sem linha na DCA de uma UF que entregou a DCA no ano: despesa = 0, marcada como "sem gasto declarado".

### Correção pela inflação {#formula-ipca}

```
I(ano) = Π (1 + IPCA_k / 100), para k do primeiro ano da série até o ano
fator(ano → base) = I(base) / I(ano) = Π (1 + IPCA_k / 100), para k de ano + 1 até base
valor real = valor da época × fator
```

| Termo | De onde vem |
|---|---|
| IPCA_k | `ipca.json` → `serie[].variacao_pct` (IBGE, SIDRA tabela 1737, dez/dez) |
| base | `meta.json` → `deflacao.ano_base_padrao` = {{anos.ano_base}} |

Exemplo (de {{exemplo_antigo.ano}} para dezembro de {{anos.ano_base}}):

```
fator = {{exemplo_antigo.produto_ipca}}
      = {{exemplo_antigo.fator}}
```

### Por habitante {#calculo-por-habitante}

```
por habitante (real) = despesa × fator(ano → base) / população(ano)
por habitante (da época) = despesa / população(ano)
```

| Termo | De onde vem |
|---|---|
| população | `despesa_funcoes.json` → `populacao` (campo da DCA no SICONFI) |

Exemplo ({{exemplo.uf}}, {{exemplo.area}}, {{exemplo_antigo.ano}}):

```
{{exemplo_antigo.valor}} × {{exemplo_antigo.fator}} = {{exemplo_antigo.real}}
{{exemplo_antigo.real}} / {{exemplo_antigo.populacao}} = {{exemplo_antigo.resultado}}
```

### Percentual do orçamento {#calculo-pct-orcamento}

```
% do orçamento = despesa(uf, área, ano) / despesa total(uf, ano) × 100
```

Exemplo ({{exemplo.uf}}, {{exemplo.area}}, {{formulas.ano}}):

```
{{formulas.despesa.liquidado}} / {{formulas.despesa.total}} × 100 = {{formulas.despesa.pct}}
```

### Posição entre os estados {#calculo-ranking}

```
posição(uf) = 1 + número de UFs com valor estritamente maior, no mesmo ano
```

Valor nulo fica sem posição e fora da contagem. Empates ficam com a mesma posição.

Exemplo ({{exemplo.area}} por habitante, real, {{formulas.ano}}): {{exemplo.uf}} tem {{formulas.despesa.per_capita_real}}. UFs com valor maior ({{formulas.despesa.maiores_quantos}}): {{formulas.despesa.maiores}}.

```
posição = 1 + {{formulas.despesa.maiores_quantos}} = {{formulas.despesa.posicao}}º de {{formulas.despesa.n_ufs}}
```

### Mediana dos estados {#calculo-mediana}

```
valores em ordem crescente: v(1) ≤ v(2) ≤ … ≤ v(n)
n ímpar: mediana = v((n + 1) / 2)
n par:   mediana = (v(n/2) + v(n/2 + 1)) / 2
```

Inclui os zeros de "sem gasto declarado"; exclui os nulos.

Exemplo ({{exemplo.area}} por habitante, real, {{formulas.ano}}, n = {{formulas.despesa.n_ufs}}, posição central {{formulas.despesa.posicao_meio}}):

```
{{formulas.despesa.vizinhos}}
mediana = {{formulas.despesa.mediana}}
```

### Variação sobre o ano anterior {#formula-variacao}

```
variação % = (total real(ano) / total real(ano − 1) − 1) × 100
```

Exemplo ({{exemplo.uf}}, despesa total):

```
({{formulas.despesa.total_real}} / {{formulas.despesa.total_real_anterior}} − 1) × 100 = {{formulas.despesa.variacao}}
```

### Receita líquida {#calculo-receita-liquida}

```
receita líquida = Σ (receita bruta − deduções), categorias 1 (correntes) e 2 (capital), sem intraorçamentárias
por habitante (real) = receita líquida × fator(ano → base) / população
% impostos próprios = impostos próprios / receita líquida × 100
% transferências da União = transferências da União / receita líquida × 100
```

| Termo | De onde vem |
|---|---|
| receita líquida | `receita.json` → `totais[].liquida_exceto_intra` (DCA Anexo I-C) |
| impostos próprios | `receita.json` → `totais[].impostos_proprios` (grupo 1.1, líquido) |
| transferências da União | `receita.json` → `totais[].transferencias_uniao` (1.7.1 + 2.4.1; até 2017, 1.7.2.1 + 2.4.2.1) |

Exemplo ({{exemplo.uf}}, {{formulas.ano}}):

```
real            = {{formulas.receita.liquida}} × {{formulas.receita.fator}} = {{formulas.receita.real}}
por habitante   = {{formulas.receita.real}} / {{formulas.receita.populacao}} = {{formulas.receita.per_capita_real}}
% impostos      = {{formulas.receita.impostos}} / {{formulas.receita.liquida}} × 100 = {{formulas.receita.pct_impostos}}
% transferências = {{formulas.receita.transferencias}} / {{formulas.receita.liquida}} × 100 = {{formulas.receita.pct_transferencias}}
```

### Dívida sobre a receita {#calculo-divida-receita}

```
DCL = dívida consolidada − deduções
DCL / RCL = DCL / RCL ajustada × 100   (RCL ajustada existe a partir de 2019; antes, RCL)
```

O site usa o percentual publicado pelo estado no relatório, sem recalcular; a conta abaixo só confere.

| Termo | De onde vem |
|---|---|
| dívida consolidada, deduções, DCL | `divida.json` → `dc`, `deducoes`, `dcl` (RGF Anexo 02, 3º quadrimestre) |
| RCL ajustada, RCL | `divida.json` → `rcl_ajustada`, `rcl` |
| percentual publicado | `divida.json` → `dcl_rcl_pct` (linha `PercentualDaDCLSobreARCL`) |

Exemplo ({{exemplo.uf}}, {{formulas.ano}}):

```
DCL = {{formulas.divida.dc}} − {{formulas.divida.deducoes}} = {{formulas.divida.dcl_calculada}}   (publicada: {{formulas.divida.dcl}})
{{formulas.divida.dcl}} / {{formulas.divida.rcl}} ({{formulas.divida.denominador}}) × 100 = {{formulas.divida.pct_calculado}}
publicado: {{formulas.divida.pct_publicado}} (duas casas)
```

### Juros e amortização {#calculo-juros-amortizacao}

```
pago = juros + amortização
pago real = pago × fator(ano → base)
```

| Termo | De onde vem |
|---|---|
| juros, amortização | `divida.json` → `juros` (natureza 3.2), `amortizacao` (4.6), liquidado, sem intraorçamentárias (DCA Anexo I-D) |

Exemplo ({{exemplo.uf}}, {{formulas.ano}}):

```
{{formulas.divida.juros}} + {{formulas.divida.amortizacao}} = {{formulas.divida.pago}}
{{formulas.divida.pago}} × {{formulas.divida.fator}} = {{formulas.divida.pago_real}}
```

### PIB dos estados {#calculo-pib}

```
% da atividade no VAB = VAB(atividade) / VAB(total das atividades) × 100
% do grande setor     = Σ VAB(atividades do setor) / VAB(total) × 100   (nulo se alguma atividade for nula)
% do PIB do país      = PIB(uf) / PIB(Brasil) × 100
volume (base b)       = volume(ano) / volume(b) × 100
crescimento b → f     = (volume(f) / volume(b) − 1) × 100
```

| Termo | De onde vem |
|---|---|
| VAB por atividade | `pib/<UF>.json` → `vab` (Conta da Produção; `atividade_cod` 01 = total) |
| PIB | `pib.json` → `linhas[].pib_corrente` (Especiais, tab01); Brasil = `uf` "BR" |
| volume | `pib.json` → `linhas[].volume_pib_2002_100` (Especiais, tab03, 2002 = 100) |

Exemplo ({{exemplo.uf}}, {{formulas.pib.ano}}):

```
{{formulas.pib.atividade}}: {{formulas.pib.vab_atividade}} / {{formulas.pib.vab_total}} × 100 = {{formulas.pib.pct_atividade}}

{{formulas.pib.setor}} ({{formulas.pib.setor_codigos}}):
{{formulas.pib.setor_partes}}
soma / {{formulas.pib.vab_total}} × 100 = {{formulas.pib.pct_setor}}

{{formulas.pib.pib_uf}} / {{formulas.pib.pib_pais}} × 100 = {{formulas.pib.pct_pais}}

volume: {{formulas.pib.volume_fim}} / {{formulas.pib.volume_desde}} × 100 = {{formulas.pib.rebase}}   (base {{formulas.pib.desde}})
crescimento {{formulas.pib.desde}}–{{formulas.pib.ano}} = {{formulas.pib.crescimento}}
```

### Tendência das atividades {#calculo-tendencia}

Série: y_t = ln(% da atividade no VAB), um ponto por ano t com valor positivo. Ano centrado: x_t = t − t̄.

```
β  = Sxy / Sxx,  Sxy = Σ x_t (y_t − ȳ),  Sxx = Σ x_t²
α  = ȳ  (valor da reta no ano médio)
g  = 100 (e^β − 1)                               taxa anual
G  = 100 (e^(β (ano final − ano inicial)) − 1)   variação acumulada
R² = 1 − SQR / SQT,  SQR = Σ e_t²,  SQT = Σ (y_t − ȳ)²,  e_t = y_t − α − β x_t
```

Incerteza:

```
s² = SQR / (n − 2)
EP(β) MQO          = √(s² / Sxx)
EP(β) Newey–West   = √( n/(n − 2) × [Σ e_t² x_t² + 2 Σ_{l=1..L} (1 − l/(L + 1)) Σ_t e_t e_{t−l} x_t x_{t−l}] ) / Sxx
                     L = ⌊4 (n/100)^(2/9)⌋, no mínimo 1
intervalo de β     = β ± t(n − 2; 0,975) × EP
intervalo de g     = 100 (e^limite − 1), para cada limite do intervalo de β
t = β / EP;  valor-p = 2 × P(T(n − 2) > |t|)
```

Autocorrelação dos resíduos (com n ≥ 8):

```
ρ₁ = Σ e_t e_{t−1} / Σ e_t²
Durbin–Watson = Σ (e_t − e_{t−1})² / Σ e_t²
Ljung–Box Q = n (n + 2) ρ₁² / (n − 1),  valor-p pela qui-quadrado com 1 grau de liberdade
se o valor-p < {{formulas.tendencia.nivel_lb}}: EP usado = Newey–West; senão, EP MQO
```

Classificação e evidência:

```
categoria pela taxa g: ≤ −5 | (−5, −1) | [−1, 1] | (1, 5) | ≥ 5 (% ao ano)
evidência: positiva se o intervalo de 95% de β > 0; negativa se < 0; senão, inconclusiva
estabilidade (TOST): β ± t(n − 2; 0,95) × EP dentro de [ln(1 − m), ln(1 + m)], m = margem
```

| Termo | De onde vem |
|---|---|
| % da atividade no VAB | `pib/<UF>.json` → `vab` da atividade / `vab` da atividade 01, × 100 |
| limites, margem, nível | `src/estatistica/configuracao.json` |

Exemplo ({{exemplo.uf}}, {{formulas.tendencia.atividade}}, {{formulas.tendencia.inicio}}–{{formulas.tendencia.fim}}):

```
n = {{formulas.tendencia.n}},  t̄ = {{formulas.tendencia.ano_medio}},  ȳ = {{formulas.tendencia.y_medio}}
Sxx = {{formulas.tendencia.sxx}},  Sxy = {{formulas.tendencia.sxy}}
β = {{formulas.tendencia.sxy}} / {{formulas.tendencia.sxx}} = {{formulas.tendencia.beta}}
g = {{formulas.tendencia.taxa}} ao ano
G = 100 (e^({{formulas.tendencia.beta}} × {{formulas.tendencia.anos_periodo}}) − 1) = {{formulas.tendencia.acumulada}}
SQR = {{formulas.tendencia.sqr}},  SQT = {{formulas.tendencia.sqt}},  R² = {{formulas.tendencia.r2}}

s² = {{formulas.tendencia.sqr}} / {{formulas.tendencia.gl}} = {{formulas.tendencia.s2}}
EP MQO = {{formulas.tendencia.ep_mqo}};  EP Newey–West (L = {{formulas.tendencia.defasagens}}) = {{formulas.tendencia.ep_nw}}
ρ₁ = {{formulas.tendencia.rho1}},  Durbin–Watson = {{formulas.tendencia.dw}}
Q = {{formulas.tendencia.q}},  valor-p = {{formulas.tendencia.p_lb}}  →  EP usado: {{formulas.tendencia.metodo}}

t({{formulas.tendencia.gl}}; 0,975) = {{formulas.tendencia.critico}}
intervalo de {{formulas.tendencia.confianca}} de β: {{formulas.tendencia.ic_beta_baixo}} a {{formulas.tendencia.ic_beta_alto}}
intervalo de {{formulas.tendencia.confianca}} de g: {{formulas.tendencia.ic_taxa_baixo}} a {{formulas.tendencia.ic_taxa_alto}} ao ano
t = {{formulas.tendencia.t}},  valor-p = {{formulas.tendencia.valor_p}}

categoria: {{formulas.tendencia.categoria}}
evidência: {{formulas.tendencia.evidencia}}
TOST: t({{formulas.tendencia.gl}}; 0,95) = {{formulas.tendencia.critico_tost}}; intervalo de 90% de g: {{formulas.tendencia.tost_baixo}} a {{formulas.tendencia.tost_alto}}; margem ±{{formulas.tendencia.margem}}%
estabilidade: {{formulas.tendencia.estabilidade}}
```

### IDEB: posição, variação e tendência {#calculo-ideb}

```
IDEB = N × P   (publicado pelo Inep; só conferido: |N × P − IDEB| ≤ 0,1)
posição(uf) = 1 + número de UFs com IDEB maior, na mesma etapa, rede e ano
variação = IDEB(ano) − IDEB(edição anterior)
```

| Termo | De onde vem |
|---|---|
| IDEB, N, P | `ideb.json` → `ufs[UF].etapas[etapa][rede].ideb`, `nota_padronizada`, `rendimento` (listas alinhadas a `anos`) |

Exemplo ({{exemplo.uf}}, {{formulas.ideb.etapa}}, rede {{formulas.ideb.rede}}, {{formulas.ideb.ano}}):

```
N × P = {{formulas.ideb.n}} × {{formulas.ideb.p}} = {{formulas.ideb.nxp}}   (publicado: {{formulas.ideb.ideb}})
posição = 1 + {{formulas.ideb.maiores}} = {{formulas.ideb.posicao}}º de {{formulas.ideb.n_ufs}}
variação = {{formulas.ideb.ideb}} − {{formulas.ideb.anterior}} ({{formulas.ideb.ano_anterior}}) = {{formulas.ideb.variacao}}
tendência {{formulas.ideb.inicio}}–{{formulas.ideb.ano}} ({{formulas.ideb.edicoes}} edições): g = {{formulas.ideb.taxa}} ao ano
```
