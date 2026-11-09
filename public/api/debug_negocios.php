<?php
require_once __DIR__.'/bootstrap.php';
$pdo = getDBConnection();
$cats = $pdo->query("SELECT nombre,slug FROM negocios_categorias")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['cats'=>$cats]);
$ negocios = $pdo->query("SELECT id,nombre,categoria FROM negocios WHERE categoria LIKE '%night%' LIMIT 20")->fetchAll(PDO::FETCH_ASSOC);
echo "\n";
echo json_encode(['negocios'=>$negocios]);
