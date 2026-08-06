<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../../bootstrap.php';

    $pdo = getDBConnection();
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $usuarioId = $tokenData['id'];

    $actual = $input['actual'] ?? '';
    $nueva = $input['nueva'] ?? '';

    $errors = [];

    if (strlen($nueva) < 8) {
        $errors['nueva'] = 'Mínimo 8 caracteres';
    }

    $stmt = $pdo->prepare("SELECT id, nombre, email, password_hash FROM usuarios WHERE id = ?");
    $stmt->execute([$usuarioId]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario || !password_verify($actual, $usuario['password_hash'])) {
        $errors['actual'] = 'Contraseña actual incorrecta';
    }

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $errors]);
        exit;
    }

    $hashed = password_hash($nueva, PASSWORD_BCRYPT);
    $update = $pdo->prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?");
    $update->execute([$hashed, $usuarioId]);

    require_once __DIR__ . '/../../mail.php';
    sendPasswordChanged($usuario['email'], $usuario['nombre']);

    echo json_encode(['success' => true, 'message' => 'Contraseña cambiada']);
} catch (Throwable $e) {
    error_log("Error usuarios/datos/cambiar-password.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
