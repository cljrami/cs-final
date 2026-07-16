<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

echo json_encode([
    'success' => true,
    'message' => 'API Kimi OK',
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => phpversion()
]);
