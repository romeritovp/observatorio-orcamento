<?php
// Metatags por página para os robôs de prévia (WhatsApp, Facebook, X), que não executam JavaScript.
// Lê o index.html do build e troca title, description, canonical, og:title, og:description, og:url e og:image.
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

// Parâmetros validados (listas fechadas vindas do JSON)
$ufs = $textos['ufs'] ?? [];
$funcoes = $textos['funcoes'] ?? [];
$view = in_array($_GET['view'] ?? '', $textos['views'] ?? [], true) ? $_GET['view'] : null;
$uf = strtoupper((string) ($_GET['uf'] ?? ''));
$uf = array_key_exists($uf, $ufs) ? $uf : null;
$area = (string) ($_GET['area'] ?? '');
$area = array_key_exists($area, $funcoes) ? $area : null;

// Página: comparar (com ou sem área) ou estado (com UF); o resto é a página padrão
$pagina = $textos['padrao'];
$consulta = [];
if ($view === 'comparar') {
    $consulta['view'] = 'comparar';
    $pagina = $textos['comparar'];
    if ($area !== null) {
        $consulta['area'] = $area;
        $pagina = array_merge($pagina, $funcoes[$area]);
    }
    if ($uf !== null) {
        $consulta['uf'] = $uf;
    }
} elseif ($uf !== null) {
    $consulta['uf'] = $uf;
    $pagina = $ufs[$uf];
}
$url = rtrim($textos['url_site'], '/') . '/' . ($consulta ? '?' . http_build_query($consulta) : '');

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
