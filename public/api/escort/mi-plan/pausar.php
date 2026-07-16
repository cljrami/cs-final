<?php
require_once __DIR__ . '/../../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/mi-plan/pausar.php

header('Content-Type: application/json');
if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

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

    $escortId = $tokenData['id'] ?? 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    require_once __DIR__ . '/../../bootstrap.php';

    $pdo = getDBConnection();
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        SELECT id, fecha_fin, dias_pausados, estado
        FROM suscripciones
        WHERE escort_id = ? AND estado = 'activa'
        LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'No tienes un plan activo para pausar']);
        exit;
    }

    $hoy = new DateTime('today');
    $fechaFin = new DateTime($suscripcion['fecha_fin']);
    $diasRestantes = (int)$hoy->diff($fechaFin)->days;

    $stmt = $pdo->prepare("
        UPDATE suscripciones
        SET estado = 'pausada',
            fecha_pausa = CURDATE(),
            dias_restantes = ?,
            updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$diasRestantes, $suscripcion['id']]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'mensaje' => 'Plan pausado correctamente',
        'dias_guardados' => $diasRestantes
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error pausar.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB: ' . $e->getMessage()]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error pausar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
