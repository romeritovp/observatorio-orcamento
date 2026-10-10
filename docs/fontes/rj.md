# Fontes estaduais: Rio de Janeiro (RJ, cod_ibge 33)

Usadas para o detalhe que o SICONFI não traz: órgão, programa e ação.

## Candidatas

| fonte | URL | situação |
|---|---|---|
| TCE-RJ — dados abertos | a mapear | não verificada |
| Portal da Transparência RJ | a mapear | não verificada |

## Arquivos baixados

| fonte | ano | data do download | arquivo em data/raw | encoding | separador | decimal | linhas | observações |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## Particularidades

(Mudanças de classificação, órgãos extintos ou fundidos, colunas que mudam de nome entre anos.)

### Receita: "Outorga de Direitos de Uso de Recursos Hídricos" (DCA I-C, `1.3.4.5.01`) e a concessão da Cedae

Valores na DCA do RJ (receita bruta): R$ 58 mi (2019), R$ 63 mi (2020), **R$ 17,5 bi (2021)**, R$ 3,0 bi (2022), R$ 120 mi (2023), R$ 3,9 bi (2024), R$ 2,0 bi (2025). O salto de 2021 e as parcelas depois não combinam com outorga de uso de água.

- **Fonte externa:** IstoÉ Dinheiro, 16/06/2021 (reportagem sobre o leilão da Cedae): outorga total de R$ 22,7 bi pela concessão de parte dos serviços da Cedae à iniciativa privada, dos quais R$ 14,5 bi destinados ao estado, pagos em parcelas. Informação trazida pelo usuário em 2026-10-08; o projeto não conferiu o texto da reportagem nem os contratos de concessão.
- **Uso no projeto:** só como ressalva na tela (`config/ufs/rj.yaml`, `outorga_cedae`, anos 2021 a 2025), dizendo que é **provável** que a linha inclua esses pagamentos. Nada é reclassificado e nenhum total muda (`docs/decisoes.md`).
- **Não reconciliado:** os R$ 17,5 bi de 2021 já passam dos R$ 14,5 bi destinados ao estado segundo a reportagem; a linha pode incluir outras receitas ou parcelas com outro critério. Para confirmar, seriam precisos o balanço do estado de 2021 ou o detalhamento da receita no portal da transparência do RJ.
