<?php
// public_html/api/escort/datos/cambiar-password.php

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
    $escortId = $tokenData['id'];

    $actual = $input['actual'] ?? '';
    $nueva = $input['nueva'] ?? '';

    $errors = [];

    if (strlen($nueva) < 8) {
        $errors['passNueva'] = 'Mínimo 8 caracteres';
    }

    // Verificar contraseña actual
    $stmt = $pdo->prepare("SELECT password_hash FROM escorts WHERE id = ?");
    $stmt->execute([$escortId]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort || !password_verify($actual, $escort['password_hash'])) {
        $errors['passActual'] = 'Contraseña actual incorrecta';
    }

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $errors]);
        exit;
    }

    $hashed = password_hash($nueva, PASSWORD_BCRYPT);
    $update = $pdo->prepare("UPDATE escorts SET password_hash = ? WHERE id = ?");
    $update->execute([$hashed, $escortId]);

    require_once __DIR__ . '/../../mail.php';
    sendPasswordChanged($escort['email'], $escort['nombre'] ?? $escort['usuario'] ?? '');

    echo json_encode(['success' => true, 'message' => 'Contraseña cambiada']);
} catch (Throwable $e) {
    error_log("Error datos/cambiar-password.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
