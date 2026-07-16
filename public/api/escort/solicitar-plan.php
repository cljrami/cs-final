<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/solicitar-plan.php
// Solicitar plan base o extra (destacado). Valida todas las reglas de negocio.

header('Content-Type: application/json');
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

try {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || !isset($tokenData['exp']) || $tokenData['exp'] < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = isset($tokenData['id']) ? intval($tokenData['id']) : 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();
    // Obtener datos de la escort
    $stmtEscort = $pdo->prepare("SELECT email, nombre, eliminada, aprobada FROM escorts WHERE id = ?");
    $stmtEscort->execute([$escortId]);
    $escort = $stmtEscort->fetch(PDO::FETCH_ASSOC);

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

    $escortEmail = $escort['email'];
    $escortNombre = $escort['nombre'];

    // Leer body JSON
    $input = json_decode(file_get_contents('php://input'), true);
    $planId = isset($input['plan_id']) ? intval($input['plan_id']) : 0;
    $metodoPago = isset($input['metodo_pago']) ? $input['metodo_pago'] : 'transferencia';
    $comprobanteUrl = isset($input['comprobante_pago']) ? trim($input['comprobante_pago']) : '';
    $notas = isset($input['notas']) ? trim($input['notas']) : '';
    $esExtra = isset($input['es_extra']) ? (bool)$input['es_extra'] : false;

    if ($planId <= 0) {
        echo json_encode(['success' => false, 'error' => 'Plan no especificado']);
        exit;
    }

    // Validar método de pago
    $metodosValidos = ['transferencia', 'webpay', 'khipu', 'efectivo', 'otro'];
    if (!in_array($metodoPago, $metodosValidos)) {
        $metodoPago = 'transferencia';
    }

    // Obtener el plan que quiere contratar
    $stmtPlan = $pdo->prepare("SELECT * FROM planes WHERE id = ? AND activo = 1");
    $stmtPlan->execute([$planId]);
    $plan = $stmtPlan->fetch(PDO::FETCH_ASSOC);

    if (!$plan) {
        echo json_encode(['success' => false, 'error' => 'Plan no existe o no está disponible']);
        exit;
    }

    // ==================== VALIDACIONES ====================

    // Obtener plan base activo de la escort (si existe)
    $stmtBase = $pdo->prepare("
        SELECT 
            s.id, 
            s.plan_id, 
            s.estado, 
            s.fecha_fin, 
            s.fecha_aprobacion,
            p.duracion_dias,
            p.nombre as plan_nombre,
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

    $tienePlanBaseVigente = false;
    $diasRestantesBase = 0;

    if ($planBase) {
        $estadoCalculado = 'desconocido';
        if ($planBase['fecha_aprobacion'] === null) {
            $estadoCalculado = 'pendiente_aprobacion';
        } elseif ($planBase['estado'] === 'pausada') {
            $estadoCalculado = 'pausada';
        } elseif ($planBase['estado'] === 'activa' && $planBase['fecha_fin'] >= date('Y-m-d')) {
            $estadoCalculado = 'activa';
            $tienePlanBaseVigente = true;
            $diasRestantesBase = max(0, (int)$planBase['dias_restantes']);
        } elseif ($planBase['estado'] === 'activa' && $planBase['fecha_fin'] < date('Y-m-d')) {
            $estadoCalculado = 'expirada';
        } else {
            $estadoCalculado = $planBase['estado'];
        }
    }

    // ---------- PLAN BASE ----------
    if ($plan['tipo'] === 'base') {
        // No puede tener plan base vigente
        if ($tienePlanBaseVigente) {
            echo json_encode([
                'success' => false,
                'error' => 'Ya tienes un plan base activo (' . $planBase['plan_nombre'] . '). Debes esperar a que venza el ' . $planBase['fecha_fin'] . ' para cambiar de plan.'
            ]);
            exit;
        }

        // Si tiene solicitud pendiente, bloquear
        if ($planBase && $planBase['fecha_aprobacion'] === null) {
            echo json_encode([
                'success' => false,
                'error' => 'Tienes una solicitud de plan pendiente de aprobación. Espera la respuesta antes de solicitar otro.'
            ]);
            exit;
        }

        // Plan gratuito (id=1) solo una vez por email
        if ($plan['id'] == 1) {
            $stmtUsado = $pdo->prepare("
                SELECT 1 FROM planes_usados 
                WHERE email = ? AND plan_id = 1
            ");
            $stmtUsado->execute([$escortEmail]);
            if ($stmtUsado->fetch()) {
                echo json_encode([
                    'success' => false,
                    'error' => 'Ya usaste el plan gratuito. Solo puedes usarlo una vez.'
                ]);
                exit;
            }
        }
    }

    // ---------- PLAN EXTRA (DESTACADO) ----------
    if ($plan['tipo'] === 'extra') {
        // Necesita plan base vigente
        if (!$tienePlanBaseVigente) {
            echo json_encode([
                'success' => false,
                'error' => 'Necesitas un plan base activo para contratar extras. Solicita un plan base primero.'
            ]);
            exit;
        }

        // El extra no puede durar más que los días restantes del plan base
        if ((int)$plan['duracion_dias'] > $diasRestantesBase) {
            echo json_encode([
                'success' => false,
                'error' => 'Este extra dura ' . $plan['duracion_dias'] . ' días, pero tu plan base solo tiene ' . $diasRestantesBase . ' días restantes. Selecciona un extra con menor duración.'
            ]);
            exit;
        }

        // Verificar que no tenga ya este mismo extra activo
        $stmtExtraActivo = $pdo->prepare("
            SELECT 1 FROM suscripciones s
            JOIN planes p ON p.id = s.plan_id
            WHERE s.escort_id = ? 
              AND p.tipo = 'extra'
              AND p.id = ?
              AND s.estado = 'activa'
              AND s.fecha_aprobacion IS NOT NULL
              AND s.fecha_fin >= CURDATE()
            LIMIT 1
        ");
        $stmtExtraActivo->execute([$escortId, $planId]);
        if ($stmtExtraActivo->fetch()) {
            echo json_encode([
                'success' => false,
                'error' => 'Ya tienes este extra activo. No puedes contratarlo dos veces simultáneamente.'
            ]);
            exit;
        }
    }

    // ==================== CREAR SUSCRIPCIÓN ====================

    $fechaInicio = date('Y-m-d');
    $fechaFin = date('Y-m-d', strtotime('+' . $plan['duracion_dias'] . ' days'));

    $pdo->beginTransaction();

    $stmtInsert = $pdo->prepare("
        INSERT INTO suscripciones (
            escort_id, 
            plan_id, 
            fecha_inicio, 
            fecha_fin, 
            precio_pagado, 
            moneda, 
            estado, 
            auto_renovar, 
            comprobante_pago,
            creado_en
        ) VALUES (?, ?, ?, ?, ?, ?, 'pendiente_aprobacion', 0, ?, NOW())
    ");
    $stmtInsert->execute([
        $escortId,
        $planId,
        $fechaInicio,
        $fechaFin,
        $plan['precio'],
        $plan['moneda'],
        $comprobanteUrl
    ]);

    $suscripcionId = $pdo->lastInsertId();

    // Crear pago para cualquier tipo de plan (base o extra)
    $concepto = $plan['tipo'] === 'extra' ? 'destacado' : 'plan';
    $pagoCheck = $pdo->prepare("SELECT id FROM pagos WHERE escort_id = ? AND concepto = ? AND suscripcion_id = ? LIMIT 1");
    $pagoCheck->execute([$escortId, $concepto, $suscripcionId]);
    $pagoExistente = $pagoCheck->fetch(PDO::FETCH_ASSOC);

    if ($pagoExistente) {
        $pdo->prepare("UPDATE pagos SET plan_id = ?, monto = ?, suscripcion_id = ? WHERE id = ?")
            ->execute([$planId, $plan['precio'], $suscripcionId, $pagoExistente['id']]);
    } else {
        $pdo->prepare("
            INSERT INTO pagos (escort_id, plan_id, suscripcion_id, concepto, monto, moneda, metodo_pago, estado_pago, notas, creado_en)
            VALUES (?, ?, ?, ?, ?, ?, 'transferencia', 'pendiente', ?, NOW())
        ")->execute([
            $escortId, $planId, $suscripcionId, $concepto,
            $plan['precio'], $plan['moneda'],
            'Pendiente por solicitud de ' . ($plan['tipo'] === 'extra' ? 'extra' : 'plan')
        ]);
    }

    // Crear notificación
    $notifTitulo = 'Nueva solicitud de ' . ($plan['tipo'] === 'extra' ? 'extra' : 'plan');
    $notifMensaje = $escortNombre . ' solicitó ' . $plan['nombre'] . ' ($' . number_format($plan['precio'], 0) . ' ' . $plan['moneda'] . ')';

    $stmtNotif = $pdo->prepare("
        INSERT INTO notificaciones (
            escort_id, 
            tipo, 
            titulo, 
            mensaje, 
            url
        ) VALUES (?, 'sistema', ?, ?, ?)
    ");
    $stmtNotif->execute([
        $escortId,
        $notifTitulo,
        $notifMensaje,
        '/admin/suscripciones'
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Solicitud enviada correctamente. Tu plan será activado una vez que el administrador lo apruebe.',
        'suscripcion_id' => (int)$suscripcionId,
        'plan' => [
            'id' => (int)$plan['id'],
            'nombre' => $plan['nombre'],
            'tipo' => $plan['tipo'],
            'duracion_dias' => (int)$plan['duracion_dias'],
            'precio' => (float)$plan['precio'],
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin
        ]
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Error solicitar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Error solicitar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
