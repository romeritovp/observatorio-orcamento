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
