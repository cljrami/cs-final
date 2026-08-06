<?php
// public/api/ciudades/listado.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/gira.php';

try {
    $pdo = getDBConnection();
    $giraCond = gira_activa();
    $stmt = $pdo->prepare("
        SELECT 
            c.id,
            c.nombre,
            c.slug,
            (SELECT COUNT(*) FROM escorts e
             LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
             WHERE (({$giraCond} AND gc.nombre = c.nombre) OR (NOT ({$giraCond}) AND e.ciudad = c.nombre))
               AND e.activa = 1 AND e.eliminada = 0 AND EXISTS (SELECT 1 FROM suscripciones s JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL WHERE s.escort_id = e.id AND s.fecha_aprobacion IS NOT NULL AND s.estado = 'activa' AND s.fecha_fin >= CURDATE())) as escorts_activas
        FROM ciudades c
        WHERE c.activa = 1
        ORDER BY c.orden ASC, c.nombre ASC
    ");

    $stmt->execute();
    $ciudades = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $ciudades
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}

