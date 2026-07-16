<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/micuenta-status.php
// 
// Devuelve el estado completo de la escort para su panel "micuenta".
// Usado en el sidebar para mostrar: estado publicación, plan, días restantes, etc.

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
    $authHeader = $headers['Authorization'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = $tokenData['id'] ?? 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();
    // â”€â”€â”€ DATOS BÁSICOS DE LA ESCORT â”€â”€â”€
    // ¿Existe la columna aprobada? (por si la migración aún no se ejecuta)
    $colStmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'aprobada'
    ");
    $colStmt->execute();
    $tieneAprobada = (int)$colStmt->fetchColumn() > 0;

    if ($tieneAprobada) {
        $escortStmt = $pdo->prepare("
            SELECT id, nombre, foto_principal, activa, aprobada, verificado, vip, destacado,
                   plan_id, suscripcion_id, estado, visitas_perfil, contactos_recibidos
            FROM escorts
            WHERE id = ? AND eliminada = 0
        ");
    } else {
        $escortStmt = $pdo->prepare("
            SELECT id, nombre, foto_principal, activa, verificado, vip, destacado,
                   plan_id, suscripcion_id, estado, visitas_perfil, contactos_recibidos
            FROM escorts
            WHERE id = ? AND eliminada = 0
        ");
    }
    $escortStmt->execute([$escortId]);
    $escort = $escortStmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    // Aprobada si: columna aprobada=1, o estado='aprobada', o tiene suscripción aprobada
    $cuentaAprobada = ($tieneAprobada && !empty($escort['aprobada']))
        || $escort['estado'] === 'aprobada';

    if (!$cuentaAprobada) {
        $susFallback = $pdo->prepare("
            SELECT 1 FROM suscripciones 
            WHERE escort_id = ? AND fecha_aprobacion IS NOT NULL
            LIMIT 1
        ");
        $susFallback->execute([$escortId]);
        if ($susFallback->fetch()) {
            $cuentaAprobada = true;
            if ($tieneAprobada) {
                $pdo->prepare("UPDATE escorts SET aprobada = 1 WHERE id = ?")->execute([$escortId]);
            }
        }
    }

    // â”€â”€â”€ ESTADO DE LA SUSCRIPCIÓN â”€â”€â”€
    $suscripcion = null;
    $estadoPublicacion = 'pendiente_perfil';
    $mensajeEstado = 'Completa tu perfil y selecciona un plan para activar tu publicación.';
    $diasRestantes = 0;
    $planVigente = false;
    $puedePublicar = false;
    $colorEstado = 'gray'; // gray, yellow, green, red

    if ($escort['suscripcion_id']) {
        $susStmt = $pdo->prepare("
            SELECT id, plan_id, fecha_aprobacion, fecha_inicio, fecha_fin, 
                   estado, precio_pagado, moneda, comprobante_pago
            FROM suscripciones 
            WHERE id = ? AND escort_id = ?
        ");
        $susStmt->execute([$escort['suscripcion_id'], $escortId]);
        $suscripcion = $susStmt->fetch(PDO::FETCH_ASSOC);

        if ($suscripcion) {
            $hoy = date('Y-m-d');

            if ($suscripcion['fecha_aprobacion'] === null) {
                // Pendiente de aprobación del admin
                $estadoPublicacion = 'pendiente_aprobacion';
                $mensajeEstado = 'Tu pago está en revisión. Te notificaremos cuando sea aprobado.';
                $colorEstado = 'yellow';

                // Verificar si hay pago asociado
                $pagoStmt = $pdo->prepare("
                    SELECT estado_pago, comprobante_url, creado_en 
                    FROM pagos 
                    WHERE suscripcion_id = ? AND escort_id = ?
                    ORDER BY creado_en DESC LIMIT 1
                ");
                $pagoStmt->execute([$escort['suscripcion_id'], $escortId]);
                $pago = $pagoStmt->fetch(PDO::FETCH_ASSOC);
            } elseif ($suscripcion['estado'] === 'pausada') {
                $estadoPublicacion = 'pausada';
                $mensajeEstado = 'Tu plan está pausado. Reactívalo para volver a aparecer.';
                $colorEstado = 'yellow';
                $diasRestantes = 0;
            } elseif ($suscripcion['estado'] === 'activa') {
                if ($suscripcion['fecha_fin'] >= $hoy) {
                    // Plan vigente
                    $planVigente = true;
                    $diasRestantes = (int)((strtotime($suscripcion['fecha_fin']) - strtotime($hoy)) / 86400);

                    if ($escort['activa'] == 1) {
                        $estadoPublicacion = 'activa';
                        $mensajeEstado = 'Tu publicación está activa y visible. Te quedan ' . $diasRestantes . ' días.';
                        $colorEstado = 'green';
                        $puedePublicar = true;
                    } else {
                        $estadoPublicacion = 'pendiente_activacion';
                        $mensajeEstado = 'Tu plan está aprobado pero tu publicación aún no está activa. Contacta al administrador.';
                        $colorEstado = 'yellow';
                    }
                } else {
                    // Plan expirado
                    $estadoPublicacion = 'expirada';
                    $mensajeEstado = 'Tu plan ha expirado. Renueva para volver a aparecer.';
                    $colorEstado = 'red';
                    $diasRestantes = 0;
                }
            } else {
                $estadoPublicacion = 'cancelada';
                $mensajeEstado = 'Tu suscripción fue cancelada. Solicita un nuevo plan.';
                $colorEstado = 'red';
            }
        }
    } else {
        // No tiene suscripción
        $estadoPublicacion = 'sin_plan';
        $mensajeEstado = 'No tienes un plan activo. Selecciona uno para publicar tu anuncio.';
        $colorEstado = 'gray';
    }

    // â”€â”€â”€ INFO DEL PLAN â”€â”€â”€
    $planInfo = null;
    if ($escort['plan_id']) {
        $planStmt = $pdo->prepare("
            SELECT nombre, slug, tipo, duracion_dias, precio, moneda, 
                   max_fotos, max_videos, permite_vip, permite_destacado, badge, color_badge
            FROM planes 
            WHERE id = ?
        ");
        $planStmt->execute([$escort['plan_id']]);
        $plan = $planStmt->fetch(PDO::FETCH_ASSOC);
        if ($plan) {
            $planInfo = [
                'id' => (int)$escort['plan_id'],
                'nombre' => $plan['nombre'],
                'slug' => $plan['slug'],
                'tipo' => $plan['tipo'],
                'duracion_dias' => (int)$plan['duracion_dias'],
                'precio' => (float)$plan['precio'],
                'moneda' => $plan['moneda'],
                'max_fotos' => (int)$plan['max_fotos'],
                'max_videos' => (int)$plan['max_videos'],
                'permite_vip' => (bool)$plan['permite_vip'],
                'permite_destacado' => (bool)$plan['permite_destacado'],
                'badge' => $plan['badge'],
                'color_badge' => $plan['color_badge']
            ];
        }
    }

    // â”€â”€â”€ NOTIFICACIONES NO LEÍDAS â”€â”€â”€
    $notifStmt = $pdo->prepare("
        SELECT COUNT(*) FROM notificaciones 
        WHERE escort_id = ? AND leida = 0
    ");
    $notifStmt->execute([$escortId]);
    $notificacionesPendientes = (int)$notifStmt->fetchColumn();

    // â”€â”€â”€ VERIFICACIÓN â”€â”€â”€
    $verifStmt = $pdo->prepare("
        SELECT estado FROM verificaciones WHERE escort_id = ?
    ");
    $verifStmt->execute([$escortId]);
    $verificacion = $verifStmt->fetch(PDO::FETCH_ASSOC);

    // â”€â”€â”€ RESPUESTA â”€â”€â”€
    echo json_encode([
        'success' => true,
        'escort' => [
            'id' => (int)$escort['id'],
            'nombre' => $escort['nombre'],
            'foto_principal' => $escort['foto_principal'],
            'verificado' => (bool)$escort['verificado'],
            'vip' => (bool)$escort['vip'],
            'destacado' => (bool)$escort['destacado'],
            'cuenta_aprobada' => (bool)$cuentaAprobada
        ],
        'publicacion' => [
            'estado' => $estadoPublicacion,
            'texto' => $mensajeEstado,
            'color' => $colorEstado,
            'activa' => $escort['activa'] == 1,
            'visible' => $puedePublicar,
            'dias_restantes' => $diasRestantes,
            'plan_vigente' => $planVigente
        ],
        'plan' => $planInfo,
        'suscripcion' => $suscripcion ? [
            'id' => (int)$suscripcion['id'],
            'fecha_aprobacion' => $suscripcion['fecha_aprobacion'],
            'fecha_inicio' => $suscripcion['fecha_inicio'],
            'fecha_fin' => $suscripcion['fecha_fin'],
            'estado' => $suscripcion['estado'],
            'precio_pagado' => (float)$suscripcion['precio_pagado'],
            'comprobante' => $suscripcion['comprobante_pago']
        ] : null,
        'stats' => [
            'visitas_perfil' => (int)$escort['visitas_perfil'],
            'contactos_recibidos' => (int)$escort['contactos_recibidos'],
            'notificaciones_pendientes' => $notificacionesPendientes
        ],
        'verificacion' => [
            'estado' => $verificacion ? $verificacion['estado'] : 'no_solicitada',
            'solicitar' => !$verificacion || $verificacion['estado'] == 'rechazada'
        ],
        'acciones' => [
            'puede_editar_perfil' => (bool)$escort['aprobada'],
            'puede_solicitar_plan' => in_array($estadoPublicacion, ['sin_plan', 'expirada', 'pendiente_perfil']),
            'puede_subir_fotos' => $planVigente,
            'puede_subir_videos' => $planVigente && $planInfo && $planInfo['max_videos'] > 0,
            'puede_solicitar_vip' => $planVigente && $planInfo && $planInfo['permite_vip'] && !$escort['vip'],
            'puede_solicitar_destacado' => $planVigente && $planInfo && $planInfo['permite_destacado'] && !$escort['destacado'],
            'puede_pausar' => $estadoPublicacion === 'activa',
            'puede_reactivar' => $estadoPublicacion === 'pausada'
        ]
    ]);
} catch (PDOException $e) {
    error_log("Error micuenta-status.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Error micuenta-status.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
