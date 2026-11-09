<?php
// public/api/banners/upload-public.php
// Subida pública de imagen para solicitudes de banner. Requiere validación estricta y rate limit.
// La imagen se guarda en /uploads/banners/ y la solicitud se moderará en admin.
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/../bootstrap.php';

try {
    // Rate limit por IP
    $rl = rateLimitCheck('banner_upload_public', 5, 3600, '');
    if (!empty($rl['blocked'])) {
        http_response_code(429);
        echo json_encode(['success' => false, 'error' => 'Demasiadas subidas. Intenta más tarde.']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método no permitido']);
        exit;
    }

    $files = $_FILES['imagen'] ?? null;
    if (!$files || !isset($files['tmp_name']) || $files['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No se recibió la imagen']);
        exit;
    }

    $tmpName = $files['tmp_name'];
    $originalName = (string)$files['name'];
    $size = (int)$files['size'];

    $MAX_SIZE = 5 * 1024 * 1024;
    if ($size <= 0 || $size > $MAX_SIZE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'La imagen no debe pesar más de 5 MB']);
        exit;
    }

    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $formatosPermitidos = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!in_array($ext, $formatosPermitidos, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Formato no permitido (jpg, png, webp o gif)']);
        exit;
    }

    $mimesPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validarMIME($tmpName, $mimesPermitidos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'El archivo no es una imagen válida']);
        exit;
    }

    $imgInfo = @getimagesize($tmpName);
    if (!$imgInfo) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'El archivo no es una imagen válida']);
        exit;
    }

    $uploadDir = __DIR__ . '/../../uploads/banners/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    if ($ext === 'jpeg') $ext = 'jpg';
    $newName = uniqid('banner_pub_') . '.' . $ext;
    $destPath = $uploadDir . $newName;

    if (!move_uploaded_file($tmpName, $destPath)) {
        error_log('upload-public.php: no se pudo mover archivo');
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'No se pudo guardar la imagen']);
        exit;
    }
    @chmod($destPath, 0644);

    echo json_encode([
        'success' => true,
        'url' => '/uploads/banners/' . $newName,
        'width' => (int)$imgInfo[0],
        'height' => (int)$imgInfo[1],
    ]);
} catch (Throwable $e) {
    error_log('upload-public.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
