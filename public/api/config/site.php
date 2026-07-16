<?php
// public/api/config/site.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT clave, valor FROM configuracion WHERE tipo IN ('string', 'int')");
    $stmt->execute();
    $config = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    echo json_encode([
        'success' => true,
        'data' => [
            'site_nombre' => $config['site_nombre'] ?? 'CSEscorts',
            'site_descripcion' => $config['site_descripcion'] ?? 'Directorio Premium de Escorts',
            'precio_vip_mensual' => (int) ($config['precio_vip_mensual'] ?? 50000),
            'precio_destacado_semanal' => (int) ($config['precio_destacado_semanal'] ?? 15000),
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
