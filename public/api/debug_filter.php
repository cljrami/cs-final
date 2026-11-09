<?php
require_once __DIR__.'/bootstrap.php';
$pdo = getDBConnection();
$cat = $_GET['cat'] ?? 'night_club';
$stmt = $pdo->prepare("SELECT id,nombre,categoria FROM negocios WHERE categoria = ? AND activo=1");
$stmt->execute([$cat]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
header('Content-Type: application/json');
echo json_encode(['cat'=>$cat,'count'=>count($rows),'rows'=>$rows]);
