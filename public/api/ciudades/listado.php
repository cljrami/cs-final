<?php
// public/api/ciudades/listado.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("
        SELECT 
            c.id,
            c.nombre,
            c.region,
            (SELECT COUNT(*) FROM escorts e WHERE e.ciudad = c.nombre AND e.activa = 1 AND e.eliminada = 0) as escorts_activas
        FROM ciudades c
        WHERE c.activa = 1
        ORDER BY c.orden ASC, c.nombre ASC
    ");

    $stmt->execute();
    $ciudades = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => $ciudades
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
