# O que é este site e o que ele não é {#o-que-e}

## simples

Este site mostra **quanto cada governo estadual arrecada, gasta e deve**, ano a ano, de {{anos.primeiro}} a {{anos.ultimo}}. Ele junta, num lugar só, números que os próprios estados entregam ao Tesouro Nacional, e faz as contas que permitem comparar um estado com outro.

### O que você encontra aqui {#o-que-e-encontra}

- **Por estado:** de onde vem o dinheiro de um estado, para onde ele vai, quanto o estado deve e quais empresas ele controla.
- **Comparar:** os 27 estados lado a lado numa área (saúde, educação, segurança...), por habitante ou em % do orçamento.
- **Como fazemos:** esta página. Explica de onde vem cada número e como ele é calculado, e permite refazer as contas.

### O que este site não é {#o-que-e-nao-e}

- **Não mostra as prefeituras.** Só o governo do estado. O que os municípios gastam com dinheiro próprio fica de fora, então o gasto total com saúde dentro de um estado é maior do que o número daqui. [Entenda por quê](#decisao-so-estado).
- **Não é uma auditoria.** Os números são os que cada estado **declarou** ao Tesouro Nacional. Não conferimos nota fiscal por nota fiscal. Quando dois relatórios do mesmo estado não batem, dizemos isso (veja [limitações](#limitacoes)).
- **Não é uma avaliação de qualidade.** Gastar mais não quer dizer gastar melhor. O site mostra quanto, não se o dinheiro foi bem usado.
- **Não é tempo real.** Os dados são anuais e só chegam depois que o ano fecha e o estado entrega as contas. Um estado pode corrigir o que entregou, e por isso guardamos a data em que cada dado foi baixado (veja [de onde vêm os dados](#fontes)).

### Por que de {{anos.primeiro}} a {{anos.ultimo}} {#o-que-e-periodo}

Começamos em {{anos.primeiro}}: daí em diante temos, para os 27 estados, todas as contas que o site usa. Terminamos em {{anos.ultimo}}, o último ano com contas entregues. Entre esses anos, a forma de registrar as receitas mudou duas vezes (em 2018 e em 2022); juntamos as classificações para a série não ter saltos falsos, e avisamos onde a comparação pede cuidado ([veja a decisão](#decisao-serie-2015)).

## tecnico

Visualização das contas dos **governos estaduais** (27 UFs, o ente estadual como declarado na DCA; a dívida, como no RGF, é a do poder Executivo), {{anos.primeiro}}–{{anos.ultimo}}, a partir de dados declarados ao Tesouro Nacional no SICONFI. Todos os valores são publicados em R$ nominais; correção pela inflação, normalização por habitante, participação no orçamento, posições e medianas são calculados no navegador, por funções testadas contra um gabarito calculado em Python.

### O que você encontra aqui {#o-que-e-encontra}

- **Por estado** (`?view=estado`): receita (DCA Anexo I-C), despesa por função e subfunção (DCA Anexo I-E), dívida (RGF Anexo 02 e DCA Anexo I-D) e estatais (Raio X do Tesouro).
- **Comparar** (`?view=comparar`): uma função de governo nas 27 UFs, por habitante (R$ corrigidos ou da época) ou em % da despesa total, com posição e mediana.
- **Como fazemos** (`?view=metodo`): fontes, método, decisões, limitações e o exemplo refeito a partir dos dados publicados. Toda visão é reproduzível pela URL.

### O que este site não é {#o-que-e-nao-e}

- **Não consolida estado e municípios.** O universo é o ente estadual (`co_esfera = E`). Transferências do estado aos municípios aparecem na função de destino; a execução municipal com recursos próprios não aparece. Ver [a decisão](#decisao-so-estado).
- **Não é auditoria.** São dados declaratórios (DCA, RGF, RREO), sujeitos a retificação. Divergências entre demonstrativos do mesmo ente são registradas, não corrigidas ([limitações](#limitacoes)).
- **Não mede eficiência nem cumprimento de mínimos constitucionais.** A despesa é o liquidado da DCA, sem as regras próprias dos mínimos de saúde e educação (que somam restos a pagar e têm exclusões).
- **Não é dado em tempo real.** Periodicidade anual; a data da extração de cada fonte fica em `meta.json` e na [ficha de cada fonte](#fontes).

### Por que de {{anos.primeiro}} a {{anos.ultimo}} {#o-que-e-periodo}

Ano inicial único ({{anos.primeiro}}) para todas as partes: de {{anos.primeiro}} a {{anos.ultimo}}, as 27 UFs estão presentes em todos os anexos usados (DCA I-C, I-D e I-E; RGF Anexo 02; RREO Anexos 01 e 02). A série atravessa duas recodificações da natureza da receita (até 2017, 2018–2021 e 2022 em diante) e uma mudança de layout do RGF Anexo 02 (2015–2016). Os mapeamentos e as quebras conhecidas estão em [decisões](#decisao-serie-2015) e em [limitações](#limitacoes).
