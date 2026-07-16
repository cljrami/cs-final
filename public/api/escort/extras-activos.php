<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/extras-activos.php
// Devuelve los extras (destacados) activos de la escort logueada.

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
    // Obtener extras activos
    $stmt = $pdo->prepare("
        SELECT 
            s.id,
            s.plan_id,
            p.nombre as plan_nombre,
            p.slug as plan_slug,
            p.duracion_dias,
            p.precio,
            p.moneda,
            p.color_badge,
            s.fecha_inicio,
            s.fecha_fin,
            s.estado,
            s.fecha_aprobacion,
            s.comprobante_pago,
            s.estado_pago,
            CASE 
                WHEN s.fecha_aprobacion IS NULL THEN 'pendiente'
                WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 'activo'
                WHEN s.estado = 'pausada' THEN 'pausado'
                ELSE 'expirado'
            END as estado_real,
            DATEDIFF(s.fecha_fin, CURDATE()) as dias_restantes
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ?
          AND p.tipo = 'extra'
        ORDER BY s.creado_en DESC
    ");
    $stmt->execute([$escortId]);
    $extras = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $extrasFormateados = [];
    foreach ($extras as $extra) {
        $extrasFormateados[] = [
            'id' => (int)$extra['id'],
            'plan_id' => (int)$extra['plan_id'],
            'plan_nombre' => $extra['plan_nombre'],
            'plan_slug' => $extra['plan_slug'],
            'duracion_dias' => (int)$extra['duracion_dias'],
            'precio' => (float)$extra['precio'],
            'moneda' => $extra['moneda'],
            'color_badge' => $extra['color_badge'],
            'fecha_inicio' => $extra['fecha_inicio'],
            'fecha_fin' => $extra['fecha_fin'],
            'estado' => $extra['estado_real'],
            'estado_raw' => $extra['estado'],
            'dias_restantes' => max(0, (int)$extra['dias_restantes']),
            'pendiente_aprobacion' => $extra['fecha_aprobacion'] === null,
            'comprobante_pago' => $extra['comprobante_pago'],
            'estado_pago' => $extra['estado_pago']
        ];
    }

    echo json_encode([
        'success' => true,
        'extras' => $extrasFormateados,
        'total_activos' => count(array_filter($extrasFormateados, function ($e) {
            return $e['estado'] === 'activo';
        }))
    ]);
} catch (PDOException $e) {
    error_log("Error extras-activos.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error extras-activos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
