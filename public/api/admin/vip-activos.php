<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';
    $tokenData = requireAuth();
    $adminId = intval($tokenData['id'] ?? 0);
    $adminRol = $tokenData['rol'] ?? '';
    if ($adminId <= 0 || !in_array($adminRol, ['superadmin', 'admin', 'moderador'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }

    $pdo = getDBConnection();

    $stmt = $pdo->query("
        SELECT
            e.id,
            e.nombre,
            e.email,
            e.telefono,
            e.ciudad,
            e.foto_principal,
            e.verificado,
            e.rating,
            e.total_valoraciones,
            e.vip,
            e.fecha_vip_expira,
            e.destacado,
            p.nombre as plan_nombre,
            s.fecha_fin as plan_vence,
            DATEDIFF(s.fecha_fin, CURDATE()) as dias_restantes
        FROM escorts e
        LEFT JOIN suscripciones s ON s.id = (
            SELECT s2.id FROM suscripciones s2
            JOIN planes p2 ON p2.id = s2.plan_id AND p2.tipo = 'base'
            WHERE s2.escort_id = e.id
              AND s2.estado = 'activa'
              AND s2.fecha_aprobacion IS NOT NULL
            ORDER BY s2.creado_en DESC
            LIMIT 1
        )
        LEFT JOIN planes p ON p.id = s.plan_id
        WHERE e.vip = 1
          AND e.eliminada = 0
          AND e.fecha_vip_expira >= NOW()
        ORDER BY e.fecha_vip_expira ASC
    ");
    $activos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $resultado = array_map(function ($e) {
        $dias = max(0, (int)$e['dias_restantes']);
        $vence = $e['fecha_vip_expira'];
        $diasVip = $vence ? max(0, (int)ceil((strtotime($vence) - time()) / 86400)) : 0;
        return [
            'id' => (int)$e['id'],
            'nombre' => $e['nombre'],
            'email' => $e['email'],
            'telefono' => $e['telefono'],
            'ciudad' => $e['ciudad'],
            'foto_principal' => $e['foto_principal']
                ? '/api/serve-upload.php?path=/' . ltrim($e['foto_principal'], '/')
                : null,
            'verificado' => (bool)$e['verificado'],
            'rating' => $e['rating'],
            'total_valoraciones' => (int)$e['total_valoraciones'],
            'destacado' => (int)$e['destacado'],
            'vip_expira' => $vence,
            'dias_restantes_vip' => $diasVip,
            'plan' => $e['plan_nombre'] ? [
                'nombre' => $e['plan_nombre'],
                'vence' => $e['plan_vence'],
                'dias_restantes' => $dias,
            ] : null,
        ];
    }, $activos);

    echo json_encode([
        'success' => true,
        'total' => count($resultado),
        'activos' => $resultado,
    ]);
} catch (Throwable $e) {
    error_log("Error vip-activos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
