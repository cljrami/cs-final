<?php
require_once __DIR__.'/bootstrap.php';
$pdo=getDBConnection();
try{
 $pdo->exec("CREATE TABLE IF NOT EXISTS negocios_planes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  tipo ENUM('semanal','quincenal','mensual','anual') NOT NULL,
  duracion_dias INT NOT NULL,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  orden INT NOT NULL DEFAULT 0,
  descripcion TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $pdo->exec("INSERT INTO negocios_planes (nombre,tipo,duracion_dias,precio,activa,orden,descripcion) VALUES ('Plan Semanal','semanal',7,10000,1,10,'Publicidad por 7 días'),('Plan Quincenal','quincenal',15,18000,1,20,'Publicidad por 15 días'),('Plan Mensual','mensual',30,30000,1,30,'Publicidad por 30 días'),('Plan Anual','anual',365,300000,1,40,'Publicidad por 365 días') ON DUPLICATE KEY UPDATE nombre=nombre");
 echo json_encode(['ok'=>true]);
}catch(Throwable $e){
 echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);
}
