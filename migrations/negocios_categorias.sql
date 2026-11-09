CREATE TABLE IF NOT EXISTS `negocios_categorias` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `icono` varchar(100) DEFAULT 'fa-store',
  `color` varchar(20) DEFAULT '#64748b',
  `activa` tinyint(1) NOT NULL DEFAULT 1,
  `orden` int(11) NOT NULL DEFAULT 0,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categoria_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `negocios_categorias` (`nombre`,`slug`,`icono`,`color`,`activa`,`orden`) VALUES
('Night Club','night_club','fa-glass-cheers','#ff3b30',1,10),
('Discoteca','discoteca','fa-music','#ff9500',1,20),
('Sex Shop','sex_shop','fa-heart','#ff2d55',1,30),
('Bar','bar','fa-beer','#0a84ff',1,40),
('Sauna','sauna','fa-hot-tub','#64d2ff',1,50),
('Otro','otro','fa-store','#64748b',1,99)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
