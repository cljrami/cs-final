<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';
$pdo = getDBConnection();

$resultado = [
    'success' => true,
    'idiomas' => [],
    'nacionalidades' => [],
    'orientaciones' => [],
    'etnias' => [],
    'colores_ojos' => [],
    'colores_pelo' => [],
    'estilos' => []
];

$consultas = [
    'idiomas' => "SELECT id, nombre FROM idiomas WHERE activo = 1 ORDER BY nombre ASC",
    'nacionalidades' => "SELECT id, nombre FROM nacionalidades WHERE activo = 1 ORDER BY nombre ASC",
    'orientaciones' => "SELECT id, nombre FROM orientaciones_sexuales WHERE activa = 1 ORDER BY orden ASC, nombre ASC",
    'etnias' => "SELECT id, nombre FROM etnias WHERE activo = 1 ORDER BY nombre ASC",
    'colores_ojos' => "SELECT id, nombre FROM colores_ojos WHERE activo = 1 ORDER BY nombre ASC",
    'colores_pelo' => "SELECT id, nombre FROM colores_pelo WHERE activo = 1 ORDER BY nombre ASC",
    'estilos' => "SELECT id, nombre FROM estilos WHERE activo = 1 ORDER BY nombre ASC"
];

foreach ($consultas as $key => $sql) {
    try {
        $stmt = $pdo->query($sql);
        $resultado[$key] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        $resultado[$key] = [];
    }
}

echo json_encode($resultado);
