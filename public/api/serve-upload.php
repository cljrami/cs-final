<?php
$requestPath = parse_url($_GET['path'] ?? '', PHP_URL_PATH);
if (!$requestPath || strpos($requestPath, '/uploads/') !== 0 || strpos($requestPath, '..') !== false) {
    http_response_code(400);
    header('Content-Type: application/json');
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
    echo json_encode(['error' => 'Archivo no encontrado']);
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
header('Content-Length: ' . filesize($foundFile));
header('Cache-Control: public, max-age=86400');
readfile($foundFile);
