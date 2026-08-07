<?php
// GET: obtener datos del admin autenticado
// PUT: actualizar nombre/email del admin autenticado

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    require_once __DIR__ . '/../../bootstrap.php';

    $tokenData = requireAuth();


    requireAdminRole($tokenData);
    $adminId = intval($tokenData['id'] ?? 0);
    if ($adminId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token invíƒÂ¡lido']);
        exit;
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT id, nombre, email, rol, activo, ultimo_login, created_at FROM admins WHERE id = ?");
        $stmt->execute([$adminId]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$admin) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Admin no encontrado']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'id' => (int)$admin['id'],
                'nombre' => $admin['nombre'],
                'email' => $admin['email'],
                'rol' => $admin['rol'],
                'activo' => (bool)$admin['activo'],
                'ultimo_login' => $admin['ultimo_login'],
                'created_at' => $admin['created_at'],
            ]
        ]);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $nombre = trim($input['nombre'] ?? '');
        $email = trim($input['email'] ?? '');

        $errors = [];
        if (strlen($nombre) < 2) $errors['nombre'] = 'Nombre muy corto';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Email invíƒÂ¡lido';

        if (!empty($errors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'fieldErrors' => $errors]);
            exit;
        }

        // Verificar email duplicado
        $check = $pdo->prepare("SELECT id FROM admins WHERE email = ? AND id != ?");
        $check->execute([$email, $adminId]);
        if ($check->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'fieldErrors' => ['email' => 'Este email ya estíƒÂ¡ en uso']]);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE admins SET nombre = ?, email = ? WHERE id = ?");
        $stmt->execute([$nombre, $email, $adminId]);

        // Actualizar localStorage data del frontend
        echo json_encode([
            'success' => true,
            'message' => 'Datos actualizados',
            'data' => ['nombre' => $nombre, 'email' => $email]
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);

} catch (Throwable $e) {
    error_log("Error admin/datos/perfil.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

