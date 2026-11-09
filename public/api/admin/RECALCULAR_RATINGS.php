<?php
/**
 * Recálculo Masivo de Ratings y Total Valoraciones
 * Ejecutar UNA VEZ para sincronizar ratings desactualizados
 * Eliminar este archivo después de usarlo por seguridad
 */

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = getDBConnection();
    
    // Protección simple: solo permitir desde IP local o con token secreto
    $allow = false;
    $remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';
    $allowedIps = ['127.0.0.1', '::1', 'localhost'];
    if (in_array($remoteIp, $allowedIps)) {
        $allow = true;
    }
    // También permitir si se pasa un token por GET con el APP_SECRET
    $token = $_GET['token'] ?? '';
    if ($token === env('APP_SECRET')) {
        $allow = true;
    }
    
    if (!$allow) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }
    
    // Iniciar transacción para consistencia
    $pdo->beginTransaction();
    
    // 1. Recalcular ratings de todas las escorts
    $sql = "UPDATE escorts e SET
        e.rating = (SELECT COALESCE(AVG(c.puntuacion), 0) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1),
        e.total_valoraciones = (SELECT COUNT(*) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1)";
    
    $affected = $pdo->exec($sql);
    
    // 2. Obtener estadísticas
    $stats = $pdo->query("
        SELECT 
            COUNT(*) as total_escorts,
            SUM(CASE WHEN total_valoraciones > 0 THEN 1 ELSE 0 END) as escorts_con_valoraciones,
            AVG(rating) as promedio_general,
            MIN(rating) as rating_min,
            MAX(rating) as rating_max
        FROM escorts
    ")->fetch(PDO::FETCH_ASSOC);
    
    // 3. Encontrar escorts con rating desincronizado (después del update deberían ser 0)
    $desincronizadas = $pdo->query("
        SELECT e.id, e.nombre, e.rating, e.total_valoraciones,
               COALESCE((SELECT COUNT(*) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1), 0) as real_count,
               COALESCE((SELECT AVG(c.puntuacion) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1), 0) as real_avg
        FROM escorts e
        WHERE ABS(e.rating - COALESCE((SELECT AVG(c.puntuacion) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1), 0)) > 0.01
           OR e.total_valoraciones != COALESCE((SELECT COUNT(*) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1), 0)
        LIMIT 20
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    $pdo->commit();
    
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => 'Recálculo completado exitosamente',
        'rows_affected' => (int)$affected,
        'estadisticas' => [
            'total_escorts' => (int)$stats['total_escorts'],
            'escorts_con_valoraciones' => (int)$stats['escorts_con_valoraciones'],
            'promedio_general_rating' => round((float)$stats['promedio_general'], 2),
            'rating_min' => round((float)$stats['rating_min'], 2),
            'rating_max' => round((float)$stats['rating_max'], 2)
        ],
        'escorts_aun_desincronizadas' => count($desincronizadas),
        'muestra_desincronizadas' => $desincronizadas,
        'timestamp' => date('Y-m-d H:i:s'),
        'warning' => 'ELIMINA ESTE ARCHIVO DESPUES DE USARLO POR SEGURIDAD'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Throwable $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
