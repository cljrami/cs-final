<?php
// public/api/escort/historias/eliminar.php

header('Content-Type: application/json');
ini_set('display_errors', 0);
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

    $escortId = $tokenData['id'];
    $historiaId = (int)($_GET['id'] ?? 0);

    if ($historiaId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID inválido']);
        exit;
    }

    // Verificar propiedad
    $check = $pdo->prepare("SELECT url FROM escort_historias WHERE id = ? AND escort_id = ?");
    $check->execute([$historiaId, $escortId]);
    $historia = $check->fetch(PDO::FETCH_ASSOC);

    if (!$historia) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Historia no encontrada']);
        exit;
    }

    // Eliminar archivo físico (handle both raw and proxied URLs)
    $rawUrl = $historia['url'];
    if (str_starts_with($rawUrl, '/api/serve-upload.php')) {
        parse_str(parse_url($rawUrl, PHP_URL_QUERY), $params);
        $rawUrl = $params['path'] ?? $rawUrl;
    }
    $filePath = __DIR__ . '/../../../' . ltrim($rawUrl, '/');
    if (file_exists($filePath)) unlink($filePath);

    // Eliminar de BD
    $stmt = $pdo->prepare("DELETE FROM escort_historias WHERE id = ? AND escort_id = ?");
    $stmt->execute([$historiaId, $escortId]);

    require_once __DIR__ . '/../../mail.php';
    notificarAccionEscort('historias', $escortId, 'Escort eliminó una historia');

    echo json_encode(['success' => true, 'message' => 'Historia eliminada']);
} catch (Throwable $e) {
    error_log("Error historias/eliminar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
