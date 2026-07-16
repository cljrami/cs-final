<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';
    $pdo = getDBConnection();

    $input = json_decode(file_get_contents('php://input'), true);
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Email y contraseña requeridos']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, nombre, email, password_hash, activo FROM usuarios WHERE email = ?");
    $stmt->execute([$email]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Email no registrado']);
        exit;
    }

    if (!password_verify($password, $usuario['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Contraseña incorrecta']);
        exit;
    }

    if ((int)$usuario['activo'] !== 1) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Cuenta inactiva']);
        exit;
    }

    $tokenData = [
        'id' => $usuario['id'],
        'email' => $usuario['email'],
        'tipo' => 'usuario',
        'exp' => time() + (30 * 24 * 60 * 60)
    ];
    $token = signToken($tokenData);

    echo json_encode([
        'success' => true,
        'token' => $token,
        'usuario' => [
            'id' => $usuario['id'],
            'nombre' => $usuario['nombre'],
            'email' => $usuario['email'],
        ]
    ]);
} catch (Throwable $e) {
    error_log("Error usuarios/login.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
