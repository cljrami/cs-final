<?php
require_once __DIR__.'/bootstrap.php';
$pdo=getDBConnection();
$tables=$pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
echo json_encode(['tables'=>$tables]);
