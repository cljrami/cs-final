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
    'colores_ojos' => "SELECT id, nombre FROM colores WHERE activo = 1 AND tipo = 'ojos' ORDER BY nombre ASC",
    'colores_pelo' => "SELECT id, nombre FROM colores WHERE activo = 1 AND tipo = 'pelo' ORDER BY nombre ASC",
    'estilos' => "SELECT id, nombre, icono FROM estilos WHERE activo = 1 ORDER BY nombre ASC",
    'categorias' => "SELECT id, nombre, icono FROM categorias WHERE activa = 1 ORDER BY orden ASC, nombre ASC"
];

foreach ($consultas as $key => $sql) {
    try {
        $stmt = $pdo->query($sql);
        $resultado[$key] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        $resultado[$key] = [];
    }
}

// Fallback hardcodeado si las tablas de colores no existen
if (empty($resultado['colores_ojos'])) {
    $resultado['colores_ojos'] = [
        ['id' => 1, 'nombre' => 'Café'],
        ['id' => 2, 'nombre' => 'Café Claro'],
        ['id' => 3, 'nombre' => 'Café Oscuro'],
        ['id' => 4, 'nombre' => 'Negros'],
        ['id' => 5, 'nombre' => 'Azules'],
        ['id' => 6, 'nombre' => 'Verdes'],
        ['id' => 7, 'nombre' => 'Miel'],
        ['id' => 8, 'nombre' => 'Ámbar'],
        ['id' => 9, 'nombre' => 'Grises'],
    ];
}
if (empty($resultado['colores_pelo'])) {
    $resultado['colores_pelo'] = [
        ['id' => 1, 'nombre' => 'Negro'],
        ['id' => 2, 'nombre' => 'Castaño Oscuro'],
        ['id' => 3, 'nombre' => 'Castaño Claro'],
        ['id' => 4, 'nombre' => 'Rubio'],
        ['id' => 5, 'nombre' => 'Rubio Oscuro'],
        ['id' => 6, 'nombre' => 'Pelirrojo'],
        ['id' => 7, 'nombre' => 'Cobrizo'],
        ['id' => 8, 'nombre' => 'Gris'],
        ['id' => 9, 'nombre' => 'Canoso'],
        ['id' => 10, 'nombre' => 'Teñido'],
    ];
}

echo json_encode($resultado);
