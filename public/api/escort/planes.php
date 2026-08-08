<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/planes.php
// CORREGIDO: Usa solo columnas reales de la DB. Compatible PHP 7.4.

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

    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();
    // Obtener datos de la escort
    $stmtEscort = $pdo->prepare("SELECT email, eliminada FROM escorts WHERE id = ?");
    $stmtEscort->execute(array($escortId));
    $escort = $stmtEscort->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode(array('success' => false, 'error' => 'Escort no encontrada'));
        exit;
    }

    if ($escort['eliminada'] == 1) {
        http_response_code(403);
        echo json_encode(array('success' => false, 'error' => 'Cuenta eliminada'));
        exit;
    }

    $escortEmail = $escort['email'];

    // Verificar plan base activo (solo columnas reales de suscripciones)
    $stmtPlanActivo = $pdo->prepare("
        SELECT 
            s.id, 
            s.plan_id, 
            s.estado, 
            s.fecha_fin, 
            s.fecha_aprobacion,
            p.duracion_dias,
            p.nombre as plan_nombre,
            CASE 
                WHEN s.estado = 'cancelada' THEN 'cancelada'
                WHEN s.fecha_aprobacion IS NULL THEN 'pendiente_aprobacion'
                WHEN s.estado = 'pausada' THEN 'pausada'
                WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 'activa'
                WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'expirada'
                WHEN s.estado = 'cancelada' THEN 'cancelada'
                WHEN s.estado = 'rechazada' THEN 'rechazada'
                WHEN s.estado = 'expirada' THEN 'expirada'
                ELSE s.estado
            END AS estado_calculado,
            GREATEST(0, DATEDIFF(s.fecha_fin, CURDATE())) as dias_restantes
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ?
          AND p.tipo = 'base'
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $stmtPlanActivo->execute(array($escortId));
    $planBaseActivo = $stmtPlanActivo->fetch(PDO::FETCH_ASSOC);

    $tienePlanBaseVigente = $planBaseActivo && in_array($planBaseActivo['estado_calculado'], array('activa', 'pausada'));
    $diasRestantesBase = $planBaseActivo ? (int)$planBaseActivo['dias_restantes'] : 0;

    // Verificar si ya usó un plan de uso único (gratuito)
    $stmtUsado = $pdo->prepare("
        SELECT COUNT(*) as usado 
        FROM (
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
    $stmtUsado->execute(array($escortEmail, $escortEmail));
    $yaUsoGratis = (bool)$stmtUsado->fetch(PDO::FETCH_ASSOC)['usado'];

    // Obtener todos los planes activos
    $stmtPlanes = $pdo->prepare("
        SELECT * FROM planes 
        WHERE activo = 1 
        ORDER BY tipo DESC, orden ASC, precio ASC
    ");
    $stmtPlanes->execute();
    $planes = $stmtPlanes->fetchAll(PDO::FETCH_ASSOC);

    $planesFormateados = array();

    foreach ($planes as $plan) {
        $planFormateado = array(
            'id' => (int)$plan['id'],
            'nombre' => $plan['nombre'],
            'slug' => $plan['slug'],
            'descripcion' => $plan['descripcion'],
            'tipo' => $plan['tipo'],
            'duracion_dias' => (int)$plan['duracion_dias'],
            'precio' => (float)$plan['precio'],
            'moneda' => $plan['moneda'],
            'max_fotos' => (int)$plan['max_fotos'],
            'max_videos' => (int)$plan['max_videos'],
            'permite_vip' => (bool)$plan['permite_vip'],
            'permite_destacado' => (bool)$plan['permite_destacado'],
            'uso_unico' => (bool)$plan['uso_unico'],
            'badge' => $plan['badge'],
            'color_badge' => $plan['color_badge'],
            'no_disponible' => false,
            'motivo_no_disponible' => null
        );

        // Lógica para planes BASE
        if ($plan['tipo'] === 'base') {
            // Plan de uso único (gratuito) solo se puede usar una vez
            if (!empty($plan['uso_unico']) && $yaUsoGratis) {
                $planFormateado['no_disponible'] = true;
                $planFormateado['motivo_no_disponible'] = 'Ya usaste el plan gratuito';
            }
            // Si tiene plan base pausado, debe reactivarlo primero
            elseif ($planBaseActivo && $planBaseActivo['estado_calculado'] === 'pausada') {
                $planFormateado['no_disponible'] = true;
                $planFormateado['motivo_no_disponible'] = 'Tienes un plan pausado (' . $planBaseActivo['plan_nombre'] . '). Reactívalo antes de contratar otro.';
            }
            // Si tiene plan base activo, el nuevo plan debe caber en los días restantes
            elseif ($planBaseActivo && $planBaseActivo['estado_calculado'] === 'activa' && (int)$plan['duracion_dias'] > $diasRestantesBase) {
                $planFormateado['no_disponible'] = true;
                $planFormateado['motivo_no_disponible'] =
                    'Solo te quedan ' . $diasRestantesBase . ' días de plan base. Este plan requiere ' . (int)$plan['duracion_dias'] . ' días.';
            }
            // Si tiene solicitud pendiente, bloquear
            elseif ($planBaseActivo && $planBaseActivo['estado_calculado'] === 'pendiente_aprobacion') {
                $planFormateado['no_disponible'] = true;
                $planFormateado['motivo_no_disponible'] = 'Tienes una solicitud pendiente de aprobación';
            }
        }

        // Lógica para planes EXTRA (destacados)
        if ($plan['tipo'] === 'extra') {
            // Necesita plan base vigente
            if (!$tienePlanBaseVigente) {
                $planFormateado['no_disponible'] = true;
                $planFormateado['motivo_no_disponible'] = 'Necesitas un plan base activo o pausado';
            }
            // El extra no puede durar más que los días restantes del plan base
            elseif ($plan['duracion_dias'] > $diasRestantesBase) {
                $planFormateado['no_disponible'] = true;
                $planFormateado['motivo_no_disponible'] =
                    'Solo te quedan ' . $diasRestantesBase . ' días de plan base. ' .
                    'Este extra requiere ' . $plan['duracion_dias'] . ' días.';
            }
        }

        $planesFormateados[] = $planFormateado;
    }

    echo json_encode(array(
        'success' => true,
        'planes' => $planesFormateados,
        'plan_base_activo' => $planBaseActivo ? array(
            'id' => (int)$planBaseActivo['id'],
            'plan_id' => (int)$planBaseActivo['plan_id'],
            'estado' => $planBaseActivo['estado_calculado'],
            'estado_raw' => $planBaseActivo['estado'],
            'dias_restantes' => $diasRestantesBase,
            'plan_nombre' => $planBaseActivo['plan_nombre']
        ) : null,
        'ya_uso_gratis' => $yaUsoGratis
    ));
} catch (PDOException $e) {
    error_log("Error planes.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array('success' => false, 'error' => 'Error de base de datos'));
} catch (Throwable $e) {
    error_log("Error planes.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array('success' => false, 'error' => 'Error del servidor'));
}
