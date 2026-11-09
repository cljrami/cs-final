<?php
require_once __DIR__.'/bootstrap.php';
$pdo=getDBConnection();
$cols=$pdo->query("SHOW COLUMNS FROM negocios")->fetchAll(PDO::FETCH_COLUMN);
echo json_encode(['columns'=>$cols]);
