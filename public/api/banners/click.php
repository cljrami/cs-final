<?php
// public/api/banners/click.php
// Registra el click y redirige (302) a la URL del anunciante.
// GET ?id=12&p=home_sidebar
// La URL de destino SIEMPRE sale del servidor y sólo puede ser http/https.

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/banners.php';

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$placement = isset($_GET['p']) ? (string)$_GET['p'] : '';

if ($id <= 0) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Banner no válido';
    exit;
}

$destino = '';
try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT enlace_url, placement, estado FROM banners WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $fila = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($fila && $fila['estado'] === 'activo') {
        $destino = banners_url_segura($fila['enlace_url']);
    }
} catch (Throwable $e) {
    error_log('banners/click.php: ' . $e->getMessage());
}

if ($destino === '') {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Banner no disponible';
    exit;
}

banners_registrar_click($id, $placement !== '' ? $placement : (string)($fila['placement'] ?? ''));

header('Location: ' . $destino, true, 302);
exit;
