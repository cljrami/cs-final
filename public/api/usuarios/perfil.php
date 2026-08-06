<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    $usuarioId = intval($tokenData['id'] ?? 0);
    if ($usuarioId <= 0) { http_response_code(401); echo json_encode(['success' => false, 'error' => 'No autorizado']); exit; }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT id, nombre, email, telefono, ciudad, created_at FROM usuarios WHERE id = ?");
        $stmt->execute([$usuarioId]);
        $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$usuario) { http_response_code(404); echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']); exit; }

        echo json_encode([
            'success' => true,
            'usuario' => [
                'id' => (int)$usuario['id'],
                'nombre' => $usuario['nombre'],
                'email' => $usuario['email'],
                'telefono' => $usuario['telefono'],
                'ciudad' => $usuario['ciudad'],
                'created_at' => $usuario['created_at'],
            ]
        ]);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $nombre = trim($input['nombre'] ?? '');
        $email = trim($input['email'] ?? '');
        $telefono = trim($input['telefono'] ?? '');
        $ciudad = trim($input['ciudad'] ?? '');
        $password = $input['password'] ?? '';
        $passwordConfirm = $input['password_confirm'] ?? '';

        $errors = [];
        if (strlen($nombre) < 2) $errors['nombre'] = 'Nombre muy corto';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Email inválido';

        if (!empty($password)) {
            if (strlen($password) < 8) $errors['password'] = 'Mínimo 8 caracteres';
            if ($password !== $passwordConfirm) $errors['password_confirm'] = 'Las contraseñas no coinciden';
        }

        if (!empty($errors)) { http_response_code(422); echo json_encode(['success' => false, 'fieldErrors' => $errors]); exit; }

        $check = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? AND id != ?");
        $check->execute([$email, $usuarioId]);
        if ($check->fetch()) { http_response_code(409); echo json_encode(['success' => false, 'fieldErrors' => ['email' => 'Email ya registrado']]); exit; }

        if (!empty($password)) {
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("UPDATE usuarios SET nombre = ?, email = ?, telefono = ?, ciudad = ?, password_hash = ? WHERE id = ?");
            $stmt->execute([$nombre, $email, $telefono, $ciudad, $hash, $usuarioId]);
            require_once __DIR__ . '/../mail.php';
            sendPasswordChanged($email, $nombre);
        } else {
            $stmt = $pdo->prepare("UPDATE usuarios SET nombre = ?, email = ?, telefono = ?, ciudad = ? WHERE id = ?");
            $stmt->execute([$nombre, $email, $telefono, $ciudad, $usuarioId]);
        }

        echo json_encode([
            'success' => true,
            'usuario' => [
                'id' => $usuarioId,
                'nombre' => $nombre,
                'email' => $email,
            ]
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error usuarios/perfil.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
