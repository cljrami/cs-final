<?php
// public_html/api/escort/verify.php

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

$pdo = getDBConnection();
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyEscortToken($token);

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    // Verificar que la escort existe y está activa
    $stmt = $pdo->prepare("SELECT id, activa FROM escorts WHERE id = ?");
    $stmt->execute([$tokenData['id']]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Cuenta no encontrada']);
        exit;
    }

    if ((int)$escort['eliminada'] === 1) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Cuenta eliminada', 'mensaje' => 'Tu cuenta fue eliminada. Si deseas publicar de nuevo, regístrate con el mismo email: se reactivará automáticamente y deberás elegir un plan de pago.']);
        exit;
    }

    if ((int)$escort['activa'] !== 1) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Cuenta inactiva', 'mensaje' => 'Tu cuenta esta inactiva. Contacta al soporte.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'escort' => [
            'id' => $escort['id'],
            'primer_login' => $tokenData['primer_login'] ?? 0
        ]
    ]);
} catch (Throwable $e) {
    error_log("Error verify.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
