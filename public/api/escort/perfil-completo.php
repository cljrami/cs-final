<?php
// public/api/escort/perfil-completo.php

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

    if (!$tokenData || (isset($tokenData['exp']) ? $tokenData['exp'] : 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = $tokenData['id'];

    $stmt = $pdo->prepare("
        SELECT id, nombre, edad, altura, peso, medidas,
               ciudad, whatsapp, telefono, 
               nacionalidad, etnia, color_ojos, color_pelo, orientacion, estilo,
               descripcion_corta, descripcion_larga,
               estado, verificado, vip
        FROM escorts 
        WHERE id = ? AND eliminada = 0
    ");
    $stmt->execute([$escortId]);
    $perfil = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$perfil) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Perfil no encontrado']);
        exit;
    }

    // Cargar servicios de la escort con su tipo (incluido/adicional)
    $servStmt = $pdo->prepare("
        SELECT servicio_id AS id, incluido
        FROM escort_servicios
        WHERE escort_id = ?
    ");
    $servStmt->execute([$escortId]);
    $perfil['servicios'] = $servStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'perfil' => $perfil]);
} catch (Throwable $e) {
    error_log("Error escort/perfil-completo.php: " . $e->getMessage() . " en " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
