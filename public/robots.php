<?php
/**
 * robots.php - Sirve robots.txt dinámico gestionable desde el panel admin.
 * Si `robots_habilitado` está en '1', devuelve el contenido configurado.
 * Si no, sirve el robots.txt estático (fallback).
 */
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=3600');

try {
    require_once __DIR__ . '/api/bootstrap.php';
    $pdo = getDBConnection();

    $stmt = $pdo->prepare("SELECT valor FROM configuracion WHERE clave IN ('robots_habilitado', 'robots_contenido')");
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $habilitado = ($rows['robots_habilitado'] ?? '0') === '1';
    $contenido = trim($rows['robots_contenido'] ?? '');

    if ($habilitado && $contenido !== '') {
        echo $contenido;
        exit;
    }
} catch (Throwable $e) {
    error_log("Error robots.php: " . $e->getMessage());
}

// Fallback al archivo estático
$static = __DIR__ . '/robots.txt';
if (file_exists($static)) {
    readfile($static);
} else {
    echo "User-agent: *\nAllow: /\n";
}