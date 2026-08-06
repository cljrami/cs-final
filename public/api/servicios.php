<?php
// public/api/servicios.php

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/bootstrap.php';

    $pdo = getDBConnection();
    $activos = isset($_GET['activos']) ? (int)$_GET['activos'] : null;

    if ($activos === 1) {
        $stmt = $pdo->query("
            SELECT id, nombre, slug, descripcion, descripcion_corta, 
                   grupo, icono, color, tipicamente_adicional, orden
            FROM servicios 
            WHERE activo = 1 
            ORDER BY orden ASC, nombre ASC
        ");
    } else {
        $stmt = $pdo->query("
            SELECT id, nombre, slug, descripcion, descripcion_corta, 
                   grupo, icono, color, tipicamente_adicional, orden, activo
            FROM servicios 
            ORDER BY orden ASC, nombre ASC
        ");
    }

    $servicios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'servicios' => $servicios
    ]);
} catch (Throwable $e) {
    error_log("Error servicios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
