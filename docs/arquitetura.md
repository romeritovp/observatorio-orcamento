# Arquitetura do Observatório dos Orçamentos

Como o projeto funciona, do download dos dados públicos até a tela no navegador. Escrito para quem precisa entender (ou apresentar) o todo sem ler o código. Os detalhes de cada regra estão em `docs/decisoes.md`; os de cada fonte, em `docs/fontes/`.

---

## 1. Em uma frase

Um site estático que compara as contas dos 27 governos estaduais (receita, despesa, dívida, empresas) e o contexto de cada estado (PIB, inovação, educação), a partir de dados públicos oficiais, com cada número rastreável até a fonte e conferido por testes automáticos.

## 2. O fluxo em cinco camadas

Os dados andam **numa direção só**. Nenhuma camada volta para editar a anterior.

```
 FONTES OFICIAIS           1. BRUTOS            2. EXTRATORES         3. TABELAS             4. PUBLICAÇÃO            5. SITE
 (APIs e planilhas)        data/raw/            extractors/           data/processed/        publicacao/              web/
                                                                                                                     
 SICONFI (Tesouro) ──┐                                                                                                
 ANP ────────────────┤     guardados como    →  leem, conferem,    →  tabelas canônicas  →  JSON em R$ nominais  →  Vite + React
 Tesouro (estatais) ─┤     vieram, com          gravam parquet        (parquet, uma         (web/public/data/)       faz as contas
 IBGE (IPCA, PIB) ───┤     data e hash          (só códigos)          pasta por UF/ano)                              e desenha as telas
 INPI (IBID) ────────┤                                                                                                
 Inep (IDEB) ────────┘                          ↑                     ↓                                               
                                                dicionarios/          analytics/  (funções puras de conta)            
                                                config/               analyses/   (relatórios em outputs/)            
```

| Camada | Pasta | Linguagem | O que faz | O que **não** faz |
|---|---|---|---|---|
| 1. Brutos | `data/raw/` | — | Guarda o arquivo exatamente como a fonte entregou, com URL, data e hash (SHA-256) num `manifesto.json` | Nunca é editada à mão |
| 2. Extratores | `extractors/` | Python | Lê o bruto, confere o layout e os totais, grava tabelas padronizadas | Não calcula indicadores |
| 3. Tabelas | `data/processed/` | parquet | Uma tabela por assunto, mesmo formato para todas as UFs | Não guarda valores corrigidos nem per capita (só R$ da época) |
| 4. Publicação | `publicacao/` | Python | Monta os JSON que o site lê e o "gabarito" para testar o site | Não faz as contas que o site mostra |
| 5. Site | `web/` | JavaScript (React) | Calcula (inflação, por habitante, %, rankings, tendências) e desenha | Não tem servidor, banco nem API |

**Por que assim:** cada camada pode ser conferida sozinha. Se um número na tela parecer errado, dá para seguir o caminho de volta: o JSON publicado, a tabela, o bruto e a fonte oficial.

---

## 3. As fontes de dados

| Fonte | O que traz | Extrator | Tabela gerada | Tela que usa |
|---|---|---|---|---|
| **SICONFI** (Tesouro Nacional), API | Contas anuais dos estados (DCA): despesa por área, receita, juros e amortização, população; dívida (RGF); conferência (RREO) | `extractors/nacional/siconfi/` | `despesa`, `demonstrativo`, `populacao` | Por estado, Comparar, Pesquisa e Inovação |
| **ANP**, planilhas | Royalties e participação especial do petróleo repassados aos estados | `extractors/nacional/anp/compensacoes.py` | `compensacoes_anp` | Por estado (receitas) |
| **Tesouro**, Raio X das estatais | Cadastro das empresas estaduais (dependentes ou não) | `extractors/nacional/tesouro_estatais.py` | dicionário `estatais.csv` | Por estado (estatais, avisos) |
| **IBGE**, SIDRA | Inflação (IPCA) | (série de referência) | `data/reference/` | Todas as telas com R$ corrigido |
| **IBGE**, Contas Regionais | PIB por estado e por atividade | `extractors/nacional/ibge_contas_regionais/` | `pib_uf`, `pib_uf_atividade` | PIB dos Estados |
| **INPI**, IBID | Índice de inovação por estado | `extractors/nacional/inpi/` | `ibid_escore`, `ibid_ranking` | Pesquisa e Inovação |
| **Inep**, IDEB | Qualidade da educação básica por estado, etapa e rede | `extractors/nacional/inep/` | `ideb` | Educação |

Todas são **nacionais**: o mesmo código serve às 27 UFs. Fontes estaduais (portais de transparência, TCEs) têm lugar reservado em `extractors/ufs/<uf>/`, mas ainda não foram implementadas.

---

## 4. Camada 1 — Dados brutos (`data/raw/`)

- Cada fonte tem sua pasta (`siconfi/`, `anp/`, `ibge/`, `inpi/`, `inep/`).
- As respostas da API do SICONFI são guardadas em JSON, uma por consulta: `data/raw/siconfi/<endpoint>/<código IBGE>/<ano>_...json`. Isso funciona como cache: rodar de novo não baixa o que já existe.
- Planilhas e zips ficam intactos, com um `manifesto.json` (URL, data, tamanho e SHA-256). Quando a fonte publica um MD5 (Inep), ele também é conferido.
- **Regra:** nunca editar. Se a fonte corrigir algo, baixa-se de novo (`--atualizar`).

## 5. Camada 2 — Extratores (`extractors/`)

**O contrato comum** (`extractors/base.py`):
- `ESQUEMAS`: as colunas e os tipos de cada tabela canônica. Coluna fora do esquema é erro; coluna ausente vira nula (nunca um valor inventado).
- `validar_soma`: confere se as partes somam o total (ex.: as áreas somam a despesa total).
- `gravar`: grava em parquet, uma pasta por UF e ano (`data/processed/<tabela>/uf=RJ/ano=2024/...parquet`).

**Cada extrator:** baixa o que falta, lê, **confere** e só então grava. As conferências variam por fonte. Alguns exemplos:
- SICONFI: as funções somam o total da despesa;
- IBGE: as atividades somam o total, e as UFs somam o Brasil;
- INPI: o ranking oficial bate com a ordenação dos escores;
- Inep: valores de controle e IDEB = N × P.

Se algo não bate, o extrator **para** em vez de gravar dado duvidoso.

**Regras que valem para todos:**
- Gravam **códigos**, não nomes (os nomes vêm dos dicionários na hora de exibir: evita grafias diferentes entre anos).
- Valores sempre em **R$ da época** (nominais). Corrigir pela inflação é tarefa de quem exibe.
- **Agnóstico de UF:** nenhum código fora de `extractors/ufs/<uf>/`, `config/ufs/<uf>.yaml` e `dicionarios/ufs/<uf>/` cita um estado específico. Toda tabela tem `uf` (sigla) e `cod_ibge` (código do IBGE, a chave com o SICONFI).

## 6. Dicionários e configuração

- `dicionarios/nacional/`: tabelas pequenas, versionadas, de código → nome (UFs, funções e subfunções do orçamento, itens da receita, atividades do PIB, dimensões do IBID, nomes de territórios do IDEB, regiões, estatais).
- `config/`: parâmetros que mudam sem mexer no código:
  - `site.yaml`: domínio, nome e UF padrão do site;
  - `siconfi.yaml`: endereço da API e pausas entre chamadas;
  - `ibge_contas_regionais.yaml`: edição do PIB;
  - `ibid.yaml`: a chave que libera a comparação dos escores do IBID entre anos;
  - `ufs/<uf>.yaml`: ressalvas específicas de um estado (hoje DF, MG, PR e RJ).

## 7. Camada 3 — Tabelas canônicas (`data/processed/`)

| Tabela | Formato | Conteúdo |
|---|---|---|
| `despesa` | largo | Execução por área (função), subárea (subfunção), estágio (empenhado, liquidado, pago), intraorçamentária ou não |
| `demonstrativo` | longo | RREO, RGF e DCA linha a linha (receita, dívida, juros...) |
| `populacao` | uma linha por UF e ano | A população usada pelo Tesouro |
| `compensacoes_anp` | longo | Royalties e participação especial por ano de caixa |
| `pib_uf`, `pib_uf_atividade` | largo | PIB, valor adicionado e volume; conta da produção por atividade |
| `ibid_escore`, `ibid_ranking` | longo | Escores (0 a 1) e posições do índice de inovação |
| `ideb` | longo | IDEB, notas do Saeb, aprovação, metas, por etapa e rede |

Lidas com `analyses.carregar.carregar("<tabela>")`. Descrição de cada coluna em `docs/dicionario.md`.

## 8. `analytics/` e `analyses/`

- **`analytics/`**: funções **puras** de conta: recebem uma tabela e devolvem outra, sem ler arquivo nem conhecer um estado específico. Os módulos são:
  - `deflacao`: correção pelo IPCA;
  - `normalizacao`: valores por habitante;
  - `comparacao`: participação %, ranking, mediana e variação;
  - `completude`: UF sem gasto declarado entra com zero, marcada;
  - `hierarquia`: códigos da receita;
  - `pib`: participações, volume e crescimento;
  - `estatais`, `nomes`: avisos de estatais e junção de nomes.
- **`analyses/`**: relatórios avulsos por tema, para uso interno (hoje, `saude.py`), que gravam em `outputs/<uf>/<tema>/`. Não alimentam o site.

## 9. Camada 4 — Publicação (`publicacao/`)

O comando central é **`uv run python -m publicacao.exportar`**. Ele lê as tabelas e grava tudo o que o site precisa em `web/public/data/`:

| Arquivo | Carregado | Conteúdo |
|---|---|---|
| `meta.json` | na abertura | Anos, UFs, fontes, datas de extração, ressalvas gerais, parâmetros das telas |
| `dicionarios.json`, `ipca.json` | na abertura | Nomes de UFs, funções e subfunções; série do IPCA |
| `despesa_funcoes.json`, `receita.json`, `divida.json`, `estatais.json` | na abertura | Despesa por área, receita, dívida e estatais das 27 UFs |
| `despesa/<UF>.json`, `receita/<UF>.json`, `estatais/<UF>.json` | ao escolher o estado | O detalhe de uma UF (subáreas, itens da receita, lista de empresas) |
| `pib.json`, `pib/<UF>.json` | só na tela PIB | PIB e atividades |
| `ibid.json`, `despesa_ensino_superior.json` | só na tela Inovação | IBID e a subfunção Ensino Superior |
| `ideb.json`, `ideb/<UF>.json` | só na tela Educação | IDEB (sem metas) e aprovação por série |
| `gabarito.json` | **nunca** (só testes) | As mesmas contas do site, feitas em Python, para conferência |
| `compartilhar.json` + imagens `og/` | pelo `index.php` | Textos e imagens das prévias no WhatsApp e redes sociais |

Os módulos ao lado (`receita.py`, `divida.py`, `compensacoes.py`, `pib.py`, `ibid.py`, `ideb.py`, `og.py`) montam cada arquivo. **Princípio:** a publicação entrega números em R$ da época; quem corrige pela inflação, divide pela população e ordena é o site.

**Por que dividir em arquivos:** o celular baixa só o necessário. A abertura leva o essencial das 27 UFs; o detalhe de um estado e as telas temáticas vêm quando o leitor pede.

## 10. Camada 5 — O site (`web/`)

### Vite: a ferramenta de construção

- `npm run dev` abre o site em modo de desenvolvimento.
- `npm run build` gera o site pronto em `web/dist/`: HTML, JavaScript, CSS e os JSON.
- `npm test` roda os testes (Vitest).
- `web/vite.config.js` faz três coisas:
  - usa caminho relativo (`base: './'`), para o site funcionar em qualquer pasta do servidor;
  - **apaga o `gabarito.json`** do site publicado;
  - preenche domínio e nome do site a partir de `config/site.yaml`.

### React: como o site está organizado (`web/src/`)

```
main.jsx ──► App.jsx ──► Navegacao (menu)
               │
               ├── dados.js ......... busca os JSON (gerais na abertura; o resto sob demanda, uma vez por sessão)
               ├── estado.js ........ lê e escreve o estado da tela na URL (?view=..&uf=..&ano=..)
               │
               └── telas/ ........... uma tela por item do menu
                     │                 (só escolhem colunas e textos; não fazem conta)
                     ├── usam calculos.js ...... TODAS as contas (inflação, por habitante, %, posição, mediana, PIB, IDEB)
                     ├── usam estatistica/ ..... tendência por regressão (taxa anual, intervalo de confiança)
                     ├── usam textos.js ........ frases geradas a partir dos dados ("Em 2025, o RJ...")
                     ├── usam formatacao.js .... R$, %, datas, CSV
                     └── usam componentes/ ..... gráficos e tabelas reutilizáveis (só desenham)
```

| Arquivo ou pasta | Papel |
|---|---|
| `App.jsx` | Carrega os dados, mantém o estado da tela sincronizado com a URL e escolhe qual tela mostrar |
| `estado.js` | Tudo o que muda a visão (estado, ano, área, etapa...) fica na URL: qualquer tela pode ser copiada e compartilhada |
| `dados.js` | Leitura dos JSON, com cache por sessão |
| `calculos.js` | **Única** casa das contas. Espelha `analytics/` do Python e é testado contra o `gabarito.json` |
| `estatistica/` | Regressão log-linear, intervalos, Newey–West, testes. Parâmetros em `configuracao.json` |
| `telas/` | `PorEstado` (com `ParteReceitas` e `ParteDividas`), `Comparar`, `PibEstados`, `PesquisaInovacao`, `Educacao`, `Metodo` |
| `componentes/` | Gráfico de linhas (`Evolucao`), barras, dispersão, tabelas com "Baixar CSV", cards, filtros, ressalvas |
| `conteudo/metodo/*.md` | O texto da página "Como fazemos", em três versões (simples, técnica e fórmulas). Os números entram por marcadores `{{...}}` preenchidos com os dados reais |
| `estilo.css`, `tema.js` | Visual e tema claro/escuro |

### As telas

| Menu | URL | O que mostra |
|---|---|---|
| Por estado | `?uf=RJ` (padrão) | As contas de um estado em quatro partes: receitas, despesas, dívidas e estatais |
| Comparar | `?view=comparar` | Uma área do orçamento (ex.: saúde) nos 27 estados: ranking, mediana, passo a passo da conta |
| PIB dos Estados | `?view=pib` | Tamanho da economia, peso dos setores, crescimento, tendência por atividade |
| Pesquisa e Inovação | `?view=inovacao` | Índice de inovação do INPI ao lado do gasto em ciência, tecnologia e ensino superior |
| Educação | `?view=educacao` | IDEB por etapa e rede: série histórica, tendência, ranking, aprovação por série |
| Como fazemos | `?view=metodo` | Fontes, contas, decisões, limitações e glossário, em três níveis de detalhe |

Toda ressalva exibida numa tela tem um link "entenda" para a explicação correspondente em "Como fazemos". Um teste garante que nenhuma fica sem link.

---

## 11. Como a qualidade é garantida

| Verificação | Onde | O que garante |
|---|---|---|
| Conferências na extração | cada extrator | Totais que fecham, layout esperado, valores de controle; senão o extrator para |
| Testes Python (`uv run pytest`) | `tests/` | Extratores (com arquivos de exemplo, sem internet), contas de `analytics/` com UFs fictícias, publicação |
| Testes do site (`npm test`) | `web/src/*.test.js(x)` | As contas do site batem com as do Python (`gabarito.json`) nas 27 UFs e em todos os anos |
| Referência estatística independente | `web/src/testes/referencia_tendencia.py` | A regressão de tendência bate com o pacote statsmodels |
| Testes de fumaça | `telas.test.jsx` | Cada tela renderiza com os dados reais, para qualquer estado |
| Registro de decisões | `docs/decisoes.md` | Toda escolha de tratamento de dados tem data, motivo e consequência |

## 12. Colocar no ar

1. `uv run python -m publicacao.exportar`: atualiza os JSON (e as imagens de prévia).
2. `cd web && npm test && npm run build`: confere e gera `web/dist/`.
3. Enviar o conteúdo de `web/dist/` por FTP para a hospedagem (Hostgator). Não há servidor de aplicação. O único código no servidor é o `index.php`, que escolhe o título e a imagem de prévia de cada link compartilhado (os robôs do WhatsApp não executam JavaScript).

## 13. Atualizar os dados

Todos os comandos rodam na raiz do projeto. Cada extrator só baixa o que falta; `--atualizar` força baixar de novo.

```bash
# Contas dos estados (SICONFI), todas as UFs; aceitam anos: ... lote_dca 2024 2025
uv run python -m extractors.nacional.siconfi.lote_dca        # despesa e população
uv run python -m extractors.nacional.siconfi.lote_receita    # receita
uv run python -m extractors.nacional.siconfi.lote_divida     # dívida, juros e amortização
uv run python -m extractors.nacional.siconfi.lote_rreo       # conferência

# Outras fontes
uv run python -m extractors.nacional.anp.compensacoes
uv run python -m extractors.nacional.tesouro_estatais
uv run python -m extractors.nacional.ibge_contas_regionais.pib
uv run python -m extractors.nacional.inpi.ibid
uv run python -m extractors.nacional.inep.ideb

# Publicar e testar
uv run python -m publicacao.exportar
uv run pytest
cd web && npm test && npm run build
```

## 14. Onde mexer para...

| Quero... | Onde |
|---|---|
| Mudar um texto da página "Como fazemos" | `web/src/conteudo/metodo/*.md` |
| Mudar uma ressalva | Gerais: no módulo de `publicacao/` da fonte; de um estado: `config/ufs/<uf>.yaml` |
| Mudar o estado que abre o site | `config/site.yaml` (`uf_padrao`) |
| Liberar a comparação de escores do IBID entre anos | `config/ibid.yaml` |
| Mudar os limites da classificação de tendência | `web/src/estatistica/configuracao.json` |
| Mudar uma conta exibida | `web/src/calculos.js` **e** a equivalente em Python (`analytics/` ou `publicacao/`), para o gabarito continuar batendo |
| Acrescentar uma fonte | Novo extrator em `extractors/nacional/<fonte>/`, esquema em `extractors/base.py`, ficha em `docs/fontes/`, testes em `tests/` |
| Acrescentar uma tela | `web/src/telas/`, item em `VIEWS` (`estado.js`), carga em `dados.js`/`App.jsx`, arquivo gerado em `publicacao/`, testes de fumaça |

## 15. Mapa de pastas

```
├── config/             parâmetros (site, fontes, ressalvas por UF)
├── dicionarios/        código → nome (versionado)
├── data/
│   ├── raw/            brutos, intocados (≈ 436 MB)
│   ├── reference/      IPCA
│   └── processed/      tabelas canônicas em parquet (≈ 42 MB)
├── extractors/         base.py + um extrator por fonte (nacional/ e ufs/)
├── analytics/          funções de conta em Python
├── analyses/           relatórios avulsos (outputs/)
├── publicacao/         gera web/public/data/ e as prévias de compartilhamento
├── tests/              testes Python
├── docs/               decisões, dicionário de dados, fichas das fontes, esta página
└── web/
    ├── public/data/    JSON publicados (≈ 20 MB, gerados; nunca editar à mão)
    ├── public/index.php  prévias de compartilhamento
    ├── src/            React: App, telas, componentes, calculos, estatistica, conteúdo
    └── dist/           site pronto para o FTP (gerado pelo build)
```

## 16. Glossário mínimo

| Termo | Significado |
|---|---|
| SICONFI | Sistema do Tesouro Nacional onde estados e municípios entregam suas contas |
| DCA | Declaração de Contas Anuais: o balanço do ano (despesa, receita, população) |
| RGF / RREO | Relatórios da Lei de Responsabilidade Fiscal (dívida; execução do orçamento) |
| Função / subfunção | Classificação nacional da despesa por área (ex.: 10 Saúde; 12 Educação → 364 Ensino Superior) |
| Liquidado | Etapa da despesa em que o serviço foi prestado ou o bem entregue; é a usada no site |
| Intraorçamentária | Pagamento entre órgãos do próprio estado; fica de fora para não contar duas vezes |
| R$ da época × corrigido | Valor como foi registrado × valor atualizado pela inflação (IPCA) até dezembro do último ano |
| Parquet | Formato de tabela compacto usado nas tabelas intermediárias |
| Gabarito | O mesmo cálculo feito em Python, usado para testar se o site calcula certo |

---

## Roteiro sugerido para apresentar (10 a 15 minutos)

1. **O problema** (1 min): as contas dos estados são públicas, mas espalhadas, em formatos técnicos e difíceis de comparar.
2. **O que o site faz** (2 min): mostrar uma tela ao vivo (Por estado → Comparar → Educação) e a página "Como fazemos".
3. **O caminho do dado** (3 min): o diagrama da seção 2. Destacar que o bruto é guardado como veio e que tudo é rastreável.
4. **As fontes** (2 min): a tabela da seção 3.
5. **Confiabilidade** (3 min): conferências na extração, gabarito Python × site, testes; mostrar um "entenda" e a versão "Fórmulas".
6. **Como se mantém** (2 min): atualizar = rodar os comandos da seção 13 e subir o `web/dist/`.
7. **Próximos passos** (1 min): fontes estaduais (TCE e portais), cruzamento da educação com o gasto por aluno (depois do Censo Escolar).
