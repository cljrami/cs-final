<?php
// public/api/escort/historias/listar.php

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

    // Limpiar historias expiradas
    $pdo->prepare("DELETE FROM escort_historias WHERE expira_en < NOW()")->execute();

    $stmt = $pdo->prepare("
        SELECT id, url, tipo, expira_en, vistas
        FROM escort_historias
        WHERE escort_id = ? AND expira_en > NOW()
        ORDER BY creado_en DESC
    ");
    $stmt->execute([$escortId]);
    $historias = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Proxy URLs through serve-upload.php
    foreach ($historias as &$h) {
        if (!str_starts_with($h['url'], '/api/serve-upload.php')) {
            $h['url'] = '/api/serve-upload.php?path=/' . ltrim($h['url'], '/');
        }
    }
    unset($h);

    // Límite del plan activo
    $planStmt = $pdo->prepare("
        SELECT p.max_videos
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND s.estado = 'activa' AND s.fecha_fin >= CURDATE()
        LIMIT 1
    ");
    $planStmt->execute([$escortId]);
    $plan = $planStmt->fetch(PDO::FETCH_ASSOC);
    $maxVideos = $plan ? (int)$plan['max_videos'] : 0;

    echo json_encode(['success' => true, 'historias' => $historias, 'maxVideos' => $maxVideos]);
} catch (Throwable $e) {
    error_log("Error historias/listar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
