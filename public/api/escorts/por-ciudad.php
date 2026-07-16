<?php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $ciudad = trim($_GET['ciudad'] ?? '');
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = 20;
    $offset = ($page - 1) * $limit;

    if (!$ciudad) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parámetro ciudad requerido']);
        exit;
    }

    $pdo = getDBConnection();

    $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM escorts WHERE activa = 1 AND eliminada = 0 AND ciudad = ?");
    $stmt->execute([$ciudad]);
    $total = (int)$stmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT e.id, e.nombre, e.slug, e.edad, e.ciudad, e.foto_principal, e.vip, e.verificado, e.descripcion_corta,
               (SELECT COUNT(*) FROM favoritos f WHERE f.escort_id = e.id) as likes
        FROM escorts e
        WHERE e.activa = 1 AND e.eliminada = 0 AND e.ciudad = ?
        ORDER BY e.vip DESC, e.visitas_perfil DESC
        LIMIT $limit OFFSET $offset
    ");
    $stmt->execute([$ciudad]);
    $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'ciudad' => $ciudad,
        'total' => $total,
        'data' => $escorts,
        'page' => $page,
        'has_more' => ($offset + $limit) < $total
    ]);
} catch (Exception $e) {
    error_log("Error por-ciudad.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
