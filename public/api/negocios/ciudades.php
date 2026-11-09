<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
try {
    $pdo = getDBConnection();
    $stmt = $pdo->query("SELECT id, nombre, slug FROM ciudades WHERE activo = 1 ORDER BY nombre ASC");
    $ciudades = $stmt->fetchAll();
    jsonResponse(true, ['ciudades'=>$ciudades]);
} catch (Throwable $e) {
    http_response_code(500);
    jsonResponse(false, ['error'=>$e->getMessage()]);
}
