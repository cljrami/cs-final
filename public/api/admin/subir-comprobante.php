<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    if (!isset($_FILES['comprobante']) || $_FILES['comprobante']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No se recibiíƒÂ³ el archivo o hubo un error']);
        exit;
    }

    $file = $_FILES['comprobante'];
    $tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validarMIME($file['tmp_name'], $tiposPermitidos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Solo se permiten imíƒÂ¡genes (JPG, PNG, WebP) o PDF']);
        exit;
    }

    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'El archivo no puede superar los 5MB']);
        exit;
    }

    $escortId = intval($_POST['escort_id'] ?? 0);
    $uploadDir = __DIR__ . '/../../uploads/comprobantes/' . ($escortId > 0 ? $escortId . '/' : 'admin/');
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

// Normalizar y restringir la extensión del archivo guardado al tipo validado
    $extPermitidas = ['jpg' => 'jpg', 'jpeg' => 'jpg', 'png' => 'png', 'webp' => 'webp', 'pdf' => 'pdf'];
    $ext = $extPermitidas[strtolower(pathinfo($file['name'], PATHINFO_EXTENSION))] ?? '';
    if ($ext === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Extensión no permitida']);
        exit;
    }
    $filename = date('Ymd_His') . '_admin_' . uniqid() . '.' . $ext;
    $filepath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        throw new Exception('Error al guardar el archivo');
    }

    $escortFolder = $escortId > 0 ? $escortId : 'admin';
    $rutaRelativa = 'uploads/comprobantes/' . $escortFolder . '/' . $filename;

    echo json_encode(['success' => true, 'path' => $rutaRelativa, 'filename' => $filename]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

