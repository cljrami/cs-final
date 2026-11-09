<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
$pdo = getDBConnection();
$slug = $_GET['slug'] ?? '';
if (!$slug) { jsonResponse(false, ['error'=>'slug requerido']); return; }
$stmt = $pdo->prepare("SELECT n.id, n.nombre, n.slug, n.categoria, n.descripcion, n.direccion, n.telefono, n.whatsapp, n.web, n.instagram, n.logo_url, n.seo_title, n.seo_description, n.seo_keywords, c.nombre AS ciudad_nombre FROM negocios n LEFT JOIN ciudades c ON c.id=n.ciudad_id WHERE n.slug = ? AND n.activo = 1 LIMIT 1");
$stmt->execute([$slug]);
$negocio = $stmt->fetch();
if (!$negocio) { jsonResponse(false, ['error'=>'no encontrado']); return; }
jsonResponse(true, ['negocio'=>$negocio]);
