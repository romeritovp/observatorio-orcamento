# Observatório dos Orçamentos (orcamento-estados)

As contas dos 27 governos estaduais e o contexto de cada estado, com dados públicos oficiais: receita, despesa, dívida e empresas estaduais, ao lado de PIB, educação, inovação e violência. Cada número é rastreável até a fonte e conferido por testes. O projeto é **agnóstico de UF**: o mesmo código serve a todos os estados.

Tem duas partes:
- **Pipeline em Python**: baixa os dados, confere e grava tabelas padronizadas (parquet), e publica os JSON do site.
- **Site estático** (Vite + React, em `web/`): faz as contas (inflação, por habitante, rankings, tendências) e mostra as telas. Publicado por FTP, sem servidor de aplicação.

## Fontes

Todas nacionais (o mesmo código para as 27 UFs):

| Fonte | O que traz | Ficha |
|---|---|---|
| SICONFI (Tesouro Nacional), API | Contas anuais (DCA), dívida (RGF), execução (RREO), população | `docs/fontes/siconfi.md` |
| ANP | Royalties e participação especial do petróleo | `docs/fontes/anp.md` |
| Tesouro, Raio X das estatais | Empresas estaduais | `docs/fontes/tesouro_estatais.md` |
| IBGE | IPCA; PIB dos estados (Contas Regionais) | `docs/fontes/ibge.md`, `docs/fontes/ibge_contas_regionais.md` |
| INPI | Índice de inovação (IBID) | `docs/fontes/inpi_ibid.md` |
| Inep | IDEB | `docs/fontes/inep_ideb.md` |
| FBSP, Anuário Brasileiro de Segurança Pública | Mortes violentas intencionais e letalidade policial | `docs/fontes/fbsp.md` |

Fontes estaduais (TCE, portais de transparência) têm lugar reservado (`extractors/ufs/<uf>/`), ainda sem implementação.

## Fluxo

```
data/raw → extractors → data/processed → publicacao → web/public/data → web (site)
                ↑               ↓
          dicionarios/      analytics → analyses → outputs   (relatórios avulsos)
          config/
```

## Começando

```bash
uv sync                                  # Python 3.12+
uv run pytest                            # testes do pipeline

cd web && npm install                    # Node 20+
npm test                                 # testes do site (contas conferidas com o Python)
npm run dev                              # site em modo de desenvolvimento
```

Atualizar os dados, publicar e gerar o site: comandos em `docs/arquitetura.md` (seções 12 e 13).

## Documentação

- `docs/arquitetura.md`: como o projeto funciona, do dado bruto à tela (comece por aqui)
- `CLAUDE.md`: regras do projeto (contexto para a IA)
- `docs/guia-desenvolvimento.md`: princípios, o que já foi feito e próximos passos
- `docs/dicionario.md`: tabelas canônicas, arquivos publicados e dicionários
- `docs/fontes/`: uma ficha por fonte de dados
- `docs/decisoes.md`: registro das decisões de tratamento de dados
- `docs/fbsp_temas.csv`: mapeamento das colunas do Anuário do FBSP usadas pelo site
