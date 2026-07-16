<?php
// public_html/api/escort/fotos/portada.php

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
    $fotoId = (int)($input['fotoId'] ?? 0);
    $escortId = $tokenData['id'];

    if ($fotoId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID inválido']);
        exit;
    }

    // Verificar propiedad
    $check = $pdo->prepare("SELECT id FROM escort_fotos WHERE id = ? AND escort_id = ?");
    $check->execute([$fotoId, $escortId]);
    if (!$check->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Foto no encontrada']);
        exit;
    }

    $pdo->prepare("UPDATE escort_fotos SET es_portada = 0 WHERE escort_id = ?")->execute([$escortId]);
    $pdo->prepare("UPDATE escort_fotos SET es_portada = 1 WHERE id = ? AND escort_id = ?")->execute([$fotoId, $escortId]);

    // Sincronizar la portada en la tabla escorts para que se refleje en el index/perfil
    $fotoStmt = $pdo->prepare("SELECT url FROM escort_fotos WHERE id = ? AND escort_id = ?");
    $fotoStmt->execute([$fotoId, $escortId]);
    $foto = $fotoStmt->fetch(PDO::FETCH_ASSOC);
    if ($foto && !empty($foto['url'])) {
        $pdo->prepare("UPDATE escorts SET foto_principal = ? WHERE id = ?")->execute([$foto['url'], $escortId]);
    }

    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    error_log("Error fotos/portada.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
