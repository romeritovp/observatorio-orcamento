# Dicionários

Tabelas pequenas de código → nome, **versionadas no git**. Toda correção aqui muda os resultados das análises, então cada mudança vai num commit próprio.

- `nacional/`: classificações que valem para todas as UFs (UFs, entes, funções, subfunções, natureza da despesa).
- `ufs/<uf>/`: o que é próprio de cada estado (órgãos, correspondências entre anos).

Regras:
- Códigos sempre como texto (preservar zeros à esquerda).
- CSV em UTF-8, separador vírgula.
- Arquivo gerado por script (ex.: `entes.csv`) não é editado à mão: corrige-se o script e gera de novo.
- Colunas de cada arquivo: ver `docs/dicionario.md`.

Já preenchido: `nacional/ufs.csv`. Os demais são criados nas fases do guia.
