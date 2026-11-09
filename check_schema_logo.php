<?php
require_once __DIR__.'/public/api/bootstrap.php';
$pdo = getDBConnection();
$stmt = $pdo->prepare("SELECT valor FROM configuracion WHERE clave='schema_logo'");
$stmt->execute();
echo $stmt->fetchColumn() ?: 'empty';
