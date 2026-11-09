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
    $notas = trim($data['notas'] ?? '');
    $comprobantePago = comprobante_path($data['comprobante_pago'] ?? null);

    if (!$suscripcionId) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de suscripción requerido']);
        exit;
    }

    $db = getDBConnection();
    $db->beginTransaction();

    // Verificar suscripci?n existe y est? pendiente
    $check = $db->prepare("
        SELECT s.*, e.nombre as escort_nombre, e.email as escort_email, 
               p.nombre as plan_nombre, p.duracion_dias, p.uso_unico, p.id as plan_id,
               p.extra_tipo, p.tipo as plan_tipo
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
            UNION
            SELECT s.id FROM suscripciones s
            JOIN planes p ON p.id = s.plan_id
            JOIN escorts e ON e.id = s.escort_id
            WHERE e.email = ? AND p.id = ? AND p.uso_unico = 1 AND s.fecha_aprobacion IS NOT NULL
            LIMIT 1
        ");
        $usado->execute([$suscripcion['plan_id'], $suscripcion['escort_email'], $suscripcion['escort_email'], $suscripcion['plan_id']]);
        if ($usado->fetch()) {
            $db->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'Esta escort ya usó el plan gratuito']);
            exit;
        }
    }

    // Validar que la escort no tenga ya un extra activo o pendiente del mismo tipo
    $extraTipo = $suscripcion['extra_tipo'];
    if ($extraTipo) {
        $checkExtraActivo = $db->prepare("
            SELECT 1 FROM suscripciones s2
            JOIN planes p2 ON p2.id = s2.plan_id
            WHERE s2.escort_id = ?
              AND s2.id != ?
              AND p2.extra_tipo = ?
              AND p2.tipo = 'extra'
              AND (
                  (s2.fecha_aprobacion IS NULL) -- pendiente
                  OR (s2.estado = 'activa' AND s2.fecha_fin >= CURDATE()) -- activa vigente
                  OR (s2.estado = 'pausada') -- pausada
              )
            LIMIT 1
        ");
        $checkExtraActivo->execute([$suscripcion['escort_id'], $suscripcionId, $extraTipo]);
        if ($checkExtraActivo->fetchColumn()) {
            $db->rollBack();
            http_response_code(409);
            echo json_encode(['error' => "La escort ya tiene una solicitud {$extraTipo} activa, pendiente o pausada. Debe esperar a que finalice para contratar otra."]);
            exit;
        }

        // Tambi?n verificar el flag directo en escorts (sticky=1 o destacado=1 vigente)
        $colFlag = $extraTipo === 'sticky' ? 'sticky' : ($extraTipo === 'destacado' ? 'destacado' : null);
        if ($colFlag) {
            $colExpira = $extraTipo === 'sticky' ? 'sticky_expira' : 'fecha_destacado_expira';
            $checkFlag = $db->prepare("SELECT 1 FROM escorts WHERE id = ? AND {$colFlag} = 1 AND ({$colExpira} IS NULL OR {$colExpira} >= CURDATE())");
            $checkFlag->execute([$suscripcion['escort_id']]);
            if ($checkFlag->fetchColumn()) {
                $db->rollBack();
                http_response_code(409);
                echo json_encode(['error' => "La escort ya tiene {$extraTipo} activo en su perfil. No puede contratar otro hasta que expire."]);
                exit;
            }
        }
    }

    // Calcular fechas
    $fechaInicio = date('Y-m-d');
    $fechaFin = date('Y-m-d', strtotime("+{$suscripcion['duracion_dias']} days"));

    // Actualizar suscripci?n
    $update = $db->prepare("
        UPDATE suscripciones 
        SET estado = 'activa',
            fecha_aprobacion = ?,
            fecha_inicio = ?,
            fecha_fin = ?,
            aprobado_por = ?,
            comprobante_pago = COALESCE(?, comprobante_pago),
            actualizado_en = NOW()
        WHERE id = ?
    ");
    $update->execute([$fechaInicio, $fechaInicio, $fechaFin, $tokenData['id'], $comprobantePago, $suscripcionId]);

    if ($comprobantePago) {
        $db->prepare("UPDATE pagos SET comprobante_url = ? WHERE suscripcion_id = ?")
            ->execute([$comprobantePago, $suscripcionId]);
    }

    // Registrar en planes_usados si es uso ?nico
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

    // Verificar estado del plan ANTERIOR para saber si resetear verificado/vip
    $prevStmt = $db->prepare("
        SELECT
            s.estado,
            s.fecha_fin,
            s.fecha_aprobacion,
            p.duracion_dias,
            CASE
                WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'expirada'
                WHEN s.fecha_aprobacion IS NULL AND s.fecha_rechazo IS NULL THEN 'pendiente_aprobacion'
                WHEN s.fecha_rechazo IS NOT NULL THEN 'rechazada'
                WHEN s.estado = 'pausada' THEN 'pausada'
                WHEN s.estado = 'cancelada' THEN 'cancelada'
                WHEN s.estado = 'activa' THEN 'activa'
                ELSE s.estado
            END AS estado_calculado
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND p.tipo = 'base' AND s.id != ?
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $prevStmt->execute([$suscripcion['escort_id'], $suscripcionId]);
    $planAnterior = $prevStmt->fetch(PDO::FETCH_ASSOC);

    $resetVerificadoVip = false;
    if ($planAnterior && in_array($planAnterior['estado_calculado'], ['expirada', 'cancelada', 'rechazada'], true)) {
        $resetVerificadoVip = true;
    }

    // Actualizar escort con plan activo (tambi?n aprueba la cuenta si no lo estaba)
    // Verificar si la columna aprobada existe (migraci?n pendiente)
    $colCheck = $db->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'aprobada'
    ");
    $colCheck->execute();
    $tieneAprobada = (int)$colCheck->fetchColumn() > 0;
    $setAprobada = $tieneAprobada ? ', aprobada = 1' : '';

    $extraSets = '';
    $extraParams = [];
    if ($suscripcion['extra_tipo'] === 'sticky') {
        $extraSets = ', sticky = 1, sticky_expira = ?';
        $extraParams[] = $fechaFin;
    } elseif ($suscripcion['extra_tipo'] === 'destacado') {
        $extraSets = ', destacado = 1, fecha_destacado_expira = ?';
        $extraParams[] = $fechaFin;
    }

    // Si el plan anterior estaba expirado/cancelado/rechazado: reset completo del
    // ciclo anterior (verificado, vip, destacado, sticky, disponible y extras).
    $resetSets = $resetVerificadoVip ? ', verificado = 0, vip = 0, destacado = 0, fecha_destacado_expira = NULL, sticky = 0, sticky_orden = 0, sticky_expira = NULL, disponible_ahora = 0' : '';

    $updateEscort = $db->prepare("
        UPDATE escorts 
        SET estado = 'aprobada'{$setAprobada}{$extraSets}{$resetSets}, updated_at = NOW()
        WHERE id = ?
    ");
    $updateEscort->execute(array_merge(
        $extraParams,
        [$suscripcion['escort_id']]
    ));

    // Reset completo del ciclo anterior: posiciones sticky, extras activos
    // viejos y solicitudes pendientes viejas (VIP/verificación) expiran para
    // que todo parta de cero con el plan nuevo.
    if ($resetVerificadoVip) {
        $db->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")
            ->execute([$suscripcion['escort_id']]);
        $db->prepare("
            UPDATE suscripciones s
            JOIN planes p ON p.id = s.plan_id
            SET s.estado = 'expirada'
            WHERE s.escort_id = ? AND s.estado = 'activa' AND s.eliminada = 0
              AND p.extra_tipo IS NOT NULL AND s.id != ?
        ")->execute([$suscripcion['escort_id'], $suscripcionId]);
        $db->prepare("
            UPDATE escort_vip_solicitudes
            SET estado = 'rechazada', admin_notas = 'Expirada por vencimiento del plan. Solicítala de nuevo.'
            WHERE escort_id = ? AND estado = 'enviado'
        ")->execute([$suscripcion['escort_id']]);
        $db->prepare("
            UPDATE verificaciones
            SET estado = 'rechazada', notas_revision = 'Expirada por vencimiento del plan. Solicítala de nuevo.'
            WHERE escort_id = ? AND estado IN ('pendiente', 'en_revision')
        ")->execute([$suscripcion['escort_id']]);
    }

    if ($suscripcion['extra_tipo'] === 'sticky') {
        $ciudadSticky = $db->prepare("SELECT c.id FROM ciudades c JOIN escorts e ON e.ciudad = c.nombre WHERE e.id = ?");
        $ciudadSticky->execute([$suscripcion['escort_id']]);
        $ciudadIdSticky = (int)$ciudadSticky->fetchColumn();
        if ($ciudadIdSticky > 0) {
            $db->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ? AND ciudad_id = ?")
                ->execute([$suscripcion['escort_id'], $ciudadIdSticky]);
            $maxOrdenSticky = $db->prepare("SELECT COALESCE(MAX(orden), 0) FROM sticky_posiciones WHERE ciudad_id = ?");
            $maxOrdenSticky->execute([$ciudadIdSticky]);
            $db->prepare("INSERT INTO sticky_posiciones (escort_id, ciudad_id, orden) VALUES (?, ?, ?)")
                ->execute([$suscripcion['escort_id'], $ciudadIdSticky, (int)$maxOrdenSticky->fetchColumn() + 1]);
        }
    }

    // Log auditor?a
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

    // Notificaci?n a escort
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
    echo json_encode(['error' => 'Error de base de datos']);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error del servidor']);
}

