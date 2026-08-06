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
        if ($id <= 0 || !in_array($accion, ['activar', 'desactivar'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
            exit;
        }
        $activo = $accion === 'activar' ? 1 : 0;
        $stmt = $pdo->prepare("UPDATE usuarios SET activo = ? WHERE id = ?");
        $stmt->execute([$activo, $id]);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM usuarios WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        exit;
    }

    // Stats
    $statsStmt = $pdo->query("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as activos,
            SUM(CASE WHEN activo = 0 THEN 1 ELSE 0 END) as inactivos
        FROM usuarios
    ");
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
    foreach ($stats as &$v) { $v = (int)$v; }
    unset($v);

    // GET: listar usuarios
    $search = trim($_GET['search'] ?? '');
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $perPage = 20;
    $offset = ($page - 1) * $perPage;
    $where = "WHERE 1=1";
    $params = [];
    if ($search !== '') {
        $where .= " AND (nombre LIKE ? OR email LIKE ?)";
        $s = "%{$search}%";
        $params[] = $s;
        $params[] = $s;
    }

    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM usuarios $where");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT id, nombre, email, activo, created_at
        FROM usuarios $where
        ORDER BY created_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $stmt->execute($params);
    $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'usuarios' => array_map(function ($u) {
            return [
                'id' => (int)$u['id'],
                'nombre' => $u['nombre'],
                'email' => $u['email'],
                'activo' => (bool)$u['activo'],
                'created_at' => $u['created_at'],
            ];
        }, $usuarios),
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => max(1, ceil($total / $perPage)),
        ],
    ]);
} catch (Throwable $e) {
    error_log("Error admin/usuarios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
