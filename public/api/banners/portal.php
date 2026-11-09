<?php
// public/api/banners/portal.php
// Portal del cliente: métricas de una campaña mediante su código de acceso.
// GET ?codigo=ABC12345
// Sólo devuelve datos de ESA campaña. Rate limited por IP+código.

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/banners.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$codigo = strtoupper(trim((string)($_GET['codigo'] ?? '')));

if (!preg_match('/^[A-Z0-9]{6,16}$/', $codigo)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Código inválido']);
    exit;
}

$rlPortal = rateLimitCheck('banner_portal', 60, 1, $codigo);
if (!empty($rlPortal['blocked'])) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Demasiadas consultas. Espera un momento.']);
    exit;
}

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("
        SELECT id, anunciante, categoria, titulo, texto, imagen_url, placement, ciudad_id,
               fecha_inicio, fecha_fin, estado, estado_pago, precio, moneda
        FROM banners WHERE codigo_acceso = ? LIMIT 1
    ");
    $stmt->execute([$codigo]);
    $b = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$b) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No encontramos ningún anuncio con ese código']);
        exit;
    }

    $bannerId = (int)$b['id'];

    // Totales
    $tot = $pdo->prepare("SELECT COALESCE(SUM(impresiones),0) AS imp, COALESCE(SUM(clicks),0) AS clk FROM banners_stats WHERE banner_id = ?");
    $tot->execute([$bannerId]);
    $totales = $tot->fetch(PDO::FETCH_ASSOC) ?: ['imp' => 0, 'clk' => 0];

    // Serie diaria
    $serie = $pdo->prepare("
        SELECT fecha, impresiones, clicks FROM banners_stats
        WHERE banner_id = ? AND fecha >= CURDATE() - INTERVAL 90 DAY
        ORDER BY fecha ASC
    ");
    $serie->execute([$bannerId]);
    $dias = $serie->fetchAll(PDO::FETCH_ASSOC);

    $impresiones = (int)$totales['imp'];
    $clicks = (int)$totales['clk'];
    $ctr = $impresiones > 0 ? round(($clicks / $impresiones) * 100, 2) : 0.0;

    echo json_encode([
        'success' => true,
        'banner' => [
            'titulo'        => $b['titulo'],
            'anunciante'    => $b['anunciante'],
            'categoria'     => $b['categoria'],
            'texto'         => $b['texto'],
            'imagen_url'    => $b['imagen_url'],
            'placement'     => $b['placement'],
            'fecha_inicio'  => $b['fecha_inicio'],
            'fecha_fin'     => $b['fecha_fin'],
            'estado'        => $b['estado'],
            'estado_pago'   => $b['estado_pago'],
            'precio'        => (float)$b['precio'],
            'moneda'        => $b['moneda'],
        ],
        'metricas' => [
            'impresiones' => $impresiones,
            'clicks'      => $clicks,
            'ctr'         => $ctr,
        ],
        'serie' => $dias,
    ]);
} catch (PDOException $e) {
    error_log('banners/portal.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log('banners/portal.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
