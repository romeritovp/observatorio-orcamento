# Limitações conhecidas e perguntas em aberto {#limitacoes}

## simples

Aqui está o que sabemos que não sabemos, sem esconder nada. Os pontos que mudam a leitura de uma tela também aparecem nela, como aviso, com um link para cá. Quando temos uma explicação provável mas não confirmada, dizemos que é uma hipótese.

### Os números são declarados e podem mudar {#limite-retificacao}

Cada estado entrega as próprias contas ao Tesouro, e pode corrigi-las depois. Não fazemos auditoria. Se um estado corrigir uma conta, o número daqui só muda quando baixarmos os dados de novo; a data de cada download está em [de onde vêm os dados](#fontes).

### O mesmo estado, dois relatórios, dois números {#limite-rreo-dca}

Os estados entregam as contas do ano em mais de um relatório, e às vezes os números não batem. Comparamos a receita de cada estado nos dois relatórios: de 2019 a 2025, bateram em 175 de 189 casos; de 2015 a 2018, em 76 de 108. As maiores diferenças: BA em 2015 (R$ 9,1 bi), PR de 2015 a 2017 (até R$ 9,0 bi), CE de 2015 a 2018 e de novo em 2019 e 2025, PI em 2025 (R$ 4,9 bi). Com o gasto em saúde, quase sempre bate (185 de 189 casos de 2019 a 2025). Usamos sempre as contas anuais e não corrigimos nada.

### Rio de Janeiro: R$ 11 bilhões sem explicação em 2019 e 2020 {#limite-rj-11bi}

O RJ não separa os royalties do petróleo nas contas desde 2018; eles devem estar numa linha genérica, "demais receitas patrimoniais". Em 2019 e 2020, essa linha tem cerca de R$ 11 bilhões a mais do que a ANP diz ter repassado de royalties. Verificamos se era efeito da mudança de códigos de 2022, e não é. Não sabemos o que são esses R$ 11 bi.

### Rio de Janeiro: a concessão da Cedae (hipótese) {#limite-cedae}

A linha "outorga de direitos de uso de recursos hídricos" do RJ salta de R$ 58 milhões em 2019 para R$ 17,5 bilhões em 2021 e segue alta depois (R$ 3,95 bi em 2024). Em 2021, o estado concedeu parte dos serviços da Cedae à iniciativa privada, com R$ 14,5 bi destinados ao estado, pagos em parcelas. É provável que esses pagamentos estejam nessa linha, mas as contas não permitem confirmar. Não é arrecadação que se repete todo ano.

### Estados que não separam os royalties {#limite-royalties}

- **RJ:** separava até 2017; não separa a partir de 2018 ([veja acima](#limite-rj-11bi)).
- **DF:** não tem linha de petróleo em nenhum ano (os valores são pequenos).
- **AC, AP e MG**, que não produzem petróleo, lançam como royalties um fundo que o Tesouro reparte entre todos os estados ([FEP](#termo-fep)). Por isso juntamos tudo num item só, "petróleo e gás".
- **MA**, em 2015 e 2017, lançou todo o petróleo como esse fundo.

### Minas Gerais em 2022: petróleo não localizado {#limite-petroleo-mg}

Em 2022, MG não tem linha de petróleo, embora tenha nos outros anos. O valor deve estar em outro código, que não encontramos.

### Paraná: compensação de Itaipu? (hipótese) {#limite-itaipu}

A linha "outras compensações" do PR (R$ 299 milhões em 2024) é maior que a compensação por uso de água. Pode ser a compensação de Itaipu, que tem regra própria. Não verificamos.

### Ceará em 2018: ICMS num código antigo {#limite-ce-2018}

Em 2018, o CE lançou R$ 2,59 bilhões num código de um imposto sobre combustíveis que não existe desde 1993. Somado ao ICMS, o valor segue a tendência de 2017 e 2019; sem ele, o ICMS do CE parece cair 22% em 2018. Provavelmente é ICMS sobre combustíveis lançado no lugar errado. Deixamos onde o estado declarou: no site, ele aparece em "outros impostos e taxas".

### ICMS de combustíveis e energia em 2022 {#limite-icms-2022}

Em 2022, uma lei federal (Lei Complementar 194) limitou o ICMS sobre combustíveis, energia e telecomunicações. A arrecadação caiu em vários estados, e a União passou a compensar parte da perda, que aparece em "outras transferências da União". A queda é real, não é erro dos dados.

### Saúde do RJ: pagamentos internos que crescem {#limite-intra-saude-rj}

Na saúde do RJ, os pagamentos entre órgãos do próprio estado (que ficam fora das nossas contas) passaram de 8% para 26% do gasto da área entre 2019 e 2025. Não sabemos por quê. Pode ser uma mudança na forma de gerir a saúde ou nas contribuições de previdência; descobrir exige um detalhe que as contas por área não trazem ([a decisão](#decisao-intra)).

### Empresas estaduais: lacunas nas listas antigas {#limite-estatais-antigas}

Não há lista de empresas que possamos usar antes de 2019: a de 2018 não identifica as empresas de um jeito que permita ligá-las às outras. O AP não aparece nas listas de 2019 e 2020, e o MA, na de 2019. Na lista de 2019, nove empresas vieram sem o número de identificação (CNPJ) ou com ele errado, e ficaram de fora; o setor e a situação das demais vêm da lista de 2021. Algumas empresas mudam de classificação (dependente ou não) quase todo ano, sem que o gasto acompanhe.

### O que não está nestas contas {#limite-fora-das-contas}

- **Previdência futura:** o que os estados devem aos servidores que vão se aposentar (o "passivo atuarial") é, em vários estados, maior que a dívida, e não entra nestes números ([dívida consolidada](#termo-divida-consolidada)).
- **Mínimos de saúde e educação:** a Constituição obriga os estados a gastar um mínimo nessas áreas, com regras próprias. Este site não mede se o mínimo foi cumprido.
- **Prefeituras:** ver [a decisão](#decisao-so-estado).

### PIB: administração pública não é a despesa do estado {#limite-pib-administracao-publica}

A atividade "administração, defesa, educação e saúde públicas e seguridade social" mede o peso do setor público na economia: escolas, hospitais, quartéis e repartições de **todos** os níveis de governo (União, estado e municípios) que funcionam no estado. Não é o que o governo estadual gasta, e não deve ser comparada com as contas das outras telas.

### PIB: pesos a preços da época {#limite-pib-nominal}

O peso de cada atividade é calculado com valores da época. Se o preço do que uma atividade produz sobe mais que o resto, ela ganha peso mesmo sem produzir mais: é o caso do petróleo (indústrias extrativas) quando o barril sobe, e o contrário quando cai. Para saber se a economia produziu mais, use o crescimento em volume.

### PIB: dois anos de atraso {#limite-pib-defasagem}

O IBGE publica o PIB dos estados com cerca de dois anos de atraso: o último ano disponível é {{fontes.pib.ultimo}}. Cada nova edição revisa a série inteira, então os números de anos antigos também podem mudar quando atualizarmos.

### IBID: escores só dentro do mesmo ano {#limite-ibid-escores}

Ainda não está confirmado se o escore do IBID pode ser comparado entre anos. A média do Brasil fica quase parada ano a ano, o que sugere que o índice é recalculado a cada edição. Por isso mostramos a evolução no tempo só pela posição no ranking, e comparamos escores só dentro de um mesmo ano.

### IBID: Ciência e Tecnologia e Ensino Superior {#limite-ibid-ct-ensino-superior}

O gasto do estado em pesquisa aparece em dois lugares das contas. A área "Ciência e Tecnologia" concentra as fundações de amparo à pesquisa; as universidades estaduais aparecem em "Ensino Superior", dentro de Educação. Mostramos as duas separadas e somadas: a soma dá um retrato mais completo, mas o Ensino Superior também inclui o ensino, não só a pesquisa. Em alguns estados e anos, não há Ensino Superior declarado (a universidade pode estar classificada em outro lugar): o valor entra como zero, marcado na tabela.

### IBID: gasto e índice lado a lado não é causa {#limite-ibid-causa}

O gasto do governo estadual e a posição no índice aparecem juntos para comparação. O IBID mede a economia e as instituições do estado inteiro (empresas, universidades federais, mercado de trabalho), não só a ação do governo estadual. Um número não explica o outro sozinho.

### IDEB: última edição na formulação de 2007 {#limite-ideb-formulacao}

O IDEB de 2025 é o último calculado do jeito criado em 2007. O Inep estuda mudanças; a próxima edição (2027) pode não ser comparável com esta série.

### IDEB: metas só até 2021 {#limite-ideb-metas}

As metas oficiais do IDEB iam de 2007 a 2021. Não há metas para 2023 e 2025, e não inventamos nenhuma. Por isso a tela não mostra metas: só o que foi medido.

### IDEB: 2021, ano da pandemia {#limite-ideb-2021}

Em 2021 muitas redes aprovaram quase todos os alunos por causa da pandemia, e menos alunos fizeram a prova do Saeb. O IDEB de 2021 sobe pela aprovação e deve ser comparado com cuidado.

### IDEB do ensino médio: mudança no Saeb em 2019 {#limite-ideb-medio-saeb}

Até 2017, a prova do ensino médio era feita por uma amostra de escolas; a partir de 2019, por todas as escolas públicas. A passagem de 2017 para 2019 pode ter um salto que não é só de aprendizado.

### IDEB: não compare etapas entre si {#limite-ideb-escalas}

Cada etapa tem sua própria escala de notas no Saeb. Uma nota de 250 nos anos iniciais e outra de 250 no ensino médio não querem dizer a mesma coisa, e o IDEB de uma etapa também não se compara com o de outra.

### IDEB: rede estadual nos anos iniciais {#limite-ideb-municipalizacao}

Em vários estados, os anos iniciais do fundamental passaram para as prefeituras. A rede estadual fica com poucas escolas nessa etapa, e o resultado pode faltar ou dizer pouco sobre o estado (em Roraima, por exemplo, não há IDEB da rede estadual nos anos iniciais desde 2017).

### IDEB: Distrito Federal {#limite-ideb-df}

No DF, a rede "estadual" é a rede distrital, e não existe rede municipal.

### IDEB: notas da planilha do Inep {#limite-ideb-notas-planilha}

Em alguns estados e redes, o Inep avisa que o resultado de 2009 foi calculado só com escolas urbanas, ou sem as particulares, ou não foi calculado por falta de amostra, e que o de 2011 foi calculado sem as escolas federais. Esses avisos aparecem na tela junto do estado.

### A população repete entre anos {#limite-populacao}

Ver [a decisão sobre a população](#decisao-populacao).

## tecnico

Pendências e anomalias registradas em `docs/decisoes.md`, sem correção nos dados. Hipóteses estão marcadas como tal.

### Os números são declarados e podem mudar {#limite-retificacao}

DCA, RGF e RREO são declaratórios e retificáveis. O cache bruto guarda a resposta da API como veio, com `extraido_em`; retificações só entram numa nova extração (apagar o cache e consultar de novo). Datas por fonte: [fontes](#fontes).

### O mesmo estado, dois relatórios, dois números {#limite-rreo-dca}

| Conferência | 2019–2025 | 2015–2018 | Maiores diferenças |
|---|---|---|---|
| DCA I-C líquida exceto intra × RREO Anexo 01 | 175/189 | 76/108 | BA 2015 (+9,06 bi); PR 2015 (−2,70 bi), 2016 (−8,22 bi), 2017 (−8,96 bi); CE 2015–2018 (−2,7 a −3,3 bi), 2019 (−3,7 bi), 2025 (+2,7 bi); PI 2025 (+4,9 bi); RJ 2016 (+1,85 bi); MA (−1,25 a −1,53 bi); PR 2021 (+1,4 bi) |
| DCA I-D (juros + amortização) × RREO Anexo 01 | 178/189 | 77/106 | 2019: amortização intra na modalidade 90 (RJ: 924,9 mi × 696,6 mi) |
| DCA I-E função 10 sem intra × RREO Anexo 02 | 185/189 | — | RR 2019 (−4,8%), MA 2019 (−0,9%), MA 2020 (−1,0%), SP 2022 (−0,2%) |

A DCA é sempre a fonte exibida; as diferenças são avisos de extração, não correções.

### Rio de Janeiro: R$ 11 bilhões sem explicação em 2019 e 2020 {#limite-rj-11bi}

"Demais Receitas Patrimoniais" (1.3.9) do RJ − total da ANP (royalties + participação especial ao estado) ≈ R$ 11 bi em 2019 e em 2020, fora da regra dos 95%. A recodificação de 2022 não explica: 1.3.9 tem o mesmo código nos dois períodos, e as linhas patrimoniais novas de 2022 (juros, aluguéis, cessão de direitos, ~R$ 3,9 bi) são recodificações de linhas antigas, fora da 1.3.9. Em aberto.

### Rio de Janeiro: a concessão da Cedae (hipótese) {#limite-cedae}

1.3.4.5.01 "Outorga de Direitos de Uso de Recursos Hídricos" (RJ): R$ 58 mi (2019), R$ 17,5 bi (2021), R$ 3,0 bi (2022), R$ 3,95 bi (2024), R$ 1,99 bi (2025). Hipótese não verificada na prestação de contas: parcelas da outorga da concessão da Cedae (R$ 22,7 bi no total, R$ 14,5 bi destinados ao estado; IstoÉ Dinheiro, 16/06/2021). Mantida onde o RJ declarou (item "receita patrimonial").

### Estados que não separam os royalties {#limite-royalties}

- RJ: petróleo em 1.3.4 até 2017; sem linha de petróleo a partir de 2018 (`petroleo_nao_separado_desde: 2018` em `config/ufs/rj.yaml`).
- DF: sem linha de petróleo em nenhum ano.
- AC, AP, MG: FEP lançado como royalties ou participação especial; por isso o item petróleo e gás junta royalties, excedente, participação especial e FEP.
- MA 2015 e 2017: todo o petróleo como FEP (1.7.2.1.22.70). AM 2016 (152%) e PR 2017 (465%, valores pequenos): DCA sem FEP ÷ ANP fora de 90%–110%.
- MS e PA, até 2017: valores pequenos em 1.3.4 (exploração de recursos naturais), mapeados para petróleo e gás, que podem ser outra receita.

### Minas Gerais em 2022: petróleo não localizado {#limite-petroleo-mg}

Sem código de petróleo na DCA I-C de MG em 2022 (presente nos demais anos). Ressalva por UF e ano em `config/ufs/mg.yaml`.

### Paraná: compensação de Itaipu? (hipótese) {#limite-itaipu}

"Outras compensações" do PR (R$ 299 mi em 2024) > recursos hídricos. Hipótese não verificada: compensação de Itaipu (regra própria). Também não verificada: `1.3.4.1` ("petróleo – regime de concessão", MG 2019 R$ 891 mi, PR 2022 R$ 410 mi) como parcela de bônus de leilões do pré-sal.

### Ceará em 2018: ICMS num código antigo {#limite-ce-2018}

CE 2018, DCA I-C: R$ 2,59 bi em 1.1.1.8.02.5 (Imposto sobre Vendas a Varejo de Combustíveis, IVVC, extinto pela EC 3/1993). ICMS (1.1.1.8.02.1): 11,35 bi (2017), 8,84 bi (2018), 12,55 bi (2019); ICMS + IVVC 2018 = 11,43 bi. Provável ICMS sobre combustíveis no código errado. Não reclassificado: o valor fica em "outros impostos e taxas".

### ICMS de combustíveis e energia em 2022 {#limite-icms-2022}

LC 194/2022: teto de alíquota do ICMS sobre combustíveis, energia elétrica e telecomunicações. ICMS agregado −4,5% real em 2022. Compensação da União pelas perdas em 1.7.1.9.62 (15 estados), dentro de "outras transferências da União" (+87% no agregado em 2022). Efeito real, não de recodificação.

### Saúde do RJ: pagamentos internos que crescem {#limite-intra-saude-rj}

Peso das intraorçamentárias na função 10 do RJ (RREO Anexo 02): 8,0% (2019), 17,5% (2022), 25,2% (2024), 26,3% (2025). Causa não investigada (forma de execução, contribuições previdenciárias); pede o detalhe por natureza da despesa dentro da função, que a DCA não traz.

### Empresas estaduais: lacunas nas listas antigas {#limite-estatais-antigas}

v2019 (exercício 2018): sem CNPJ, sigla em 24 de 258 linhas, dependência "Não Informado" em 15; não incorporada. v2020 (2019): AP ausente; MA sem nenhuma empresa com CNPJ; 9 linhas sem CNPJ de 14 dígitos descartadas (GASMAR, EMAP, MAPA, CAEMA/MA; EMAE ações preferenciais/SP; CEHAP/PB; E. F. Paraná Oeste/PR; SUAPE/PE; RIOTRILHOS/RJ); 12 empresas sem par em 2021 ficam sem setor e situação. v2021 (2020): AP ausente, sem sigla. Classificação instável em METROFOR/CE, CETURB/ES e COHAB/ES ([verificação](#decisao-quebra-dependencia)). Detalhes em `docs/fontes/tesouro_estatais.md`.

### O que não está nestas contas {#limite-fora-das-contas}

- RGF Anexo 02, linhas fora da dívida consolidada (não entram em nenhum total): passivo atuarial do RPPS, precatórios anteriores a 05/05/2000, precatórios posteriores não incluídos na DC, RP não processados, depósitos judiciais, dívida de PPP.
- Mínimos constitucionais (LC 141/2012; art. 212 da CF): regras próprias, não reproduzidas.
- Execução municipal: fora do universo ([decisão](#decisao-so-estado)).

### PIB: administração pública não é a despesa do estado {#limite-pib-administracao-publica}

Atividade 12 (Administração, defesa, educação e saúde públicas e seguridade social): valor adicionado das três esferas de governo localizadas na UF, medido pelo custo (principalmente remunerações), na ótica da produção. Não corresponde à despesa da DCA nem a nenhum estágio da execução orçamentária estadual; não cruzar.

### PIB: pesos a preços da época {#limite-pib-nominal}

Participações calculadas a preço corrente: refletem volume e preço relativo. Em UFs com indústria extrativa relevante (RJ, ES), o peso da atividade 03 (indústrias extrativas) acompanha o preço do petróleo. O crescimento usa só o índice de volume (tab03), sem deflator implícito nem IPCA.

### PIB: dois anos de atraso {#limite-pib-defasagem}

Edição {{fontes.pib.edicao}}: série {{fontes.pib.primeiro}}–{{fontes.pib.ultimo}}. A edição N sai cerca de dois anos depois de N e revisa toda a série; a coluna `edicao` guarda a edição de cada linha. Os anos do PIB não coincidem com os do orçamento ({{anos.primeiro}}–{{anos.ultimo}}), por isso a tela tem seletor de ano próprio.

### IBID: escores só dentro do mesmo ano {#limite-ibid-escores}

O escore do índice geral do Brasil fica entre 0,29 e 0,30 de 2014 a 2025, o que sugere normalização anual dos indicadores. Até a confirmação da metodologia: evolução temporal só por posição (`ibid_ranking`); escores só em comparações do mesmo ano. A escolha fica em `config/ibid.yaml` (`escores_comparaveis_entre_anos`), exportada para `meta.json → ibid`.

### IBID: Ciência e Tecnologia e Ensino Superior {#limite-ibid-ct-ensino-superior}

DCA Anexo I-E, liquidado, sem intra: função 19 (nível `funcao`) e subfunção 364 dentro da função 12 (nível `subfuncao`, arquivo `despesa_ensino_superior.json`). São despesas disjuntas (a 364 sob a 12 não está na 19), por isso a soma não conta nada duas vezes; nos dados publicados, a 364 só aparece sob a função 12. Por habitante e % do orçamento com as contas das subáreas (denominador: despesa total da UF, soma das funções sem intra). UF que entregou a DCA sem a linha 12.364 entra com 0 e `sem_gasto_declarado` (`indicadoresDaSubfuncao`, espelhada em `publicacao.exportar.indicadores_da_subfuncao` e conferida no `gabarito.json → ensino_superior`). A subfunção 364 inclui ensino de graduação, não só pesquisa.

### IBID: gasto e índice lado a lado não é causa {#limite-ibid-causa}

Posição no IBID e gasto na função 19 por habitante são exibidos lado a lado, sem correlação, regressão nem defasagem estimadas. O índice cobre o território inteiro (setor privado, esfera federal), não a execução orçamentária estadual.

### IDEB: última edição na formulação de 2007 {#limite-ideb-formulacao}

`formulacao: original_2007` no JSON. O Inep criou um grupo técnico para atualizar o índice (nota informativa do IDEB 2025); a série 2005–2025 é internamente comparável, a de 2027 pode não ser.

### IDEB: metas só até 2021 {#limite-ideb-metas}

Metas do 1º ciclo (2007–2021) gravadas como `indicador = meta` na tabela `ideb` e excluídas do `ideb.json` do site. 2023 e 2025 sem parâmetro oficial: nada projetado.

### IDEB: 2021, ano da pandemia {#limite-ideb-2021}

Aprovação inflada por regras de promoção e participação menor no Saeb (nota informativa do IDEB 2021 e relatório do Saeb 2021). O P sobe e o N pode ter viés de participação; a tendência que inclui 2021 herda isso.

### IDEB do ensino médio: mudança no Saeb em 2019 {#limite-ideb-medio-saeb}

Saeb do ensino médio amostral até 2017 e censitário para escolas públicas a partir de 2019: possível quebra de série 2017 → 2019 nas redes públicas.

### IDEB: não compare etapas entre si {#limite-ideb-escalas}

Proficiências do Saeb em escalas próprias de cada etapa (anos iniciais, finais, médio); N é padronizado dentro da etapa. Rankings e séries da tela são sempre dentro de uma etapa e uma rede.

### IDEB: rede estadual nos anos iniciais {#limite-ideb-municipalizacao}

Com a municipalização dos anos iniciais, a rede estadual pode ter poucas escolas e ficar sem Saeb (sem IDEB). Ex.: RR, rede estadual, anos iniciais: aprovação até 2025, mas sem Saeb e IDEB desde 2017 (lacuna da conferência de cobertura).

### IDEB: Distrito Federal {#limite-ideb-df}

`rede = estadual` é a rede distrital; não há linha municipal para o DF.

### IDEB: notas da planilha do Inep {#limite-ideb-notas-planilha}

Notas de rodapé nos rótulos de rede da planilha (numeração diferente em cada aba), lidas com o texto do rodapé e publicadas em `ressalvas_por_uf` com as etapas e redes afetadas: 2009 só escolas urbanas; 2009 sem escolas privadas; 2009 não calculado (perda amostral); 2011 sem escolas federais.

### A população repete entre anos {#limite-populacao}

Campo `populacao` do SICONFI; ver [decisão](#decisao-populacao).
