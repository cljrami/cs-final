<?php
// public/api/admin/upload-imagen.php
// Subida de imagen(es) de portada para artículos del blog.
// Solo admin/moderador. Guarda en /uploads/blog/.

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $files = $_FILES['imagen'] ?? [];
    if (empty($files['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No se envió ninguna imagen']);
        exit;
    }

    $uploadDir = __DIR__ . '/../../uploads/blog/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $nombre = $files['name'] ?? '';
    $error = $files['error'] ?? UPLOAD_ERR_OK;
    $size = $files['size'] ?? 0;
    $tmpName = $files['tmp_name'];

    if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($tmpName)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Error al subir el archivo']);
        exit;
    }

    $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
    $formatosImg = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    if (!in_array($ext, $formatosImg, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Formato no permitido (usar: ' . implode(', ', $formatosImg) . ')']);
        exit;
    }

    $MAX_IMG_SIZE = 10 * 1024 * 1024;
    $MAX_DIM = 4096;

    if ($size > $MAX_IMG_SIZE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'La imagen supera el límite de 10MB']);
        exit;
    }

    if (!validarMIME($tmpName, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No es una imagen válida o está corrupta']);
        exit;
    }

    $imgInfo = @getimagesize($tmpName);
    if ($imgInfo === false) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No es una imagen válida o está corrupta']);
        exit;
    }
    if ($imgInfo[0] > $MAX_DIM || $imgInfo[1] > $MAX_DIM) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "La imagen excede $MAX_DIM px en alguna dimensión ({$imgInfo[0]}x{$imgInfo[1]})"]);
        exit;
    }

    if ($ext === 'jpeg') $ext = 'jpg';

    $newName = uniqid('blog_') . '.' . $ext;
    $destPath = $uploadDir . $newName;

    if (!move_uploaded_file($tmpName, $destPath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'No se pudo guardar la imagen']);
        exit;
    }

    $url = '/uploads/blog/' . $newName;

    echo json_encode(['success' => true, 'url' => $url]);
} catch (Throwable $e) {
    error_log("Error admin/upload-imagen.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}