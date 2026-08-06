<?php
// public/api/ciudades.php

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/bootstrap.php';

    $pdo = getDBConnection();
    $stmt = $pdo->query("
        SELECT id, nombre, orden
        FROM ciudades 
        WHERE activa = 1 
        ORDER BY orden ASC, nombre ASC
    ");

    $ciudades = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'ciudades' => $ciudades
    ]);
} catch (Throwable $e) {
    error_log("Error ciudades.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
