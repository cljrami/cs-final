<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../bootstrap.php';

$headers = getallheaders();
$auth = $headers['Authorization'] ?? '';
$token = str_replace('Bearer ', '', $auth);

if (!$token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

$tokenData = verifyToken($token);
$escortId = $tokenData['id'] ?? 0;

if (!$escortId) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Token inválido']);
    exit;
}

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("
        SELECT 
            s.id,
            p.nombre as plan_nombre,
            p.color_badge as plan_color,
            s.estado,
            s.fecha_inicio,
            s.fecha_fin,
            CASE 
                WHEN s.fecha_aprobacion IS NULL THEN 'moderacion'
                WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 'activo'
                WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'expirado'
                ELSE s.estado
            END as estado_real,
            GREATEST(0, DATEDIFF(s.fecha_fin, CURDATE())) as dias_restantes
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND s.estado IN ('activa', 'pausada')
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$suscripcion) {
        echo json_encode([
            'success' => true,
            'suscripcion' => null
        ]);
        exit;
    }
    
    echo json_encode([
        'success' => true,
        'suscripcion' => [
            'id' => (int)$suscripcion['id'],
            'plan_nombre' => $suscripcion['plan_nombre'],
            'plan_color' => $suscripcion['plan_color'],
            'estado' => $suscripcion['estado_real'],
            'fecha_inicio' => $suscripcion['fecha_inicio'],
            'fecha_fin' => $suscripcion['fecha_fin'],
            'dias_restantes' => (int)$suscripcion['dias_restantes']
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}