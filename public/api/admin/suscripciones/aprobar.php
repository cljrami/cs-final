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
    $comprobantePago = $data['comprobante_pago'] ?? null;

    if (!$suscripcionId) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de suscripción requerido']);
        exit;
    }

    $db = getDBConnection();
    $db->beginTransaction();

    // Verificar suscripción existe y está pendiente
    $check = $db->prepare("
        SELECT s.*, e.nombre as escort_nombre, e.email as escort_email, 
               p.nombre as plan_nombre, p.duracion_dias, p.uso_unico, p.id as plan_id
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

    if ($suscripcion['fecha_aprobacion'] !== null) {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'Esta suscripción ya fue aprobada']);
        exit;
    }

    // Verificar plan gratis no repetido
    if ($suscripcion['uso_unico']) {
        $usado = $db->prepare("
            SELECT id FROM planes_usados 
            WHERE plan_id = ? AND email = ?
        ");
        $usado->execute([$suscripcion['plan_id'], $suscripcion['escort_email']]);
        if ($usado->fetch()) {
            $db->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'Esta escort ya usó el plan gratuito']);
            exit;
        }
    }

    // Calcular fechas
    $fechaInicio = date('Y-m-d');
    $fechaFin = date('Y-m-d', strtotime("+{$suscripcion['duracion_dias']} days"));

    // Actualizar suscripción
    $update = $db->prepare("
        UPDATE suscripciones 
        SET estado = 'activa',
            fecha_aprobacion = ?,
            fecha_inicio = ?,
            fecha_fin = ?,
            aprobado_por = ?,
            comprobante_pago = ?,
            actualizado_en = NOW()
        WHERE id = ?
    ");
    $update->execute([$fechaInicio, $fechaInicio, $fechaFin, $tokenData['id'], $comprobantePago, $suscripcionId]);

    // Registrar en planes_usados si es uso único
    if ($suscripcion['uso_unico']) {
        $insertUsado = $db->prepare("
            INSERT INTO planes_usados (plan_id, email, escort_id) 
            VALUES (?, ?, ?)
        ");
        $insertUsado->execute([
            $suscripcion['plan_id'],
            $suscripcion['escort_email'],
            $suscripcion['escort_id']
        ]);
    }

    // Actualizar escort con plan activo (también aprueba la cuenta si no lo estaba)
    // Verificar si la columna aprobada existe (migración pendiente)
    $colCheck = $db->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'aprobada'
    ");
    $colCheck->execute();
    $tieneAprobada = (int)$colCheck->fetchColumn() > 0;
    $setAprobada = $tieneAprobada ? ', aprobada = 1' : '';

    $updateEscort = $db->prepare("
        UPDATE escorts 
        SET plan_id = ?, suscripcion_id = ?, activa = 1, 
            estado = 'aprobada'{$setAprobada}, updated_at = NOW()
        WHERE id = ?
    ");
    $updateEscort->execute([
        $suscripcion['plan_id'],
        $suscripcionId,
        $suscripcion['escort_id']
    ]);

    // Log auditoría
    $log = $db->prepare("
        INSERT INTO logs_auditoria 
        (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
        VALUES (?, ?, 'aprobar_suscripcion', 'suscripciones', ?, ?, ?)
    ");
    $log->execute([
        $tokenData['id'],
        $suscripcion['escort_id'],
        $suscripcionId,
        json_encode([
            'suscripcion_id' => $suscripcionId,
            'escort_id' => $suscripcion['escort_id'],
            'plan_id' => $suscripcion['plan_id'],
            'fecha_aprobacion' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'aprobado_por' => $tokenData['id'],
            'notas' => $notas
        ]),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    // Notificación a escort
    $notif = $db->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url)
        VALUES (?, 'sistema', 'Plan aprobado', ?, '/panel/mi-plan')
    ");
    $notif->execute([
        $suscripcion['escort_id'],
        "Tu plan '{$suscripcion['plan_nombre']}' ha sido aprobado. Válido hasta {$fechaFin}."
    ]);

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Suscripción aprobada correctamente',
        'fecha_fin' => $fechaFin
    ]);
} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error del servidor: ' . $e->getMessage()]);
}
