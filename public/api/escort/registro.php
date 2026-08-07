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
        ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ñ', 'Ü'],
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
        'tipo' => 'escort',
        'exp' => time() + (7 * 24 * 60 * 60)
    ];
    $token = signToken($tokenData);

    $af = $pdo->prepare("SELECT foto_principal FROM escorts WHERE id = ?");
    $af->execute([$newId]);

    $notifMsg = "Nueva escort registrada: {$usuario} (" . ($af->fetchColumn() ?: 'sin foto') . ")";
    $notif = $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id) VALUES (NULL, 'sistema', 'Nueva escort registrada', ?, '/admin/escorts', ?)");
    $notif->execute([$notifMsg, $newId]);

    $pdo->prepare("INSERT INTO logs_auditoria (escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address, user_agent, created_at) VALUES (?, 'nueva_escort', 'escorts', ?, ?, ?, ?, NOW())")
        ->execute([
            $newId,
            $newId,
            json_encode(['nombre' => $usuario]),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

    require_once __DIR__ . '/../mail.php';
    try {
        $body = '<p>Se ha registrado una nueva escort en la plataforma:</p>';
        $body .= '<table class="info">';
        $body .= '<tr><td>Usuario:</td><td>' . htmlspecialchars($usuario, ENT_QUOTES, 'UTF-8') . '</td></tr>';
        $body .= '<tr><td>Email:</td><td>' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</td></tr>';
        $body .= '</table>';
        $body .= '<p>La cuenta está pendiente de aprobación. Revisa sus datos y activa su anuncio cuando corresponda.</p>';
        $body .= '<p style="text-align:center;margin-top:24px"><a class="btn" href="' . SITE_URL . '/admin/escorts">Ver escorts</a></p>';
        sendAdminNotification('inscripciones', 'Nueva escort registrada', $body);
    } catch (\Throwable $e2) {
        error_log("registro.php notify error: " . $e2->getMessage());
    }

    sendWelcomeEscort($email, $usuario);

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
