<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    $tokenData = requireAuth();
    $adminId = intval($tokenData['id'] ?? 0);
    $adminRol = $tokenData['rol'] ?? '';
    if ($adminId <= 0 || !in_array($adminRol, ['superadmin', 'admin', 'moderador'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        $accion = $input['accion'] ?? '';
        if ($id <= 0 || !in_array($accion, ['aprobar', 'rechazar'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
            exit;
        }
        $aprobado = $accion === 'aprobar' ? 1 : 0;
        $stmt = $pdo->prepare("UPDATE comentarios SET aprobado = ? WHERE id = ?");
        $stmt->execute([$aprobado, $id]);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID requerido']); exit; }
        $stmt = $pdo->prepare("DELETE FROM comentarios WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        exit;
    }

    // GET: listar comentarios
    $search = trim($_GET['search'] ?? '');
    $estado = trim($_GET['estado'] ?? ''); // pendientes, aprobados, todos
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $perPage = 20;
    $offset = ($page - 1) * $perPage;

    $where = "WHERE 1=1";
    $params = [];

    if ($estado === 'pendientes') {
        $where .= " AND c.aprobado = 0";
    } elseif ($estado === 'aprobados') {
        $where .= " AND c.aprobado = 1";
    }

    if ($search !== '') {
        $where .= " AND (c.comentario LIKE ? OR u.nombre LIKE ? OR e.nombre LIKE ?)";
        $s = "%{$search}%";
        $params[] = $s; $params[] = $s; $params[] = $s;
    }

    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id JOIN escorts e ON e.id = c.escort_id $where");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT c.id, c.comentario, c.puntuacion, c.aprobado, c.created_at,
               u.nombre as usuario_nombre, u.email as usuario_email,
               e.nombre as escort_nombre, e.id as escort_id
        FROM comentarios c
        JOIN usuarios u ON u.id = c.usuario_id
        JOIN escorts e ON e.id = c.escort_id
        $where
        ORDER BY c.created_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $stmt->execute($params);
    $comentarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Stats
    $pendientes = (int)$pdo->query("SELECT COUNT(*) FROM comentarios WHERE aprobado = 0")->fetchColumn();
    $aprobados = (int)$pdo->query("SELECT COUNT(*) FROM comentarios WHERE aprobado = 1")->fetchColumn();

    echo json_encode([
        'success' => true,
        'comentarios' => array_map(function ($c) {
            return [
                'id' => (int)$c['id'],
                'comentario' => $c['comentario'],
                'puntuacion' => $c['puntuacion'] ? (int)$c['puntuacion'] : null,
                'aprobado' => (bool)$c['aprobado'],
                'usuario' => $c['usuario_nombre'],
                'usuario_email' => $c['usuario_email'],
                'escort' => $c['escort_nombre'],
                'escort_id' => (int)$c['escort_id'],
                'created_at' => $c['created_at'],
            ];
        }, $comentarios),
        'stats' => [
            'pendientes' => $pendientes,
            'aprobados' => $aprobados,
            'total' => $total,
        ],
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => max(1, ceil($total / $perPage)),
        ],
    ]);
} catch (Throwable $e) {
    error_log("Error admin/comentarios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
