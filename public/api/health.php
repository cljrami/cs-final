<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = getDBConnection();
    $stmt = $pdo->query("SELECT 1");
    $dbStatus = $stmt ? 'connected' : 'error';
} catch (Throwable $e) {
    error_log('health check db error: ' . $e->getMessage());
    $dbStatus = 'error';
}

$status = ($dbStatus === 'connected') ? 'ok' : 'degraded';

http_response_code($status === 'ok' ? 200 : 503);
echo json_encode([
    'status' => $status,
    'timestamp' => date('c'),
    'version' => '1.0.0',
    'db' => $dbStatus
]);
