<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/cancelar-vip.php

ini_set('display_errors', 0);
error_reporting(E_ALL);

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

try {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || !isset($tokenData['exp']) || $tokenData['exp'] < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = isset($tokenData['id']) ? intval($tokenData['id']) : 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $solicitudId = (int)($input['solicitud_id'] ?? 0);

    if ($solicitudId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID de solicitud requerido']);
        exit;
    }

    require_once __DIR__ . '/../bootstrap.php';
    $pdo = getDBConnection();

    if (!$pdo) {
        throw new Exception('No se pudo conectar a la base de datos');
    }

    // Verificar que la solicitud pertenece a esta escort y está pendiente
    $stmt = $pdo->prepare("
        SELECT id, estado, comprobante_pago 
        FROM escort_vip_solicitudes 
        WHERE id = ? AND escort_id = ? AND estado IN ('enviado', 'en_revision')
    ");
    $stmt->execute([$solicitudId, $escortId]);
    $solicitud = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$solicitud) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Solicitud no encontrada o no puede ser cancelada']);
        exit;
    }

    // Eliminar comprobante si existe
    if ($solicitud['comprobante_pago']) {
        $path = __DIR__ . '/../../' . ltrim($solicitud['comprobante_pago'], '/');
        if (file_exists($path)) @unlink($path);
    }

    // Eliminar solicitud
    $pdo->prepare("DELETE FROM escort_vip_solicitudes WHERE id = ?")->execute([$solicitudId]);

    echo json_encode(['success' => true, 'message' => 'Solicitud cancelada correctamente']);
} catch (PDOException $e) {
    error_log("Error cancelar-vip.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Error cancelar-vip.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno: ' . $e->getMessage()]);
}
