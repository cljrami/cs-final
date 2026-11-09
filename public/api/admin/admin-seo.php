<?php
require_once __DIR__ . '/../bootstrap.php';
$tokenData = requireAuth();
requireAdminRole($tokenData);
header('Content-Type: application/json; charset=utf-8');
$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $seccion = $_GET['seccion'] ?? '';
        if (!$seccion) { jsonResponse(false, ['error'=>'seccion requerido']); return; }
        $stmt = $pdo->prepare("SELECT seccion, meta_title, meta_description, meta_keywords, og_image FROM admin_seo WHERE seccion = ?");
        $stmt->execute([$seccion]);
        $row = $stmt->fetch();
        if (!$row) {
            jsonResponse(true, ['seo'=>['seccion'=>$seccion,'meta_title'=>'','meta_description'=>'','meta_keywords'=>'','og_image'=>'']]);
            return;
        }
        jsonResponse(true, ['seo'=>$row]);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $seccion = trim($input['seccion'] ?? '');
    $meta_title = trim($input['meta_title'] ?? '');
    $meta_description = trim($input['meta_description'] ?? '');
    $meta_keywords = trim($input['meta_keywords'] ?? '');
    $og_image = trim($input['og_image'] ?? '');

    if (!$seccion) { jsonResponse(false, ['error'=>'seccion requerido']); return; }

    $stmt = $pdo->prepare("INSERT INTO admin_seo (seccion, meta_title, meta_description, meta_keywords, og_image) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE meta_title=VALUES(meta_title), meta_description=VALUES(meta_description), meta_keywords=VALUES(meta_keywords), og_image=VALUES(og_image)");
    $stmt->execute([$seccion, $meta_title, $meta_description, $meta_keywords, $og_image]);
    jsonResponse(true, ['message'=>'SEO guardado']);
} catch (Throwable $e) {
    http_response_code(500);
    jsonResponse(false, ['error'=>$e->getMessage()]);
}
