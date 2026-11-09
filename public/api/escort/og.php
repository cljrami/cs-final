<?php
require_once __DIR__ . '/../bootstrap.php';
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if($id <= 0){ http_response_code(400); exit('Bad Request'); }
$pdo = getDBConnection();
$stmt = $pdo->prepare("SELECT id, nombre, edad, ciudad, foto_principal, descripcion_corta FROM escorts WHERE id = ? LIMIT 1");
$stmt->execute([$id]);
$escort = $stmt->fetch(PDO::FETCH_ASSOC);
if(!$escort){ http_response_code(404); exit('Not found'); }
// Buscar foto de portada o primera foto
$stmtFoto = $pdo->prepare("SELECT url, gif_url, tipo FROM fotos WHERE escort_id = ? AND es_portada = 1 LIMIT 1");
$stmtFoto->execute([$id]);
$fotoRow = $stmtFoto->fetch(PDO::FETCH_ASSOC);
if(!$fotoRow){
    $stmtFoto2 = $pdo->prepare("SELECT url, gif_url, tipo FROM fotos WHERE escort_id = ? ORDER BY id ASC LIMIT 1");
    $stmtFoto2->execute([$id]);
    $fotoRow = $stmtFoto2->fetch(PDO::FETCH_ASSOC);
}
$nombre = htmlspecialchars($escort['nombre'] ?? '');
$edad = intval($escort['edad'] ?? 0);
$ciudad = htmlspecialchars($escort['ciudad'] ?? '');
$desc = htmlspecialchars(strip_tags($escort['descripcion_corta'] ?? ''));
$foto_principal = $escort['foto_principal'];
// Lógica para OG: usar imagen estática si la portada es video
$foto = '';
if($fotoRow){
    if(!empty($fotoRow['url'])){
        $foto = $fotoRow['url'];
    }
    // Si es video, no usar gif_url para OG, mantener imagen estática
}
if(!$foto && $foto_principal){
    $foto = $foto_principal;
}
if($foto && !preg_match('#^https?://#i', $foto)){ $foto = 'https://www.consexvip.cl' . $foto; }
$title = trim("$nombre " . ($edad ? "$edad años" : '') . " - Escort en $ciudad");
$site = 'Consexvip';
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title><?= $title ?> | <?= $site ?></title>
<meta name="description" content="<?= $desc ?>">
<meta property="og:type" content="profile">
<meta property="og:title" content="<?= $title ?>">
<meta property="og:description" content="<?= $desc ?>">
<meta property="og:url" content="https://www.consexvip.cl/cs<?= $id ?>">
<meta property="og:image" content="<?= htmlspecialchars($foto ?? '') ?>">
<meta property="og:site_name" content="<?= $site ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= $title ?>">
<meta name="twitter:description" content="<?= $desc ?>">
<meta name="twitter:image" content="<?= htmlspecialchars($foto ?? '') ?>">
</head>
<body>
<p>Redirigiendo...</p>
<script>window.location.href='https://www.consexvip.cl/cs<?= $id ?>';</script>
</body>
</html>
