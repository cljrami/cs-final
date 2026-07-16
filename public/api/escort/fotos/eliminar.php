<?php
// public_html/api/escort/fotos/eliminar.php

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

    $fotoId = (int)($_GET['id'] ?? 0);
    $escortId = $tokenData['id'];

    if ($fotoId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID inválido']);
        exit;
    }

    $check = $pdo->prepare("SELECT url, es_portada FROM escort_fotos WHERE id = ? AND escort_id = ?");
    $check->execute([$fotoId, $escortId]);
    $foto = $check->fetch(PDO::FETCH_ASSOC);

    if (!$foto) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Foto no encontrada']);
        exit;
    }

    // Eliminar archivo físico
    $filePath = __DIR__ . '/../../../' . ltrim($foto['url'], '/');
    if (file_exists($filePath)) unlink($filePath);

    // Eliminar de BD
    $pdo->prepare("DELETE FROM escort_fotos WHERE id = ? AND escort_id = ?")->execute([$fotoId, $escortId]);

    // Si era portada, poner la primera como portada
    if ($foto['es_portada']) {
        $pdo->prepare("
            UPDATE escort_fotos SET es_portada = 1 
            WHERE escort_id = ? 
            ORDER BY orden ASC, id ASC 
            LIMIT 1
        ")->execute([$escortId]);
    }

    echo json_encode(['success' => true, 'message' => 'Foto eliminada']);
} catch (Throwable $e) {
    error_log("Error fotos/eliminar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
