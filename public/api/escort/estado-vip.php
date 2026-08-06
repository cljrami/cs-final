<?php
// public/api/escort/estado-vip.php

ini_set('display_errors', 0);
error_reporting(E_ALL);

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $tokenData = requireAuth();
    $escortId = intval($tokenData['id'] ?? 0);

    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    $pdo = getDBConnection();

    if (!$pdo) {
        throw new Exception('No se pudo conectar a la base de datos');
    }

    // ─── DATOS ESCORT ───
    $stmt = $pdo->prepare("
        SELECT id, nombre, vip, fecha_vip_expira, eliminada 
        FROM escorts 
        WHERE id = ?
    ");
    $stmt->execute([$escortId]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    if ($escort['eliminada'] == 1) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Cuenta eliminada']);
        exit;
    }

    // VIP activo: vip=1 Y fecha_vip_expira no nula Y fecha_vip_expira >= ahora
    $ahora = date('Y-m-d H:i:s');
    $vipActivo = $escort['vip'] == 1 && !empty($escort['fecha_vip_expira']) && $escort['fecha_vip_expira'] >= $ahora;
    $diasVipRestantes = 0;
    $fechaVipExpira = $escort['fecha_vip_expira'];

    if ($vipActivo && !empty($escort['fecha_vip_expira'])) {
        $hoy = new DateTime();
        $expira = new DateTime($escort['fecha_vip_expira']);
        $diasVipRestantes = max(0, (int)$hoy->diff($expira)->format('%r%a'));
    }

    // ─── PLAN BASE ───
    $stmtBase = $pdo->prepare("
        SELECT 
            s.id as suscripcion_id,
            s.plan_id,
            s.fecha_fin,
            s.fecha_aprobacion,
            s.estado,
            p.nombre,
            p.color,
            p.permite_vip,
            DATEDIFF(s.fecha_fin, CURDATE()) as dias_restantes
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? 
          AND p.tipo = 'base'
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $stmtBase->execute([$escortId]);
    $planBase = $stmtBase->fetch(PDO::FETCH_ASSOC);

    // ─── SOLICITUD VIP ───
    // Solo traer solicitudes que NO estén aprobadas si ya hay VIP activo
    // o traer la última solicitud activa (enviado)
    $stmtSol = $pdo->prepare("
        SELECT 
            id,
            estado,
            comprobante_pago,
            admin_notas,
            fecha_respuesta,
            created_at
        FROM escort_vip_solicitudes
        WHERE escort_id = ?
          AND estado IN ('enviado', 'rechazado')
        ORDER BY created_at DESC
        LIMIT 1
    ");
    $stmtSol->execute([$escortId]);
    $solicitud = $stmtSol->fetch(PDO::FETCH_ASSOC);

    // Si no hay solicitud activa/rechazada pero hay VIP activo, 
    // buscar la solicitud aprobada asociada para mostrar info
    $solicitudAprobada = null;
    if (!$solicitud && $vipActivo) {
        $stmtSolAprob = $pdo->prepare("
            SELECT 
                id,
                estado,
                comprobante_pago,
                fecha_respuesta
            FROM escort_vip_solicitudes
            WHERE escort_id = ?
              AND estado = 'aprobado'
            ORDER BY fecha_respuesta DESC
            LIMIT 1
        ");
        $stmtSolAprob->execute([$escortId]);
        $solicitudAprobada = $stmtSolAprob->fetch(PDO::FETCH_ASSOC);
    }

    // ─── CONFIGURACIÓN ───
    $stmtConfig = $pdo->prepare("
        SELECT clave, valor FROM configuracion 
        WHERE clave IN ('precio_vip', 'moneda_vip')
    ");
    $stmtConfig->execute();
    $configRaw = [];
    while ($row = $stmtConfig->fetch(PDO::FETCH_ASSOC)) {
        $configRaw[$row['clave']] = $row['valor'];
    }

    $config = [
        'precio_vip' => isset($configRaw['precio_vip']) ? intval($configRaw['precio_vip']) : 20000,
        'moneda_vip' => isset($configRaw['moneda_vip']) ? $configRaw['moneda_vip'] : 'CLP'
    ];

    // ─── DETERMINAR SI PUEDE SOLICITAR ───
    $puedeSolicitar = false;
    $motivoNoSolicitar = '';

    if ($vipActivo) {
        $motivoNoSolicitar = 'Ya tienes VIP activo';
    } elseif ($solicitud && $solicitud['estado'] === 'enviado') {
        $motivoNoSolicitar = 'Tienes una solicitud en revisión';
    } elseif (!$planBase) {
        $motivoNoSolicitar = 'No tienes un plan base activo. Contrata un plan primero.';
    } elseif ($planBase['fecha_aprobacion'] === null) {
        $motivoNoSolicitar = 'Tu plan base está pendiente de aprobación.';
    } elseif ($planBase['estado'] === 'pausada') {
        $motivoNoSolicitar = 'Tu plan base está pausado. Reactívalo antes de solicitar VIP.';
    } elseif ($planBase['fecha_fin'] < date('Y-m-d')) {
        $motivoNoSolicitar = 'Tu plan base ha expirado. Renueva tu plan para solicitar VIP.';
    } elseif ($planBase['plan_id'] == 1) {
        $motivoNoSolicitar = 'El plan gratuito no incluye VIP. Actualiza a un plan de pago.';
    } elseif (!$planBase['permite_vip']) {
        $motivoNoSolicitar = 'Tu plan actual no permite solicitar VIP.';
    } else {
        $puedeSolicitar = true;
    }

    // ─── RESPUESTA ───
    echo json_encode([
        'success' => true,
        'escort' => [
            'vip_activo' => $vipActivo,
            'dias_vip_restantes' => $diasVipRestantes,
            'fecha_vip_expira' => $fechaVipExpira
        ],
        'plan_base' => $planBase ? [
            'id' => (int)$planBase['plan_id'],
            'nombre' => $planBase['nombre'],
            'color' => $planBase['color'] ?: '#6366f1',
            'fecha_fin' => $planBase['fecha_fin'],
            'dias_restantes' => max(0, (int)$planBase['dias_restantes']),
            'permite_vip' => (bool)$planBase['permite_vip']
        ] : null,
        'solicitud' => $solicitud ? [
            'id' => (int)$solicitud['id'],
            'estado' => $solicitud['estado'],
            'comprobante_pago' => $solicitud['comprobante_pago'],
            'admin_notas' => $solicitud['admin_notas'],
            'fecha_respuesta' => $solicitud['fecha_respuesta'],
            'created_at' => $solicitud['created_at']
        ] : null,
        'solicitud_aprobada' => $solicitudAprobada ? [
            'id' => (int)$solicitudAprobada['id'],
            'estado' => $solicitudAprobada['estado'],
            'comprobante_pago' => $solicitudAprobada['comprobante_pago'],
            'fecha_respuesta' => $solicitudAprobada['fecha_respuesta']
        ] : null,
        'config' => $config,
        'puede_solicitar' => $puedeSolicitar,
        'motivo_no_solicitar' => $motivoNoSolicitar
    ]);
} catch (PDOException $e) {
    error_log("Error estado-vip.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error estado-vip.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
