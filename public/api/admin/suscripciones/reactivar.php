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

    // Verificar suscripción pausada
    $check = $db->prepare("
        SELECT s.*, e.nombre as escort_nombre, p.nombre as plan_nombre,
               p.duracion_dias
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
        echo json_encode(['error' => 'Suscripción no encontrada o no está pausada']);
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

    // Obtener última pausa para calcular días transcurridos
    $ultimaPausa = $db->prepare("
        SELECT fecha_accion, dias_acumulados_pausa 
        FROM historial_pausas 
        WHERE suscripcion_id = ? AND accion = 'pausa'
        ORDER BY fecha_accion DESC LIMIT 1
    ");
    $ultimaPausa->execute([$suscripcionId]);
    $pausa = $ultimaPausa->fetch(PDO::FETCH_ASSOC);

    // Calcular nueva fecha_fin (extender por días que estuvo pausada)
    $diasPausados = 0;
    if ($pausa) {
        $fechaPausa = new DateTime($pausa['fecha_accion']);
        $hoy = new DateTime();
        $diasPausados = $fechaPausa->diff($hoy)->days;
    }

    $nuevaFechaFin = date('Y-m-d', strtotime($suscripcion['fecha_fin'] . " +{$diasPausados} days"));

    // Actualizar suscripción
    $update = $db->prepare("
        UPDATE suscripciones 
        SET estado = 'activa',
            fecha_fin = ?,
            actualizado_en = NOW()
        WHERE id = ?
    ");
    $update->execute([$nuevaFechaFin, $suscripcionId]);

    // Registrar en historial_pausas
    $historial = $db->prepare("
        INSERT INTO historial_pausas 
        (suscripcion_id, escort_id, accion, dias_acumulados_pausa, notas, realizado_por)
        VALUES (?, ?, 'reactivacion', ?, ?, ?)
    ");
    $historial->execute([
        $suscripcionId,
        $suscripcion['escort_id'],
        $diasPausados,
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
            'dias_pausados' => $diasPausados,
            'nueva_fecha_fin' => $nuevaFechaFin,
            'notas' => $notas
        ]),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    // Notificación
    $notif = $db->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url)
        VALUES (?, 'sistema', 'Plan reactivado', ?, '/panel/mi-plan')
    ");
    $notif->execute([
        $suscripcion['escort_id'],
        "Tu plan '{$suscripcion['plan_nombre']}' ha sido reactivado. Nueva fecha de vencimiento: {$nuevaFechaFin}"
    ]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Suscripción reactivada correctamente',
        'nueva_fecha_fin' => $nuevaFechaFin,
        'dias_pausados' => $diasPausados
    ]);
} catch (PDOException $e) {
    if (isset($db)) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
}
