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

### 2026-10-08 — Compensações financeiras: quatro itens, comparação pela bruta
**Decisão:**
- O item "royalties" de `receita_itens.csv` virou quatro, nos códigos de transferência e de receita patrimonial dos dois períodos: **petróleo e gás** (`1.7.1.8.02.3` a `.6` até 2021; `1.7.1.2.52` depois; royalties, excedente, participação especial e FEP juntos, porque vários estados rotulam errado: AC, AP e MG, não produtores, lançam o FEP como royalties ou participação especial), **mineração / CFEM** (`1.7.1.8.02.2`, `1.7.1.2.51`, `1.7.2.2.51`, `1.3.4.4.02`), **recursos hídricos** (`1.7.1.8.02.1`, `1.7.1.2.50`, `1.7.2.2.50`, `1.3.4.5.03`) e **outras compensações** (o resto de `1.7.1.8.02`, `1.7.1.2` e `1.7.2.2`). O código `1.3.4.1` virou item próprio, "Petróleo – regime de concessão (receita patrimonial)": só aparece em MG 2019 (R$ 891 mi), PR 2022 (R$ 410 mi) e DF 2022 (R$ 0,3 mi).
- **Comparações de compensações entre estados usam a receita bruta**, porque a dedução da cota dos municípios varia: ES, RN, SE, AL, BA, PR, MT e CE deduzem parte do petróleo (ES, R$ 100 mi em 2024), os demais não. Pela líquida, a comparação misturaria os dois tratamentos. `receita.json` lista esses itens em `comparar_pela_bruta`.
- **Ressalvas por UF:** RJ (petróleo não separado na fonte; "Demais receitas patrimoniais" de 26% a 40% da receita); DF (sem linha de petróleo em nenhum ano; tem mineração e hídricos); MG só em 2022 (linha de petróleo não localizada; campo `anos`). **Hipóteses não verificadas**, marcadas como tal: `1.3.4.1` como parte do bônus de leilões do pré-sal repassada aos estados; "outras compensações" do PR (R$ 299 mi em 2024) como compensação de Itaipu.

### 2026-10-08 — ANP ao lado da DCA; regra dos 95%; ressalvas por UF na configuração
**Contexto:** o RJ (e o DF) não separam o petróleo na DCA. A recodificação de 2022 **não** explica a sobra de ~R$ 11 bi entre "Demais receitas patrimoniais" (1.3.9) do RJ e a ANP em 2019–2020: a 1.3.9 tem o mesmo código nos dois períodos, e as linhas que só aparecem a partir de 2022 na receita patrimonial (juros, aluguéis, cessão de direitos, ~R$ 3,9 bi em 2022) são recodificações de linhas antigas, fora da 1.3.9. Achado no caminho: a "outorga de recursos hídricos" do RJ vai a **R$ 17,5 bi em 2021** (e R$ 3,0 bi em 2022, R$ 3,9 bi em 2024), o que casa com a outorga da concessão da CEDAE (leilão de 2021), hipótese não verificada.
**Decisão:**
- Nova fonte nacional, a ANP (`extractors/nacional/anp/`, tabela `compensacoes_anp`, `docs/fontes/anp.md`): royalties e participação especial destinados ao estado, por ano de caixa. **Nenhum total da DCA muda**: a ANP só aparece ao lado, com a fonte.
- **A ANP por estado não inclui o FEP**; a DCA inclui. Comparações usam DCA sem o FEP declarado. Participação especial em dados abertos só até nov/2024: anos depois do último ano com participação especial ficam sem total da ANP (royalties marcados como parciais).
- **Regra dos 95%:** onde a DCA não separa o petróleo (`petroleo_nao_separado` em `config/ufs/<uf>.yaml`: RJ, DF), se o total da ANP for **de 95% a 100%** de "Demais receitas patrimoniais" no ano, a tela diz que a linha contém os repasses ("…dos quais R$ Y bi são royalties e participação especial repassados ao estado, segundo a ANP"). Fora disso (inclusive quando a ANP passa da linha, como no RJ 2021, 112%), mostra os dois valores lado a lado com a nota de que não se reconciliam. Para o RJ: explica em 2022, 2023 e 2024; não reconcilia em 2019, 2020 e 2021; 2025 sem total. Regra em `calculos.js` (`reconciliacaoPetroleo`).
- **Ressalvas e marcações por UF saem do código** (estavam em `publicacao/exportar.py`, com siglas escritas, contra a regra de agnosticismo) e vão para `config/ufs/<uf>.yaml` (`publicacao.receita`), lidas por `exportar.ler_config_ufs`.

### 2026-10-08 — Metatags de prévia vêm do PHP
**Contexto:** o site é uma SPA (React); o título e as metatags da página só existem depois que o JavaScript roda. Os robôs que montam as prévias de links (WhatsApp, Facebook, X, Telegram, LinkedIn) **não executam JavaScript**: leem só o HTML que o servidor devolve. Sem isso, todo link compartilhado (de um estado, de uma comparação) mostraria a mesma prévia genérica.
**Decisão:**
- `web/public/index.php` (o Hostgator roda PHP; `.htaccess` com `DirectoryIndex index.php`) lê o `index.html` do build e troca title, description, canonical, og:title, og:description, og:url e og:image conforme `view`, `uf` e `area`. Cada parâmetro é validado contra listas fechadas (UFs, funções e telas de `data/compartilhar.json`); qualquer outro valor cai na página padrão; tudo é escapado com `htmlspecialchars`. **O PHP não tem texto nem conta**: só escolhe entre os textos gerados no export (`publicacao/og.py`).
- Alternativas descartadas: pré-renderizar um HTML por URL (são 27 UFs × telas × áreas × anos; e o estado da tela está na busca da URL, que um site estático não distingue); serviço externo de prévia (dependência e custo).
- Imagens de prévia (1200×630, PNG < 300 KB) geradas pelo Python a partir dos JSONs exportados: `og/padrao.png` (sem números) e `og/estado-<uf>.png` (receita líquida, DCL/RCL e saúde por habitante do último ano). O teste confere os números com o `gabarito.json`. Para a imagem e o site usarem a mesma fonte, o site passou de `system-ui` para **Inter** (OFL), com os arquivos no repositório.
- Domínio, nome do site e indexação ficam **só** em `config/site.yaml` (lidos pelo build do Vite e pelo Python). `<meta name="robots" content="noindex">` sai só com `indexar: true`, quando a publicação aberta for autorizada.

### 2026-10-10 — Série estendida para 2015–2025
**Decisão:** ano inicial único, **2015**, para tudo (despesa, população, receita, dívida, gabarito). `ANOS_PADRAO = (2015, 2025)` fica só em `extractors/nacional/siconfi/lote.py`; os lotes importam de lá. IPCA de 2015–2018 acrescentado em `data/reference/ipca.csv` (fonte em `docs/fontes/ibge.md`). Todos os lotes rodaram com 108/108 UF-anos em 2015–2018 (DCA I-C, I-D, I-E; RGF Anexo 02; RREO Anexos 01 e 02).

**Despesa (DCA I-E) 2015–2016**
- Os totais vêm com outros nomes ("Despesas (Exceto Intraorçamentárias)", "Intra-Orçamentárias"): o rótulo é comparado sem acento, parênteses e hífens (`dca._normalizar`).
- Essas DCAs não trazem "FUnn - Demais Subfunções". Onde a função não tem "demais" e as subfunções não somam a função, a diferença vira uma linha `nivel = demais_calculado` (calculada, não declarada; nome na tela "Demais subfunções (calculado)"), e a validação de sempre continua (subfunções + demais = função). **Na prática nenhuma linha foi necessária:** nas 27 UFs, em 2015 e 2016, as subfunções somam exatamente a função. A regra fica para retificações futuras.
- Dicionários de funções e subfunções regenerados com os nomes de 2015–2025 (prevalece o mais recente): entrou a função 05 Defesa Nacional e 7 subfunções.

**RREO Anexo 02:** relatórios antigos (RN 2015, BA 2016) trazem as colunas só com a letra: "Até o Bimestre (b)" = empenhado e "(d)" = liquidado. A validação aceita os dois nomes.

**Receita (DCA I-C) até 2018**
- Até 2018 o anexo só traz o total geral (sem "exceto intra" e "intra"). A receita exceto intra é calculada pelas **categorias 1 e 2** (correntes e de capital); a validação passa a conferir sempre **1 + 2 + 7 + 8 = total**.
- Três codificações: até 2017 (7 segmentos), 2018–2021 e 2022 em diante. **2018 já usa a codificação de 2019–2021**: as regras de 2019–2021 em `receita_itens.csv` valem desde 2018, e um bloco novo `ano_fim = 2017` mapeia a codificação antiga (ICMS, IPVA, ITCMD, IR retido, FPE, SUS, FUNDEB, petróleo, mineração, recursos hídricos, outras compensações, convênios e transferências da União).
- **Multas, juros e dívida ativa dos impostos (até 2017):** os códigos identificam o imposto de origem (ex.: 1.9.1.1.42 = multas e juros do ICMS), então foram **somados ao imposto**, como na codificação atual, que já os inclui na linha do imposto. Efeito no ICMS (R$ bi, bruto): RJ 2015 35,0 → 36,0 (+2,7%), 2016 +2,0%, 2017 36,8 → 37,3 (+1,4%); PE 2015 +1,3%, 2016 +2,9%, 2017 14,15 → 14,34 (+1,3%). Com a soma, a série 2017 → 2018 fica suave (RJ 37,3 → 37,6; PE 14,3 → 15,4). Reversível só no CSV.
- **Adicional do ICMS para fundos de pobreza (FECP):** só aparece separado a partir de 2018. Antes não está na linha do ICMS (o ICMS sem o adicional não salta entre 2017 e 2018; com ele, o RJ saltaria 13,6%). Fica como ressalva geral ("Até 2017, outra codificação das receitas").
- **Petróleo até 2017:** o RJ lançava royalties e participação especial em "exploração de recursos naturais" (1.3.4, receita patrimonial), mapeada para petróleo e gás até 2017 (RJ 2015–2017: R$ 5,3 / 3,5 / 7,2 bi; ANP: 4,9 / 4,1 / 7,7 bi). Em MS e PA o 1.3.4 tem valores pequenos que podem ser outra receita mal rotulada; registrado, sem reclassificar.
- **Conferência com a ANP estendida a 2015–2017:** o FEP de até 2017 (1.7.2.1.22.70) passa a ser descontado (`compensacoes.codigo_fep`). Dos 33 UF-anos com total da ANP em 2015–2017, **26 ficam entre 90% e 110%** (DCA sem o FEP ÷ ANP). Fora da faixa: AM 2016 (152%), ES 2015 (110,4%), RJ 2016 (86%), PR 2017 (465%; valores pequenos), MA 2015 e 2017 (lança todo o petróleo como FEP) e MA 2016 (139%). Nenhum total da DCA muda.
- **RJ:** `petroleo_nao_separado_desde: 2018` em `config/ufs/rj.yaml`. Ressalva: separava até 2017; não separa a partir de 2018. `receita.json → petroleo.nao_separa_desde`; o front (`naoSeparaPetroleo`) só trata o RJ como "não separa" a partir de 2018.
- Conferência I-C × RREO Anexo 01 em 2015–2018: 76 de 108 iguais. As 32 diferenças são declarações diferentes do mesmo estado nos dois relatórios (a I-C é a fonte). As maiores: BA 2015 (+R$ 9,1 bi), PR 2015–2017 (−R$ 2,7 a −9,0 bi), CE 2015–2018 (−R$ 2,7 a −3,3 bi), RJ 2016 (+R$ 1,9 bi), MA (−R$ 1,3 a −1,5 bi), RN 2015 (−R$ 1,2 bi).

**Dívida (RGF Anexo 02) 2015–2016**
- Layout antigo: a dívida contratual se divide só em interna e externa (`rgf.layout_antigo`). A validação usa a hierarquia daquele layout (`HIERARQUIA_ANTIGA`).
- Exportados só DC, deduções, DCL, RCL e DCL/RCL; limite, alerta e **composição por tipo ficam nulos**, com nota de que não é comparável com 2017 em diante (`divida.json → nota_composicao_antiga`). Juros e amortização vêm da DCA I-D e continuam.
- AP 2017: DC − deduções negativa e DCL declarada como zero; aceito pela validação.
- Conferência do pagamento da dívida (I-D × RREO Anexo 01) em 2015–2018: 77 de 106 iguais; diferenças só como aviso.

**Estatais:** anos antes da primeira edição do cadastro (hoje 2023) ficam **sem informação de estatais** (`edicao_para_ano` → None/null; a tela mostra "Sem informação de estatais para este ano."). Antes, usavam a edição mais antiga, o que punha em 2015 empresas de 2023.

**Gabarito:** `gabarito.json` cobre 2015–2025 em todas as seções (despesa, totais, receita, dívida e medianas).

### 2026-10-10 — Estatais: edições antigas, edição do exercício e mudanças de dependência
**Decisão:** cada ano usa a edição do Raio X **daquele exercício** (`analytics.edicao_para_ano`: a mais recente que não passa do ano; anos sem edição mostram "Sem informação de estatais para este ano"; 2025 usa a de 2024, a última disponível). Entraram as edições dos exercícios **2021 (v2022) e 2022 (v2023)**, no mesmo formato das atuais; com elas a Sabesp aparece em SP de 2021 a 2023 e some em 2024. **2018–2020 ficam pendentes** (formatos e lacunas em `docs/fontes/tesouro_estatais.md`): até serem incorporados, mostram "sem informação".
**Nomes:** `analytics.limpar_anotacoes` tira, só na exibição, as anotações das edições (marcador "▪" no início, "(Baixada em …)", "(Torna-se subsidiária …)", "EM LIQUIDAÇÃO" e "- Extinta" no fim). O dicionário continua como veio. A situação já tem coluna própria.
**Mudanças de dependência** (todas as edições consecutivas; liquidado sem intra por habitante, R$ de dez/2025):
- 2021→2022: 15 mudanças, 7 com função; 2022→2023: 5, 4 com função; 2023→2024: as 3 já revisadas (Gaspisa, Metrô, CIAMA).
- **Quebra visível, no sentido da mudança: só CAEMA/MA, Saneamento (17), 2021→2022** (passou a dependente): de R$ 3,09 para R$ 85,13 por habitante (22º → 3º; 0,09% → 2,38% do orçamento), contra mediana de +19,6% nos outros estados.
- Sem quebra visível ou em sentido contrário ao esperado: METROFOR/CE (dependente só em 2022: +27,6% e depois −19,0%, perto das medianas de +74,7% e −11,3%), CETURB/ES (passou a dependente em 2022 com +15,2% contra +74,7%; deixou em 2023 e o gasto subiu 28,2%), Porto Piauí/PI (deixou em 2023, gasto +29,1%), EMSERH/MA Saúde (deixou em 2022, +0,9%), CASEGO/GO Agricultura (deixou em 2022, −21,5% contra +43,0%), METAGO/GO (valores ínfimos), EPC/PB Comunicações (deixou em 2023, +44,5%).
- Sem função (não testáveis): PRODUBAN/AL, BRB Serv/DF, PRODAGO/GO, MAPA/MA, TECPAR/PR, IAZPE/SC, BESCOR/SC, SAPIENS/SC, Investe Piauí/PI.
**Até a revisão:** o site só mostrava as mudanças das edições já revisadas. (Revisto na entrada seguinte, «Estatais 2019 e 2020; regra fixa…»: todas aparecem.)

### 2026-10-10 — Invariância 2019–2025 e desempenho da extensão
**Invariância** (JSONs novos × `d5698fa`, último commit publicado): despesa, receita (totais), dívida e gabarito (valores, medianas, receita, dívida) de 2019–2025 **sem nenhum valor diferente**. Diferenças, todas esperadas: (1) `gabarito.totais` 2019 ganha a variação sobre 2018 (antes nula, por ser o primeiro ano); (2) a função 05 (Defesa Nacional) entra no dicionário e gera linhas zeradas no gabarito (nenhum estado declara gasto); (3) itens da receita de 2019–2025: a divisão de "royalties" em quatro itens e o bloco de petróleo/ANP vêm do trabalho de 2026-10-08, ainda não publicado, e não da extensão. Recalculando a receita com o dicionário sem as regras da extensão, as 4.137 linhas de 2019–2025 saem idênticas.
**Desempenho** (build de produção, gzip, "Por estado" de SP, Chrome headless; mediana de 3): dados transferidos 744 → 1.136 KB. Desktop: tela pronta em 0,56 → 0,86 s. Celular médio (CPU 4×, 4G lento de 1,6 Mbps): 8,1 → 11,1 s, com 2,1 s de tarefa longa depois que os dados chegam. Trocar o ano: 34 → 44 ms (desktop), 163 → 214 ms (celular). Proposta (não implementada): dividir `despesa.json` em total+funções de todas as UFs (219 KB) e subfunções por UF (cerca de 31 KB cada), e as linhas de receita por UF.

### 2026-10-10 — Página "Como fazemos" (documentação no site)
**Decisão:**
- Nova tela `?view=metodo` ("Como fazemos"), com o nível da explicação na URL (`&nivel=tecnico`; padrão: simples) valendo para a página toda. Oito seções: o que é o site, fontes, refaça a conta, como cada número é calculado, decisões, limitações, glossário e histórico de versões.
- **Texto fora dos componentes:** um Markdown por seção em `web/src/conteudo/metodo/`, cada um com `## simples` e `## tecnico`, lido por um leitor de Markdown próprio (`web/src/markdown.js` e `componentes/Markdown.jsx`, sem biblioteca externa e sem `innerHTML`). Números entram por marcadores `{{...}}`, preenchidos por `telas/metodo/valores.js` a partir dos JSON publicados; marcador sem valor é erro.
- **Refaça a conta:** gerado de `despesa.json` e `ipca.json` por `passosPorHabitante` (`calculos.js`), com o estado e a área de `config/site.yaml` (`exemplo_metodo`, hoje saúde do RJ) e o anexo e a coluna da DCA vindos do extractor (`meta.json → documentacao.exemplo`). Como o ano mais recente é o ano base, o fator de correção é 1; para mostrar a correção, o mesmo passo a passo é repetido para o primeiro ano da série. O teste confere que o resultado é igual ao da tela (`indicadoresDaFuncao`), ao do `gabarito.json` e ao texto formatado da tela Comparar.
- **Fontes:** `meta.json → documentacao` traz links e a data da última extração de cada fonte, calculada no export a partir das tabelas processadas (SICONFI por demonstrativo, ANP), da data do commit do Raio X (`tesouro_estatais.COMMIT_DATA`) e da consulta ao SIDRA (`data/reference/ipca_fonte.yaml`). A população vem da DCA (não do IBGE), e a ficha diz isso.
- **"Entenda":** toda ressalva e todo aviso das telas (estatais, quebra de série) leva um link para a âncora correspondente (`conteudo/metodo/ligacoes.js`). Links `?view=...` trocam de tela sem recarregar os dados e rolam até a âncora. Testes: todo link interno aponta para âncora existente, as âncoras são as mesmas nas duas versões, toda ressalva publicada tem ligação (e nenhuma ligação sobra).

### 2026-10-10 — CE 2018: ICMS lançado como IVVC
**Achado (ao escrever as limitações):** o CE declarou R$ 2,59 bi em 2018 no código 1.1.1.8.02.5, Imposto sobre Vendas a Varejo de Combustíveis (IVVC, extinto em 1993). ICMS: R$ 11,35 bi (2017), R$ 8,84 bi (2018), R$ 12,55 bi (2019); ICMS + IVVC em 2018 = R$ 11,43 bi. Quase certamente é ICMS sobre combustíveis no código errado.
**Decisão:** não reclassificar (mesma regra das outras anomalias: fica onde o estado declarou, em "outros impostos e taxas"); registrado em "Limitações" na página do site. Pendente de confirmação do usuário.


### 2026-10-10 — Estatais 2019 e 2020; regra fixa para mudanças de dependência
**Decisões do usuário (2026-10-10):** incorporar o exercício 2020 (v2021, `.xls`, lido com `xlrd`, adicionado ao projeto); no exercício 2019 (v2020), setor e situação herdados pelo CNPJ da edição de 2021, com a dependência só da própria edição, e os campos herdados marcados; AP sem informação em 2019; 2018 sem informação; volta à **regra fixa** de avisos de mudança de dependência (todas as empresas com função, frase cautelosa atribuída ao Tesouro), com a verificação de efeito registrada aqui.
**Implementação:**
- Exercício 2020: 302 empresas, 26 UFs (o AP não aparece na planilha), sem coluna de sigla (fica nula). Setores já na classificação atual.
- Exercício 2019: planilha "PAF 2020" (duas linhas de título, cabeçalho "Grupo > Coluna"; `tesouro_estatais.ler_aba_paf_2020`). 254 empresas, 25 UFs. Setor e situação herdados de 2021 em 242; marcados em `campos_herdados = "setor,situacao"` e `herdado_de = "2021"` no `estatais.csv`, e com † na lista da tela. 12 sem par em 2021 ficam sem setor e situação (sem área relacionada; fora dos avisos, que exigem situação ativa).
- **Descartadas em 2019 (sem CNPJ de 14 dígitos; não corrigidas à mão):** MA: GASMAR, EMAP, MAPA, CAEMA (CNPJ em branco: por isso o **MA também fica sem informação em 2019**); SP: linha "EMAE – ações preferenciais" (em branco); PB: CEHAP (`09.111.168/00001-01`); PR: Estrada de Ferro Paraná Oeste (`80.544.042/001-22`); PE: SUAPE (`11.448.933/00001-62`); RJ: RIOTRILHOS (`46.118.18/0001-00`).
- Cobertura por UF: `estatais.json → ufs_por_edicao`; UF ausente da edição do ano mostra "Sem informação de estatais para este ano" (`calculos.edicaoDaUf`). Sem informação: todas as UFs até 2018; AP em 2019 e 2020; MA em 2019.
- Sabesp (SP): presente de 2019 a 2023 (em 2019, com setor e situação herdados), ausente em 2024.
- **Regra fixa:** saem os avisos só das edições revisadas (`EDICOES_COM_MUDANCAS_REVISADAS`); todas as 26 mudanças com função entre edições consecutivas viram aviso no gráfico (frase de `textos.avisoQuebraSerie`). Empresas sem sigla em nenhuma edição aparecem pelo nome.

**Verificação do efeito na despesa** (só registro; não muda o que é exibido). Liquidado sem intra por habitante, R$ de dez/2025, na função da empresa, ano anterior → ano da mudança; "mediana" = variação mediana dos outros estados na mesma função e anos. **Critério:** efeito visível ("sim") quando a variação da UF se afasta da mediana em 30 pontos percentuais ou mais **no sentido esperado** (para cima, se passou a dependente; para baixo, se deixou); "sentido contrário" quando se afasta 10 pontos ou mais no sentido oposto; senão, "não". Resultado: 10 sim, 6 não, 9 em sentido contrário, 1 não testável.

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

**Leitura:** os casos mais claros são CAEMA/MA (2021→2022), Gaspisa/PI (2023→2024), Metrobus/GO e CETURB/ES (2019→2020). METROFOR/CE, CETURB/ES e COHAB/ES mudam de classificação quase todo ano (dependente, não dependente, dependente…), e o gasto não acompanha: a oscilação parece ser da classificação informada ao Tesouro, não da execução. A Gaspisa em 2020→2021 tem valores ínfimos (R$ 0,26 → R$ 0,19 por habitante). Mudanças sem função correspondente (não testáveis): 21, de Instituto BRB/DF a CIAMA/AM.

### 2026-10-10 — Dados do site divididos por UF, carregados sob demanda
**Contexto:** com a série 2015–2025, a tela "Por estado" ficou lenta num celular médio (CPU 4×, 4G lento de 1,6 Mbps): 10,8 s até a tela pronta, 1.136 KB transferidos (gzip).
**Decisão (aprovada pelo usuário):** o export grava um arquivo geral e um por UF. Geral (abertura): `despesa_funcoes.json` (níveis total e função das 27 UFs: o que Comparar, rankings, medianas e resumos usam), `receita.json` sem as linhas por item, `estatais.json` sem a lista completa, mais meta, dicionários, IPCA e dívida. Por UF (tela "Por estado", sob demanda): `despesa/<UF>.json` (subfunção, demais, demais calculado), `receita/<UF>.json` (linhas por item), `estatais/<UF>.json` (lista completa por edição). `src/dados.js` busca a UF da URL junto com os gerais e guarda cada UF baixada na sessão. Os testes juntam todas as partes de novo (`src/testes/publicados.js`) e continuam comparando as 27 UFs com o `gabarito.json`; um teste confere que nada se perde nem se repete na divisão.
**Medição** (mesmo método de 2026-10-10; "Por estado" de SP; mediana de 3; gzip como no Hostgator):

| | Antes | Depois |
|---|---|---|
| Dados transferidos | 1.136 KB | 340 KB |
| Celular médio: tela pronta | 10,8 s | 6,5 s |
| Celular médio: dados chegam | 8,5 s | 4,6 s |
| Celular médio: maior tarefa longa | 1,9 s | 1,4 s |
| Celular médio: trocar o ano | 221 ms | 192 ms |
| Desktop: tela pronta | 0,87 s | 0,71 s |

**Consequência:** trocar de estado na tela baixa de 30 a 40 KB (gzip) do novo estado. O cálculo de todas as funções na abertura (rankings e medianas das 27 UFs) continua sendo a maior tarefa no celular.

### 2026-10-10 — "Por estado": indicadores por função calculados por partes, sob demanda
**Contexto:** depois da divisão dos dados por UF, a maior tarefa da abertura no celular era calcular os indicadores de todas as funções, para as 27 UFs e os 11 anos (~620 ms no Node; ~1,5 s com CPU 4×), embora a tela só precise de três partes deles.
**Decisão (pedida pelo usuário):** `calculos.indicadoresSobDemanda` calcula, com memorização, só o que a tela pede: `doAno(ano)` (todas as funções no ano escolhido, 27 UFs, com posições: composição e dívida × áreas), `daFuncao(funcao)` (a área escolhida em todos os anos: série com a mediana) e `daUf(uf)` (todas as funções da UF em todos os anos, só valores: tabela áreas × anos; sem posição e `n_ufs`, que numa fatia de uma UF não valem). **Nenhuma conta muda:** em `indicadoresDaFuncao`, participação, zero para ausência e posição são por ano, e deflação e por habitante são por linha, então as partes dão os mesmos números do cálculo completo. Testes: cada parte igual ao cálculo completo (todos os anos, todas as funções, as 27 UFs); os testes contra o `gabarito.json` não mudaram; o HTML da tela foi comparado com o da versão anterior em 27 combinações de UF, ano, área e métrica, idêntico (teste temporário, apagado). "Comparar" continua com o cálculo de uma função, como antes.
**Medição** (celular médio: CPU 4×, 4G lento; "Por estado" de SP; mediana de 3):

| | Cálculo completo | Sob demanda |
|---|---|---|
| Tela pronta | 6,5 s | 5,5 s |
| Da chegada dos dados à tela | 1,87 s | 0,90 s |
| Tarefas longas (soma) | 1,65 s | 0,58 s |
| Maior tarefa longa | 1,51 s | 0,46 s |
| Trocar para um ano ainda não visto | 188 ms | 362 ms |
| Desktop: tela pronta | 0,65 s | 0,47 s |

**Consequência:** trocar para um ano ainda não calculado custa mais (o ano é calculado na hora); voltar a um ano já visto não recalcula. O restante do tempo de abertura no celular é rede (dados chegam em ~4,6 s).

### 2026-10-12 — PIB por UF: Contas Regionais do IBGE (`pib_uf` e `pib_uf_atividade`)
**Contexto:** nova fonte nacional para normalizar e contextualizar os orçamentos pelo tamanho da economia de cada UF. Inspeção do layout da edição 2023 (série 2002–2023) antes do parser; ficha em `docs/fontes/ibge_contas_regionais.md`.
**Decisão (do usuário):**
1. **Território:** 27 UFs e Brasil (`uf = BR`, `cod_ibge = 1`, o código do Brasil no IBGE e o `id_ente` da União no SICONFI), num dicionário novo, `dicionarios/nacional/territorios.csv`, para o `ufs.csv` continuar sendo a lista das 27 UFs. Regiões ficam de fora.
2. **Abas pela posição**, conferidas pelo conteúdo (território e atividade nas linhas 4 e 5 de cada bloco), nunca pelo nome da aba nem pelo ano do título: a Tabela19 tem abas com nome errado e 364 títulos dizem 2002-2022. Território ou atividade diferente do esperado faz o extractor falhar.
3. **Nomes de território normalizados** (sem acento, minúsculas, espaços nas pontas e repetidos removidos) antes da ligação com `ufs.csv`, como na ANP: cobre `Santa catarina`, `Mato Grosso `, regiões e Brasil indentados.
4. **#REF! e células vazias viram nulo**, nunca o código do erro. Acre 2002, atividades `09` a `13`: VBP e VAB nulos, **sem** preencher pela tab07; cada ocorrência vai para o log.
5. **R$ nominais** (fonte em R$ milhão × 1.000.000), sem coluna de unidade.
6. **`pib_uf`:** pib_corrente (tab01), vab (tab04), volume_pib_2002_100 (tab03), edicao. **Impostos não são gravados:** são calculados em `analytics/` como `pib_corrente − vab`.
7. **`pib_uf_atividade`:** atividade_cod (`01` a `13`, texto com zero à esquerda, para ordenar certo como texto; o número é o sufixo da aba), nivel (`total` para `01`, `atividade` para `02` a `13`), valor_producao, consumo_intermediario, vab (preço corrente) e vab_indice_volume (índice anual da Conta da Produção, nulo em 2002), edicao.
8. **`dicionarios/nacional/atividades_ibge.csv`:** atividade_cod, nome (oficial), nome_curto, grande_setor (Agropecuária = 02; Indústria = 03 a 06; Serviços = 07 a 13; Total = 01). A tab07 (com subtotais Indústria e Serviços) não é lida.

**Consequência:** a cada extração o extractor confere soma das atividades = total, VBP − CI = VAB e VAB da Conta = tab04 (tolerância de R$ 0,01 milhão), e falha se não bater. Os testes conferem também soma das UFs = Brasil e os índices anuais contra a tab05. A coluna `edicao` permite guardar edições diferentes no futuro (cada uma revisa a série inteira); hoje cada extração sobrescreve os parquets.

### 2026-10-14 — Tela "PIB dos Estados" (`?view=pib`)
**Contexto:** `pib.json` e `pib/<UF>.json` já eram publicados, mas sem tela.
**Decisão (do usuário: tela própria no menu; peso dos setores no ano **e** na série histórica):**
1. **Item novo no menu**, entre "Comparar" e "Como fazemos". `pib.json` e `pib/<UF>.json` só são baixados quando a tela é aberta (`dados.js`: `carregarPib`, `carregarPibDaUf`), como os arquivos por UF.
2. **Anos próprios na URL:** a série do PIB (2002–2023) não é a do orçamento, então a tela não usa `ano`: `pano` (ano, padrão o último do PIB), `desde` (início do crescimento; padrão o primeiro ano do orçamento quando há PIB nele, senão o primeiro do PIB; nunca o último) e `tpib` (tabela em % do VAB ou em R$). Gravados só quando `view=pib`. UF e pares são os mesmos das outras telas.
3. **Conteúdo:** resumo (PIB em R$ da época, participação no país com posição, crescimento em volume desde `desde`, com o do país); peso dos grandes setores no ano, as 12 atividades no ano e a composição dos setores ano a ano (barras 100% empilhadas, `setoresPorAno`: ano com algum setor nulo fica vazio, ex.: Acre 2002); crescimento pelo volume rebaseado (UF, pares e Brasil); participação no país ao longo do tempo e ranking das 27 UFs no ano; tabela atividades × anos; as três ressalvas de `pib.json`, cada uma com "entenda".
4. **Comparação entre UFs só normalizada:** % do país, % do VAB ou índice de volume. Valores em R$ só da própria UF e sempre da época: o PIB não é deflacionado pelo IPCA (o IBGE já separa preço e volume).
5. **Como fazemos:** ficha da fonte (`#fonte-pib`), cálculo (`#calculo-pib`) e três limitações (`#limite-pib-administracao-publica`, `#limite-pib-nominal`, `#limite-pib-defasagem`), com marcadores lidos de `meta.documentacao.fontes.ibge_contas_regionais`. Prévia de compartilhamento própria (`compartilhar.json` → `pib`; `index.php`).

**Consequência:** novas contas em `calculos.js` (`setoresPorAno`, `participacoesNoPais`) com teste; as do PIB batem com `gabarito.json` nos 28 territórios. Os eixos de ano de `Evolucao` e `BarrasEmpilhadas` passam a espaçar os rótulos pela largura (≥ 36 px, contados do último ano), o que também vale para as telas antigas em telas estreitas.

### 2026-10-14 — Tendência das atividades do PIB (regressão log-linear)
**Contexto:** pedido do usuário: na tela "PIB dos Estados", cada linha da tabela de atividades é clicável e abre cards com a tendência nos últimos 3, 5 e 10 anos e na série completa (padrão: Indústrias de transformação, `04`), pelo método especificado por ele (regressão sobre ln Y, cinco categorias, evidência separada da intensidade).
**Decisão:**
1. **Série analisada:** participação % da atividade no VAB da UF, não o VAB em R$ da época (que cresce com a inflação e cairia quase sempre em "crescimento acentuado"). Vale nos dois modos da tabela.
2. **Janelas:** "últimos N anos" = de ano − N ao ano escolhido (N + 1 observações); série completa = do primeiro ano até o ano escolhido. Variação acumulada pela distância entre os anos inicial e final.
3. **Inferência:** MQO com t de n − 2 gl. Com n ≥ 8, ρ₁, Durbin–Watson e Ljung–Box Q(1); se p < 0,10, intervalo e valor-p por Newey–West (Bartlett, ⌊4(n/100)^(2/9)⌋ defasagens, correção n/(n − 2)), com aviso. Com n < 8, a independência não é verificável e a leitura é marcada como frágil; com n < 4, só a estimativa pontual.
4. **Evidência × intensidade:** categoria só pela taxa anual (limites provisórios em `web/src/estatistica/configuracao.json`); evidência pelo intervalo de 95% (positiva, negativa, inconclusiva); manutenção testada à parte por equivalência (TOST, intervalo de 90% dentro de ±1% ao ano). Não rejeitar β = 0 nunca vira "manutenção".
5. **Dados:** ausentes, não numéricos, ≤ 0 e anos repetidos excluídos com o motivo, nunca preenchidos (ex.: AC, extrativas, VAB ≤ 0 em 2013 e 2022). A taxa é arredondada a 1e-9 p.p. antes de comparar com os limites (uma série de exatamente +1% ao ano dá 1,0000000000002% em ponto flutuante).
6. **Exceção à regra do espelho em Python:** o módulo fica em `web/src/estatistica/` (chamado por `calculos.tendenciasDaAtividade`), sem espelho em `analytics/` nem no `gabarito.json`. A conferência é contra o statsmodels/scipy: `web/src/testes/referencia_tendencia.py` (rodado com `uv run --no-project --with statsmodels`, sem virar dependência do projeto) grava `referencia_tendencia.json`, e o teste exige erro relativo < 1e-9 em β, erros-padrão (MQO e Newey–West), intervalos, R², Durbin–Watson e Ljung–Box.
7. **URL:** `ativ` (atividade, padrão `04`) e `jan` (janela da reta no gráfico, padrão série completa), só em `view=pib`.

**Consequência:** com 4 a 6 observações (3 e 5 anos), os intervalos são largos e a maioria dos cards fica "direção incerta". É o resultado honesto: a tela mostra a direção e diz que ela não está confirmada. Os limites das categorias e a margem de equivalência são parâmetros a revisar com o uso.

### 2026-10-14 — "Como fazemos": versão "Fórmulas" para auditoria (`?view=metodo&nivel=formulas`)
**Contexto:** pedido do usuário: além das explicações simples e técnica, uma versão com as contas aplicadas, para auditoria.
**Decisão (recomendações aceitas pelo usuário):**
1. **Terceira versão, só com as seções que têm contas** (hoje, a seção 4); a numeração das seções é a da página inteira. O bloco `## formulas` é opcional nos `.md`. Âncora que não existe nessa versão (ex.: link "entenda" para uma decisão ou limitação) leva à explicação técnica.
2. **Notação em texto Unicode, em bloco de código** (Σ, Π, ln, e^x), sem biblioteca de fórmulas: pode ser copiada para uma planilha.
3. **Cada fórmula traz** a fórmula, a origem de cada termo (arquivo publicado e campo, e a conta da fonte) e um exemplo com os números publicados da UF e da área do exemplo da página (`meta.json → documentacao.exemplo`), em R$ com centavos, sem arredondar.
4. **Os exemplos saem das funções do site** (`web/src/telas/metodo/formulas.js` só escolhe linhas e formata; os passos intermediários da regressão vêm de `analisarTendencia → intermediarios`), e o teste confere cada número exibido contra o `gabarito.json` (despesa, receita, dívida, PIB) e contra o statsmodels (tendência: a série real do exemplo está em `referencia_tendencia.json → exemplo_metodo`).
5. **DCL/RCL:** o site continua usando o percentual publicado; a fórmula mostra a conta (DCL ÷ RCL ajustada, ou RCL antes de 2019) só como conferência. `calculos.conferenciaDclRcl` foi verificada em todas as UFs e anos com os campos (287 de 297 linhas; o layout de 2015–2016 não traz DC e deduções): diferença máxima de 0,005 ponto, só arredondamento de duas casas; DC − deduções = DCL a menos de R$ 0,01.

**Consequência:** a versão "Fórmulas" carrega `pib.json` e `pib/<UF do exemplo>.json` (para os exemplos do PIB e da tendência); enquanto não chegam, a página avisa. Nova fórmula = novo bloco no `.md` + valores em `formulas.js` + teste contra a referência independente.

### 2026-10-14 — IBID (INPI) e a tela "Pesquisa e Inovação" (`?view=inovacao`)
**Contexto:** pedido do usuário: nova fonte nacional (IBID, extrator fornecido por ele) e uma página que cruza o índice com a despesa estadual em Ciência e Tecnologia.
**Decisão:**
1. **Pipeline no padrão das outras fontes nacionais:** `extractors/nacional/inpi/baixar.py` (bruto intacto + manifesto com SHA-256) e `ibid.py` (lê, confere, grava `ibid_escore` e `ibid_ranking` via `base.gravar`, mais `data/processed/ibid_fonte.json` com nota, SHA-256 e conferência). Siglas, dimensões e agregados vêm de dicionários (`ufs.csv`, `ibid_dimensoes.csv` novo, `regioes.csv` novo + `territorios.csv`); as asserções do extrator viraram `ErroValidacao` (um `assert` some com `python -O`); escores gravados sem arredondar (o arredondamento a 6 casas fica na publicação). Sem banco nem Makefile: o projeto usa parquet e módulos `uv run python -m`.
2. **`regioes.csv` separado de `territorios.csv`:** o extrator do PIB lê `territorios.csv` e passaria a aceitar regiões. As regiões usam `uf` por extenso (`SUDESTE`), nunca a sigla de duas letras ("SE" é Sergipe).
3. **JSON do site = saída original:** `publicacao/ibid.py` monta `web/public/data/ibid.json` das tabelas processadas no mesmo formato do extrator original; conferido idêntico (conteúdo e texto) ao `data/nacional/inpi/ibid.json`, exceto `extraido_em`.
4. **Regra de método (do usuário, até confirmar a comparabilidade):** evolução no tempo só por posição; escores só no mesmo ano; ressalva na tela. Um único ponto de configuração: `config/ibid.yaml → escores_comparaveis_entre_anos`, exportado para `meta.json → ibid`; com `true`, a tela oferece a série de escores e a ressalva sai.
5. **Agregados do INPI não são médias:** o escore do Brasil e das regiões é o publicado pelo INPI para o território (Brasil 2014: 0,2945 × 0,2428 de média simples das UFs). A tela compara os pilares da UF com esses escores e os chama de "escore da região/do país", não de "média".
6. **Cruzamento com o orçamento:** função 19 por `indicadoresDaFuncao` (mesmo deflator, população e base de "% do orçamento" das outras telas; conferido contra o `gabarito.json`), só nos anos das duas fontes (2015–2025), lado a lado com a posição no IBID, sem correlação nem causalidade estimadas.

**Consequência:** o ano padrão da tela é o último do IBID (2025); anos só do IBID (2014) mostram o índice e avisam que não há despesa. Ressalvas novas com "entenda": `limite-ibid-escores`, `limite-ibid-funcao-19`, `limite-ibid-causa`.

### 2026-10-14 — "Pesquisa e Inovação": estado típico, Ensino Superior, códigos das regiões e rótulos da dispersão
**Contexto:** decisões do usuário sobre os quatro pontos levantados na entrega da tela.
**Decisão:**
1. **Estado típico:** além dos escores oficiais do INPI para regiões e Brasil (que não são médias), o pipeline publica em `ibid.json → mediana_ufs` a mediana das 27 UFs por dimensão e ano (`publicacao/ibid.py`, `analytics.mediana_entre_ufs`), marcada como calculada pelo projeto. O front não calcula: os pilares mostram a UF contra região, Brasil (INPI) e estado típico, e os quadrantes da dispersão usam essa mesma mediana publicada. Nota na tela: o Brasil oficial fica acima da maioria dos estados (2025: 0,296 × 0,198 do estado típico), então estar abaixo do Brasil não é estar abaixo da maioria.
2. **Códigos das regiões:** o Brasil **não** ganhou código próprio. Ele não está em `regioes.csv`, e sim em `territorios.csv`, com `1`: o mesmo código do `pib_uf` e o `id_ente` da União no SICONFI; mudá-lo criaria dois códigos para o mesmo território entre tabelas. A colisão com o Norte (região 1) fica documentada, e um teste falha se a publicação ou a tela do IBID usarem `cod_ibge` (o `ibid.json` publicado nem traz o campo). A ligação é sempre pela coluna `uf`.
3. **Ensino Superior no cruzamento:** ao lado da função 19 (C&T), a subfunção 364 dentro da função 12 (Educação), DCA I-E, com as contas das subáreas (deflator, população, % sobre a despesa total da UF), e a soma "C&T + Ensino Superior" (despesas disjuntas: nos dados, a 364 só aparece sob a 12). Linhas publicadas em `despesa_ensino_superior.json` (27 UFs, R$ nominais); conta no front (`indicadoresDaSubfuncao`) espelhada em `publicacao.exportar.indicadores_da_subfuncao` (gabarito). UF que entregou a DCA sem a linha 12.364 entra com 0 marcado, sem ser tratada como erro: 38 casos de UF/ano em 2015–2025 (AC, MS, RN, RO, RS, SE; ver a lista no relato da entrega).
4. **Dispersão:** rótulo visível só na UF destacada e nas comparadas; os demais pontos mostram nome e escores em dica (mouse ou toque; alvo de toque de 24 px).

### 2026-10-14 — IDEB (Inep): extrator da edição 2025 (série 2005–2025)
**Contexto:** pedido do usuário: extrair o IDEB por UF, etapa e rede no padrão do IBID, sem integração na tela por enquanto.
**Decisão:**
1. **Fluxo do projeto:** `extractors/nacional/inep/baixar.py` (zips intactos + manifesto com SHA-256, conferência do MD5 publicado pelo Inep) → `ideb.py` (tabela `ideb`, formato longo, e `data/processed/ideb_fonte.json`) → `publicacao/ideb.py` (`data/nacional/inep/ideb.json`, o JSON pedido, no desenho do `ibid.json`). O extrator para antes de gravar se um valor de controle de 2025 não bater ou se algum valor sair da faixa.
2. **Dois arquivos do Inep:** o de regiões e UFs não tem o Brasil; ele vem de `divulgacao_brasil_ideb_<edicao>.zip`, o único com a rede municipal.
3. **Colunas pelo texto do cabeçalho** (linhas 7 a 9, desfeitas as mesclagens), com o código técnico da linha 10 só como conferência: a edição 2025 tem um código errado (P de 2025 rotulado 2023, anos iniciais, UFs) e um ausente (IDEB 2023, anos finais, Brasil). O erro conhecido fica numa lista explícita (`CODIGOS_COM_ERRO`); qualquer outra divergência para o extrator.
4. **Notas de rodapé no rótulo da rede** viram ressalvas por linha, com o texto lido do rodapé da própria aba (a numeração muda entre abas). Avisos gerais no JSON: formulação de 2007, metas só até 2021, pandemia em 2021, quebra do Saeb do médio em 2017 → 2019, escalas Saeb, municipalização; por UF: DF distrital.
5. **Metas** gravadas com `indicador = meta`, nunca misturadas ao observado; 2023 e 2025 ficam sem meta.
6. **Certificado TLS do Inep sem o intermediário:** completado com o intermediário do endereço AIA do próprio certificado, só para montar a cadeia até uma raiz do `certifi` (cadeia parcial desligada). Nenhuma dependência nova; a verificação nunca é desligada.

**Consequência:** conferências da edição 2025: 7/7 controles, N × P em 4.000 casos sem nenhum fora de ±0,1, nenhuma amplitude violada, 22 lacunas de cobertura explicadas (privada 2009 no Norte; RR estadual nos anos iniciais desde 2017). Cruzamento com a despesa (função 12 menos 364, por matrícula) depois do Censo Escolar.

### 2026-10-14 — Tela "Educação" (`?view=educacao`): IDEB por estado, etapa e rede
**Contexto:** pedido do usuário: uma tela para o IDEB, com seleção por estado e ano, série histórica e tendência, no padrão do projeto.
**Decisão:**
1. **Padrão da tela: ensino médio, rede estadual** (a responsabilidade principal dos governos estaduais), em `publicacao/ideb.py` (`ETAPA_PADRAO`, `REDE_PADRAO`) e no `meta.json → ideb`. Etapa, rede, ano e janela da tendência na URL (`etapa`, `erede`, `eano`, `ejan`), gravados só quando diferem do padrão.
2. **Dados divididos como as outras telas:** `ideb.json` (27 UFs, regiões e Brasil; IDEB, N, P, Saeb e aprovação total; **sem metas**; séries como listas alinhadas a `anos`, 75 KB com gzip) e `ideb/<UF>.json` (aprovação por série, ~1,4 KB), ambos carregados só na tela. O `data/nacional/inep/ideb.json` (com metas, no desenho do `ibid.json`) continua sendo a saída completa.
3. **Contas no front** (`calculos.js`): ranking e variação em pontos por etapa, rede e ano (espelho em `publicacao.ideb.gabarito_ideb` → `gabarito.json → ideb`), tendência com `analisarTendencia` em janelas de anos (6 e 10 anos e série completa; `configuracao.json → janelas_ideb_anos`), conferência N × P. Comparações sempre dentro de uma etapa e uma rede.
4. **Rede ausente na etapa** (a pública no ensino médio das UFs): a opção fica desativada no filtro, e a URL que a pede mostra um aviso, sem números.
5. **`Evolucao` posiciona os anos pelo tempo** (do primeiro ao último ano), não pela contagem de pontos: necessário para séries bienais; as anuais não mudam.

**Consequência:** ressalvas do IDEB com "entenda" para `limite-ideb-*` no "Como fazemos" (as quatro notas da planilha apontam para a mesma seção); cálculo em `#calculo-ideb` nas três versões, com o exemplo da versão "Fórmulas" conferido contra o gabarito. A versão "Fórmulas" passa a carregar também o `ideb.json`.

### 2026-10-15 — FBSP (Anuário Brasileiro de Segurança Pública): extrator genérico no padrão do projeto
**Contexto:** extrator exploratório do usuário (`extractors/nacional/fbsp/fbsp.py`) gravava num "banco" próprio (`banco/`), fora do fluxo do projeto.
**Decisão:** sem mudar a leitura (`para_longo`, `processa_pdf`, `processa_xlsx`):
1. Entrada padrão `data/raw/fbsp/`; execução por `uv run python -m extractors.nacional.fbsp.fbsp`; `pdfplumber` vira dependência do projeto (`uv add`).
2. **Tabela canônica `fbsp`** (esquema em `extractors/base.py`, gravada por `base.gravar` em `data/processed/fbsp/uf=<UF>/ano=<ano>/fbsp.parquet`) só com as células de UF (ou BR) e ano identificados, porque `uf`, `cod_ibge` e `ano` são obrigatórios; `cod_ibge` pelos dicionários; `extraido_em` nulo (arquivos baixados à mão).
3. **Material de conferência** (todas as células, catálogo, CSV por tabela) em `data/interim/fbsp/`: não é tabela canônica, então fica fora de `processed/`. Pasta `data/interim/` passa a existir para esse tipo de saída.
4. **Arquivos com o mesmo SHA-256 param a extração** (a edição vem do nome do arquivo e sairia trocada); `--ignorar` pula um arquivo. Motivo: `anuario-2016.xlsx` é cópia do de 2022.

**Consequência:** a tabela é exploratória (sem dicionário de indicadores; ano por heurística do cabeçalho, com casos errados documentados em `docs/fontes/fbsp.md`). Não alimenta nenhuma tela.

### 2026-10-15 — FBSP: ano só de uma fonte inequívoca, edições preservadas e a edição mais recente prevalece
**Contexto:** a primeira extração dava a 414 valores da Tabela 64 da edição 2026 o ano 2026, tirado do intervalo "2022-2026" do título. A causa era dupla: o cabeçalho só aceitava 5 linhas (a tabela tem 7, e a linha dos anos virava dado) e o ano saía do último ano encontrado no texto. Ano de cabeçalho com nota de rodapé ("2023 (2)") tinha o mesmo efeito (edição 2025, Tabela 46).
**Decisão (do usuário):**
1. **Ano da célula:** o cabeçalho da própria coluna, se tiver exatamente um ano (`ano_origem = coluna`); senão o título, se tiver exatamente um ano (`ano_origem = titulo`); senão nulo, com o motivo (`varios_anos_no_titulo`, `varios_anos_na_coluna`, `sem_ano`), e a célula não vai para `processed/`. Intervalo nunca vira ano. Cabeçalho de até 10 linhas; ano com nota colada ("2023 (2)") conta como ano; a última linha do cabeçalho não propaga para a direita (célula vazia ali é "sem ano", ex.: "Variação (%)").
2. **Edições preservadas:** a tabela `fbsp` guarda todas as edições em que um valor aparece, com `edicao`. Ex. real: mortes violentas intencionais (números absolutos), RJ, 2021: 4.755 na edição 2022 e 4.762 nas edições 2023 a 2026 (o anuário revisa o ano anterior). 617 das 672 combinações UF × ano aparecem em mais de uma edição.
3. **Regra de uso:** para cada indicador, UF e ano, **prevalece a edição mais recente**. Ela será aplicada na leitura, quando existir o dicionário de indicadores (a chave "indicador" ainda não existe: `titulo` e `coluna` mudam de redação entre edições). Nada é apagado na tabela.

**Consequência:** `processed/fbsp` passou a ter 188.289 valores (162.146 com ano da coluna e 26.143 com ano do título); 189.603 ficam fora, por motivo, em `data/interim/fbsp/fora_de_processed.csv` (sem UF: capitais, municípios, regiões e totais; sem ano inequívoco). O inventário das 15 mil combinações (edicao, titulo, coluna), em `data/interim/fbsp/inventario.csv`, é a base do dicionário de indicadores.

### 2026-10-15 — FBSP: território em qualquer coluna de identificação, grupo de qualidade e capital à parte
**Contexto:** o extrator só procurava a UF na 1ª coluna. Nas planilhas de 2018 em diante a tabela de mortes violentas intencionais (MVI) traz o grupo de qualidade dos dados na 1ª coluna ("Grupo 1") e a UF na 2ª; nos PDFs a 1ª coluna costuma vir vazia. O diagnóstico (`scripts/diagnostico_fbsp.py`) achou 91.307 valores de UF fora de `processed/` só por isso.
**Decisão (do usuário):**
1. **Colunas de identificação:** a 1ª coluna e as seguintes enquanto forem de texto nas linhas de dados (mais texto que número) ou de código/posição em ranking pelo cabeçalho (`Cód.`, `Código IBGE`, `Posição`, `Ranking`, `Nº` sozinho). O território é procurado em todas elas, pelos dicionários (`ufs.csv`, que ganhou a coluna `capital`, e `territorios.csv`); nada escrito no código.
2. **Vale o território mais à direita;** o que fica à esquerda é atributo: "Grupo N" (ou o "N opurG" invertido de alguns PDFs) vai para `grupo_qualidade`; em "Grupo 1 | AL | Maceió" a linha é da capital (UF como atributo), e o nome vai para `capital`. Coluna cujo cabeçalho é só de capitais: "DF | -" é Brasília, "Rio de Janeiro" é a cidade. Coluna de municípios (ou título de municípios com nome que não é território): a linha é `municipio`.
3. **Código e posição em ranking nunca viram valor.**
4. **Só linhas de UF e Brasil vão para `processed/`** (`nivel_territorial` em `uf`/`brasil`); capitais, total das capitais, regiões e municípios ficam em `data/interim/fbsp/` com o nível. Sem tabela municipal por enquanto; regra do ano inalterada.
5. **Aceitação:** em cada edição, a tabela de MVI por UF em `processed/` com as 27 UFs e a soma das UFs igual à linha Brasil em cada coluna de números absolutos ("-" conta zero na soma). Teste com a Tabela 02 de 2024 real (`tests/fixtures/fbsp/`); conferência de todas as edições no diagnóstico.

**Consequência:** `processed/fbsp` passou de 188.289 para 231.783 valores (873 arquivos). O ganho líquido de 43.494 já desconta 6.237 valores de tabelas de capitais ("SE | Aracaju", UF na 1ª coluna) que antes entravam como se fossem da UF e agora saem. Fora de `processed/`: 189.603 → 144.206; "UF fora da 1ª coluna" caiu de 91.307 para 5.984 (o resto está em PDFs com o bloco de UFs numa célula só ou fora das colunas de identificação), e "UF sem ano inequívoco" subiu de 31.475 para 66.192: são linhas de UF agora identificadas que esbarram na regra do ano, inalterada. A tabela de MVI por UF passa na aceitação nas 9 edições em planilha (2018–2026); nos PDFs (2007–2017) ela não é encontrada, ou sai como texto em bloco (2017). Ver `data/interim/fbsp/diagnostico/`.

### 2026-10-15 — FBSP: só as planilhas; ano com várias notas; colunas de variação fora de `processed/`
**Contexto:** a leitura dos PDFs (edições 2007–2017, `pdfplumber`) trazia tabelas em bloco de texto, texto invertido e páginas sem texto; a tabela de MVI por UF não passava na aceitação em nenhuma edição em PDF. Nas planilhas, cabeçalhos como "2019 (1) (2)" (ano com duas notas) não eram reconhecidos como ano, e a tabela inteira caía no intervalo do título (11 tabelas das edições 2022–2026).
**Decisão (do usuário):**
1. **Só planilhas:** o extrator lê apenas `data/raw/fbsp/anuario-<edição>.xlsx` (2018–2026). Os PDFs continuam em `data/raw/fbsp/`, mas não são lidos; a leitura de PDF (`processa_pdf`, a dependência `pdfplumber`, a forma invertida "1 opurG" do grupo de qualidade e os ramos de PDF do diagnóstico) saiu do código. Outros arquivos da pasta (planilhas de trabalho, temporários do Excel "~$...") são listados e ignorados.
2. **Ano de cabeçalho com qualquer número de notas** ("2019 (1) (2)", "2023 (2) (3)") é ano. A regra do ano (cabeçalho da coluna ou título com exatamente um ano) não mudou.
3. **Colunas de variação** ("Variação (%)", reconhecidas pelo cabeçalho da própria coluna) nunca vão para `processed/` (motivo `variacao` em `data/interim/fbsp/fora_de_processed.csv`): **são recalculáveis a partir dos valores dos anos**, que estão na tabela.

**Consequência:** `processed/fbsp`: 185.867 valores (9 edições, 806 tabelas, 28 territórios, 672 arquivos), contra 185.498 das planilhas e 46.285 dos PDFs antes. A aceitação de MVI por UF (27 UFs, soma das UFs = Brasil nas colunas absolutas) passa em 2018–2026. Não reaplicadas, de propostas anteriores: a exclusão de ano posterior à edição (os casos eram dos PDFs) e as colunas `formato_origem` e `n_ufs_tabela`. Cópia das mudanças descartadas em `backups/` (fora do git).

### 2026-10-15 — Navegação por estado e por indicador, com rotas em caminho
**Contexto:** o menu tinha uma aba por tela ("Por estado | Comparar | PIB dos Estados | Pesquisa e Inovação | Educação | Como fazemos") e o botão de tema quebrava para uma segunda linha; cada indicador novo virava uma aba.
**Decisão (do usuário, escolhida entre caminhos, parâmetros de busca e hash):**
1. **Modelo estado × indicador**, com duas entradas: "Estados ▾" (27 UFs por região) e "Indicadores ▾" (mega-menu por eixo), mais Comparar, Metodologia, busca de UF e o tema num botão-ícone. Nas páginas de um estado, um subcabeçalho fixo com o seletor de UF (mantém o indicador) e as abas (mantêm a UF). No celular, gaveta em tela cheia.
2. **Fonte única** `web/src/navegacao.config.js`: eixos e indicadores (`slug`, `nome`, `artigo`, `eixo`, `descricaoCurta`, `disponivel`, telas); as UFs vêm do `dicionarios.json` (regra do projeto: nenhuma lista de UF no código).
3. **Rotas em caminho reais** (`/orcamento/sp/pib`), resolvidas no navegador por `web/src/rotas.js`, sem biblioteca de roteamento. Isso substitui a regra anterior ("sem rotas no servidor; `base: './'`"): a base do Vite passa a ser a subpasta em caminho absoluto (lida do `config/site.yaml`), o `.htaccess` manda todo caminho que não é arquivo para o `index.php`, e o `index.php` lê o caminho para escolher as metatags de prévia (status 404 para caminho inexistente).
4. **As telas não mudaram de contrato:** `rotas.js` traduz caminho + busca para o estado que `estado.js` já lia (`view` e `uf`), e de volta. Parâmetros de busca continuam guardando o detalhe (ano, área, medida, pares).
5. **URLs antigas** (`?view=...&uf=...`) redirecionadas para as novas, com o restante da busca e a âncora: 301 no `index.php` e `replaceState` no navegador (mesma regra, testada dos dois lados). Links "entenda" apontam para `/metodologia#...`.

**Consequência:** mudar o site de pasta exige mudar o `dominio` em `config/site.yaml` e gerar o build de novo; a hospedagem precisa de `mod_rewrite`. Títulos das telas no padrão "O [Indicador] de [UF]". Página nova de visão geral do estado (`/sp`) e página inicial com as duas entradas.
