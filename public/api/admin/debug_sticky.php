<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();

    // Test the fix: Check if swapping works by testing with actual data
    $stmt = $pdo->prepare("SELECT sp.escort_id, sp.ciudad_id, sp.orden, e.nombre 
        FROM sticky_posiciones sp 
        JOIN escorts e ON e.id = sp.escort_id 
        WHERE sp.ciudad_id = 20 
        AND sp.orden > 0");
    $stmt->execute();
    $testPositions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'test_positions' => $testPositions
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}