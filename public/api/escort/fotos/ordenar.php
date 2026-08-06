<?php
// public_html/api/escort/fotos/ordenar.php

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../../bootstrap.php';

    $pdo = getDBConnection();
    $headers = getallheaders();
    $authHeader = '';
    foreach ($headers as $k => $v) {
        if (strtolower($k) === 'authorization') {
            $authHeader = $v;
            break;
        }
    }

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
    $fotos = $input['fotos'] ?? [];
    $escortId = $tokenData['id'];

    $update = $pdo->prepare("UPDATE escort_fotos SET orden = ? WHERE id = ? AND escort_id = ?");
    foreach ($fotos as $f) {
        $update->execute([(int)$f['orden'], (int)$f['id'], $escortId]);
    }

    require_once __DIR__ . '/../../mail.php';
    notificarAccionEscort('fotos', $escortId, 'Escort reordenó su galería de fotos', [
        'Fotos ordenadas' => count($fotos),
    ]);

    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    error_log("Error fotos/ordenar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
