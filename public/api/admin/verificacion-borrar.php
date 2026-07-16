<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? intval($input['id']) : 0;

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID no válido']);
        exit;
    }

    $pdo = getDBConnection();

    $stmt = $pdo->prepare("SELECT escort_id, estado FROM verificaciones WHERE id = ?");
    $stmt->execute([$id]);
    $verif = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$verif) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Verificación no encontrada']);
        exit;
    }

    if ($verif['estado'] === 'aprobada') {
        $stmt = $pdo->prepare("UPDATE escorts SET verificado = 0 WHERE id = ?");
        $stmt->execute([$verif['escort_id']]);
    }

    $stmt = $pdo->prepare("DELETE FROM verificaciones WHERE id = ?");
    $stmt->execute([$id]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    error_log("Error verificacion-borrar: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
