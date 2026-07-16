<?php
// api/escort/ciudades.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Método no permitido', 405);
}

try {
    $pdo = getDBConnection();
    $stmt = $pdo->query("SELECT id, nombre, region FROM ciudades WHERE activa = 1 ORDER BY orden, nombre");
    jsonResponse(true, ['ciudades' => $stmt->fetchAll()]);
} catch (Exception $e) {
    jsonError('Error: ' . $e->getMessage(), 500);
}
