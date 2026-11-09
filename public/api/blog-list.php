<?php
require_once __DIR__ . '/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
try {
    $pdo = getDBConnection();
    $ciudad = isset($_GET['ciudad_id']) ? intval($_GET['ciudad_id']) : 0;
    $where = ["a.estado = 'publicado'"];
    $params = [];
    if ($ciudad > 0) {
        $where[] = 'a.ciudad_id = ?';
        $params[] = $ciudad;
    }
    $sql = "SELECT a.id, a.titulo, a.slug, a.imagen, a.extracto, a.autor, a.published_at, a.categoria_id, c.nombre AS ciudad_nombre FROM articulos a LEFT JOIN ciudades c ON c.id = a.ciudad_id WHERE " . implode(' AND ', $where) . " ORDER BY a.published_at DESC LIMIT 50";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success'=>true, 'data'=>$rows]);
} catch (Throwable $e) {
    error_log('blog-list error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false, 'error'=>'Error del servidor']);
}
