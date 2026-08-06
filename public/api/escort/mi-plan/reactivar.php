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
    require_once __DIR__ . '/../../lib/plan_pausas.php';

    $pdo = getDBConnection();
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        SELECT id, dias_pausados, fecha_pausa
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

    // Modelo unificado: sumar la duración real de la pausa y recalcular fecha_fin desde la base
    $diasEstaPausa = plan_dias_esta_pausa($suscripcion['fecha_pausa']);
    $diasPausadosTotal = (int)($suscripcion['dias_pausados'] ?? 0) + $diasEstaPausa;

    $stmt = $pdo->prepare("
        UPDATE suscripciones
        SET estado = 'activa',
            fecha_reactivacion = CURDATE(),
            fecha_pausa = NULL,
            dias_restantes = NULL,
            dias_pausados = ?,
            updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([
        $diasPausadosTotal,
        $suscripcion['id']
    ]);
    $nuevaFechaFin = plan_recalcular_fecha_fin($pdo, $suscripcion['id']);

    $pdo->prepare("UPDATE escorts SET activa = 1 WHERE id = ?")->execute([$escortId]);

    $af = $pdo->prepare("SELECT foto_principal, nombre FROM escorts WHERE id = ?");
    $af->execute([$escortId]);
    $actor = $af->fetch(PDO::FETCH_ASSOC);

    $notif = $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url) VALUES (?, 'sistema', 'Plan reactivado', ?, '/mi-cuenta/mi-plan')");
    $notif->execute([$escortId, "Tu plan ha sido reactivado. Vence el " . ($nuevaFechaFin ? date('d/m/Y', strtotime($nuevaFechaFin)) : '—') . "."]);

    $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id) VALUES (NULL, 'sistema', 'Reactivó su plan', ?, '/admin/escorts', ?)")
        ->execute(["La escort {$actor['nombre']} ha reactivado su plan.", $escortId]);

    $pdo->commit();

    require_once __DIR__ . '/../../mail.php';
    notificarAccionEscort('planes', $escortId, $actor['nombre'] . ' reactivó su plan', [
        'Nueva fecha fin' => $nuevaFechaFin ? date('d/m/Y', strtotime($nuevaFechaFin)) : '—',
    ]);

    echo json_encode([
        'success' => true,
        'mensaje' => 'Plan reactivado correctamente',
        'nueva_fecha_fin' => $nuevaFechaFin
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error reactivar.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error reactivar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
