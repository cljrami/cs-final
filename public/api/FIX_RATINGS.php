<?php
// Script de emergencia para recalcular ratings de todas las escorts
// ACCESO RESTRINGIDO - eliminar tras uso

// Verificar que se ejecuta desde el servidor (no desde navegador sin protección)
// $sig = $_GET['sig'] ?? '';
// if ($sig !== hash_hmac('sha256', 'recalcular_ratings', 'tu_secreto_aqui')) { http_response_code(403); exit; }

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = getDBConnection();
    
    // 1. Recalcular ratings de todas las escorts
    $sql = "UPDATE escorts e SET
        e.rating = (SELECT COALESCE(AVG(c.puntuacion), 0) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1),
        e.total_valoraciones = (SELECT COUNT(*) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1)";
    
    $pdo->exec($sql);
    
    // 2. Obtener estadísticas para confirmar
    $stats = $pdo->query("
        SELECT 
            COUNT(*) as total_escorts,
            SUM(CASE WHEN total_valoraciones > 0 THEN 1 ELSE 0 END) as escorts_con_valoraciones,
            AVG(rating) as promedio_general
        FROM escorts
    ")->fetch(PDO::FETCH_ASSOC);
    
    // 3. También mostrar algunas escorts con valores desincronizados
    $desincronizadas = $pdo->query("
        SELECT e.id, e.nombre, e.rating, e.total_valoraciones,
               (SELECT COUNT(*) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1) as real_count,
               (SELECT COALESCE(AVG(c.puntuacion), 0) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1) as real_avg
        FROM escorts e
        WHERE e.total_valoraciones != (SELECT COUNT(*) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1)
           OR ABS(e.rating - (SELECT COALESCE(AVG(c.puntuacion), 0) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1)) > 0.01
        LIMIT 20
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => 'Recálculo completado exitosamente',
        'estadisticas' => [
            'total_escorts' => (int)$stats['total_escorts'],
            'escorts_con_valoraciones' => (int)$stats['escorts_con_valoraciones'],
            'promedio_general_rating' => round((float)$stats['promedio_general'], 2)
        ],
        'muestra_desincronizadas' => $desincronizadas,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
