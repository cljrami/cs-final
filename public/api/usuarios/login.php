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

    // Rate limit: máx 10 intentos por IP cada 15 minutos
    rateLimitLogin('login_usuario', 10, 15, strtolower($email));

    compatEnsureTokenVersion();

    $stmt = $pdo->prepare("SELECT id, nombre, email, password_hash, activo, token_version FROM usuarios WHERE email = ?");
    $stmt->execute([$email]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario) {
        // Hash dummy para igualar tiempos y no revelar si el email existe.
        password_verify($password, '$2y$12$cqBFJdbT1wCVHlckB1Mz.uA8UUor2HjyinboWpzHNSt6Qf4pWagD');
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
        exit;
    }

    if (!password_verify($password, $usuario['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
        exit;
    }

    if ((int)$usuario['activo'] !== 1) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Cuenta inactiva']);
        exit;
    }

    rateLimitReset('login_usuario', strtolower($email));

    $tokenData = [
        'id' => $usuario['id'],
        'email' => $usuario['email'],
        'tipo' => 'usuario',
        'tv' => (int)($usuario['token_version'] ?? 0),
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
