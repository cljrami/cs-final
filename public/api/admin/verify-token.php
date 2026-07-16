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
        echo json_encode([
            'success' => false,
            'valid' => false,
            'error' => 'Token no proporcionado'
        ]);
        exit;
    }

    $payload = verifyToken($token);

    if (!$payload) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'valid' => false,
            'error' => 'Token inválido o expirado'
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'valid' => true,
        'user' => [
            'id' => $payload['id'] ?? null,
            'email' => $payload['email'] ?? null,
            'nombre' => $payload['nombre'] ?? null,
            'rol' => $payload['rol'] ?? $payload['role'] ?? 'admin',
            'exp' => $payload['exp']
        ]
    ]);
} catch (Throwable $e) {
    error_log("Error verify-token: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'valid' => false,
        'error' => 'Error interno del servidor'
    ]);
}
