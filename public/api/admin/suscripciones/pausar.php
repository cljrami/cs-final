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
    $motivo = trim($data['motivo'] ?? '');

    if (!$suscripcionId || !$motivo) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de suscripción y motivo requeridos']);
        exit;
    }

    $db = getDBConnection();
    $db->beginTransaction();

    $check = $db->prepare("
        SELECT s.*, e.nombre as escort_nombre, p.nombre as plan_nombre,
               p.max_pausas_permitidas, p.duracion_dias,
               (SELECT COUNT(*) FROM historial_pausas hp WHERE hp.suscripcion_id = s.id AND hp.accion = 'pausa') as contador_pausas
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

    if ($suscripcion['estado'] !== 'activa') {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Solo se pueden pausar suscripciones activas']);
        exit;
    }

    // Verificar ventana desde primera pausa
    $fechaPrimerPausa = $suscripcion['fecha_primer_pausa'];
    $ventanaDias = max(1, (int)$suscripcion['duracion_dias']);
    if ($fechaPrimerPausa) {
        $inicio = new DateTime($fechaPrimerPausa);
        $diff = (int)$inicio->diff(new DateTime())->days;
        if ($diff > $ventanaDias) {
            $db->prepare("UPDATE suscripciones SET estado = 'expirada', actualizado_en = NOW() WHERE id = ?")->execute([$suscripcionId]);
            $db->commit();
            http_response_code(400);
            echo json_encode(['error' => "Pasaron más de {$ventanaDias} días desde la primera pausa. La suscripción ha expirado."]);
            exit;
        }
    }

    $contadorPausas = (int)$suscripcion['contador_pausas'];
    $maxPausas = (int)$suscripcion['max_pausas_permitidas'];

    if ($contadorPausas >= $maxPausas) {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Límite de pausas alcanzado']);
        exit;
    }

    // Si es la primera pausa, guardar fecha de referencia
    if ($contadorPausas === 0) {
        $db->prepare("UPDATE suscripciones SET fecha_primer_pausa = NOW() WHERE id = ?")->execute([$suscripcionId]);
    }

    $update = $db->prepare("
        UPDATE suscripciones 
        SET estado = 'pausada',
            actualizado_en = NOW()
        WHERE id = ?
    ");
    $update->execute([$suscripcionId]);

    $historial = $db->prepare("
        INSERT INTO historial_pausas 
        (suscripcion_id, escort_id, accion, notas, realizado_por)
        VALUES (?, ?, 'pausa', ?, ?)
    ");
    $historial->execute([
        $suscripcionId,
        $suscripcion['escort_id'],
        $motivo,
        $tokenData['id']
    ]);

    $log = $db->prepare("
        INSERT INTO logs_auditoria 
        (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
        VALUES (?, ?, 'pausar_suscripcion', 'suscripciones', ?, ?, ?)
    ");
    $log->execute([
        $tokenData['id'],
        $suscripcion['escort_id'],
        $suscripcionId,
        json_encode([
            'suscripcion_id' => $suscripcionId,
            'motivo' => $motivo,
            'contador_pausas' => $contadorPausas + 1
        ]),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    $notif = $db->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url)
        VALUES (?, 'sistema', 'Plan pausado', ?, '/panel/mi-plan')
    ");
    $notif->execute([
        $suscripcion['escort_id'],
        "Tu plan '{$suscripcion['plan_nombre']}' ha sido pausado. Motivo: {$motivo}"
    ]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Suscripción pausada correctamente'
    ]);
} catch (PDOException $e) {
    if (isset($db)) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
}
