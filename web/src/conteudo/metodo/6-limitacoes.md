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

### A população repete entre anos {#limite-populacao}

Campo `populacao` do SICONFI; ver [decisão](#decisao-populacao).
