<?php
require_once __DIR__ . '/bootstrap.php';
$pdo = getDBConnection();

$sql = <<<SQL
CREATE TABLE IF NOT EXISTS `negocios_categorias` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `descripcion` TEXT NULL,
  `icono` VARCHAR(50) DEFAULT 'fa-store',
  `color` VARCHAR(20) DEFAULT '#3b82f6',
  `orden` INT DEFAULT 0,
  `activa` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `negocios_categorias` (`nombre`,`slug`,`descripcion`,`icono`,`color`,`orden`,`activa`) VALUES
('Night Club','night_club','Clubes nocturnos','fa-moon','#8b5cf6',10,1),
('Discoteca','discoteca','Discotecas','fa-music','#ec4899',20,1),
('Sex Shop','sex_shop','Tiendas eróticas','fa-heart','#f43f5e',30,1),
('Bar','bar','Bares','fa-beer','#f59e0b',40,1),
('Sauna','sauna','Saunas','fa-hot-tub','#14b8a6',50,1),
('Otro','otro','Otros negocios','fa-store','#64748b',60,1);

ALTER TABLE `negocios` ADD COLUMN IF NOT EXISTS `categoria_id` INT UNSIGNED NULL AFTER `categoria`;
ALTER TABLE `negocios` ADD KEY IF NOT EXISTS `idx_negocios_categoria_id` (`categoria_id`);

UPDATE `negocios` n
JOIN `negocios_categorias` c ON c.slug = n.categoria
SET n.categoria_id = c.id
WHERE n.categoria_id IS NULL;
SQL;
$statements = array_filter(array_map('trim', explode(';', $sql)));
$ok = true;
foreach ($statements as $stmt) {
    if ($stmt === '') continue;
    try {
        $pdo->exec($stmt);
    } catch (Throwable $e) {
        echo "Error: " . $e->getMessage() . "\nSQL: $stmt\n";
        $ok = false;
        break;
    }
}
if ($ok) {
    echo "Migración aplicada correctamente.\n";
    $cnt = $pdo->query("SELECT COUNT(*) FROM negocios_categorias")->fetchColumn();
    echo "Categorías creadas: $cnt\n";
} else {
    echo "Migración falló.\n";
}
