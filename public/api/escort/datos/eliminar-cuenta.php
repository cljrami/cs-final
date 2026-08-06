<?php
// public_html/api/escort/datos/eliminar-cuenta.php

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
    $password = $input['password'] ?? '';

    if ($password === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Debes confirmar tu contrasena']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT password_hash FROM escorts WHERE id = ?");
    $stmt->execute([$escortId]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort || !password_verify($password, $escort['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Contrasena incorrecta']);
        exit;
    }

    $update = $pdo->prepare(
        "UPDATE escorts SET eliminada = 1, activa = 0, estado = 'eliminada', updated_at = NOW() WHERE id = ?"
    );
    $update->execute([$escortId]);

    require_once __DIR__ . '/../../mail.php';
    notificarAccionEscort('cuentas', $escortId, 'Escort eliminó su cuenta');

    echo json_encode(['success' => true, 'message' => 'Cuenta eliminada']);
} catch (Throwable $e) {
    error_log("Error datos/eliminar-cuenta.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
