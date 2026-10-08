# orcamento-estados

Análises rápidas de orçamentos estaduais brasileiros com dados públicos. Começa pelo Rio de Janeiro e serve a qualquer UF.

- **Fonte nacional:** API do SICONFI (Tesouro Nacional) — RREO, RGF, DCA, MSC.
- **Fontes estaduais:** TCE e portal da transparência de cada estado, para órgão, programa e ação.

## Fluxo

```
data/raw → extractors → data/processed → analytics → analyses → outputs
                              ↑
                         dicionarios/
```

## Começando

```bash
uv sync
uv run pytest
```

## Documentação

- `CLAUDE.md` — regras do projeto (contexto para a IA)
- `docs/guia-desenvolvimento.md` — fases de desenvolvimento
- `docs/dicionario.md` — tabelas canônicas e dicionários
- `docs/fontes/` — uma página por fonte de dados
- `docs/decisoes.md` — registro de decisões
