<?php
require_once __DIR__ . '/../../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/mi-plan/reactivar.php

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
        SELECT id, dias_restantes, dias_pausados, fecha_pausa
        FROM suscripciones
        WHERE escort_id = ? AND estado = 'pausada'
        LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'No tienes un plan pausado para reactivar']);
        exit;
    }

    $nuevaFechaFin = (new DateTime('today'))->modify("+{$suscripcion['dias_restantes']} days");

    $fechaPausa = new DateTime($suscripcion['fecha_pausa']);
    $diasEstaPausa = (int)$fechaPausa->diff(new DateTime('today'))->days;
    $diasPausadosTotal = (int)$suscripcion['dias_pausados'] + $diasEstaPausa;

    $stmt = $pdo->prepare("
        UPDATE suscripciones
        SET estado = 'activa',
            fecha_fin = ?,
            fecha_reactivacion = CURDATE(),
            fecha_pausa = NULL,
            dias_restantes = NULL,
            dias_pausados = ?,
            updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([
        $nuevaFechaFin->format('Y-m-d'),
        $diasPausadosTotal,
        $suscripcion['id']
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'mensaje' => 'Plan reactivado correctamente',
        'nueva_fecha_fin' => $nuevaFechaFin->format('d/m/Y')
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error reactivar.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB: ' . $e->getMessage()]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error reactivar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
