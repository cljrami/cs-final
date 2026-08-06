<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    $auth = requireAuth();
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID requerido']); exit; }

        $check = $pdo->prepare("SELECT c.id FROM comentarios c JOIN escorts e ON e.id = c.escort_id WHERE c.id = ? AND (c.usuario_id = ? OR e.id = (SELECT id FROM escorts WHERE usuario_id = ?))");
        $usuarioId = (int)$auth['id'];
        $check->execute([$id, $usuarioId, $usuarioId]);
        if (!$check->fetch()) { http_response_code(404); echo json_encode(['success' => false, 'error' => 'Comentario no encontrado o no tiene permiso']); exit; }

        $stmt = $pdo->prepare("DELETE FROM comentarios WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Comentario eliminado']);
        exit;
    }

    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método no permitido']);
        exit;
    }

    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $perPage = isset($_GET['per_page']) ? max(1, min(50, intval($_GET['per_page']))) : 20;
    $offset = ($page - 1) * $perPage;

$isEscort = isset($auth['tipo']) && $auth['tipo'] === 'escort';
    $usuarioId = (int)$auth['id'];
    $escortId = 0;

    if ($isEscort) {
        $escortRow = $pdo->prepare("SELECT id FROM escorts WHERE id = ?");
        $escortRow->execute([$usuarioId]);
        $escortData = $escortRow->fetch();
        if (!$escortData) {
            http_response_code(200);
            echo json_encode(['success' => true, 'comentarios' => [], 'pagination' => ['total' => 0, 'page' => 1, 'per_page' => $perPage, 'total_pages' => 1]]);
            exit;
        }
        $escortId = (int)$escortData['id'];
    }

    $where = $isEscort ? "WHERE c.escort_id = ?" : "WHERE c.usuario_id = ?";
    $params = [$isEscort ? $escortId : $usuarioId];

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM comentarios c $where");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT c.id, c.comentario, c.puntuacion, c.aprobado, c.created_at,
               COALESCE(e.nombre, '(escort eliminada)') as escort_nombre,
               e.id as escort_id,
               COALESCE(NULLIF(e.foto_principal, ''), pf.url) as escort_foto,
               COALESCE(u.nombre, '(usuario eliminado)') as usuario_nombre
        FROM comentarios c
        LEFT JOIN escorts e ON e.id = c.escort_id
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        LEFT JOIN usuarios u ON u.id = c.usuario_id
        $where
        ORDER BY c.created_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $stmt->execute($params);
    $comentarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'comentarios' => array_map(function($c) {
            return [
                'id' => (int)$c['id'],
                'comentario' => $c['comentario'],
                'puntuacion' => $c['puntuacion'] ? (int)$c['puntuacion'] : null,
                'aprobado' => (bool)$c['aprobado'],
                'escort' => $c['escort_nombre'],
                'escort_id' => (int)$c['escort_id'],
                'escort_foto' => $c['escort_foto'] ?? '',
                'usuario_nombre' => $c['usuario_nombre'],
                'created_at' => $c['created_at'],
            ];
        }, $comentarios),
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => max(1, ceil($total / $perPage)),
        ],
    ]);
    exit;
} catch (Throwable $e) {
    error_log("Error mis-comentarios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}