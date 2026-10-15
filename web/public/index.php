<?php
// Metatags por página para os robôs de prévia (WhatsApp, Facebook, X), que não executam JavaScript.
// Lê o index.html do build e troca title, description, canonical, og:title, og:description, og:url e og:image.
// As páginas são caminhos (/orcamento/sp/pib); o .htaccess manda todo caminho que não é arquivo para cá.
// Os textos vêm de data/compartilhar.json (gerado por publicacao/og.py), nunca escritos aqui.
// Cada parâmetro é validado contra uma lista fechada; qualquer outro valor cai no padrão.

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache');

$html = @file_get_contents(__DIR__ . '/index.html');
$textos = json_decode((string) @file_get_contents(__DIR__ . '/data/compartilhar.json'), true);
if ($html === false) {
    http_response_code(500);
    exit('index.html não encontrado');
}
if (!is_array($textos)) {
    echo $html; // sem textos: serve o index.html com as metatags base
    exit;
}

// Servidor embutido do PHP (testes): arquivos que existem são servidos direto
if (PHP_SAPI === 'cli-server' && is_file(__DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH))) {
    return false;
}

// Listas fechadas vindas do JSON: nada da URL entra na página sem estar nelas
$ufs = $textos['ufs'] ?? [];
$funcoes = $textos['funcoes'] ?? [];
$indicadores = $textos['indicadores'] ?? [];

// Caminho relativo à pasta do site (o .htaccess manda todo caminho que não é arquivo para cá):
// /orcamento/sp/pib → ['sp', 'pib']
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/';
$caminho = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$relativo = substr($caminho, 0, strlen($base)) === $base ? substr($caminho, strlen($base)) : ltrim($caminho, '/');
$partes = array_values(array_filter(explode('/', rawurldecode($relativo)), 'strlen'));
$ufDe = fn($slug) => array_key_exists(strtoupper((string) $slug), $ufs) && strlen((string) $slug) === 2 ? strtoupper($slug) : null;

// URLs antigas (?view=...&uf=..., antes das rotas em caminho): redirect 301 para a nova (mesma regra de src/rotas.js)
if (!$partes && (isset($_GET['view']) || isset($_GET['uf']))) {
    $resto = $_GET;
    $view = (string) ($resto['view'] ?? 'estado');
    $uf = $ufDe($resto['uf'] ?? '');
    unset($resto['view'], $resto['uf']);
    $porView = ['pib' => 'pib', 'educacao' => 'educacao', 'inovacao' => 'pesquisa-e-inovacao', 'estado' => 'orcamento'];
    if ($view === 'metodo') {
        $novo = 'metodologia';
    } elseif ($view === 'comparar') {
        if ($uf !== null) {
            $pares = array_filter(array_map($ufDe, explode(',', (string) ($resto['pares'] ?? ''))));
            unset($resto['pares']);
            $resto = ['ufs' => strtolower(implode(',', array_merge([$uf], $pares))), 'indicador' => 'orcamento'] + $resto;
            $novo = 'comparar';
        } else {
            $novo = 'indicadores/orcamento';
        }
    } elseif (isset($porView[$view])) {
        $novo = $uf !== null ? strtolower($uf) . '/' . $porView[$view] : ($view === 'estado' ? '' : 'indicadores/' . $porView[$view]);
    } else {
        $novo = '';
    }
    $consulta = http_build_query($resto);
    header('Location: ' . $base . $novo . ($consulta !== '' ? '?' . str_replace('%2C', ',', $consulta) : ''), true, 301);
    exit;
}

// Página: início, metodologia, comparar (com a área, no orçamento), visão nacional de um indicador, painel do estado
// ou indicador num estado. Caminho que não existe: página padrão e status 404 (o site mostra "não encontrada").
$pagina = $textos['padrao'];
$valido = true;
if (!$partes || $partes === ['metodologia']) {
    // padrão
} elseif ($partes === ['comparar']) {
    $pagina = $textos['comparar'];
    $area = (string) ($_GET['area'] ?? '');
    if (array_key_exists($area, $funcoes) && ($_GET['indicador'] ?? 'orcamento') === 'orcamento') {
        $pagina = array_merge($pagina, $funcoes[$area]);
    }
} elseif (count($partes) === 2 && $partes[0] === 'indicadores' && isset($indicadores[$partes[1]])) {
    $pagina = $textos[$indicadores[$partes[1]]];
} elseif (($uf = $ufDe($partes[0])) !== null && count($partes) === 1) {
    $pagina = $ufs[$uf];
} elseif ($uf !== null && count($partes) === 2 && isset($indicadores[$partes[1]])) {
    $pagina = $partes[1] === 'orcamento' ? $ufs[$uf] : $textos[$indicadores[$partes[1]]];
} else {
    $valido = false;
    http_response_code(404);
}
$url = rtrim($textos['url_site'], '/') . '/' . ($valido ? implode('/', array_map('rawurlencode', $partes)) : '');

$e = fn($texto) => htmlspecialchars((string) $texto, ENT_QUOTES | ENT_HTML5, 'UTF-8');
$trocas = [
    '#<title>.*?</title>#s' => '<title>' . $e($pagina['title']) . '</title>',
    '#<meta name="description" content="[^"]*"#' => '<meta name="description" content="' . $e($pagina['description']) . '"',
    '#<link rel="canonical" href="[^"]*"#' => '<link rel="canonical" href="' . $e($url) . '"',
    '#<meta property="og:title" content="[^"]*"#' => '<meta property="og:title" content="' . $e($pagina['title']) . '"',
    '#<meta property="og:description" content="[^"]*"#' => '<meta property="og:description" content="' . $e($pagina['description']) . '"',
    '#<meta property="og:url" content="[^"]*"#' => '<meta property="og:url" content="' . $e($url) . '"',
];
if (!empty($pagina['image'])) {
    $trocas['#<meta property="og:image" content="[^"]*"#'] = '<meta property="og:image" content="' . $e($pagina['image']) . '"';
}
foreach ($trocas as $padrao => $novo) {
    // substituição literal (sem $1 etc. no texto): o valor já está escapado
    $html = preg_replace_callback($padrao, fn() => $novo, $html, 1);
}
echo $html;
