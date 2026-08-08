<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/plan_pausas.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

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
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(array('success' => false, 'error' => 'No autorizado'));
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || !isset($tokenData['exp']) || $tokenData['exp'] < time()) {
        http_response_code(401);
        echo json_encode(array('success' => false, 'error' => 'Token expirado'));
        exit;
    }

    $escortId = isset($tokenData['id']) ? intval($tokenData['id']) : 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(array('success' => false, 'error' => 'Token inválido'));
        exit;
    }

    $pdo = getDBConnection();

    $stmt = $pdo->prepare("
        SELECT 
            s.id as suscripcion_id,
            s.plan_id,
            s.fecha_inicio,
            s.fecha_fin,
            s.fecha_pausa,
            s.fecha_aprobacion,
            s.estado,
            s.precio_pagado,
            s.moneda,
            s.comprobante_pago,
            s.creado_en,
            (SELECT id FROM pagos WHERE escort_id = s.escort_id AND concepto = 'plan' ORDER BY creado_en DESC LIMIT 1) AS pago_id,
            p.nombre as plan_nombre,
            p.slug as plan_slug,
            p.tipo as plan_tipo,
            p.duracion_dias as plan_duracion,
            p.max_fotos,
            p.max_videos,
            p.permite_vip,
            p.permite_destacado,
            p.uso_unico,
            p.badge as plan_badge,
            p.color_badge,
            p.max_pausas_permitidas,
            CASE 
                WHEN s.estado = 'activa' AND (s.fecha_fin IS NULL OR s.fecha_fin >= CURDATE()) THEN 'activa'
                WHEN s.fecha_aprobacion IS NULL AND s.fecha_rechazo IS NULL THEN 'pendiente_aprobacion'
                WHEN s.fecha_rechazo IS NOT NULL THEN 'rechazada'
                WHEN s.estado = 'pausada' THEN 'pausada'
                WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'expirada'
                WHEN s.estado = 'cancelada' THEN 'cancelada'
                ELSE s.estado
            END AS estado_calculated,
            CASE 
                WHEN s.fecha_aprobacion IS NULL THEN NULL
                WHEN s.estado = 'pausada' THEN IFNULL(GREATEST(0, DATEDIFF(COALESCE(s.fecha_fin, CURDATE()), COALESCE(s.fecha_pausa, CURDATE()))), p.duracion_dias)
                WHEN s.estado = 'activa' THEN IFNULL(GREATEST(0, DATEDIFF(s.fecha_fin, CURDATE())), p.duracion_dias)
                ELSE 0
            END AS dias_restantes_calculados,
            (
                SELECT COUNT(*) 
                FROM historial_pausas hp 
                WHERE hp.suscripcion_id = s.id AND hp.accion = 'pausa'
            ) AS contador_pausas
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND p.tipo = 'base'
          AND NOT (p.uso_unico = 1 AND s.estado = 'cancelada')
        ORDER BY 
            CASE 
                WHEN s.estado = 'activa' AND (s.fecha_fin IS NULL OR s.fecha_fin >= CURDATE()) THEN 0
                WHEN s.estado = 'pausada' THEN 1
                WHEN s.fecha_aprobacion IS NULL AND s.fecha_rechazo IS NULL THEN 2
                WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 3
                WHEN s.fecha_rechazo IS NOT NULL THEN 4
                WHEN s.estado = 'cancelada' THEN 5
                ELSE 6
            END,
            s.creado_en DESC
        LIMIT 1
    ");
    $stmt->execute(array($escortId));
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        $escortCheck = $pdo->prepare("SELECT email FROM escorts WHERE id = ? AND eliminada = 0");
        $escortCheck->execute(array($escortId));
        $escortData = $escortCheck->fetch(PDO::FETCH_ASSOC);
        $email = $escortData ? $escortData['email'] : '';

        $yaUsoGratis = false;
        if ($email) {
            $usoGratis = $pdo->prepare("
                SELECT COUNT(*) FROM (
                    SELECT 1 FROM planes_usados pu
                    JOIN planes p ON p.id = pu.plan_id
                    WHERE pu.email = ? AND p.uso_unico = 1
                    UNION
                    SELECT 1 FROM suscripciones s
                    JOIN planes p ON p.id = s.plan_id
                    JOIN escorts e ON e.id = s.escort_id
                    WHERE e.email = ? AND p.uso_unico = 1 AND s.fecha_aprobacion IS NOT NULL
                ) u
            ");
            $usoGratis->execute(array($email, $email));
            $yaUsoGratis = (int)$usoGratis->fetchColumn() > 0;
        }

        echo json_encode(array(
            'success' => true,
            'tiene_plan' => false,
            'mensaje' => 'No tienes un plan activo',
            'puede_comprar' => true,
            'ya_uso_gratis' => $yaUsoGratis,
            'escort_id' => $escortId
        ));
        exit;
    }

    $estadoCalculado = $suscripcion['estado_calculated'];
    $diasRestantes = (int)($suscripcion['dias_restantes_calculados'] !== null ? $suscripcion['dias_restantes_calculados'] : 0);
    $diasTotales = (int)$suscripcion['plan_duracion'];
    $porcentajeUsado = 0;
    $puedePausar = false;
    $puedeReactivar = false;
    $motivoNoPausar = '';

    // Plazo para usar pausas (desde la primera pausa, calendario real)
    $plazoPausas = plan_plazo_pausas($pdo, (int)$suscripcion['suscripcion_id'], $diasTotales);

    // Vencimiento proyectado si está pausada (base + duracion + días de la pausa en curso)
    $fechaFinProyectada = null;
    if ($estadoCalculado === 'pausada' && !empty($suscripcion['fecha_fin']) && !empty($suscripcion['fecha_pausa'])) {
        $diasEnPausa = (int)floor((strtotime(date('Y-m-d')) - strtotime(date('Y-m-d', strtotime($suscripcion['fecha_pausa'])))) / 86400);
        $fechaFinProyectada = date('Y-m-d', strtotime(date('Y-m-d', strtotime($suscripcion['fecha_fin'])) . " +{$diasEnPausa} days"));
    }

    if ($estadoCalculado === 'pausada') {
        $porcentajeUsado = $diasTotales > 0 ? round((($diasTotales - $diasRestantes) / $diasTotales) * 100, 1) : 0;
        $puedeReactivar = true;
    } elseif ($estadoCalculado === 'activa') {
        $porcentajeUsado = $diasTotales > 0 ? round((($diasTotales - $diasRestantes) / $diasTotales) * 100, 1) : 0;
        $puedePausar = true;
        if ((int)$suscripcion['contador_pausas'] >= (int)$suscripcion['max_pausas_permitidas']) {
            $puedePausar = false;
            $motivoNoPausar = 'Límite de ' . $suscripcion['max_pausas_permitidas'] . ' pausas alcanzado';
        }
        if ($puedePausar && $plazoPausas['vencido']) {
            $puedePausar = false;
            $motivoNoPausar = 'Tu plazo para usar pausas venció el ' . date('d/m/Y', strtotime($plazoPausas['limite']));
        }
    } elseif ($estadoCalculado === 'expirada') {
        $porcentajeUsado = 100;
        $motivoNoPausar = 'Tu plan ha expirado';
    } elseif ($estadoCalculado === 'pendiente_aprobacion') {
        $motivoNoPausar = 'Pendiente de aprobación por el administrador';
    } elseif ($estadoCalculado === 'rechazada') {
        $motivoNoPausar = 'Tu solicitud fue rechazada';
    } elseif ($estadoCalculado === 'cancelada') {
        $motivoNoPausar = 'Tu plan fue cancelado';
    }

    $textoEstado = 'Desconocido';
    switch ($estadoCalculado) {
        case 'activa':
            $textoEstado = 'Activo';
            break;
        case 'pausada':
            $textoEstado = 'Pausado';
            break;
        case 'expirada':
            $textoEstado = 'Expirado';
            break;
        case 'pendiente_aprobacion':
            $textoEstado = 'Pendiente de aprobación';
            break;
        case 'rechazada':
            $textoEstado = 'Rechazado';
            break;
        case 'cancelada':
            $textoEstado = 'Cancelado';
            break;
    }

    $fechaInicioFmt = $suscripcion['fecha_inicio'] ? date('d/m/Y', strtotime($suscripcion['fecha_inicio'])) : null;
    $fechaFinFmt = $suscripcion['fecha_fin'] ? date('d/m/Y', strtotime($suscripcion['fecha_fin'])) : null;
    $fechaPausaFmt = !empty($suscripcion['fecha_pausa']) ? date('d/m/Y', strtotime($suscripcion['fecha_pausa'])) : null;
    $finProyectadaFmt = $fechaFinProyectada ? date('d/m/Y', strtotime($fechaFinProyectada)) : null;

    $escortCheck = $pdo->prepare("SELECT email FROM escorts WHERE id = ?");
    $escortCheck->execute(array($escortId));
    $escortData = $escortCheck->fetch(PDO::FETCH_ASSOC);
    $email = $escortData ? $escortData['email'] : '';

    $yaUsoGratis = false;
    if ($email) {
        $usoGratis = $pdo->prepare("SELECT COUNT(*) FROM (
            SELECT 1 FROM planes_usados pu JOIN planes p ON p.id = pu.plan_id WHERE pu.email = ? AND p.uso_unico = 1
            UNION
            SELECT 1 FROM suscripciones s JOIN planes p ON p.id = s.plan_id JOIN escorts e ON e.id = s.escort_id
            WHERE e.email = ? AND p.uso_unico = 1 AND s.fecha_aprobacion IS NOT NULL
        ) u");
        $usoGratis->execute(array($email, $email));
        $yaUsoGratis = (int)$usoGratis->fetchColumn() > 0;
    }

    $puedeComprar = in_array($estadoCalculado, array('expirada', 'cancelada', 'rechazada', 'pendiente_aprobacion')) || $estadoCalculado === 'activa';

    echo json_encode(array(
        'success' => true,
        'tiene_plan' => true,
        'plan' => array(
            'suscripcion_id' => (int)$suscripcion['suscripcion_id'],
            'plan_id' => (int)$suscripcion['plan_id'],
            'nombre' => $suscripcion['plan_nombre'],
            'slug' => $suscripcion['plan_slug'],
            'tipo' => $suscripcion['plan_tipo'],
            'badge' => $suscripcion['plan_badge'],
            'color_badge' => $suscripcion['color_badge'],
            'duracion_dias' => $diasTotales,
            'max_fotos' => (int)$suscripcion['max_fotos'],
            'max_videos' => (int)$suscripcion['max_videos'],
            'permite_vip' => (bool)$suscripcion['permite_vip'],
            'permite_destacado' => (bool)$suscripcion['permite_destacado'],
            'uso_unico' => (bool)$suscripcion['uso_unico'],
        ),
        'estado' => array(
            'codigo' => $estadoCalculado,
            'texto' => $textoEstado,
            'dias_restantes' => $diasRestantes,
            'dias_totales' => $diasTotales,
            'porcentaje_usado' => $porcentajeUsado,
            'porcentaje_restante' => round(100 - $porcentajeUsado, 1),
        ),
        'fechas' => array(
            'inicio' => $fechaInicioFmt,
            'fin' => $fechaFinFmt,
            'pausa' => $fechaPausaFmt,
            'fin_proyectada' => $finProyectadaFmt,
        ),
        'pausas' => array(
            'usadas' => (int)$suscripcion['contador_pausas'],
            'maximas' => (int)$suscripcion['max_pausas_permitidas'],
            'restantes' => max(0, (int)$suscripcion['max_pausas_permitidas'] - (int)$suscripcion['contador_pausas']),
            'limite' => $plazoPausas['limite'] ? date('d/m/Y', strtotime($plazoPausas['limite'])) : null,
            'plazo_dias_restantes' => $plazoPausas['dias_restantes'],
        ),
        'acciones' => array(
            'puede_pausar' => $puedePausar,
            'puede_reactivar' => $puedeReactivar,
            'motivo_no_pausar' => $motivoNoPausar,
        ),
        'pago' => array(
            'id' => (int)$suscripcion['pago_id'],
            'precio' => (float)$suscripcion['precio_pagado'],
            'moneda' => $suscripcion['moneda'],
            'comprobante' => $suscripcion['comprobante_pago'],
        ),
        'ya_uso_gratis' => $yaUsoGratis,
        'puede_comprar' => $puedeComprar,
    ));
} catch (PDOException $e) {
    error_log("Error mi-plan.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array('success' => false, 'error' => 'Error de base de datos'));
} catch (Throwable $e) {
    error_log("Error mi-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array('success' => false, 'error' => 'Error del servidor'));
}
