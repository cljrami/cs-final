<?php
// public/api/banners.php
// API pública: devuelve el banner vigente de un placement.
// GET ?placement=home_sidebar&ciudad=Santiago
// Sin autenticación. Cache-Control: no-store (los banners cambian seguido).

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/banners.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$placement = isset($_GET['placement']) ? (string)$_GET['placement'] : '';
$ciudad = isset($_GET['ciudad']) ? trim((string)$_GET['ciudad']) : null;
$lane = isset($_GET['lane']) ? max(1, intval($_GET['lane'])) : 1;

if (!banners_placement_valido($placement)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Placement inválido']);
    exit;
}

if ($lane > banners_lanes($placement)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Carril inválido para esa ubicación']);
    exit;
}

$banner = banners_obtener($placement, $ciudad, $lane);

if (!$banner) {
    echo json_encode(['success' => true, 'banner' => null]);
    exit;
}

echo json_encode([
    'success' => true,
    'banner' => [
        'id'        => (int)$banner['id'],
        'titulo'    => $banner['titulo'],
        'anunciante'=> $banner['anunciante'],
        'categoria' => $banner['categoria'],
        'texto'     => $banner['texto'],
        'imagen_url'=> $banner['imagen_url'],
        'placement' => $banner['placement'],
        'lane'      => (int)$banner['lane'],
        'ciudad'    => $banner['ciudad_nombre'],
        'url'       => '/api/banners/click.php?id=' . (int)$banner['id'] . '&p=' . rawurlencode($placement),
        'etiqueta'  => banners_etiqueta_publicidad(),
    ],
]);
