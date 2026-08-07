<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../lib/plan_pausas.php';

$tokenData = requireAuth();


requireAdminRole($tokenData);

try {
    $data = json_decode(file_get_contents('php://input'), true);
    $suscripcionId = intval($data['suscripcion_id'] ?? 0);
    $notas = trim($data['notas'] ?? '');

    if (!$suscripcionId) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de suscripciíƒÂ³n requerido']);
        exit;
    }

    $db = getDBConnection();
    $db->beginTransaction();

    // Verificar suscripciíƒÂ³n pausada
    $check = $db->prepare("
        SELECT s.*, e.nombre as escort_nombre, p.nombre as plan_nombre,
               p.duracion_dias, p.tipo as plan_tipo
        FROM suscripciones s
        JOIN escorts e ON e.id = s.escort_id
        JOIN planes p ON p.id = s.plan_id
        WHERE s.id = ? AND e.eliminada = 0 AND s.estado = 'pausada'
    ");
    $check->execute([$suscripcionId]);
    $suscripcion = $check->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'SuscripciíƒÂn no encontrada o no estíƒÂ pausada']);
        exit;
    }

    if ($suscripcion['plan_tipo'] === 'extra') {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Las solicitudes de planes extra se gestionan desde el panel de Solicitudes Extras']);
        exit;
    }

    // Modelo unificado: sumar la duración real de la pausa y recalcular fecha_fin desde la base
    $diasEstaPausa = plan_dias_esta_pausa($suscripcion['fecha_pausa']);
    $diasPausadosTotal = (int)($suscripcion['dias_pausados'] ?? 0) + $diasEstaPausa;

    // Actualizar suscripción
    $update = $db->prepare("
        UPDATE suscripciones 
        SET estado = 'activa',
            fecha_pausa = NULL,
            dias_pausados = ?,
            actualizado_en = NOW()
        WHERE id = ?
    ");
    $update->execute([$diasPausadosTotal, $suscripcionId]);
    $nuevaFechaFin = plan_recalcular_fecha_fin($db, $suscripcionId);

    $db->prepare("UPDATE escorts SET activa = 1 WHERE id = ?")->execute([$suscripcion['escort_id']]);

    // Registrar en historial_pausas
    $historial = $db->prepare("
        INSERT INTO historial_pausas 
        (suscripcion_id, escort_id, accion, dias_acumulados_pausa, notas, realizado_por)
        VALUES (?, ?, 'reactivacion', ?, ?, ?)
    ");
    $historial->execute([
        $suscripcionId,
        $suscripcion['escort_id'],
        $diasEstaPausa,
        $notas,
        $tokenData['id']
    ]);

    // Log auditoría
    $log = $db->prepare("
        INSERT INTO logs_auditoria 
        (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
        VALUES (?, ?, 'reactivar_suscripcion', 'suscripciones', ?, ?, ?)
    ");
    $log->execute([
        $tokenData['id'],
        $suscripcion['escort_id'],
        $suscripcionId,
        json_encode([
            'suscripcion_id' => $suscripcionId,
            'escort_id' => $suscripcion['escort_id'],
            'dias_esta_pausa' => $diasEstaPausa,
            'nueva_fecha_fin' => $nuevaFechaFin,
            'notas' => $notas
        ]),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    // Log auditoríƒÂ­a
    $log = $db->prepare("
        INSERT INTO logs_auditoria 
        (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
        VALUES (?, ?, 'reactivar_suscripcion', 'suscripciones', ?, ?, ?)
    ");
    $log->execute([
        $tokenData['id'],
        $suscripcion['escort_id'],
        $suscripcionId,
        json_encode([
            'suscripcion_id' => $suscripcionId,
            'escort_id' => $suscripcion['escort_id'],
            'dias_pausados' => $diasPausados,
            'nueva_fecha_fin' => $nuevaFechaFin,
            'notas' => $notas
        ]),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    // NotificaciíƒÂ³n
    $notif = $db->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url)
        VALUES (?, 'sistema', 'Plan reactivado', ?, '/panel/mi-plan')
    ");
    $notif->execute([
        $suscripcion['escort_id'],
        "Tu plan '{$suscripcion['plan_nombre']}' ha sido reactivado. Nueva fecha de vencimiento: {$nuevaFechaFin}"
    ]);

    $db->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id) VALUES (NULL, 'sistema', 'Plan reactivado por admin', ?, '/admin/escorts', ?)")
        ->execute(["El administrador reactivíƒÂ³ el plan '{$suscripcion['plan_nombre']}' de {$suscripcion['escort_nombre']} (ID {$suscripcion['escort_id']}).", $suscripcion['escort_id']]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'SuscripciíƒÂ³n reactivada correctamente',
        'nueva_fecha_fin' => $nuevaFechaFin,
        'dias_esta_pausa' => $diasEstaPausa
    ]);
} catch (PDOException $e) {
    if (isset($db)) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error del servidor']);
}

