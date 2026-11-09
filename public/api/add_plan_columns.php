<?php
require_once __DIR__.'/bootstrap.php';
$pdo=getDBConnection();
try{
 $pdo->exec("ALTER TABLE negocios ADD COLUMN plan_id INT NULL AFTER destacado");
 $pdo->exec("ALTER TABLE negocios ADD COLUMN plan_precio_aplicado DECIMAL(10,2) NULL AFTER plan_id");
 echo json_encode(['ok'=>true]);
}catch(Throwable $e){
 echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);
}
