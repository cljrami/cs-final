<?php
ini_set('display_errors', 0);
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $tokenData = requireEscortAuth();

    echo json_encode([
        'success' => true,
        'id' => $tokenData['id'],
        'usuario' => $tokenData['usuario']
    ]);
} catch (Throwable $e) {
    error_log("Error verificar-sesion.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
