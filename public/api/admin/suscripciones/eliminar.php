<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../bootstrap.php';

$tokenData = requireAuth();

try {
    $data = json_decode(file_get_contents('php://input'), true);
    $suscripcionId = intval($data['suscripcion_id'] ?? 0);
    $notas = trim($data['notas'] ?? '');

    if (!$suscripcionId) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de suscripción requerido']);
        exit;
    }

    $db = getDBConnection();
    $db->beginTransaction();

    // Obtener datos completos antes de eliminar
    $check = $db->prepare("
        SELECT s.*, e.nombre as escort_nombre, e.email as escort_email,
               p.nombre as plan_nombre, p.tipo as plan_tipo, p.duracion_dias
        FROM suscripciones s
        JOIN escorts e ON e.id = s.escort_id
        JOIN planes p ON p.id = s.plan_id
        WHERE s.id = ? AND e.eliminada = 0
    ");
    $check->execute([$suscripcionId]);
    $suscripcion = $check->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Suscripción no encontrada']);
        exit;
    }

    // Guardar en historial antes de eliminar
    $historial = $db->prepare("
        INSERT INTO suscripciones_historial 
        (suscripcion_id, escort_id, escort_nombre, escort_email, plan_id, plan_nombre, 
         plan_tipo, precio_pagado, moneda, estado_anterior, fecha_inicio, fecha_aprobacion, 
         fecha_fin, aprobado_por, rechazado_por, eliminado_por, notas_eliminacion, datos_completos)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $historial->execute([
        $suscripcionId,
        $suscripcion['escort_id'],
        $suscripcion['escort_nombre'],
        $suscripcion['escort_email'],
        $suscripcion['plan_id'],
        $suscripcion['plan_nombre'],
        $suscripcion['plan_tipo'],
        $suscripcion['precio_pagado'],
        $suscripcion['moneda'],
        $suscripcion['estado'],
        $suscripcion['fecha_inicio'],
        $suscripcion['fecha_aprobacion'],
        $suscripcion['fecha_fin'],
        $suscripcion['aprobado_por'],
        $suscripcion['rechazado_por'],
        $tokenData['id'],
        $notas,
        json_encode($suscripcion)
    ]);

    // Log auditoría
    $log = $db->prepare("
        INSERT INTO logs_auditoria 
        (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address)
        VALUES (?, ?, 'eliminar_suscripcion', 'suscripciones', ?, ?, ?)
    ");
    $log->execute([
        $tokenData['id'],
        $suscripcion['escort_id'],
        $suscripcionId,
        json_encode($suscripcion),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    // Desvincular escort del plan
    $updateEscort = $db->prepare("
        UPDATE escorts 
        SET plan_id = NULL, suscripcion_id = NULL, activa = 0, updated_at = NOW()
        WHERE id = ? AND suscripcion_id = ?
    ");
    $updateEscort->execute([$suscripcion['escort_id'], $suscripcionId]);

    // Eliminar suscripción (HARD DELETE)
    $delete = $db->prepare("DELETE FROM suscripciones WHERE id = ?");
    $delete->execute([$suscripcionId]);

    // Limpiar planes_usados si existe (para planes de uso único)
    $cleanUsados = $db->prepare("DELETE FROM planes_usados WHERE plan_id = ? AND escort_id = ?");
    $cleanUsados->execute([$suscripcion['plan_id'], $suscripcion['escort_id']]);

    // Notificación
    $notif = $db->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url)
        VALUES (?, 'sistema', 'Plan cancelado', ?, '/panel/mi-plan')
    ");
    $notif->execute([
        $suscripcion['escort_id'],
        "Tu plan '{$suscripcion['plan_nombre']}' ha sido cancelado."
    ]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Suscripción eliminada correctamente'
    ]);
} catch (PDOException $e) {
    if (isset($db)) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
}
