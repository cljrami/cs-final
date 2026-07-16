<?php
// api/escort/servicios.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Método no permitido', 405);
}

try {
    $pdo = getDBConnection();
    $where = isset($_GET['activos']) ? "WHERE activo = 1" : "";
    $stmt = $pdo->query("SELECT id, nombre, grupo, color, icono FROM servicios $where ORDER BY grupo, orden, nombre");
    jsonResponse(true, ['servicios' => $stmt->fetchAll()]);
} catch (Exception $e) {
    jsonError('Error: ' . $e->getMessage(), 500);
}
