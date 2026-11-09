<?php
// public/api/admin/banners-stats.php
// Métricas de banners: por banner, por placement y serie diaria.
// GET ?id=12&desde=2026-09-01&hasta=2026-10-20&formato=csv

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/banners.php';

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método no permitido']);
        exit;
    }

    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    $desde = isset($_GET['desde']) ? trim((string)$_GET['desde']) : '';
    $hasta = isset($_GET['hasta']) ? trim((string)$_GET['hasta']) : '';
    $formato = isset($_GET['formato']) ? (string)$_GET['formato'] : 'json';

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde)) $desde = date('Y-m-d', strtotime('-30 days'));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $hasta)) $hasta = date('Y-m-d');

    $params = [$desde, $hasta];
    $idCond = '';
    if ($id > 0) {
        $idCond = ' AND s.banner_id = ?';
        $params[] = $id;
    }

    // Serie diaria
    $stmt = $pdo->prepare("
        SELECT s.banner_id, b.anunciante, b.titulo, b.placement, s.fecha, s.impresiones, s.clicks
        FROM banners_stats s
        JOIN banners b ON b.id = s.banner_id
        WHERE s.fecha BETWEEN ? AND ? {$idCond}
        ORDER BY s.fecha ASC
    ");
    $stmt->execute($params);
    $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Totales por banner
    $stmtTot = $pdo->prepare("
        SELECT s.banner_id, b.anunciante, b.titulo, b.placement, b.estado, b.estado_pago, b.precio, b.moneda,
               SUM(s.impresiones) AS impresiones, SUM(s.clicks) AS clicks
        FROM banners_stats s
        JOIN banners b ON b.id = s.banner_id
        WHERE s.fecha BETWEEN ? AND ? {$idCond}
        GROUP BY s.banner_id
        ORDER BY impresiones DESC
    ");
    $stmtTot->execute($params);
    $totales = $stmtTot->fetchAll(PDO::FETCH_ASSOC);

    foreach ($totales as &$t) {
        $t['ctr'] = ((int)$t['impresiones'] > 0)
            ? round(((int)$t['clicks'] / (int)$t['impresiones']) * 100, 2)
            : 0;
    }
    unset($t);

    // Totales por placement
    $stmtPl = $pdo->prepare("
        SELECT b.placement, SUM(s.impresiones) AS impresiones, SUM(s.clicks) AS clicks
        FROM banners_stats s
        JOIN banners b ON b.id = s.banner_id
        WHERE s.fecha BETWEEN ? AND ? {$idCond}
        GROUP BY b.placement
        ORDER BY impresiones DESC
    ");
    $stmtPl->execute($params);
    $porPlacement = $stmtPl->fetchAll(PDO::FETCH_ASSOC);

    if ($formato === 'csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="banners-metricas-' . $desde . '-' . $hasta . '.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Fecha', 'Banner', 'Anunciante', 'Placement', 'Impresiones', 'Clicks', 'CTR %']);
        foreach ($filas as $f) {
            $imp = (int)$f['impresiones'];
            $clk = (int)$f['clicks'];
            fputcsv($out, [
                $f['fecha'],
                $f['titulo'],
                $f['anunciante'],
                $f['placement'],
                $imp,
                $clk,
                $imp > 0 ? round(($clk / $imp) * 100, 2) : 0,
            ]);
        }
        fclose($out);
        exit;
    }

    echo json_encode([
        'success' => true,
        'rango' => ['desde' => $desde, 'hasta' => $hasta],
        'totales' => $totales,
        'por_placement' => $porPlacement,
        'serie' => $filas,
    ]);
} catch (PDOException $e) {
    error_log('Error banners-stats.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log('Error banners-stats.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
