<?php
$requestPath = parse_url($_GET['path'] ?? '', PHP_URL_PATH);
$decodedPath = urldecode((string)$requestPath);

// Validar ruta: debe estar bajo /uploads/ y no contener secuencias de salida (..)
// Se comprueba tanto la ruta cruda como la decodificada (%2e%2e => ..)
if ($requestPath === false || $decodedPath === ''
    || stripos($decodedPath, '/uploads/') !== 0
    || strpos($decodedPath, '..') !== false
    || strpos($requestPath, '..') !== false) {
    http_response_code(400);
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['error' => 'Ruta inválida']);
    exit;
}

// New location: documents root /public_html/ or /public/
$newBase = __DIR__ . '/..';
$newFile = $newBase . $requestPath;

// Old location: one level above documents root
$oldBase = __DIR__ . '/../..';
$oldFile = $oldBase . $requestPath;

$foundFile = null;
if (file_exists($newFile) && is_file($newFile)) {
    $foundFile = $newFile;
} elseif (file_exists($oldFile) && is_file($oldFile)) {
    $foundFile = $oldFile;
}

if (!$foundFile) {
    http_response_code(404);
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['error' => 'Archivo no encontrado']);
    exit;
}

// Canonicalizar y verificar que el archivo resuelto esté realmente bajo /uploads/
$realFile = realpath($foundFile);
$realNorm = str_replace('\\', '/', (string)$realFile);
$inUploads = $realFile !== false && stripos($realNorm, '/uploads/') !== false;
if (!$inUploads) {
    http_response_code(403);
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['error' => 'Acceso denegado']);
    exit;
}

$ext = strtolower(pathinfo($foundFile, PATHINFO_EXTENSION));
$mimeMap = [
    'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
    'gif' => 'image/gif', 'webp' => 'image/webp', 'avif' => 'image/avif',
    'bmp' => 'image/bmp', 'pdf' => 'application/pdf',
    'mp4' => 'video/mp4', 'mov' => 'video/quicktime', 'webm' => 'video/webm',
];
$mime = $mimeMap[$ext] ?? 'application/octet-stream';

header('Content-Type: ' . $mime);
header('X-Content-Type-Options: nosniff');
header('Content-Length: ' . filesize($foundFile));
header('Cache-Control: public, max-age=86400');
readfile($foundFile);
