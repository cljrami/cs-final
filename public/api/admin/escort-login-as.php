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
    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonError('ID de escort requerido', 400);
    }

    $stmt = $pdo->prepare("SELECT id, usuario, nombre, primer_login, eliminada FROM escorts WHERE id = ?");
    $stmt->execute([$id]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        jsonError('Escort no encontrada', 404);
    }
    if ((int)$escort['eliminada'] === 1) {
        jsonError('La cuenta de la escort está eliminada', 403);
    }

    $token = signToken([
        'id' => (int)$escort['id'],
        'usuario' => $escort['usuario'],
        'tipo' => 'escort',
        'primer_login' => (int)$escort['primer_login'],
        'admin_acting' => true,
        'exp' => time() + (7 * 24 * 60 * 60)
    ]);

    echo json_encode([
        'success' => true,
        'token' => $token,
        'escort' => [
            'id' => (int)$escort['id'],
            'usuario' => $escort['usuario'],
            'nombre' => $escort['nombre']
        ]
    ]);
} catch (Throwable $e) {
    error_log("Error escort-login-as.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
