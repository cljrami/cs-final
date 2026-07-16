<?php
// public_html/api/escort/datos/actualizar.php

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

    $email = trim($input['email'] ?? '');
    $telefono = trim($input['telefono'] ?? '');
    $whatsapp = trim($input['whatsapp'] ?? '');

    $errors = [];

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Email inválido';
    }

    // Verificar email duplicado
    $checkEmail = $pdo->prepare("SELECT id FROM escorts WHERE email = ? AND id != ?");
    $checkEmail->execute([$email, $escortId]);
    if ($checkEmail->fetch()) {
        $errors['email'] = 'Este email ya está en uso';
    }

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $errors]);
        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE escorts 
        SET email = ?, telefono = ?, whatsapp = ?, actualizado_en = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$email, $telefono, $whatsapp, $escortId]);

    echo json_encode(['success' => true, 'message' => 'Datos actualizados']);
} catch (Throwable $e) {
    error_log("Error datos/actualizar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
