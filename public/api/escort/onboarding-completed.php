<?php
// public_html/api/escort/onboarding-completed.php

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (substr($authHeader, 0, 7) !== 'Bearer ') {
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

    // El onboarding solo se puede completar si la escort ya seleccionó su plan
    // (tiene al menos una suscripción creada). Evita saltarse el plan.
    $tienePlan = $pdo->prepare("SELECT 1 FROM suscripciones WHERE escort_id = ? LIMIT 1");
    $tienePlan->execute([$tokenData['id']]);
    if (!$tienePlan->fetch()) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Debes seleccionar tu plan primero']);
        exit;
    }

    // Actualizar en BD
    $stmt = $pdo->prepare("UPDATE escorts SET primer_login = 0 WHERE id = ?");
    $stmt->execute([$tokenData['id']]);

    // Regenerar token con primer_login = 0
    $newTokenData = [
        'id' => $tokenData['id'],
        'usuario' => $tokenData['usuario'] ?? '',
        'tipo' => 'escort',
        'primer_login' => 0,
        'exp' => $tokenData['exp']
    ];
    $newToken = signToken($newTokenData);

    echo json_encode([
        'success' => true,
        'token' => $newToken
    ]);
} catch (Throwable $e) {
    error_log("Error onboarding-completed.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
