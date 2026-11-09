<?php
// public/api/banners/impresion.php
// Registra una impresión de banner. POST { banner_id, placement }
// Público, con rate limit y dedupe por cookie (6h).

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/banners.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$rlImpresion = rateLimitCheck('banner_impresion', 120, 1, '');
if (!empty($rlImpresion['blocked'])) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Demasiadas peticiones']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$bannerId = isset($input['banner_id']) ? intval($input['banner_id']) : 0;
$placement = isset($input['placement']) ? (string)$input['placement'] : '';

if ($bannerId <= 0 || !banners_placement_valido($placement)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
    exit;
}

banners_registrar_impresion($bannerId, $placement);

echo json_encode(['success' => true]);
