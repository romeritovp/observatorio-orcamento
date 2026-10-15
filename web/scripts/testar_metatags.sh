#!/usr/bin/env bash
# Simula o pedido de um robô de prévia (WhatsApp) contra o index.php rodando localmente (php -S) e confere as
# metatags devolvidas para as páginas em caminho (início, estado, indicador, comparar), os 301 das URLs antigas e o 404.
# Uso (de qualquer pasta): web/scripts/testar_metatags.sh        (precisa de php e do build em web/dist)
set -euo pipefail
cd "$(dirname "$0")/.."
command -v php >/dev/null || { echo "php não encontrado: instale o PHP para rodar este teste"; exit 2; }
[ -f dist/index.php ] && [ -f dist/data/compartilhar.json ] || { echo "rode antes: export (Python) e npm run build"; exit 2; }

PORTA=${PORTA:-8765}
# index.php como roteador: faz o papel da regra do .htaccess (caminho que não é arquivo → index.php)
php -S "127.0.0.1:$PORTA" -t dist dist/index.php >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null' EXIT
sleep 1

AGENTE="WhatsApp/2.23.20.0"
falhas=0
pedir() { curl -s -A "$AGENTE" "http://127.0.0.1:$PORTA/$1"; }
conferir() {  # url, padrão esperado (expressão regular), descrição
  if pedir "$1" | grep -Eq "$2"; then echo "ok    $3"; else echo "FALHA $3  ($1)"; falhas=$((falhas + 1)); fi
}
redireciona() {  # url antiga, destino esperado (Location), descrição
  local cabecalhos
  cabecalhos=$(curl -s -o /dev/null -D - -A "$AGENTE" "http://127.0.0.1:$PORTA/$1")
  if echo "$cabecalhos" | grep -q "301" && echo "$cabecalhos" | grep -iq "^location: $2"; then echo "ok    $3"; else echo "FALHA $3  ($1)"; falhas=$((falhas + 1)); fi
}

conferir ""                                  '<title>[^<]*as contas dos estados</title>'          "inicial: título padrão"
conferir ""                                  'og:image" content="https://[^"]*/og/padrao\.png"'  "inicial: imagem padrão"
conferir "rj"                                '<title>As contas do Rio de Janeiro'                "painel RJ: título"
conferir "rj"                                'og:image" content="https://[^"]*/og/estado-rj\.png"' "painel RJ: imagem"
conferir "rj/orcamento"                      'og:url" content="https://[^"]*/rj/orcamento"'      "orçamento RJ: og:url"
conferir "rj/pib"                            '<title>PIB dos Estados'                            "PIB RJ: título"
conferir "indicadores/educacao"              '<title>Educação'                                   "Educação nacional: título"
conferir "comparar?ufs=pe&indicador=orcamento&area=10" '<title>Comparar estados: Saúde'          "comparar saúde PE: título"
conferir "comparar?ufs=pe&indicador=orcamento&area=10" 'og:description" content="Quanto cada governo estadual gasta em saúde' "comparar saúde PE: descrição"
# URLs antigas: 301 para a nova
redireciona "?uf=RJ"                         "/rj/orcamento"                                     "antiga ?uf=RJ → /rj/orcamento"
redireciona "?view=pib&uf=SP&pano=2023"      "/sp/pib?pano=2023"                                 "antiga PIB SP → /sp/pib"
redireciona "?view=comparar&area=10&uf=PE"   "/comparar?ufs=pe&indicador=orcamento&area=10"      "antiga comparar → /comparar"
redireciona "?view=metodo"                   "/metodologia"                                      "antiga metodo → /metodologia"
# caminho inexistente: 404 com a página padrão; nada da URL é injetado
if curl -s -o /dev/null -w '%{http_code}' -A "$AGENTE" "http://127.0.0.1:$PORTA/zz/qualquer" | grep -q 404; then echo "ok    caminho inexistente: 404"; else echo "FALHA 404"; falhas=$((falhas + 1)); fi
if pedir '%22%3E%3Cscript%3E/pib' | grep -q '<script>alert'; then echo "FALHA injeção"; falhas=$((falhas + 1)); else echo "ok    sem injeção"; fi

[ "$falhas" -eq 0 ] && echo "todas as metatags conferem" || { echo "$falhas falha(s)"; exit 1; }
