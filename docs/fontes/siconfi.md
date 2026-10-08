# Fonte: SICONFI (Tesouro Nacional)

> Dicionários gerados por script a partir desta fonte:
> - `dicionarios/nacional/funcoes.csv` e `subfuncoes.csv`: gerados em 2026-10-08 por `python -m extractors.nacional.siconfi.lote_dca` (que roda `dicionario_funcoes` no fim), a partir da DCA Anexo I-E em cache: **27 UFs, exercícios 2019 a 2025** (189 arquivos). Resultado: 27 funções (falta só a 05, Defesa Nacional, que nenhum estado usa) e 105 subfunções.

Fonte nacional. Serve a qualquer UF com o mesmo formato.

- Documentação: https://apidatalake.tesouro.gov.br/docs/siconfi/
- URL base: ver `config/siconfi.yaml`
- Os dados são **declarados pelos próprios entes** e podem ser retificados depois. Guardar a data de cada extração.

## Endpoints de interesse

| endpoint | o que traz | parâmetros principais |
|---|---|---|
| `/entes` | cadastro de entes (estados, municípios, DF) | — |
| `/anexos-relatorios` | lista de anexos por demonstrativo | — |
| `/extrato_entregas` | o que cada ente entregou e quando | `id_ente`, `an_referencia` |
| `/rreo` | Relatório Resumido da Execução Orçamentária (bimestral) | `an_exercicio`, `nr_periodo`, `co_tipo_demonstrativo`, `no_anexo`, `co_esfera`, `id_ente` |
| `/rgf` | Relatório de Gestão Fiscal (quadrimestral) | `an_exercicio`, `in_periodicidade`, `nr_periodo`, `co_tipo_demonstrativo`, `no_anexo`, `co_esfera`, `co_poder`, `id_ente` |
| `/dca` | Declaração de Contas Anuais | `an_exercicio`, `no_anexo`, `id_ente` |
| `/msc_orcamentaria` | Matriz de Saldos Contábeis, contas orçamentárias (mensal) | `id_ente`, `an_referencia`, `me_referencia`, `co_tipo_matriz`, `classe_conta`, `id_tv` |

`id_ente` = código IBGE. Para estados, `co_esfera = E`.

> **A confirmar:** parâmetros obrigatórios exatos de cada endpoint e nomes exatos dos anexos por ano. Paginação e formato da resposta do `/rreo` já confirmados (abaixo).

## Formato da resposta (confirmado em `/rreo`, 2026-10-08)

Consulta: `an_exercicio=2025, nr_periodo=6, co_tipo_demonstrativo=RREO, no_anexo=RREO-Anexo 02, co_esfera=E, id_ente=33`.

Chaves de topo (padrão Oracle ORDS):

| chave | conteúdo |
|---|---|
| `items` | lista de linhas (ver abaixo) |
| `hasMore` | `true` se há mais páginas |
| `limit` | máximo de linhas por página: **5000** |
| `offset` | posição da primeira linha desta página |
| `count` | linhas nesta página |
| `links` | `self`, `describedby`, `first` (e `next` quando há mais páginas); os `href` apontam para um host interno, não para a URL pública |

**Paginação:** o cliente envia `offset` (começa em 0) e soma `len(items)` enquanto `hasMore` for verdadeiro. Não depende dos `links`, porque eles usam o host interno. Esta consulta trouxe 2043 linhas em uma única página (`hasMore = false`). Só `hasMore = false` foi observado até agora.

Campos de cada item (mesmo conjunto em todas as linhas):

| campo | tipo na API | exemplo | observação |
|---|---|---|---|
| `exercicio` | int | `2025` | → `ano` |
| `demonstrativo` | str | `RREO` | |
| `periodo` | int | `6` | bimestre |
| `periodicidade` | str | `B` | B = bimestral |
| `instituicao` | str | `Governo do Estado do ...` | nome do ente; não usar como chave |
| `cod_ibge` | **int** | `33` | converter para `str` |
| `uf` | str | sigla | conferir com `dicionarios/nacional/ufs.csv` |
| `populacao` | int | | população informada pelo SICONFI |
| `anexo` | str | `RREO-Anexo 02` | |
| `esfera` | str | `E` | |
| `rotulo` | str | `Total das Despesas Exceto Intra-Orçamentárias` | bloco do anexo; separa despesas intraorçamentárias das demais |
| `coluna` | str | `DOTAÇÃO INICIAL` | 13 colunas no Anexo 02, incluindo percentuais `% (b/total b)` |
| `cod_conta` | str | `RREO2TotalDespesas` | **não identifica a linha**: no Anexo 02 só há 2 valores, e a função/subfunção aparece apenas em `conta` |
| `conta` | str | `Legislativa`, `Ação Legislativa` | texto da linha; função e subfunção vêm misturadas, sem código |
| `valor` | int ou float | | a API devolve `int` quando o valor é inteiro; converter para `float` |

Chave única da linha no Anexo 02: (`rotulo`, `cod_conta`, `conta`, `coluna`). Sem `conta`, (`cod_conta`, `coluna`) repete em 22 casos.

## Formato da DCA Anexo I-E (confirmado, 2026-10-08)

Consulta: `/dca` com `an_exercicio=2024, no_anexo=DCA-Anexo I-E, id_ente=33`: 577 itens, 1 página. Chaves de topo iguais às do `/rreo`.

Campos de cada item: `exercicio`, `instituicao`, `cod_ibge` (int), `uf`, `anexo`, `rotulo`, `coluna`, `cod_conta`, `conta`, `valor` (int ou float), `populacao`. **Não tem** `periodo`, `demonstrativo` nem `esfera`.

- `populacao`: mesmo valor em todos os itens da resposta; `extrair_despesa_funcao` grava na tabela `populacao`. Repete entre alguns anos (ex.: RJ 2022 = 2023 e 2024 = 2025), então é a população cadastrada pelo Tesouro, não necessariamente a estimativa do IBGE do ano.
- `rotulo`: um único valor, `Total Geral da Despesa por Função`.
- `cod_conta`: sempre `TotalDespesas`; não identifica a linha.
- `coluna`: `Despesas Empenhadas`, `Despesas Liquidadas`, `Despesas Pagas`, `Inscrição de Restos a Pagar Processados`, `Inscrição de Restos a Pagar Não Processados`. Linha sem valor numa coluna simplesmente não aparece (ex.: `FU09` só tem empenhado).
- `conta`, em quatro formatos:

| formato | exemplo | nível |
|---|---|---|
| texto | `Despesas Exceto Intraorçamentárias` | total |
| texto | `Despesas Intraorçamentárias` | total intra (sem detalhe por função) |
| `NN - nome` | `10 - Saúde` | função |
| `NN.SSS - nome` | `10.302 - Assistência Hospitalar e Ambulatorial` | subfunção |
| `FUNN - Demais Subfunções` | `FU10 - Demais Subfunções` | resto das subfunções da função NN |

Conferido em 2024: soma das funções = `Despesas Exceto Intraorçamentárias`; subfunções + `FUNN` = função NN, em todas as colunas.

Lote 27 UFs × 2019–2025 (`lote_dca.py`, 2026-10-08): 189 combinações, todas com dados e todas passando na validação soma das funções = total. Nenhuma DCA vazia nem com linha de `conta` em formato desconhecido.

Mudanças de nome de subfunção observadas no período (o dicionário usa o nome mais recente):

| código | nome antigo | nome atual |
|---|---|---|
| 241 | Assistência ao Idoso | Assistência à Pessoa Idosa |
| 242 | Assistência ao Portador de Deficiência | Assistência à Pessoa com Deficiência |
| 784 | Transporte Hidroviário | Transporte Aquaviário |

Subfunções que só aparecem a partir de 2025: 245 (Serviços Socioassistenciais) e 246 (Segurança e Renda). Séries de assistência social (função 08) que cruzem 2024 e 2025 por subfunção precisam de cuidado.

## Conferência manual: Saúde do RJ em 2024 (2026-10-08)

Número conferido: liquidado da função 10 (Saúde) do RJ em 2024, sem intraorçamentárias, no parquet `data/processed/despesa/uf=RJ/ano=2024/siconfi_dca_anexo_i_e.parquet`.

| fonte | linha | liquidado (R$) |
|---|---|---|
| nosso parquet (DCA Anexo I-E) | `nivel = funcao`, `funcao_cod = 10`, `intra = false` | 10.294.795.547,63 |
| RREO Anexo 02, 6º bim. 2024 | rótulo `Total das Despesas Exceto Intra-Orçamentárias`, conta `Saúde`, coluna `DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)` | 10.294.795.547,63 |
| RREO Anexo 12, 6º bim. 2024 | — | **não disponível na API** |

**Resultado:** DCA e RREO Anexo 02 batem centavo a centavo (também empenhado, R$ 10.439.322.135,46, e o total sem intra, R$ 99.267.937.429,71).

**RREO Anexo 12 não está na API.** `consultar("rreo", {..., "no_anexo": "RREO-Anexo 12", ...})` devolve zero itens (o cliente avisa e não grava cache). Testado também para RJ 2023, 2025 e 5º bim. 2024, e para SP 2024: sempre zero. O RREO completo do RJ, 6º bim. 2024, sem filtro de anexo, traz só os anexos 01, 02, 03, 04, 06, 07, 09, 10 - RPPS, 11 e 14 (4.625 linhas, uma página). O demonstrativo de saúde dos estados é preenchido no SIOPS (Ministério da Saúde); para conferir o mínimo constitucional é preciso o PDF do RREO publicado pelo estado ou o SIOPS. O endpoint `/anexos-relatorios` não respondeu (3 tentativas de 60 s esgotadas) nesta data.

**Por que o Anexo 12 daria outro número (diferenças de conceito, não de dado):**
- O Anexo 12 mede **ações e serviços públicos de saúde (ASPS)** financiados com **receita de impostos e transferências constitucionais** (LC 141/2012). A função 10 inclui também o que é pago com transferências do SUS federal, operações de crédito e outras fontes.
- O Anexo 12 exclui despesas que a LC 141 não aceita como ASPS mesmo classificadas na função 10 (ex.: inativos e pensionistas, assistência à saúde restrita a servidores, saneamento financiado por tarifa).
- Para o mínimo, contam as despesas liquidadas **mais** os restos a pagar não processados inscritos até o limite da disponibilidade de caixa; o nosso número é só o liquidado.
- Portanto o valor de ASPS do Anexo 12 tende a ser **menor** que o liquidado da função 10 pela fonte, e pode ser maior pela regra de restos a pagar. As duas medidas respondem perguntas diferentes e não devem ser comparadas como se fossem a mesma.

**Achado: intraorçamentárias na Saúde.** O RREO Anexo 02 detalha as intraorçamentárias por função; a DCA I-E não. Em 2024 o RJ liquidou **R$ 3.460.448.468,60 intraorçamentários na função Saúde**, equivalentes a 34% do liquidado sem intra (e 43% de todas as intraorçamentárias do estado, R$ 7,99 bi). Intraorçamentária é operação entre órgãos e entidades do mesmo orçamento (ex.: contribuição patronal ao regime próprio de previdência, pagamentos a fundações e empresas estatais dependentes); excluí-las evita contar o mesmo gasto duas vezes, e é o padrão da tabela `despesa`. Mas o peso varia entre estados, conforme o modelo de gestão da saúde (administração direta, fundações, organizações sociais). Para medir esse efeito nas 27 UFs, usar o RREO Anexo 02, 6º bimestre (fase futura).

Tratado em `rreo.py` (identificação pelo `cod_conta` e pela `conta`): no Anexo 02 a linha `DESPESAS (INTRA-ORÇAMENTÁRIAS) (II)` aparece também dentro do rótulo `Total das Despesas Exceto Intra-Orçamentárias`; o rótulo sozinho não separa intra de não intra.

## Anexos de interesse

| anexo | pergunta que responde |
|---|---|
| RREO-Anexo 01 | balanço orçamentário: receita e despesa totais |
| RREO-Anexo 02 | despesa por função e subfunção |
| RREO-Anexo 03 | Receita Corrente Líquida (base para normalizar) |
| RREO-Anexo 12 | aplicação mínima em saúde. **Não disponível na API** (ver "Conferência manual") |
| RGF-Anexo 01 | despesa com pessoal |
| DCA-Anexo I-E | despesa anual por função e subfunção (empenhada, liquidada, paga) |

## Registro de verificações

| data | o que foi verificado | resultado |
|---|---|---|
| 2026-10-08 | `/rreo` Anexo 02, 6º bim., 27 UFs, 2019–2025 (`lote_rreo.py`) | 189 ok, 0 vazias, 0 erros. Blocos sempre com `cod_conta` `RREO2TotalDespesas` / `RREO2TotalDespesasIntra`; rótulo do bloco intra em 2019 = "Total de Despesas". Função 10 sem intra = DCA ao centavo em 185 de 189 (divergem RR 2019, MA 2019, MA 2020, SP 2022; ver decisoes.md). DF usa `co_esfera = E` |
| 2026-10-08 | conferência manual Saúde RJ 2024: DCA I-E × RREO Anexo 02 × RREO Anexo 12 | DCA = Anexo 02 ao centavo; Anexo 12 indisponível na API (zero itens em RJ e SP, 2023–2025) |
| 2026-10-08 | `/anexos-relatorios` | sem resposta (3 × timeout de 60 s) |
| 2026-10-08 | `/dca` 2019–2025, DCA-Anexo I-E, 27 UFs | 189 combinações ok, 0 vazias, 0 erros; mesmo formato em todos os anos |
| 2026-10-08 | `/dca` 2024, DCA-Anexo I-E, ente 33 | 577 itens, 1 página; hierarquia confere (ver seção acima) |
| 2026-10-08 | `/rreo` 2025, 6º bim., RREO-Anexo 02, esfera E, ente 33 | 2043 itens, 1 página, `limit` 5000; formato igual a `tests/fixtures/rreo.json` |
