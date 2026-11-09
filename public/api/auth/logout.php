<?php
// public/api/auth/logout.php
// Revoca la sesión actual incrementando token_version de la cuenta.
// Todos los tokens anteriores (robados o no) dejan de ser válidos.

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $payload = requireAuth();
    compatEnsureTokenVersion();
    $pdo = getDBConnection();

    $tipo = $payload['tipo'] ?? '';
    $rol = $payload['rol'] ?? $payload['role'] ?? '';
    $tabla = $tipo === 'usuario' ? 'usuarios'
        : ($tipo === 'escort' ? 'escorts'
        : (in_array($rol, ['admin', 'superadmin', 'moderador'], true) ? 'admins' : null));

    if ($tabla === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Tipo de sesión desconocido']);
        exit;
    }

    $pdo->prepare("UPDATE `$tabla` SET token_version = token_version + 1 WHERE id = ?")
        ->execute([(int)($payload['id'] ?? 0)]);

    echo json_encode(['success' => true, 'message' => 'Sesión cerrada en todos los dispositivos']);
} catch (Throwable $e) {
    error_log('Error auth/logout.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
