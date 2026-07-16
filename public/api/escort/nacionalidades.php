<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

$pdo = getDBConnection();
try {
    $stmt = $pdo->query("SELECT id, nombre FROM nacionalidades WHERE activo = 1 ORDER BY nombre ASC");
    $nacionalidades = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'nacionalidades' => $nacionalidades]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
