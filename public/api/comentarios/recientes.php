<?php
// public/api/comentarios/recientes.php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();
    $limit = min(12, max(1, intval($_GET['limit'] ?? 6)));

    $stmt = $pdo->prepare("
        SELECT c.id, c.comentario, c.puntuacion, c.cita_verificada, c.created_at,
               COALESCE(u.nombre, 'Anónimo') as usuario_nombre,
               e.id as escort_id, e.nombre as escort_nombre,
               COALESCE(NULLIF(e.foto_principal, ''), pf.url) as escort_foto
        FROM comentarios c
        JOIN escorts e ON e.id = c.escort_id
        LEFT JOIN usuarios u ON u.id = c.usuario_id
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        WHERE c.aprobado = 1 AND c.comentario IS NOT NULL AND c.comentario != ''
        ORDER BY c.created_at DESC
        LIMIT $limit
    ");
    $stmt->execute();
    $comentarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($comentarios as &$c) {
        $c['puntuacion'] = $c['puntuacion'] ? (int)$c['puntuacion'] : null;
        $c['cita_verificada'] = (int)($c['cita_verificada'] ?? 0);
        $c['escort_foto'] = !empty($c['escort_foto'])
            ? '/api/serve-upload.php?path=/' . ltrim($c['escort_foto'], '/')
            : null;
    }
    unset($c);

    echo json_encode(['success' => true, 'data' => $comentarios]);
} catch (Throwable $e) {
    error_log("Error comentarios/recientes.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
