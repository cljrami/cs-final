<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    $tokenData = requireAuth();
    $adminId = intval($tokenData['id'] ?? 0);
    $adminRol = $tokenData['rol'] ?? '';
    if ($adminId <= 0 || !in_array($adminRol, ['superadmin', 'admin'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // Solo superadmin puede crear/eliminar admins
    $isSuperadmin = $adminRol === 'superadmin';

    if ($method === 'POST') {
        if (!$isSuperadmin) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Solo superadmin puede crear administradores']);
            exit;
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $nombre = trim($input['nombre'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        $rol = $input['rol'] ?? 'moderador';

        $errors = [];
        if (strlen($nombre) < 2) $errors['nombre'] = 'Nombre muy corto';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Email inválido';
        if (strlen($password) < 8) $errors['password'] = 'Mínimo 8 caracteres';
        if (!in_array($rol, ['superadmin', 'admin', 'moderador'])) $errors['rol'] = 'Rol inválido';

        if (!empty($errors)) { http_response_code(422); echo json_encode(['success' => false, 'fieldErrors' => $errors]); exit; }

        $check = $pdo->prepare("SELECT id FROM admins WHERE email = ?");
        $check->execute([$email]);
        if ($check->fetch()) { http_response_code(409); echo json_encode(['success' => false, 'fieldErrors' => ['email' => 'Email ya registrado']]); exit; }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO admins (nombre, email, password_hash, rol, activo, created_at) VALUES (?, ?, ?, ?, 1, NOW())");
        $stmt->execute([$nombre, $email, $hash, $rol]);
        $newId = $pdo->lastInsertId();

        echo json_encode(['success' => true, 'admin' => ['id' => (int)$newId, 'nombre' => $nombre, 'email' => $email, 'rol' => $rol]]);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID requerido']); exit; }

        // No permitir auto-desactivarse
        if ($id === $adminId && isset($input['activo'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No puedes desactivarte a ti mismo']);
            exit;
        }

        // Solo superadmin puede cambiar roles
        if (isset($input['rol']) && !$isSuperadmin) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Solo superadmin puede cambiar roles']);
            exit;
        }

        $fields = [];
        $params = [];
        if (isset($input['nombre'])) { $fields[] = 'nombre = ?'; $params[] = trim($input['nombre']); }
        if (isset($input['email'])) { $fields[] = 'email = ?'; $params[] = trim($input['email']); }
        if (isset($input['rol'])) { $fields[] = 'rol = ?'; $params[] = $input['rol']; }
        if (isset($input['activo'])) { $fields[] = 'activo = ?'; $params[] = $input['activo'] ? 1 : 0; }
        if (!empty($input['password'])) {
            if (strlen($input['password']) < 8) { http_response_code(422); echo json_encode(['success' => false, 'fieldErrors' => ['password' => 'Mínimo 8 caracteres']]); exit; }
            $fields[] = 'password_hash = ?';
            $params[] = password_hash($input['password'], PASSWORD_BCRYPT);
        }

        if (empty($fields)) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'Sin campos para actualizar']); exit; }

        $params[] = $id;
        $stmt = $pdo->prepare("UPDATE admins SET " . implode(', ', $fields) . " WHERE id = ?");
        $stmt->execute($params);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($method === 'DELETE') {
        if (!$isSuperadmin) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Solo superadmin puede eliminar administradores']);
            exit;
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID requerido']); exit; }
        if ($id === $adminId) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'No puedes eliminarte a ti mismo']); exit; }
        $stmt = $pdo->prepare("DELETE FROM admins WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        exit;
    }

    // GET: listar admins
    $search = trim($_GET['search'] ?? '');
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $perPage = 50;
    $offset = ($page - 1) * $perPage;
    $where = "WHERE 1=1";
    $params = [];
    if ($search !== '') {
        $where .= " AND (nombre LIKE ? OR email LIKE ?)";
        $s = "%{$search}%";
        $params[] = $s; $params[] = $s;
    }

    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM admins $where");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmt = $pdo->prepare("SELECT id, nombre, email, rol, activo, ultimo_login, created_at FROM admins $where ORDER BY created_at DESC LIMIT $perPage OFFSET $offset");
    $stmt->execute($params);
    $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Stats
    $stmtStats = $pdo->query("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN rol = 'superadmin' THEN 1 ELSE 0 END) as superadmins,
            SUM(CASE WHEN rol = 'admin' THEN 1 ELSE 0 END) as admins,
            SUM(CASE WHEN rol = 'moderador' THEN 1 ELSE 0 END) as moderadores
        FROM admins
    ");
    $stats = $stmtStats->fetch();

    echo json_encode([
        'success' => true,
        'admins' => array_map(function ($a) {
            return [
                'id' => (int)$a['id'],
                'nombre' => $a['nombre'],
                'email' => $a['email'],
                'rol' => $a['rol'],
                'activo' => (bool)$a['activo'],
                'ultimo_login' => $a['ultimo_login'],
                'created_at' => $a['created_at'],
            ];
        }, $admins),
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => max(1, ceil($total / $perPage)),
        ],
        'stats' => [
            'total' => (int)$stats['total'],
            'superadmins' => (int)$stats['superadmins'],
            'admins' => (int)$stats['admins'],
            'moderadores' => (int)$stats['moderadores'],
        ],
    ]);
} catch (Throwable $e) {
    error_log("Error admin/administradores.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
