# As decisões que tomamos {#decisoes}

## simples

Para transformar as contas dos estados em números comparáveis, tivemos de fazer escolhas. Outras escolhas seriam possíveis, e algumas mudariam os resultados. Por isso, listamos cada uma: o que decidimos, por quê e o que muda nos números.

### Só o governo do estado, sem as prefeituras {#decisao-so-estado}

**O que decidimos:** mostrar só o que o governo estadual arrecada, gasta e deve.

**Por quê:** é o que os estados declaram ao Tesouro de forma igual para os 27. Juntar as prefeituras exigiria somar as contas de mais de 5.500 municípios, com o cuidado de não contar duas vezes o dinheiro que o estado repassa a elas.

**O que muda nos números:** o gasto de um estado numa área parece baixo quando são as prefeituras que cuidam de boa parte dela. Isso acontece muito em saúde e educação, e a divisão de tarefas muda de estado para estado. O número daqui é o do governo estadual, não o de "tudo o que se gasta no estado".

### O gasto é o "liquidado" {#decisao-liquidado}

**O que decidimos:** contar como gasto a despesa **liquidada**: o serviço foi prestado ou o produto foi entregue naquele ano.

**Por quê:** o "empenhado" inclui o que foi só reservado e talvez nunca entregue; o "pago" depende de quando o dinheiro saiu do caixa e empurra contas de dezembro para o ano seguinte. O liquidado é o retrato mais fiel do que o ano entregou.

**O que muda nos números:** pouco, na maioria das áreas. Exemplo: em 2025, o RJ empenhou R$ 10,93 bi em saúde, liquidou R$ 10,73 bi e pagou R$ 10,20 bi. Atenção: os mínimos que a Constituição exige em saúde e educação seguem outra regra, e este site não mede se eles foram cumpridos.

### Fora os pagamentos entre órgãos do próprio estado {#decisao-intra}

**O que decidimos:** deixar de fora as despesas "intraorçamentárias", que são pagamentos de um órgão do estado para outro órgão do mesmo estado ([o que são](#termo-intraorcamentaria)).

**Por quê:** se a Secretaria de Saúde paga a contribuição de previdência dos seus servidores ao fundo de previdência do estado, e o fundo depois paga as aposentadorias, o mesmo dinheiro apareceria duas vezes.

**O que muda nos números:** em alguns estados, muito. Na saúde do RJ, essas despesas passaram de 8% (2019) para 26% (2025) do gasto da área. Com elas, o RJ subiria no ranking de gasto por habitante em saúde: em 2024, de 27º para 21º; em 2025, de 27º para 23º. Sem elas (o padrão do site), o RJ fica entre os que menos gastam em todos os anos de 2019 a 2025, em qualquer das duas versões, mas "o último" depende dessa escolha.

### Valores corrigidos pela inflação de dezembro a dezembro {#decisao-inflacao}

**O que decidimos:** corrigir os valores antigos pelo IPCA, do IBGE, até dezembro do ano mais recente ({{anos.ano_base}}), usando a inflação de dezembro a dezembro de cada ano.

**Por quê:** sem a correção, um gasto que só acompanhou a inflação parece um aumento.

**O que muda nos números:** cada real de {{anos.primeiro}} vale {{exemplo_antigo.fator}} reais de dezembro de {{anos.ano_base}}. A conta completa está em [refaça a conta](#refaca-a-conta). Na tela, "valores da época" mostra os números sem correção.

### A população é a que o Tesouro registra {#decisao-populacao}

**O que decidimos:** dividir pelo número de habitantes que o Tesouro registra nas contas de cada estado, e não pela estimativa anual do IBGE.

**Por quê:** é o número que acompanha as próprias contas, igual para todos os estados e anos.

**O que muda nos números:** essa população às vezes se repete de um ano para o outro e depois dá um salto. No RJ, 2022 e 2023 têm o mesmo número; em 2024, a população cai 4,9%. Só por isso, o gasto por habitante do RJ sobe cerca de 5% em 2024, sem que o gasto tenha mudado.

### Por habitante e em % do orçamento, sempre juntos {#decisao-normalizar}

**O que decidimos:** comparar estados sempre por habitante **e** pelo peso da área no orçamento, e mostrar a mediana dos estados como referência.

**Por quê:** o "por habitante" favorece estados pequenos (os custos fixos, como uma secretaria ou um hospital de referência, se dividem por poucas pessoas). O "% do orçamento" não depende da população e mostra a prioridade que o estado dá à área.

**O que muda nos números:** um estado pode estar no fim de um ranking e no meio do outro. Exemplo: em 2015, o RJ era o 20º em gasto por habitante em saúde e o 26º em % do orçamento.

### Quem não declarou gasto entra com zero {#decisao-zero}

**O que decidimos:** se um estado entregou as contas do ano mas não tem gasto numa área, ele entra com **zero**, com um aviso "sem gasto declarado".

**Por quê:** sem isso, o estado sumiria da comparação, e um ano teria 27 estados e o outro 25.

**O que muda nos números:** a comparação é sempre entre os 27. O zero quer dizer "não declarou", não "não gastou nada": o gasto pode estar em outra área ou numa empresa estadual (é o caso comum do saneamento).

### Empresas estaduais: só aviso, nunca soma {#decisao-estatais}

**O que decidimos:** listar as empresas de cada estado e avisar quando uma empresa que **não depende** do dinheiro do estado atua na área, sem mudar nenhum número.

**Por quê:** as contas do estado só incluem as empresas que dependem do orçamento estadual. Uma companhia de água com receita própria, por exemplo, não aparece no gasto com saneamento. Não temos como somar os gastos delas sem contar coisas em dobro.

**O que muda nos números:** nada. Muda a leitura: um estado com gasto baixo em saneamento pode ter uma companhia estadual que faz esse trabalho. No ranking, esses estados aparecem marcados com ◆.

### A lista de empresas de cada ano {#decisao-estatais-edicao}

**O que decidimos:** cada ano usa a lista de empresas daquele ano, publicada pelo Tesouro. Anos sem lista mostram "sem informação de estatais para este ano".

**Por quê:** empresas são criadas, vendidas e fechadas. A Sabesp, de São Paulo, foi privatizada em 2024: ela aparece de 2019 a 2023 e some em 2024.

**O que muda nos números:** nada nos valores. Há listas para os anos de {{fontes.estatais.edicoes}}. A lista de 2018 não identifica as empresas de um jeito que permita ligá-las às outras, e por isso 2015 a 2018 ficam sem informação; também ficam sem informação o AP em 2019 e 2020 e o MA em 2019, que faltam nas listas do Tesouro. Em 2019, o setor e a situação de cada empresa vêm da lista de 2021 (a de 2019 não traz esses dados de forma comparável), e a tela marca isso com †.

### Quando uma empresa passa a depender do estado {#decisao-quebra-dependencia}

**O que decidimos:** quando o Tesouro muda a classificação de uma empresa (de independente para dependente, ou o contrário), o gráfico marca o ano da mudança com uma linha tracejada e uma nota.

**Por quê:** os gastos de uma empresa dependente passam a entrar nas contas do estado, o que pode fazer a série saltar sem que o estado tenha gastado mais.

**O que muda nos números:** nada nos valores; só o aviso, que aparece para toda empresa com área correspondente, com ou sem efeito visível. Exemplo: em 2024, a Gaspisa (gás do Piauí) passou a dependente, e o gasto do Piauí com energia por habitante foi de R$ 2,10 para R$ 20,12. Em outros casos o gasto não muda, ou muda no sentido contrário; algumas empresas mudam de classificação quase todo ano. Por isso a frase do aviso é cautelosa: as contas não dizem qual empresa gastou.

### Receita: o que fica com o estado {#decisao-receita-liquida}

**O que decidimos:** mostrar a receita **líquida**: o que entrou menos a parte dos municípios e a parte do FUNDEB.

**Por quê:** uma parte do ICMS e do IPVA nunca fica com o estado: vai por lei para as prefeituras e para o fundo da educação básica. Contar essa parte como receita do estado exageraria o que ele tem para gastar.

**O que muda nos números:** a receita líquida é bem menor que a arrecadação. O quadro "para onde vai o imposto" mostra, para o ICMS e o IPVA, quanto foi arrecadado e quanto ficou com o estado.

### Receitas: códigos que mudaram {#decisao-recodificacao}

**O que decidimos:** juntar, em cada item da receita, os códigos antigos e os novos, porque a classificação mudou em 2018 e em 2022.

**Por quê:** sem isso, o ICMS de 2021 e o de 2022 estariam em linhas diferentes, e a série teria um salto falso.

**O que muda nos números:** os itens principais (ICMS, IPVA, FPE, FUNDEB) seguem sem salto. Itens pequenos ("outras...") podem mudar de composição na troca de classificação.

### Royalties e compensações: comparar pelo valor bruto {#decisao-compensacoes}

**O que decidimos:** separar as compensações em petróleo e gás, mineração, recursos hídricos e outras, e compará-las entre estados pelo valor **bruto**, antes do repasse aos municípios.

**Por quê:** cada estado registra o repasse aos municípios de um jeito (uns descontam, outros não). Pelo valor líquido, estaríamos comparando registros diferentes.

**O que muda nos números:** alguns estados aparecem com mais royalties do que na receita líquida. Exemplo: o ES descontou R$ 100 milhões de petróleo em 2024.

### Petróleo: a ANP ao lado, sem mexer no total {#decisao-petroleo-anp}

**O que decidimos:** mostrar, ao lado do que o estado declara, quanto a ANP diz ter repassado em royalties e participação especial. Os totais do estado não mudam.

**Por quê:** alguns estados não separam o petróleo nas contas (o RJ, a partir de 2018). A ANP permite ver quanto deveria estar lá.

**O que muda nos números:** nada nos totais. Quando o valor da ANP fica entre 95% e 100% da linha "demais receitas patrimoniais" do estado, dizemos que essa linha contém os royalties; fora disso, mostramos os dois números lado a lado, sem conciliar.

### Dívida: o número oficial do relatório {#decisao-divida-indicador}

**O que decidimos:** usar o percentual de dívida sobre a receita que o próprio estado publica, sem refazer a conta, e o limite legal fixo (200%) no gráfico.

**Por quê:** é o número oficial, usado para verificar o limite da lei. Refazê-lo criaria uma segunda versão "nossa".

**O que muda nos números:** às vezes o relatório tem pequenas diferenças internas: no RJ em 2024, a linha oficial diz 211,32% e outra parte do mesmo relatório diz 211,23%. Usamos a oficial. Alguns relatórios declaram um limite diferente do legal (o CE declarou zero de 2019 a 2022); a tabela mostra o declarado, o gráfico mostra o legal.

### Dívida: tipos, só a partir de 2017 {#decisao-divida-composicao}

**O que decidimos:** mostrar com quem é a dívida (União, bancos do país, bancos de fora, parcelamentos...) só a partir de 2017.

**Por quê:** até 2016, o relatório separava a dívida só em "interna" e "externa", sem os tipos usados depois.

**O que muda nos números:** em 2015 e 2016, o quadro "com quem é a dívida" fica vazio, com uma nota. O total da dívida e o percentual sobre a receita continuam disponíveis.

### Juros e amortização pela natureza da despesa {#decisao-juros}

**O que decidimos:** medir o que foi pago de dívida pelos códigos de juros e de amortização das contas anuais, sem os pagamentos entre órgãos do estado.

**Por quê:** as subáreas de "encargos da dívida" são usadas de jeitos diferentes por cada estado; os códigos de natureza são iguais para todos.

**O que muda nos números:** em 2019, alguns estados registraram como pagamento comum o que outro relatório trata como pagamento entre órgãos. No RJ, as contas anuais mostram R$ 924,9 milhões pagos naquele ano, e o outro relatório, R$ 696,6 milhões. Em 2020, a lei suspendeu pagamentos de dívida com a União, e o valor pago daquele ano não é comparável.

### Série desde 2015 {#decisao-serie-2015}

**O que decidimos:** estender a série para começar em 2015, juntando as três formas de classificar receitas (até 2017, de 2018 a 2021 e de 2022 em diante).

**Por quê:** uma série mais longa permite ver tendências, inclusive a crise fiscal de 2015 e 2016.

**O que muda nos números:** até 2017, multas, juros e dívida ativa de cada imposto foram somados ao próprio imposto, como já acontece na classificação atual. No ICMS do RJ, isso soma 2,7% em 2015. O adicional do ICMS para os fundos de combate à pobreza só aparece separado a partir de 2018. Os números de 2019 a 2025 não mudaram com a extensão.

## tecnico

Seleção das entradas de `docs/decisoes.md` que afetam o que o site mostra. Entradas de infraestrutura (cache, formato de arquivos, metatags) ficam de fora. Cada item cita a entrada original.

### Só o governo do estado, sem as prefeituras {#decisao-so-estado}

**Decisão:** universo = ente estadual no SICONFI (`co_esfera = E`; no RGF, `co_poder = E`). **Por quê:** comparabilidade entre as 27 UFs com uma única fonte. **Efeito:** a despesa estadual por função não mede o gasto total na UF; transferências a municípios entram na função de destino, a execução municipal com recursos próprios não. **Referência:** «2026-10-08 — SICONFI como fonte principal» e «Vieses do per capita estadual e medida complementar».

### O gasto é o "liquidado" {#decisao-liquidado}

**Decisão:** estágio padrão `liquidado` (DCA I-E, coluna `Despesas Liquidadas`). **Por quê:** o empenhado inclui o que vira resto a pagar não processado; o pago depende do caixa. **Efeito:** RJ, função 10, 2025: empenhado R$ 10,93 bi, liquidado R$ 10,73 bi, pago R$ 10,20 bi. Mínimos constitucionais (LC 141/2012, art. 212 da CF) têm regra própria (restos a pagar, exclusões) e não são medidos aqui. **Referência:** «2026-10-08 — Despesa executada padrão é o liquidado».

### Fora os pagamentos entre órgãos do próprio estado {#decisao-intra}

**Decisão:** `intra = false` em todas as contas. A DCA I-E traz as intraorçamentárias numa linha agregada, sem detalhe por função; o RREO Anexo 02 detalha. **Por quê:** dupla contagem (ex.: contribuição patronal ao RPPS, repasses a entidades do próprio orçamento). **Efeito:** peso das intra na função 10, média 2019–2025: MG 23,9%, DF 17,9%, RJ 16,7%, RS 13,0%, PE 11,3%; a maioria abaixo de 5%. RJ: de 8,0% (2019) a 26,3% (2025). Posição do RJ no por habitante real, sem → com intra: 2019 27º→24º, 2020 27º→25º, 2021 24º→23º, 2022 23º→21º, 2023 27º→26º, 2024 27º→21º, 2025 27º→23º. "Grupo de menor gasto" é robusto; "último" não é. **Referência:** «2026-10-08 — Robustez da Saúde às intraorçamentárias (RREO Anexo 02)».

### Valores corrigidos pela inflação de dezembro a dezembro {#decisao-inflacao}

**Decisão:** IPCA dez/dez (SIDRA 1737, v2265), índice encadeado de `variacao_pct`, base dez/{{anos.ano_base}}; o gasto do ano é tratado como a preços de dezembro daquele ano. **Por quê:** comparação real entre anos com uma série oficial e simples de reproduzir. **Efeito:** fator {{anos.primeiro}} → {{anos.ano_base}} = {{exemplo_antigo.fator}}. O IPCA médio anual daria valores reais um pouco diferentes. Estoques de dívida (31/dez) usam o mesmo fator. **Referência:** «2026-10-08 — Deflação pelo IPCA dez/dez e população do SICONFI».

### A população é a que o Tesouro registra {#decisao-populacao}

**Decisão:** população = campo `populacao` da DCA I-E (tabela `populacao`). **Por quê:** acompanha a declaração, cobre todas as UFs e anos. **Efeito:** repete em alguns anos e muda de patamar (RJ: 2017 = 2018, 2022 = 2023, 2024 = 2025; −4,9% de 2023 para 2024, o que sozinho eleva o por habitante em ~5,1%), gerando saltos artificiais. Trocar pela estimativa do IBGE seria uma nova `fonte_dado` na tabela `populacao`. **Referência:** «2026-10-08 — Deflação pelo IPCA dez/dez e população do SICONFI».

### Por habitante e em % do orçamento, sempre juntos {#decisao-normalizar}

**Decisão:** toda comparação entre UFs é normalizada (por habitante ou % da despesa total) e vem acompanhada da mediana; valores totais em R$ não são ranqueados. **Por quê:** dois vieses do por habitante: escala (custos fixos em UFs pequenas; AP, RR e AC lideram) e divisão de responsabilidades com os municípios. **Efeito:** RJ, função 10, 2015: 20º por habitante real, 26º em % do orçamento. **Referência:** «2026-10-08 — Vieses do per capita estadual e medida complementar».

### Quem não declarou gasto entra com zero {#decisao-zero}

**Decisão:** UF que entregou a DCA no ano (tem alguma linha `nivel = funcao`) sem linha na função, ou com a linha sem valor no estágio, entra com 0 e `sem_gasto_declarado = true`; UF sem DCA no ano fica fora do universo. Igual no Python (`analytics.completar_com_zero`) e no front (`completarComZero`). **Por quê:** universo constante de 27 UFs no ranking e na mediana. **Efeito:** o zero entra na posição (empatado no fim) e na mediana; a tela lista os estados nessa situação. **Referência:** «2026-10-08 — Ausência de linha numa função = gasto zero».

### Empresas estaduais: só aviso, nunca soma {#decisao-estatais}

**Decisão:** o cadastro de estatais (Raio X do Tesouro) nunca altera valores; gera avisos para estatais ativas, não dependentes e com função correspondente ao setor (`setor_funcao.csv`, com `correspondencia` direta/parcial/nenhuma; exceções por CNPJ em `estatais_ajustes.csv`). **Por quê:** a operação de estatais não dependentes não está no orçamento fiscal e da seguridade; somá-la exigiria dados que não temos e criaria dupla contagem com os aportes. **Efeito:** nenhum valor muda; ◆ no ranking. **Referência:** «2026-10-08 — Estatais: só informativo; ajustes por empresa» e «Correspondência setor da estatal → função orçamentária».

### A lista de empresas de cada ano {#decisao-estatais-edicao}

**Decisão:** para cada ano, a edição do Raio X daquele exercício (`edicaoParaAno`: a mais recente que não passa do ano); ano anterior à primeira edição, ou UF ausente da edição (`ufs_por_edicao`, `edicaoDaUf`) → sem informação. Exercícios incorporados: {{fontes.estatais.edicoes}}. Exercício 2019: setor e situação herdados da edição de 2021 pelo mesmo UF e CNPJ (`campos_herdados`, `herdado_de`), dependência da própria edição; 9 linhas sem CNPJ válido descartadas. Exercício 2018 (v2019, sem CNPJ): não incorporado. **Por quê:** privatizações e extinções (Sabesp, privatizada em 2024: presente de 2019 a 2023). **Efeito:** sem informação até 2018, AP em 2019 e 2020, MA em 2019. **Referência:** «2026-10-10 — Estatais 2019 e 2020; regra fixa para mudanças de dependência».

### Quando uma empresa passa a depender do estado {#decisao-quebra-dependencia}

**Decisão:** regra fixa: toda mudança de dependência entre edições consecutivas, em empresa com função, gera linha tracejada no gráfico e nota atribuída ao Tesouro (`mudancasDeDependencia`, `avisoQuebraSerie`), com ou sem efeito visível na despesa. **Por quê:** a classificação muda o perímetro do orçamento; julgar caso a caso exigiria saber qual empresa gastou, o que a DCA não informa. **Verificação** (só registro): liquidado sem intra por habitante, R$ de dez/{{anos.ano_base}}, na função, ano anterior → ano da mudança, contra a variação mediana dos outros estados. Efeito visível = afastamento de 30 pontos ou mais no sentido esperado; "sentido contrário" = 10 pontos ou mais no sentido oposto. 26 mudanças: 10 com efeito visível, 6 sem, 9 em sentido contrário, 1 não testável. **Referência:** «2026-10-08 — Quebra de série por mudança de dependência de estatal» e «2026-10-10 — Estatais 2019 e 2020; regra fixa para mudanças de dependência».

| Edições | Empresa (UF) | Função | Mudança | Por habitante (posição) | Variação | Mediana | Efeito visível? |
|---|---|---|---|---|---|---|---|
| 2019→2020 | METROFOR (CE) | 26 Transporte | passou a dependente | R$ 178,29 → R$ 164,36 (8º → 11º) | −7,8% | +2,2% | não |
| 2019→2020 | COHAB (ES) | 16 Habitação | deixou de ser dependente | R$ 1,08 → R$ 1,43 (24º → 23º) | +31,7% | −16,0% | não (sentido contrário) |
| 2019→2020 | CETURB (ES) | 26 Transporte | passou a dependente | R$ 225,24 → R$ 335,37 (6º → 4º) | +48,9% | +1,5% | **sim** |
| 2019→2020 | AGEHAB (GO) | 16 Habitação | passou a dependente | R$ 0,00 → R$ 0,00 (26º → 27º) | – | −11,7% | não testável (sem gasto antes) |
| 2019→2020 | METROBUS (GO) | 26 Transporte | passou a dependente | R$ 30,63 → R$ 49,69 (26º → 23º) | +62,2% | +1,5% | **sim** |
| 2019→2020 | Codapar (PR) | 20 Agricultura | passou a dependente | R$ 63,18 → R$ 86,71 (10º → 8º) | +37,2% | −3,9% | **sim** |
| 2020→2021 | METROFOR (CE) | 26 Transporte | deixou de ser dependente | R$ 164,36 → R$ 165,44 (11º → 13º) | +0,7% | +39,3% | **sim** |
| 2020→2021 | COHAB (ES) | 16 Habitação | passou a dependente | R$ 1,43 → R$ 1,94 (23º → 21º) | +36,2% | −1,1% | **sim** |
| 2020→2021 | CETURB (ES) | 26 Transporte | deixou de ser dependente | R$ 335,37 → R$ 314,60 (4º → 6º) | −6,2% | +39,3% | **sim** |
| 2020→2021 | Gaspisa (PI) | 25 Energia | deixou de ser dependente | R$ 0,26 → R$ 0,19 (11º → 11º) | −24,0% | +28,8% | **sim** |
| 2020→2021 | PORTO PIAUI (PI) | 26 Transporte | passou a dependente | R$ 155,76 → R$ 214,87 (12º → 11º) | +38,0% | +39,3% | não |
| 2020→2021 | CODERTE (RJ) | 26 Transporte | passou a dependente | R$ 45,36 → R$ 72,17 (25º → 25º) | +59,1% | +38,6% | não |
| 2020→2021 | DERSA (SP) | 26 Transporte | passou a dependente | R$ 289,65 → R$ 294,20 (5º → 7º) | +1,6% | +39,3% | não (sentido contrário) |
| 2021→2022 | METROFOR (CE) | 26 Transporte | passou a dependente | R$ 165,44 → R$ 211,14 (13º → 19º) | +27,6% | +74,7% | não (sentido contrário) |
| 2021→2022 | COHAB (ES) | 16 Habitação | deixou de ser dependente | R$ 1,94 → R$ 2,98 (21º → 24º) | +53,6% | +62,3% | não |
| 2021→2022 | CETURB (ES) | 26 Transporte | passou a dependente | R$ 314,60 → R$ 362,32 (6º → 12º) | +15,2% | +74,7% | não (sentido contrário) |
| 2021→2022 | CASEGO (GO) | 20 Agricultura | deixou de ser dependente | R$ 28,46 → R$ 22,35 (23º → 27º) | −21,5% | +43,0% | **sim** |
| 2021→2022 | METAGO (GO) | 22 Indústria | deixou de ser dependente | R$ 0,00 → R$ 0,09 (25º → 25º) | +2.900,7% | +30,4% | não (sentido contrário) |
| 2021→2022 | EMSERH (MA) | 10 Saúde | deixou de ser dependente | R$ 570,08 → R$ 574,98 (26º → 25º) | +0,9% | +5,9% | não |
| 2021→2022 | CAEMA (MA) | 17 Saneamento | passou a dependente | R$ 3,09 → R$ 85,13 (22º → 3º) | +2.653,5% | +19,6% | **sim** |
| 2022→2023 | METROFOR (CE) | 26 Transporte | deixou de ser dependente | R$ 211,14 → R$ 171,09 (19º → 21º) | −19,0% | −11,3% | não |
| 2022→2023 | CETURB (ES) | 26 Transporte | deixou de ser dependente | R$ 362,32 → R$ 464,66 (12º → 5º) | +28,2% | −11,8% | não (sentido contrário) |
| 2022→2023 | EPC (PB) | 24 Comunicações | deixou de ser dependente | R$ 7,15 → R$ 10,34 (11º → 12º) | +44,5% | +20,9% | não (sentido contrário) |
| 2022→2023 | PORTO PIAUI (PI) | 26 Transporte | deixou de ser dependente | R$ 303,42 → R$ 391,79 (13º → 8º) | +29,1% | −11,8% | não (sentido contrário) |
| 2023→2024 | Gaspisa (PI) | 25 Energia | passou a dependente | R$ 2,10 → R$ 20,12 (6º → 3º) | +857,2% | +53,9% | **sim** |
| 2023→2024 | Metrô (SP) | 26 Transporte | passou a dependente | R$ 443,11 → R$ 473,77 (6º → 8º) | +6,9% | +21,3% | não (sentido contrário) |

METROFOR/CE, CETURB/ES e COHAB/ES mudam de classificação quase todo ano, e o gasto não acompanha: a oscilação parece ser da classificação informada ao Tesouro.

### Receita: o que fica com o estado {#decisao-receita-liquida}

**Decisão:** padrão = receita líquida das deduções (bruta − transferências constitucionais aos municípios − FUNDEB − outras), exceto intra (categorias 7 e 8). A bruta aparece só no destino dos impostos. **Por quê:** é o que fecha com o RREO Anexo 01 e o que o estado pode gastar. **Efeito:** I-C líquida exceto intra = RREO Anexo 01 em 175 de 189 combinações em 2019–2025 e em 76 de 108 em 2015–2018; as diferenças são declarações divergentes do mesmo ente ([limitações](#limite-rreo-dca)). **Referência:** «2026-10-08 — Receita: fonte, itens, padrão de exibição e anomalias».

### Receitas: códigos que mudaram {#decisao-recodificacao}

**Decisão:** `receita_itens.csv` mapeia por prefixo, com vigência (`ano_inicio`, `ano_fim`), três codificações da natureza da receita: até 2017 (7 segmentos), 2018–2021 e 2022 em diante. Cada linha vale pelo valor próprio e cai no prefixo mais longo. **Por quê:** continuidade dos itens. **Efeito:** nenhum código sem item; soma dos itens = total da I-C em todas as UF-anos. Itens centrais sem salto na troca; itens residuais podem mudar de composição. **Referência:** «2026-10-08 — Receita…» e «2026-10-10 — Série estendida para 2015–2025».

### Royalties e compensações: comparar pelo valor bruto {#decisao-compensacoes}

**Decisão:** quatro itens (petróleo e gás, incluindo FEP; mineração/CFEM; recursos hídricos; outras compensações), comparados pela receita bruta (`comparar_pela_bruta` em `receita.json`). **Por quê:** ES, RN, SE, AL, BA, PR, MT e CE deduzem parte do petróleo; os demais não. **Efeito:** ES deduziu R$ 100 mi de petróleo em 2024. **Referência:** «2026-10-08 — Compensações financeiras: quatro itens, comparação pela bruta».

### Petróleo: a ANP ao lado, sem mexer no total {#decisao-petroleo-anp}

**Decisão:** tabela `compensacoes_anp` (royalties + participação especial destinados ao estado, por ano de caixa) exibida ao lado da DCA. Comparação justa = DCA sem o FEP declarado × ANP. Regra dos 95%: onde a UF não separa o petróleo, se ANP ÷ "Demais receitas patrimoniais" (1.3.9) estiver entre 95% e 100%, a linha é descrita como contendo os repasses; senão, lado a lado (`reconciliacaoPetroleo`). **Por quê:** a DCA de algumas UFs não identifica o petróleo. **Efeito:** RJ: reconcilia em 2022, 2023 e 2024; não em 2019, 2020 e 2021; 2025 sem total da ANP (participação especial em dados abertos só até nov/2024). Em 2015–2017, DCA sem FEP ÷ ANP fica entre 90% e 110% em 26 de 33 UF-anos com repasse da ANP. **Referência:** «2026-10-08 — ANP ao lado da DCA; regra dos 95%…».

### Dívida: o número oficial do relatório {#decisao-divida-indicador}

**Decisão:** DCL/RCL = linha `PercentualDaDCLSobreARCL` do RGF Anexo 02, sem recálculo; limite legal fixo (200%, alerta 180%) no gráfico e limite declarado na tabela. **Por quê:** número oficial do controle da LRF. **Efeito:** RJ 2024: 211,32% na linha oficial × 211,23% na trajetória de retorno do mesmo relatório. Limite declarado ≠ legal: CE 2019–2022 = 0; RR = 90% em todos os anos; SP 2025 = 170%; MS 2024 = 200,8%. DCL negativa é possível (caixa maior que a dívida). **Referência:** «2026-10-08 — Dívida: fontes, indicador e o que fica fora».

### Dívida: tipos, só a partir de 2017 {#decisao-divida-composicao}

**Decisão:** composição por tipo (reestruturação, internos, externos, parcelamentos, precatórios, outras; soma = DC, conferida) só no layout do RGF a partir de 2017; em 2015–2016 (dívida contratual só interna/externa, `rgf.layout_antigo`), composição, limite e alerta ficam nulos. **Por quê:** categorias não comparáveis. **Efeito:** 54 UF-anos sem composição; DC, deduções, DCL, RCL e DCL/RCL completos. **Referência:** «2026-10-10 — Série estendida para 2015–2025».

### Juros e amortização pela natureza da despesa {#decisao-juros}

**Decisão:** DCA I-D, grupos 3.2 e 4.6, liquidado, soma das modalidades `DO` (a linha do grupo inclui as modalidades intra). **Por quê:** as subfunções 841–844 batem com a natureza em só 43 de 189 combinações; cada UF as usa de um jeito. **Efeito:** I-D = RREO Anexo 01 em 178 de 189 (2019–2025) e 77 de 106 (2015–2018). Em 2019, alguns estados lançaram amortização intra na modalidade 90 (RJ: I-D R$ 924,9 mi × RREO R$ 696,6 mi; mantida a I-D). 2020: pagamentos à União suspensos (LC 173/2020). **Referência:** «2026-10-08 — Dívida: fontes, indicador e o que fica fora».

### Série desde 2015 {#decisao-serie-2015}

**Decisão:** ano inicial único {{anos.primeiro}}. DCA I-C até 2018 sem totais exceto/intra: exceto intra pelas categorias 1 e 2, validado 1 + 2 + 7 + 8 = total. Até 2017, multas, juros e dívida ativa somados ao imposto de origem (código identifica o imposto). FECP só separado a partir de 2018 (antes, fora da linha do ICMS). DCA I-E 2015–2016 sem "Demais subfunções": regra de `demais_calculado`, não acionada (subfunções somam a função nas 27 UFs). **Efeito:** ICMS bruto do RJ com multas, juros e dívida ativa: +2,7% em 2015, +2,0% em 2016, +1,4% em 2017; PE: +1,3%, +2,9%, +1,3%. Nenhum valor de 2019–2025 mudou (conferido contra a versão publicada). **Referência:** «2026-10-10 — Série estendida para 2015–2025» e «Invariância 2019–2025 e desempenho da extensão».
