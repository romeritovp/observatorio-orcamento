# Registro de decisões

Uma entrada por decisão relevante de tratamento de dados ou arquitetura. Curta.

## Modelo

### AAAA-MM-DD — Título
**Contexto:** o problema.
**Decisão:** o que foi feito.
**Consequência:** o que isso afeta.

---

### 2026-10-08 — SICONFI como fonte principal
**Contexto:** o projeto precisa servir a qualquer UF.
**Decisão:** dados nacionais (SICONFI) são a base; fontes estaduais entram só para órgão, programa e ação.
**Consequência:** um único extractor nacional atende todos os estados; comparações entre UFs usam só dados do SICONFI.

### 2026-10-08 — Duas tabelas canônicas
**Contexto:** demonstrativos fiscais têm estrutura de relatório; execução orçamentária é tabular.
**Decisão:** tabela `despesa` (larga) e tabela `demonstrativo` (longa).
**Consequência:** análises de indicadores fiscais usam `demonstrativo`; análises granulares usam `despesa`.

### 2026-10-08 — Códigos nos dados, nomes nos dicionários
**Contexto:** nomes de órgãos e programas mudam de grafia entre anos e fontes.
**Decisão:** extractors gravam só códigos; nomes vêm de `dicionarios/` via join.
**Consequência:** agrupamentos estáveis entre anos; dicionários versionados no git.

### 2026-10-08 — Formato do cache bruto do SICONFI
**Contexto:** a API pagina as respostas (`hasMore`, `offset`, `limit`) e os dados podem ser retificados pelo ente.
**Decisão:** cada consulta vira um único JSON em `data/raw/siconfi/<endpoint>/<cod_ibge>/` com `extraido_em`, `endpoint`, `params` e `paginas` (lista das respostas da API, sem alteração). Nome do arquivo: `<ano>_<periodo>_<anexo>` seguido dos demais parâmetros em ordem alfabética do nome (ex.: `2025_6_RREO-Anexo-02_E_RREO.json`); caracteres fora de letra/número/hífen viram `-`. Consulta sem `id_ente` vai para a pasta `todos`; sem parâmetros, `completo.json`.
**Consequência:** consultas diferentes (ex.: RREO e RREO Simplificado) nunca colidem; o arquivo só é gravado quando todas as páginas chegam e há pelo menos um item (resposta vazia gera aviso no log e não vira cache, para que uma entrega posterior do ente seja buscada). Para atualizar dados retificados, apagar o arquivo e consultar de novo. Retentativa só em erro de rede e HTTP 429; outros erros HTTP falham na hora.

### 2026-10-08 — Funções e subfunções: dicionário vem da DCA; níveis nunca somados juntos
**Contexto:** a DCA Anexo I-E traz função e subfunção só como texto em `conta` (`10 - Saúde`, `10.302 - ...`, `FU10 - Demais Subfunções`), misturando totais, funções e subfunções na mesma lista. Todas as linhas têm o mesmo `rotulo`; as intraorçamentárias vêm numa única linha agregada (`Despesas Intraorçamentárias`), sem detalhe por função.
**Decisão:** `extractors/nacional/siconfi/dca.py` separa código e nome. A tabela `despesa` ganha `nivel` (`total`, `funcao`, `subfuncao`, `demais`) e `intra`. A linha intraorçamentária é identificada pela `conta` (e também pelo `rotulo`, se algum ano trouxer um bloco intra). `funcoes.csv` e `subfuncoes.csv` são gerados por `dicionario_funcoes.py` a partir das DCA I-E em cache; em conflito de grafia vale o exercício mais recente. Linhas de níveis diferentes **nunca** são somadas juntas. Validação na extração: soma das linhas `funcao` (fora intra) = linha `total` (fora intra). Colunas de inscrição em restos a pagar ficam de fora. Valor ausente na fonte (ex.: `FU09` só com empenhado) fica nulo.
**Consequência:** os dicionários só contêm os códigos que aparecem nas DCA baixadas (com só RJ 2024: 25 funções, 64 subfunções); baixar mais entes e anos completa a lista. `funcao_cod_tipica` saiu de `subfuncoes.csv` porque a DCA não informa. Toda análise filtra um `nivel` antes de agregar.

### 2026-10-08 — Deflação pelo IPCA dez/dez e população do SICONFI
**Contexto:** a Fase 4 precisa de deflação e per capita com dados de referência passados como argumento.
**Decisão:** `data/reference/ipca.csv` guarda a variação anual dez/dez do IPCA (SIDRA 1737). `deflacionar` encadeia as variações e leva cada ano a preços de dezembro do `ano_base` (fator = índice do ano_base / índice do ano), tratando o gasto do ano como se fosse a preços de dezembro daquele ano. A população vem do campo `populacao` da DCA (nova tabela canônica `populacao`), não de arquivo próprio. As funções de `analytics` recusam DataFrame com mais de um `nivel` (variação e participação) e nunca preenchem valor faltante: ano sem IPCA ou UF/ano sem população é erro.
**Consequência:** usar o IPCA médio anual daria valores reais um pouco diferentes; trocar é só mudar o csv e a docstring. A população do SICONFI repete entre alguns anos, então o per capita de anos vizinhos pode usar a mesma população; se isso incomodar, trocar pela estimativa do IBGE numa tabela `populacao` com outra `fonte_dado`.

### 2026-10-08 — Despesa executada padrão é o liquidado
**Contexto:** a tabela `despesa` traz empenhado, liquidado e pago; análises precisam de uma medida única de "quanto foi gasto".
**Decisão:** o padrão é o **liquidado** (bem ou serviço entregue e reconhecido no exercício). Empenhado inclui o que não foi entregue (vira resto a pagar não processado); pago depende do caixa e empurra despesas de dezembro para o ano seguinte. Atenção: os mínimos constitucionais (ex.: saúde, LC 141/2012) têm regra própria, que soma restos a pagar; para eles, usar os anexos específicos do RREO, não o liquidado da DCA. Usar outro estágio só quando a pergunta pedir, dizendo isso na saída.
**Consequência:** séries, rankings e per capita das análises usam `liquidado` salvo indicação explícita.

### 2026-10-08 — Vieses do per capita estadual e medida complementar
**Contexto:** a análise de saúde compara UFs pela despesa per capita, e o RJ aparece em último lugar quase todos os anos. Essa medida tem dois vieses conhecidos.
**Decisão:** toda comparação per capita entre estados vem acompanhada de uma medida que não depende da população: a participação da função na despesa total do estado (soma das linhas `nivel = funcao`, sem intraorçamentárias, igual ao total validado na extração). As análises também comparam a UF com um grupo de pares escolhido (`--pares`), além da mediana nacional. Os dois vieses registrados:
1. **Tamanho da população.** Estados pequenos têm custos fixos (secretaria, hospitais de referência, rede mínima) divididos por poucos habitantes, e muitos recebem transferências federais proporcionalmente maiores; o per capita deles tende a ser alto (AP, RR e AC lideram). Estados populosos tendem a ficar embaixo. Comparar com pares de porte parecido e com a mediana atenua o efeito. A população do SICONFI ainda repete entre alguns anos, o que gera saltos artificiais no per capita.
2. **Divisão de responsabilidades entre estado e municípios.** A despesa estadual por função mede só o que o governo estadual executa. Onde os municípios (sobretudo a capital) assumem mais a rede de saúde, ou recebem mais transferências do estado, o gasto estadual parece baixo sem que o gasto total na UF seja baixo. As transferências do estado aos municípios entram na função de destino, mas a execução municipal com recursos próprios não aparece. O per capita estadual não mede o gasto total em saúde da população da UF.
**Consequência:** posição no ranking per capita nunca é lida sozinha. Conclusões sobre "quanto se gasta na UF" pedem também dados municipais (SICONFI tem DCA dos municípios), o que fica para fase futura.

### 2026-10-08 — Robustez da Saúde às intraorçamentárias (RREO Anexo 02)
**Contexto:** a DCA I-E não separa as intraorçamentárias por função, e a análise de saúde usa o liquidado sem intra. A conferência manual mostrou R$ 3,46 bi intra na Saúde do RJ em 2024. Era preciso saber se a posição do RJ depende dessa escolha.
**Decisão:** `extractors/nacional/siconfi/rreo.py` grava o RREO Anexo 02 do 6º bimestre (27 UFs, 2019–2025, 189 combinações, todas validadas) na tabela `demonstrativo`. O bloco é identificado pelo `cod_conta` (`RREO2TotalDespesas` / `RREO2TotalDespesasIntra`) e as linhas de total pela `conta`, nunca só pelo `rotulo` (em 2019 o bloco intra se chamava "Total de Despesas"; a linha (II) aparece também no bloco exceto). `analyses/saude.py` grava `robustez_intra.csv`: liquidado da função 10 sem intra, intra, com intra, peso das intra e posição no per capita real nas duas versões. O padrão continua **sem intra**; a versão com intra é tratada como **limite superior**, porque parte das intra na Saúde pode ser repasse a entidade do próprio estado que gasta de novo na função 10 (dupla contagem), e parte é custo real da Saúde contabilizado também em outra função (ex.: contribuição patronal ao regime próprio).
**Resultado:**
- RREO sem intra = DCA, ao centavo, em 185 das 189 combinações. Divergem: RR 2019 (−4,8%), MA 2019 (−0,9%), MA 2020 (−1,0%), SP 2022 (−0,2%); provável retificação ou entrega diferente entre os dois demonstrativos. Mantida a DCA.
- Peso das intra na função 10, média 2019–2025: MG 23,9%, DF 17,9%, RJ 16,7%, RS 13,0%, PE 11,3%; a maioria das UFs fica abaixo de 5%; AP 0%.
- No RJ o peso subiu de 8,0% (2019) para 17,5% (2022), 25,2% (2024) e 26,3% (2025). Causa ainda não investigada (forma de execução da saúde, contribuições previdenciárias); pede o detalhe por natureza da despesa.
- Posição do RJ no per capita real, sem → com intra: 2019 27º→24º, 2020 27º→25º, 2021 24º→23º, 2022 23º→21º, 2023 27º→26º, 2024 27º→21º, 2025 27º→23º. MG muda do mesmo modo (2025: 26º→22º).
**Consequência:** a conclusão "RJ está no grupo de menor gasto estadual per capita em saúde" é robusta (21º a 27º em qualquer versão); "RJ é o último" não é, e não deve ser afirmada sem a ressalva das intraorçamentárias. Comparações per capita de saúde entre UFs passam a citar as duas versões.

### 2026-10-08 — Camada de publicação para o front
**Contexto:** um front (em `web/`) vai exibir os dados; ele precisa de arquivos estáticos e de uma forma de conferir se calcula igual ao Python.
**Decisão:** nova camada `publicacao/` (`uv run python -m publicacao.exportar`), que lê `data/processed/` e grava em `web/public/data/`: `meta.json` (arquivos, colunas, níveis, regras de uso, método de deflação, datas de extração por fonte), `dicionarios.json`, `ipca.json`, `despesa.json` e `gabarito.json`. `despesa.json` traz uma linha por linha da tabela `despesa`, com valores **nominais**, `intra` como booleano, a população da UF no ano e `extraido_em`; não traz valor real nem per capita, que são calculados no front. `gabarito.json` traz, para as 27 UFs e todos os anos, o per capita real (dez/2025) e o % da despesa total da saúde (função 10, liquidado, sem intra), calculados por `analytics/`; é só para teste do front, nunca para exibição. Para isso, a data de extração passou a ir do cache bruto para as tabelas processadas (coluna `extraido_em` em `despesa`, `demonstrativo` e `populacao`), e a publicação nunca lê `data/raw/`.
**Consequência:** o front deflaciona encadeando `variacao_pct` (não `indice_dez`; o arredondamento difere) e, assim, reproduz o gabarito com diferença relativa da ordem de 1e-16 (conferido recalculando só a partir dos JSON). `despesa.json` tem 23.344 linhas (~5,7 MB, sem espaços); se o front precisar de carga menor, dividir por UF ou usar formato colunar.

### 2026-10-08 — Ausência de linha numa função = gasto zero
**Contexto:** na DCA, a UF que não executou despesa numa função simplesmente não tem a linha (ex.: saneamento, função 17, falta para 18 UF-anos entre 2019 e 2025). Sem tratamento, a UF sumia do ranking e da mediana, e a comparação passava a ser "entre 25 estados" num ano e "entre 27" no outro.
**Decisão:** UF que entregou a DCA no ano (tem alguma linha `nivel = funcao`) mas não tem linha na função, ou tem a linha sem valor no estágio escolhido, entra com **0** e `sem_gasto_declarado = True`. Vale igual no Python (`analytics.completar_com_zero`, usada em `publicacao/exportar.py`) e no front (`completarComZero` e `indicadoresDaFuncao` em `web/src/calculos.js`); o `gabarito.json` cobre todas as funções com essa regra. O zero entra no ranking (fica no fim, empatado com a melhor posição entre os zeros), na mediana e na tabela, e a tela lista os estados nessa situação abaixo do ranking.
**Consequência:** a comparação é sempre entre os 27 estados. O zero é "não declarado", não "comprovadamente nada gasto": a despesa pode estar classificada em outra função ou fora do orçamento (ex.: companhias de saneamento). Por isso a marcação aparece em todo lugar onde o zero aparece. Se uma UF deixar de entregar a DCA num ano, ela fica fora do universo daquele ano (não vira zero).

### 2026-10-08 — Dicionário de estatais estaduais (Raio X do Tesouro)
**Contexto:** parte do gasto em algumas áreas passa por empresas estatais (ex.: saneamento), e é preciso saber quais empresas cada estado tem, o setor e se são dependentes do Tesouro estadual.
**Decisão:** `dicionarios/nacional/estatais.csv`, gerado por `extractors/nacional/tesouro_estatais.py` a partir do repositório público `tesouro/empresas-estados`, **de um commit fixo** (`b7f456b`), arquivo `v2025/dados/dados-originais/dados_raw.xlsx`, abas `ex2024` e `ex2023` (`ano_referencia` 2024 e 2023). Diferenças entre abas (coluna `'Setor '`, setor com `\n`) são tratadas na leitura, sem editar a planilha. Empresas em liquidação ficam, marcadas por `situacao`. O nome vem como veio em `empresa`; a versão normalizada fica só em `empresa_normalizada`. `cnpj` (14 dígitos) é a chave entre edições. O repositório não tem licença: usamos só dados cadastrais, com atribuição ao Tesouro Nacional em `docs/fontes/tesouro_estatais.md` e no `meta.json`.
**Consequência:** um valor de dependência fora de `DEPENDENTE`/`NÃO DEPENDENTE`, UF desconhecida, CNPJ inválido ou repetido na mesma UF faz o script falhar, em vez de gravar dado inventado.

### 2026-10-08 — Correspondência setor da estatal → função orçamentária
**Contexto:** para ligar estatais à despesa por função (ex.: "saneamento é feito por companhia estadual"), cada setor do Raio X precisa de uma função.
**Decisão:** `dicionarios/nacional/setor_funcao.csv`, feito à mão, com `correspondencia` `direta`, `parcial` ou `nenhuma` e a justificativa. **Não se força correspondência:** Financeiro, Gestão de Ativos, Informática e TI, Desenvolvimento Regional e Outros ficam com `funcao_cod` nulo. Comunicação (→ 24) e Habitação e Urbanização (→ 16) são `parcial`, porque parte do setor cai em outra função (Administração e Urbanismo).
**Consequência:** análises que usem a tabela devem tratar `parcial` com ressalva e nunca atribuir função às empresas dos setores sem correspondência. Aprovada pelo usuário em 2026-10-08, mantendo as duas linhas `parcial` com a função principal e a justificativa.

### 2026-10-08 — Estatais: só informativo; ajustes por empresa
**Contexto:** a tela "Comparar estados" passa a avisar quando o estado em destaque tem estatal não dependente na área (ex.: CEDAE no saneamento do RJ), porque a operação dessas empresas não está na despesa do estado.
**Decisão:**
- **O dicionário de estatais é só informativo: nunca altera valores de despesa** (não soma, não subtrai, não muda ranking nem mediana). Só gera avisos: no Python (`analytics/estatais.py`) e no front (`estataisNaArea` e `ufsComEstatalNaArea` em `calculos.js`).
- Exceções por empresa ficam em `dicionarios/nacional/estatais_ajustes.csv` (cnpj, funcao_cod, justificativa) e **têm prioridade sobre o setor** (`correspondencia = "ajuste"`). Primeira: EMOP/RJ → 15 Urbanismo. A EMOP é dependente, então não aparece nos avisos; o ajuste vale para qualquer uso futuro do dicionário.
- O front recebe `estatais.json` (`publicacao/exportar.py`): só estatais **ativas, não dependentes e com função**, agrupadas por UF e função, com a atribuição ao Tesouro Nacional. (A escolha da edição por ano foi revista na decisão seguinte.)
**Consequência:** quando a tela marca um estado com ◆ no ranking, o número dele continua sendo só a despesa do governo; o símbolo diz que parte da atuação na área está fora dessa conta. Estatais dependentes não geram aviso, porque o que o Tesouro estadual repassa a elas já está na despesa.

### 2026-10-08 — Estatais: edição do dicionário conforme o ano da tela
**Contexto:** usar sempre a edição mais recente (exercício 2024) dava aviso errado para os anos anteriores. O caso de teste é a Sabesp: privatizada em 2024, ela está na edição 2023 (ativa, não dependente, Saneamento) e não aparece na 2024. O mesmo acontece com a EMAE (energia, SP).
**Decisão:** `estatais.json` traz as duas edições (`por_edicao`). Para cada ano da tela vale **a edição mais recente que não passa do ano**: 2024 em diante usa a edição 2024; até 2023, a edição 2023. A regra está em `analytics.edicao_para_ano` (Python) e `edicaoParaAno` (`calculos.js`). O Python grava `edicao_por_ano` no JSON e o teste do front confere ano a ano. A linha de fonte do aviso diz a edição usada ("situação em 2023"). Avisos e o símbolo ◆ do ranking seguem a mesma edição.
**Limitação:** **para anos anteriores a 2023 (2019 a 2022), os avisos usam a edição de 2023**, até incorporarmos as edições antigas do Raio X (pastas `v2019` a `v2023` do repositório, com formato diferente). Empresas privatizadas, extintas ou criadas entre esses anos e 2023 podem gerar aviso a mais ou a menos nesses anos.
**Exibição do nome:** o nome continua como veio no dicionário; só a tela o limpa (`nomeEmpresa` em `formatacao.js`). Ela tira o " - SIGLA" repetido do fim e converte nomes todos em maiúsculas para iniciais maiúsculas, com de/da/do/das/dos/e em minúsculas e siglas mantidas (a da empresa, de UF, palavras sem vogal e formas societárias como SA e S/A).

### 2026-10-08 — Quebra de série por mudança de dependência de estatal
**Contexto:** entre as edições 2023 e 2024 do Raio X, três estatais mudaram de dependência, todas de não dependente para dependente: Metrô (SP, Transporte, 26), Gaspisa (PI, Energia, 25) e CIAMA (AM, Desenvolvimento Regional, sem função). Pela regra, os gastos de uma estatal dependente entram no orçamento do estado, o que pode quebrar a série.
**Verificação** (despesa liquidada sem intra, DCA, R$ de dez/2025):
- **Gaspisa / PI / função 25: quebra visível.** De R$ 6,9 mi (2023) para R$ 65,8 mi (2024) e R$ 72,5 mi (2025); por habitante, de R$ 2,10 para R$ 20,12 (6º → 3º). O gasto sai da subfunção Energia Elétrica e vai para "demais subfunções" (R$ 55,4 mi). A coincidência é forte, mas a DCA não identifica a empresa, e a função 25 oscila muito em vários estados.
- **Metrô / SP / função 26: sem quebra visível.** Variação real de +5,5% em 2023→2024, abaixo da mediana dos outros estados (+17,4%); peso no orçamento estável (6,25% → 6,23%); intraorçamentárias de SP quase iguais (R$ 16,9 bi → R$ 17,6 bi). A composição por subfunção mudou (demais +R$ 4,7 bi, rodoviário −R$ 2,8 bi), sem como atribuir ao Metrô com a DCA.
- **CIAMA / AM: sem função correspondente**, não testável.
**Decisão:** regra fixa, sem julgamento caso a caso: quando o estado em destaque tem estatal que mudou de dependência entre edições na função escolhida, o gráfico de evolução mostra uma linha tracejada entre os dois anos ("mudança de classificação") e uma nota abaixo dele. A lista vem de `analytics.mudancas_de_dependencia`, exportada em `estatais.json` (`mudancas_dependencia`). Hoje há dois avisos: Gaspisa/PI em Energia e Metrô/SP em Transporte.
**Princípio:** **os avisos descrevem a classificação da fonte, não afirmam efeitos que não verificamos.** Por isso a frase é atribuída ao Tesouro e cautelosa ("Segundo o Tesouro Nacional, em 2024 a … passou a constar como estatal dependente. A partir desse ano, seus gastos devem entrar nestas contas, o que pode afetar a comparação com anos anteriores."), e é a mesma para o caso com quebra visível (Gaspisa) e sem quebra (Metrô).
**Limitação:** só detecta mudanças entre as edições incorporadas (2023 → 2024).

### 2026-10-08 — Nome de estatal exibido na tela
**Contexto:** a edição 2024 do Raio X traz vários nomes sem acento ("COMPANHIA DE GAS DO PIAUI", "... DE SAO PAULO"), e a sigla crua ("GASPISA", "METRÔ") fica pesada nas frases.
**Decisão:** o dicionário `estatais.csv` não muda; só a exibição escolhe sigla e nome, nesta ordem de prioridade:
1. **correção manual** em `dicionarios/nacional/estatais_nomes_exibicao.csv` (cnpj, sigla_exibicao, nome_exibicao), usada como está. Hoje: Gaspisa (Companhia de Gás do Piauí) e Metrô (Companhia do Metropolitano de São Paulo);
2. entre as edições do **mesmo CNPJ**, a versão **com acentos** (a mais recente, se mais de uma tiver). Resolve 27 empresas em que só uma edição tem acento;
3. a versão da edição mais recente.
A escolha é feita por `analytics.nomes_de_exibicao` e exportada em `estatais.json` (`sigla_exibicao`, `nome_exibicao`, `nome_manual`, com o original em `sigla` e `empresa`). Nos casos 2 e 3, o front ainda limpa o nome (`nomeEmpresa`: tira o " - SIGLA" do fim e passa maiúsculas para iniciais maiúsculas); a correção manual não passa por essa limpeza. As frases usam a sigla com o nome entre parênteses ("a Gaspisa (Companhia de Gás do Piauí, PI)"). O artigo vem da sigla quando ela é palavra conhecida ("o Metrô"); senão, da primeira palavra do nome.

### 2026-10-08 — Tela "Por estado" e menu de navegação
**Contexto:** segunda tela do site (um estado, todas as áreas), com menu "Comparar | Por estado".
**Decisão:**
- **Tela ativa na URL** (`?view=estado&uf=PE`), sem rotas: o site continua estático. "Comparar" é o padrão e não grava `view`. A área só vai para a URL quando o leitor a escolhe (`areaExplicita`); sem ela, "Comparar" usa Saúde e "Por estado" usa a **maior área do estado no ano**. Trocar de tela entra no histórico do navegador; os demais filtros só substituem a URL.
- **Resumo do ano:** despesa total = soma das linhas `nivel = funcao` sem intra (a mesma base do % do orçamento), por habitante e variação sobre o ano anterior: real com "valores corrigidos", nominal com "valores da época". Conta em `calculos.js` (`totaisPorUfAno`), espelho de `publicacao.exportar.totais_por_uf`; o `gabarito.json` ganhou `totais` (27 UFs × 7 anos) e o teste do front confere tudo. O gabarito já cobria % do orçamento e per capita (real e da época) de todas as funções × 27 UFs × 7 anos.
- **Selo de posição na composição:** posição do estado na área **no % do orçamento** (a mesma medida das barras), não no per capita.
- **Valor total na série da área:** sempre em R$ da época (como o gráfico de barras da outra tela); por habitante e % trazem a mediana nacional como referência.
- **Estatais do estado:** lista completa (dependentes e não dependentes, qualquer situação) da edição que vale para o ano escolhido, sem valores financeiros, com link para o painel publicado da edição (`tesouro.github.io/empresas-estados/vAAAA/`, onde a pasta vAAAA traz o exercício AAAA−1, conferido em 2026-10-08). A coluna "área relacionada" vem de `setor_funcao.csv` + ajustes, e é apresentada como correspondência aproximada.
**Consequência:** o `estatais.json` cresceu para ~330 KB por causa da lista completa por edição.

### 2026-10-08 — "Por estado": contas × empresas e subáreas na tabela
**Decisão:**
- A tela tem duas partes, com âncoras no topo: **Parte 1, "As contas do estado"** (resumo, composição, série, tabela e ressalvas gerais, que são sobre as contas) e **Parte 2, "As empresas do estado"** (estatais, com a divisão não dependentes × dependentes). Um divisor forte separa as duas: as estatais não são parte do orçamento e não devem ser lidas como mais uma linha dele.
- **Subáreas** (subfunções + "Demais subfunções") abrem sob cada área na tabela; as abertas vão na URL (`abrir=28,12`). Têm as mesmas medidas da área (por habitante, valor total, corrigido ou da época), e **no % do orçamento o percentual é sobre o orçamento total do estado**, não sobre a área, para que a soma das subáreas dê o % da área. Contas em `calculos.js` (`subareasDaUf`, `tabelaSubareasPorAno`).
- Conferido nos dados publicados: subfunções + demais = função em todas as 4.650 combinações de UF, ano e área, nas cinco medidas (teste em `calculos.test.js`). Subárea sem valor liquidado (84 linhas, só com empenhado) fica de fora, como na área; as 3 áreas com liquidado nulo (RN 2020/27, RR 2021/19, SC 2020/25) entram com 0 e não têm subáreas a mostrar.
- O CSV da tabela traz sempre áreas e subáreas, com a coluna `nivel` (`area` ou `subarea`), independentemente do que está aberto na tela.

### 2026-10-08 — Dívida: fontes, indicador e o que fica fora
**Decisão:**
- **Estoque:** RGF Anexo 02, 3º quadrimestre (estoque de 31/dez), `co_poder=E` (sem ele a API devolve vazio, sem erro). **Fluxo:** DCA Anexo I-D, grupos 3.2 (juros e encargos) e 4.6 (amortização), liquidado, exceto intra. Os dois vão para a tabela `demonstrativo` como vieram (`rgf.py`, `dca.extrair_natureza`).
- **Indicador exibido: a linha oficial `PercentualDaDCLSobreARCL`**, sem recálculo. No RJ 2024 ela diz **211,32%**, e a trajetória de retorno ao limite, no mesmo relatório, traz "% DCL (b)" = **211,23%**. A divergência (0,09 ponto) é do próprio relatório; usamos a linha oficial e não a corrigimos.
- **Validação só na coluna do 3º quadrimestre**, a única usada: DC − deduções = DCL e, em cada nível, soma das subcontas = pai (DC, contratual, empréstimos, financiamentos, parcelamentos). As colunas intermediárias (saldo anterior, 1º e 2º quadrimestres) têm subcontas que não somam em vários estados (ex.: AM em todos os anos, no 1º quadrimestre) e não são usadas.
- **Fora de qualquer total:** as linhas do anexo que não integram a dívida consolidada (passivo atuarial, precatórios anteriores a 05/05/2000, precatórios posteriores não incluídos na DC, RP não processados, depósitos judiciais e sem contrapartida) e a dívida de PPP, que o RO (2023 e 2024) lança nessa seção, fora da dívida contratual (`rgf.FORA_DA_DC`).
- **Composição por tipo** (`publicacao/divida.py`): reestruturação; empréstimos e financiamentos internos; externos; parcelamentos; precatórios vencidos; outras (mobiliária, outras dívidas, demais contratuais). Soma = DC, conferida na exportação. O relatório não separa por credor.
- **Pagamento:** grupo da I-D ausente = 0 (nada liquidado nele, como a regra de ausência da despesa); UF/ano sem DCA I-D = nulo. Valores reais no front, com o mesmo fator do IPCA dez/dez (os estoques são de 31/dez).
- **Conferência só com aviso:** juros + amortização da I-D contra as subfunções 841–844 da I-E e contra o RREO Anexo 01 (6º bimestre). As subfunções não são usadas: cada estado as classifica de um jeito.
**Achados do lote (27 UFs, 2019–2025), 2026-10-08:**
- RGF Anexo 02: 189 de 189 extraídos e validados. DCA I-D: 189 de 189, depois de descobrir que **a linha do grupo (`DO3.2`, `DO4.6`) inclui as modalidades intraorçamentárias (`DI…91`)**: conferido em 1.303 combinações. Juros e amortização "exceto intra" = soma das modalidades `DO` (`dca.soma_modalidades`), não a linha do grupo. Na primeira versão, que usava a linha do grupo, 31 combinações falhavam na validação.
- Conferência: a natureza (I-D) bate com o **RREO Anexo 01 em 178 de 189** combinações; das 11 diferenças, 8 são de 2019. Em 2019, alguns estados lançaram amortização intraorçamentária na modalidade 90 (aplicação direta), e não na 91. Ex.: RJ 2019, R$ 228,3 mi em "Indenizações e Restituições" (elemento 93), que o RREO trata como intra; a I-D mostra R$ 924,9 mi pagos, o RREO R$ 696,6 mi (−24,7%). Mantida a I-D como fonte (decisão do usuário); nesses casos, o pago de 2019 inclui a parte intra. As subfunções 841–844 batem em só 43 de 189: confirmado que não servem para comparar estados.
- **Limite declarado ≠ limite legal** em alguns relatórios: CE 2019–2022 = 0; RR = 90% da RCL em todos os anos; SP 2025 = 170%; MS 2024 = 200,8%. O gráfico usa o **limite legal fixo** (200% e alerta 180% da RCL, Resolução do Senado nº 40/2001 e LRF), exportado em `divida.json` (`limite_legal_pct`, `alerta_legal_pct`); a tabela mostra o limite **declarado**, com esse nome.
- DCL negativa é possível e aparece (caixa maior que a dívida; ex.: RO 2024, −1,34% da RCL). Não é tratada como erro.

### 2026-10-08 — Receita: fonte, itens, padrão de exibição e anomalias
**Decisão:**
- **Fonte:** DCA Anexo I-C, gravada como veio em `demonstrativo` (`dca.extrair_receita`, lote `lote_receita.py`), 2019–2025. **Padrão de exibição: receita líquida das deduções** (bruta − transferências constitucionais aos municípios − FUNDEB − outras), sem intraorçamentárias: é o que fecha com o RREO Anexo 01. A bruta só aparece no destino dos impostos (ICMS, IPVA). A RCL continua vindo do RGF Anexo 02 (não dá para reconstruí-la pela I-C).
- **Intra pela categoria, não pelo prefixo:** categorias 7 e 8 são intraorçamentárias; em 2019 vários estados entregam essas categorias com prefixo `RO` (como se fossem exceto intra). Conferido nas 189 combinações.
- **Itens** em `dicionarios/nacional/receita_itens.csv` (item, codigo, ano_inicio, ano_fim), com os códigos antigos (até 2021) e novos (2022 em diante). Cada linha vale pelo **valor próprio** (valor − filhos diretos, `analytics.valores_proprios`) e cai no item de **prefixo mais longo** vigente no ano (`analytics.mapear_por_prefixo`). Os itens "outros/outras" pegam o grupo inteiro (1.1, 1.7, 1.7.1, 2.4.1, 1.3, 1, 2; e 7, 8 para intra), então nada some. Validado em 189 de 189: nenhum código sem item, soma dos itens = total da I-C em todas as colunas, líquida exceto intra = total do anexo.
- **Peso das fontes** pelo código, igual nos dois períodos: impostos próprios = grupo 1.1 (líquido das deduções); transferências da União = 1.7.1 + 2.4.1. O FUNDEB (retorno) não conta como transferência da União.
- **Royalties:** onde a fonte não separa, ficam não identificáveis, com ressalva por UF. Pelos dados, só o RJ: "Demais Receitas Patrimoniais" (1.3.9) vale 26% a 40% da receita dele (R$ 25,9 bi em 2024), sem detalhe, e o item royalties fica quase zerado; nenhum outro estado passa de 3,5%.
- **Anomalia registrada, sem reclassificar:** no RJ, "Outorga de Direitos de Uso de Recursos Hídricos" (1.3.4.5.01) salta de R$ 58 mi (2019) para **R$ 3,95 bi (2024) e R$ 1,99 bi (2025)**. O valor não combina com outorga de uso de água; deve ser outra receita lançada nesse código. Fica onde o RJ declarou (item "receita patrimonial").
**Achados do lote:**
- I-C líquida exceto intra = RREO Anexo 01 em **175 de 189**. Diferenças (declarações diferentes do mesmo estado nos dois relatórios; a I-C é a fonte): AC 2022, RR 2019–2022, AP 2019, 2020 e 2022, PI 2025 (+R$ 4,9 bi), CE 2019 (−R$ 3,7 bi) e 2025 (+R$ 2,7 bi), AL 2024–2025, PR 2021 (+R$ 1,4 bi exato).
- **Relatório de quebra 2021→2022** (`python -m publicacao.receita`): 8 itens com variação real acima de 50% em mais de 5 estados. Nenhum item central (ICMS, IPVA, ITCMD, IR, FPE, FUNDEB) aparece. Comparando com 2020→2021 e 2022→2023, não parecem efeito da recodificação: alienação de bens, operações de crédito e outras de capital saltam em 11 a 21 estados em todos os pares de anos (itens voláteis); receita patrimonial salta também em 2020→2021 (juros); royalties saltam em 2021→22 e 2022→23 (petróleo); "outras transferências da União" (+87% no agregado) recebe a nova compensação da União pelas perdas de ICMS da LC 194/2022 (código 1.7.1.9.62, em 15 estados). O ICMS cai 4,5% real em 2022 no agregado.

### 2026-10-08 — Página inicial e estado padrão do site
**Decisão:** a tela aberta sem `?view=` passa a ser "Por estado" (`VIEW_PADRAO` em `web/src/estado.js`, o único lugar que define isso; "Comparar" vai na URL como `?view=comparar`). O estado aberto sem `?uf=` é configurável em `config/site.yaml` (`uf_padrao: SP`), levado ao `meta.json` por `publicacao/exportar.py` (validado contra `ufs.csv`) e lido pelo front: a sigla não fica no código, pela regra de agnosticismo. "Nenhum estado" escolhido pelo leitor vai na URL como `uf=` vazio, para o link compartilhado abrir igual.
**Consequência:** links antigos sem `view` (que abriam "Comparar") passam a abrir "Por estado".
