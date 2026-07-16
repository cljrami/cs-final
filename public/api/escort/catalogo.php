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
        'colores_ojos' => 'catalogo_colores_ojos',
        'colores_pelo' => 'catalogo_colores_pelo',
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
            $result[$key] = []; // Tabla no existe aún
        }
    }

    jsonResponse(true, $result);
} catch (Exception $e) {
    jsonError('Error: ' . $e->getMessage(), 500);
}
