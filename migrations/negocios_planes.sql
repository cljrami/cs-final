CREATE TABLE IF NOT EXISTS `negocios_planes` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `negocio_id` int(11) UNSIGNED NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `tipo` enum('semanal','quincenal','mensual','semestral','anual') NOT NULL DEFAULT 'mensual',
  `precio` decimal(10,2) NOT NULL DEFAULT 0.00,
  `descripcion` text DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_planes_negocio` (`negocio_id`),
  CONSTRAINT `fk_planes_negocio` FOREIGN KEY (`negocio_id`) REFERENCES `negocios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
