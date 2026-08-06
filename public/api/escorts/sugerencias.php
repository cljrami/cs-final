<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';

$q = trim($_GET['q'] ?? '');
if (strlen($q) < 1) {
    echo json_encode(['success' => true, 'data' => ['ciudades' => [], 'escorts' => []]]);
    exit;
}

try {
    $pdo = getDBConnection();
    $like = '%' . $q . '%';

    $stmt = $pdo->prepare("SELECT DISTINCT c.nombre FROM ciudades c WHERE c.activa = 1 AND c.nombre LIKE ? ORDER BY c.nombre LIMIT 5");
    $stmt->execute([$like]);
    $ciudades = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $stmt = $pdo->prepare("SELECT e.id, e.nombre FROM escorts e WHERE e.activa = 1 AND e.eliminada = 0 AND EXISTS (SELECT 1 FROM suscripciones s JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL WHERE s.escort_id = e.id AND s.fecha_aprobacion IS NOT NULL AND s.estado = 'activa' AND s.fecha_fin >= CURDATE()) AND e.nombre LIKE ? ORDER BY e.nombre LIMIT 5");
    $stmt->execute([$like]);
    $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => [
            'ciudades' => $ciudades,
            'escorts' => $escorts
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
