<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $payload = requireAuth();
    compatEnsureTokenVersion();
    $pdo = getDBConnection();
    $pdo->prepare("UPDATE admins SET token_version = token_version + 1 WHERE id = ?")
        ->execute([(int)($payload['id'] ?? 0)]);

    echo json_encode([
        'success' => true,
        'message' => 'Sesión cerrada'
    ]);
} catch (Throwable $e) {
    error_log('Error admin/logout.php: ' . $e->getMessage());
    echo json_encode([
        'success' => true,
        'message' => 'Sesión cerrada'
    ]);
}
