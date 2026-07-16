<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/extras-disponibles.php
// Devuelve planes tipo 'extra' disponibles para contratar

header('Content-Type: application/json');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
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
        echo json_encode(['success' => false, 'error' => 'Token invalido']);
        exit;
    }

    require __DIR__ . '/../../config/database.php';
    $pdo = getDBConnection();

    // Obtener extras disponibles (planes tipo='extra' activos)
    $stmt = $pdo->prepare("
        SELECT 
            p.id,
            p.nombre,
            p.slug,
            p.descripcion,
            p.tipo,
            p.duracion_dias,
            p.precio,
            p.moneda,
            p.max_fotos,
            p.max_videos,
            p.permite_vip,
            p.permite_destacado,
            p.uso_unico,
            p.badge,
            p.color,
            p.color_badge,
            p.orden
        FROM planes p
        WHERE p.tipo = 'extra'
          AND p.activo = 1
        ORDER BY p.orden ASC, p.precio ASC
    ");
    $stmt->execute();
    $extras = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Verificar cuales ya fueron contratados por la escort
    $stmtUsados = $pdo->prepare("
        SELECT plan_id FROM suscripciones 
        WHERE escort_id = ? AND estado IN ('activa', 'pendiente_aprobacion')
    ");
    $stmtUsados->execute([$escortId]);
    $usados = $stmtUsados->fetchAll(PDO::FETCH_COLUMN);

    $extrasFormateados = [];
    foreach ($extras as $extra) {
        $yaUsado = in_array((int)$extra['id'], array_map('intval', $usados));

        $extrasFormateados[] = [
            'id' => (int)$extra['id'],
            'nombre' => $extra['nombre'],
            'slug' => $extra['slug'],
            'descripcion' => $extra['descripcion'],
            'tipo' => $extra['tipo'],
            'duracion_dias' => (int)$extra['duracion_dias'],
            'precio' => (float)$extra['precio'],
            'moneda' => $extra['moneda'],
            'max_fotos' => (int)$extra['max_fotos'],
            'max_videos' => (int)$extra['max_videos'],
            'permite_vip' => (bool)$extra['permite_vip'],
            'permite_destacado' => (bool)$extra['permite_destacado'],
            'uso_unico' => (bool)$extra['uso_unico'],
            'badge' => $extra['badge'],
            'color' => $extra['color'],
            'color_badge' => $extra['color_badge'],
            'ya_contratado' => $yaUsado && (bool)$extra['uso_unico'],
            'orden' => (int)$extra['orden']
        ];
    }

    echo json_encode([
        'success' => true,
        'extras' => $extrasFormateados,
        'total' => count($extrasFormateados)
    ]);
} catch (PDOException $e) {
    error_log("Error extras-disponibles.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error extras-disponibles.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
