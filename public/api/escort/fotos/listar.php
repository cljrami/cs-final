<?php
// public_html/api/escort/fotos/listar.php

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

    $escortId = $tokenData['id'];

    $stmt = $pdo->prepare("
        SELECT id, url, tipo, es_portada as esPortada, orden
        FROM escort_fotos
        WHERE escort_id = ?
        ORDER BY orden ASC, id ASC
    ");
    $stmt->execute([$escortId]);
    $fotos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Límite del plan activo
    $planStmt = $pdo->prepare("
        SELECT p.max_fotos
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND s.estado = 'activa' AND s.fecha_fin >= CURDATE()
        LIMIT 1
    ");
    $planStmt->execute([$escortId]);
    $plan = $planStmt->fetch(PDO::FETCH_ASSOC);
    $maxFotos = $plan ? (int)$plan['max_fotos'] : 5;

    echo json_encode(['success' => true, 'fotos' => $fotos, 'maxFotos' => $maxFotos]);
} catch (Throwable $e) {
    error_log("Error fotos/listar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
