<?php
require_once __DIR__.'/public/api/bootstrap.php';
$pdo=getDBConnection();
$stmt=$pdo->query('SELECT COUNT(*) FROM negocios WHERE activo=1');
echo $stmt->fetchColumn();
