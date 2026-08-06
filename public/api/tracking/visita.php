<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

try {
    $pdo = getDBConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    $escortId = isset($input['escort_id']) ? intval($input['escort_id']) : 0;

    if ($escortId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'escort_id requerido']);
        exit;
    }

    // Deduplicación por cookie
    $cookieName = 'visited_' . $escortId;
    $esNueva = empty($_COOKIE[$cookieName]);

    $pdo->prepare("UPDATE escorts SET visitas_perfil = visitas_perfil + 1 WHERE id = ?")->execute([$escortId]);

    if ($esNueva) {
        $pdo->prepare("
            INSERT INTO estadisticas_diarias (escort_id, fecha, visitas)
            VALUES (?, CURDATE(), 1)
            ON DUPLICATE KEY UPDATE visitas = visitas + 1
        ")->execute([$escortId]);
        setcookie($cookieName, '1', time() + 21600, '/', '', false, true);
    }

    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    error_log("Error visita.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
