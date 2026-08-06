<?php
// api/escort/catalogos.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Método no permitido', 405);
}

try {
    $pdo = getDBConnection();
    $result = [];

    $tables = [
        'etnias' => 'catalogo_etnias',
        'orientaciones' => 'catalogo_orientaciones',
        'estilos' => 'catalogo_estilos',
        'idiomas' => 'catalogo_idiomas',
        'nacionalidades' => 'catalogo_nacionalidades'
    ];

    foreach ($tables as $key => $table) {
        try {
            $stmt = $pdo->query("SELECT id, nombre FROM $table WHERE activo = 1 ORDER BY orden, nombre");
            $result[$key] = $stmt->fetchAll();
        } catch (Exception $e) {
            $result[$key] = [];
        }
    }

    try {
        $stmt = $pdo->query("SELECT id, nombre FROM colores WHERE activo = 1 AND tipo = 'ojos' ORDER BY orden, nombre");
        $result['colores_ojos'] = $stmt->fetchAll();
    } catch (Exception $e) {
        $result['colores_ojos'] = [];
    }

    try {
        $stmt = $pdo->query("SELECT id, nombre FROM colores WHERE activo = 1 AND tipo = 'pelo' ORDER BY orden, nombre");
        $result['colores_pelo'] = $stmt->fetchAll();
    } catch (Exception $e) {
        $result['colores_pelo'] = [];
    }

    jsonResponse(true, $result);
} catch (Exception $e) {
    jsonError('Error: ' . $e->getMessage(), 500);
}
