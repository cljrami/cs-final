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
    $nombre = trim($input['nombre'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $passwordConfirm = $input['password_confirm'] ?? '';

    $errors = [];
    if (strlen($nombre) < 2) $errors['nombre'] = 'Nombre muy corto';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Email inválido';
    if (strlen($password) < 8) $errors['password'] = 'Mínimo 8 caracteres';
    if ($password !== $passwordConfirm) $errors['password_confirm'] = 'Las contraseñas no coinciden';

    $check = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
    $check->execute([$email]);
    if ($check->fetch()) $errors['general'] = 'Email ya registrado';
    $checkEscort = $pdo->prepare("SELECT id FROM escorts WHERE email = ?");
    $checkEscort->execute([$email]);
    if ($checkEscort->fetch()) $errors['general'] = 'Email ya registrado como escort';

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $errors]);
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare("
        INSERT INTO usuarios (nombre, email, password_hash, activo, created_at)
        VALUES (?, ?, ?, 1, NOW())
    ");
    $stmt->execute([$nombre, $email, $hashedPassword]);
    $newId = $pdo->lastInsertId();

    $tokenData = [
        'id' => $newId,
        'email' => $email,
        'tipo' => 'usuario',
        'exp' => time() + (30 * 24 * 60 * 60)
    ];
    $token = signToken($tokenData);

    $notif = $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url) VALUES (NULL, 'sistema', ?, ?, '/admin/usuarios')");
    $notif->execute(["Nuevo usuario: {$nombre}", $email]);

    require_once __DIR__ . '/../mail.php';
    sendWelcomeUsuario($nombre, $email);
    notificarAccionUsuario('usuarios', $newId, 'Nuevo usuario registrado en Kimi');

    echo json_encode([
        'success' => true,
        'token' => $token,
        'usuario' => [
            'id' => $newId,
            'nombre' => $nombre,
            'email' => $email,
        ]
    ]);
} catch (Throwable $e) {
    error_log("Error usuarios/registro.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
