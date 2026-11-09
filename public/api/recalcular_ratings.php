<?php
require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = getDBConnection();
    
    // Recalcular ratings para todas las escorts
    $sql = "UPDATE escorts e SET
        e.rating = (SELECT COALESCE(AVG(c.puntuacion), 0) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1),
        e.total_valoraciones = (SELECT COUNT(*) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1)";
    
    $pdo->exec($sql);
    
    // Verificar cuántas filas se actualizaron
    $stmt = $pdo->query("SELECT COUNT(*) FROM escorts");
    $totalEscorts = $stmt->fetchColumn();
    
    $stmt = $pdo->query("SELECT COUNT(*) FROM escorts WHERE rating IS NOT NULL");
    $escortsConRating = $stmt->fetchColumn();
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => 'Ratings recalculados correctamente',
        'total_escorts' => (int)$totalEscorts,
        'escorts_con_rating' => (int)$escortsConRating
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
