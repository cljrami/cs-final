<?php
require_once __DIR__ . '/../bootstrap.php';
$tokenData = requireAuth();
requireAdminRole($tokenData);
header('Content-Type: application/json; charset=utf-8');
$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT id, nombre, slug, icono, color, activa, orden FROM negocios_categorias ORDER BY orden ASC, nombre ASC");
        $cats = $stmt->fetchAll();
        jsonResponse(true, ['categorias' => $cats]);
        return;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    if ($method === 'POST') {
        $nombre = trim($input['nombre'] ?? '');
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i','-', $nombre));
        $icono = $input['icono'] ?? 'fa-store';
        $color = $input['color'] ?? '#64748b';
        $activa = intval($input['activa'] ?? 1);
        $orden = intval($input['orden'] ?? 0);
        if ($nombre === '') { jsonResponse(false, ['error'=>'Nombre requerido']); return; }
        $chk = $pdo->prepare("SELECT id FROM negocios_categorias WHERE slug = ? OR LOWER(nombre) = LOWER(?) LIMIT 1");
        $chk->execute([$slug, $nombre]);
        if ($chk->fetch()) {
            jsonResponse(false, ['error'=>'La categoría ya existe']);
            return;
        }
        $stmt = $pdo->prepare("INSERT INTO negocios_categorias (nombre, slug, icono, color, activa, orden) VALUES (?,?,?,?,?,?)");
        $stmt->execute([$nombre,$slug,$icono,$color,$activa,$orden]);
        jsonResponse(true, ['message'=>'Categoría creada']);
        return;
    }
    if ($method === 'PUT') {
        $id = intval($input['id'] ?? 0);
        if (!$id) { jsonResponse(false, ['error'=>'ID requerido']); return; }
        $nombre = trim($input['nombre'] ?? '');
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i','-', $nombre ?: ''));
        $icono = $input['icono'] ?? 'fa-store';
        $color = $input['color'] ?? '#64748b';
        $activa = intval($input['activa'] ?? 1);
        $orden = intval($input['orden'] ?? 0);
        $stmt = $pdo->prepare("UPDATE negocios_categorias SET nombre=?, slug=?, icono=?, color=?, activa=?, orden=? WHERE id=?");
        $stmt->execute([$nombre,$slug,$icono,$color,$activa,$orden,$id]);
        jsonResponse(true, ['message'=>'Categoría actualizada']);
        return;
    }
    if ($method === 'DELETE') {
        $id = intval($_GET['id'] ?? 0);
        if (!$id) { jsonResponse(false, ['error'=>'ID requerido']); return; }
        $stmt = $pdo->prepare("DELETE FROM negocios_categorias WHERE id=?");
        $stmt->execute([$id]);
        jsonResponse(true, ['message'=>'Categoría eliminada']);
        return;
    }
    jsonResponse(false, ['error'=>'Método no soportado']);
} catch (Throwable $e) {
    http_response_code(500);
    jsonResponse(false, ['error'=>$e->getMessage()]);
}
