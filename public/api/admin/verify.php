<?php

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $token = getBearerToken();

    if (empty($token)) {
        http_response_code(401);
        echo json_encode(['valid' => false, 'error' => 'No token']);
        exit;
    }

    $payload = verifyToken($token);

    if (!$payload) {
        http_response_code(401);
        echo json_encode(['valid' => false, 'error' => 'Token inválido o expirado']);
        exit;
    }

    echo json_encode([
        'valid' => true,
        'admin' => [
            'id' => $payload['id'],
            'nombre' => $payload['nombre'],
            'email' => $payload['email'],
            'rol' => $payload['rol']
        ]
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'valid' => false,
        'error' => 'Error interno: ' . $e->getMessage()
    ]);
}
