<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
try {
    requireAuth();
    $tokenData = verifyToken(getBearerToken());
    requireAdminRole($tokenData);
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['success'=>false,'error'=>'Método no permitido']); exit; }
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Archivo no recibido']); exit; }
    $file = $_FILES['file'];
    $maxSize = 5 * 1024 * 1024;
    if ($file['size'] > $maxSize) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Archivo demasiado grande']); exit; }
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    $allowed = ['image/jpeg','image/png','image/webp'];
    if (!in_array($mime, $allowed, true)) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Tipo no permitido']); exit; }
    $extMap = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
    $ext = $extMap[$mime] ?? 'bin';
    $baseDir = __DIR__ . '/../../uploads/seo';
    if (!is_dir($baseDir)) { mkdir($baseDir, 0755, true); }
    $uniq = uniqid('seo_', true);
    $filename = $uniq . '.' . $ext;
    $dest = $baseDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) { http_response_code(500); echo json_encode(['success'=>false,'error'=>'No se pudo guardar']); exit; }
    $publicPath = '/uploads/seo/' . $filename;
    echo json_encode(['success'=>true,'path'=>$publicPath]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>$e->getMessage()]);
}
