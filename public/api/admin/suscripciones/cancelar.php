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


requireAdminRole($tokenData);

try {
    $data = json_decode(file_get_contents('php://input'), true);
    $suscripcionId = intval($data['suscripcion_id'] ?? 0);

    if (!$suscripcionId) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de suscripciíƒÂ³n requerido']);
        exit;
    }

    $db = getDBConnection();
    $db->beginTransaction();

    $check = $db->prepare("
SELECT s.*, e.nombre as escort_nombre, p.nombre as plan_nombre, p.extra_tipo, p.tipo as plan_tipo
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
        echo json_encode(['error' => 'SuscripciíƒÂn no encontrada']);
        exit;
    }

    if ($suscripcion['plan_tipo'] === 'extra') {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Las solicitudes de planes extra se gestionan desde el panel de Solicitudes Extras']);
        exit;
    }

    if ($suscripcion['estado'] !== 'activa') {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Solo se pueden cancelar suscripciones activas']);
        exit;
    }

    $update = $db->prepare("
        UPDATE suscripciones 
        SET estado = 'cancelada',
            actualizado_en = NOW()
        WHERE id = ?
    ");
    $update->execute([$suscripcionId]);

    // Limpiar flags de extras en el escort
    $extraClean = '';
    if ($suscripcion['extra_tipo'] === 'sticky') {
        $extraClean = 'sticky = 0, sticky_orden = 0, sticky_expira = NULL, ';
    } elseif ($suscripcion['extra_tipo'] === 'destacado') {
        $extraClean = 'destacado = 0, fecha_destacado_expira = NULL, ';
    }
    $updateEscort = $db->prepare("
        UPDATE escorts 
        SET {$extraClean}updated_at = NOW()
        WHERE id = ?
    ");
    $updateEscort->execute([$suscripcion['escort_id']]);

    if ($suscripcion['extra_tipo'] === 'sticky') {
        $db->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$suscripcion['escort_id']]);
    }

    $log = $db->prepare("
        INSERT INTO logs_auditoria 
        (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
        VALUES (?, ?, 'cancelar_suscripcion', 'suscripciones', ?, ?, ?)
    ");
    $log->execute([
        $tokenData['id'],
        $suscripcion['escort_id'],
        $suscripcionId,
        json_encode(['suscripcion_id' => $suscripcionId]),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    $notif = $db->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url)
        VALUES (?, 'sistema', 'Plan cancelado', ?, '/panel/mi-plan')
    ");
    $notif->execute([
        $suscripcion['escort_id'],
        "Tu plan '{$suscripcion['plan_nombre']}' ha sido cancelado por la administraciíƒÂ³n."
    ]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'SuscripciíƒÂ³n cancelada correctamente'
    ]);
} catch (PDOException $e) {
    if (isset($db)) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error del servidor']);
}

