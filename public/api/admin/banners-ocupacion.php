<?php
// public/api/admin/banners-ocupacion.php
// Informa si un espacio (placement + carril) está libre u ocupado, y por quién.
// GET ?placement=footer&lane=1&desde=2026-01-01&hasta=2026-12-31
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/banners.php';

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método no permitido']);
        exit;
    }

    $placement = isset($_GET['placement']) ? (string)$_GET['placement'] : '';
    $lane = isset($_GET['lane']) ? max(1, intval($_GET['lane'])) : 1;
    $desde = isset($_GET['desde']) ? trim((string)$_GET['desde']) : null;
    $hasta = isset($_GET['hasta']) ? trim((string)$_GET['hasta']) : null;

    if (!banners_placement_valido($placement)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ubicación inválida']);
        exit;
    }

    $ocupacion = banners_ocupacion($placement, $lane, $desde, $hasta);
    $conflictos = ($desde && $hasta) ? banners_conflictos($placement, $lane, $desde, $hasta) : [];

    echo json_encode([
        'success' => true,
        'placement' => $placement,
        'lane' => $lane,
        'lanes_totales' => banners_lanes($placement),
        'ocupado' => !empty($ocupacion),
        'ocupacion' => $ocupacion,
        'conflictos' => $conflictos,
    ]);
} catch (Throwable $e) {
    error_log('banners-ocupacion.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
