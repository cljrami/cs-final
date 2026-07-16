<?php
// public/api/escort/registro.php

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function generarSlug($str)
{
    $str = strtolower(trim($str));
    $str = str_replace(
        ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', 'Á', 'Ã‰', 'Í', 'Ó', 'Ãš', 'Ã‘', 'Ãœ'],
        ['a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u', 'n', 'u'],
        $str
    );
    $str = preg_replace('/[^a-z0-9]+/', '-', $str);
    return trim($str, '-');
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();

    $input = json_decode(file_get_contents('php://input'), true);

    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $passwordConfirm = $input['password_confirm'] ?? '';

    $errors = [];

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Email inválido';
    if (strlen($password) < 8) $errors['password'] = 'Mínimo 8 caracteres';
    if ($password !== $passwordConfirm) $errors['confirmPassword'] = 'Las contraseñas no coinciden';

    // Generar usuario automáticamente desde el email
    $usuario = strstr($email, '@', true);
    $usuarioBase = $usuario;
    $suffix = 1;
    while (true) {
        $check = $pdo->prepare("SELECT id FROM escorts WHERE usuario = ?");
        $check->execute([$usuario]);
        if (!$check->fetch()) break;
        $usuario = $usuarioBase . $suffix;
        $suffix++;
    }

    // Verificar duplicado de email en ambas tablas
    $check = $pdo->prepare("SELECT id FROM escorts WHERE email = ?");
    $check->execute([$email]);
    if ($check->fetch()) { $errors['general'] = 'Email ya registrado'; }
    $checkUsr = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
    $checkUsr->execute([$email]);
    if ($checkUsr->fetch()) { $errors['general'] = 'Email ya registrado como usuario'; }

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $errors]);
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $slug = generarSlug($usuario);

    $stmt = $pdo->prepare("
        INSERT INTO escorts (usuario, email, password_hash, nombre, slug, edad, activa, aprobada, estado, primer_login, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'pendiente', 1, NOW())
    ");
    $stmt->execute([$usuario, $email, $hashedPassword, $usuario, $slug]);
    $newId = $pdo->lastInsertId();

    $tokenData = [
        'id' => $newId,
        'usuario' => $usuario,
        'exp' => time() + (7 * 24 * 60 * 60)
    ];
    $token = signToken($tokenData);

    echo json_encode([
        'success' => true,
        'token' => $token,
        'escort' => [
            'id' => (int)$newId,
            'usuario' => $usuario,
            'email' => $email,
        ],
        'message' => 'Cuenta creada. Completa tu perfil para activar tu anuncio.'
    ]);
} catch (Throwable $e) {
    error_log("Error registro.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
