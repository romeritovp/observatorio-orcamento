#!/usr/bin/env bash
# Simula o pedido de um robô de prévia (WhatsApp) contra o index.php rodando localmente (php -S) e confere as
# metatags devolvidas para três URLs: inicial, estado RJ e comparar saúde PE.
# Uso (de qualquer pasta): web/scripts/testar_metatags.sh        (precisa de php e do build em web/dist)
set -euo pipefail
cd "$(dirname "$0")/.."
command -v php >/dev/null || { echo "php não encontrado: instale o PHP para rodar este teste"; exit 2; }
[ -f dist/index.php ] && [ -f dist/data/compartilhar.json ] || { echo "rode antes: export (Python) e npm run build"; exit 2; }

PORTA=${PORTA:-8765}
php -S "127.0.0.1:$PORTA" -t dist >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null' EXIT
sleep 1

AGENTE="WhatsApp/2.23.20.0"
falhas=0
pedir() { curl -s -A "$AGENTE" "http://127.0.0.1:$PORTA/$1"; }
conferir() {  # url, padrão esperado (expressão regular), descrição
  if pedir "$1" | grep -Eq "$2"; then echo "ok    $3"; else echo "FALHA $3  ($1)"; falhas=$((falhas + 1)); fi
}

conferir ""                                  '<title>[^<]*as contas dos estados</title>'          "inicial: título padrão"
conferir ""                                  'og:image" content="https://[^"]*/og/padrao\.png"'  "inicial: imagem padrão"
conferir "?uf=RJ"                            '<title>As contas do Rio de Janeiro'                "estado RJ: título"
conferir "?uf=RJ"                            'og:image" content="https://[^"]*/og/estado-rj\.png"' "estado RJ: imagem"
conferir "?uf=RJ"                            'og:url" content="https://[^"]*/\?uf=RJ"'            "estado RJ: og:url"
conferir "?view=comparar&area=10&uf=PE"      '<title>Comparar estados: Saúde'                    "comparar saúde PE: título"
conferir "?view=comparar&area=10&uf=PE"      'og:url" content="https://[^"]*/\?view=comparar&amp;area=10&amp;uf=PE"' "comparar saúde PE: og:url"
conferir "?view=comparar&area=10&uf=PE"      'og:description" content="Quanto cada governo estadual gasta em saúde' "comparar saúde PE: descrição"
# parâmetros fora das listas fechadas caem no padrão e nada é injetado
conferir '?uf=%22%3E%3Cscript%3E&view=x'     '<title>[^<]*as contas dos estados</title>'          "parâmetro inválido: padrão"
if pedir '?uf=%22%3E%3Cscript%3E' | grep -q '<script>alert'; then echo "FALHA injeção"; falhas=$((falhas + 1)); else echo "ok    sem injeção"; fi

[ "$falhas" -eq 0 ] && echo "todas as metatags conferem" || { echo "$falhas falha(s)"; exit 1; }
