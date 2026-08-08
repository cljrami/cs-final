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
    $motivo = trim($data['motivo'] ?? '');

    if (!$suscripcionId) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de suscripción requerido']);
        exit;
    }

    if ($motivo === '') {
        $motivo = 'Solicitud rechazada por el administrador';
    }

    $db = getDBConnection();
    $db->beginTransaction();

    // Verificar suscripciíƒÂ³n
    $check = $db->prepare("
        SELECT s.*, e.nombre as escort_nombre, p.nombre as plan_nombre, p.tipo as plan_tipo
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

    if ($suscripcion['plan_tipo'] === 'extra') {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Las solicitudes de planes extra se gestionan desde el panel de Solicitudes Extras']);
        exit;
    }

    if ($suscripcion['estado'] === 'rechazada') {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Esta suscripción ya fue rechazada']);
        exit;
    }

    // Actualizar suscripciíƒÂ³n
    $update = $db->prepare("
        UPDATE suscripciones 
        SET estado = 'rechazada',
            fecha_rechazo = CURDATE(),
            rechazado_por = ?,
            actualizado_en = NOW()
        WHERE id = ?
    ");
    $update->execute([$tokenData['id'], $suscripcionId]);

    // Log auditoríƒÂ­a con motivo
    $log = $db->prepare("
        INSERT INTO logs_auditoria 
        (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
        VALUES (?, ?, 'rechazar_suscripcion', 'suscripciones', ?, ?, ?)
    ");
    $log->execute([
        $tokenData['id'],
        $suscripcion['escort_id'],
        $suscripcionId,
        json_encode([
            'suscripcion_id' => $suscripcionId,
            'escort_id' => $suscripcion['escort_id'],
            'plan_id' => $suscripcion['plan_id'],
            'motivo_rechazo' => $motivo,
            'rechazado_por' => $tokenData['id'],
            'fecha_rechazo' => date('Y-m-d')
        ]),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    // NotificaciíƒÂ³n a escort
    $notif = $db->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url)
        VALUES (?, 'sistema', 'Plan rechazado', ?, '/panel/mi-plan')
    ");
    $notif->execute([
        $suscripcion['escort_id'],
        "Tu solicitud de plan '{$suscripcion['plan_nombre']}' fue rechazada. Motivo: {$motivo}"
    ]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Suscripción rechazada correctamente'
    ]);
} catch (PDOException $e) {
    if (isset($db)) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error del servidor']);
}

