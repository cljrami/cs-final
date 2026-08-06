<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    if (!isset($_FILES['imagen']) || $_FILES['imagen']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No se recibió el archivo o hubo un error']);
        exit;
    }

    $file = $_FILES['imagen'];
    $tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validarMIME($file['tmp_name'], $tiposPermitidos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Solo se permiten imágenes (JPG, PNG, WebP)']);
        exit;
    }

    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'El archivo no puede superar los 5MB']);
        exit;
    }

    $carpeta = $_POST['carpeta'] ?? 'og';
    if (!in_array($carpeta, ['og', 'schema'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Carpeta no válida']);
        exit;
    }

    $uploadDir = __DIR__ . '/../../uploads/' . $carpeta . '/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Normalizar y restringir la extensión del archivo guardado al tipo validado
    $extPermitidas = ['jpg' => 'jpg', 'jpeg' => 'jpg', 'png' => 'png', 'webp' => 'webp'];
    $ext = $extPermitidas[strtolower(pathinfo($file['name'], PATHINFO_EXTENSION))] ?? '';
    if ($ext === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Extensión no permitida']);
        exit;
    }
    $filename = date('Ymd_His') . '_' . $carpeta . '_' . uniqid() . '.' . $ext;
    $filepath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        throw new Exception('Error al guardar el archivo');
    }

    $ruta = '/uploads/' . $carpeta . '/' . $filename;

    // Mantener un archivo estático 'current-og.jpg' siempre actual con la última imagen (OG o Schema)
    if ($carpeta === 'og' || $carpeta === 'schema') {
        $dest = $uploadDir . 'current-og.jpg';
        if (function_exists('imagecreatefromstring')) {
            $img = @imagecreatefromstring(@file_get_contents($filepath));
            if ($img !== false) {
                @imagejpeg($img, $dest, 90);
                @imagedestroy($img);
            } else {
                @copy($filepath, $dest);
            }
        } else {
            @copy($filepath, $dest);
        }
    }

    echo json_encode(['success' => true, 'path' => $ruta, 'filename' => $filename]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
