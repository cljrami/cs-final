-- Catálogo global de planes para negocios
CREATE TABLE IF NOT EXISTS `negocios_planes_global` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `duracion` enum('semanal','quincenal','mensual','trimestral','semestral','anual') NOT NULL DEFAULT 'mensual',
  `valor` decimal(10,2) NOT NULL DEFAULT 0.00,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `orden` int(11) NOT NULL DEFAULT 0,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar plan_id a negocios
ALTER TABLE `negocios` 
ADD COLUMN IF NOT EXISTS `plan_id` int(11) UNSIGNED DEFAULT NULL AFTER `categoria`,
ADD COLUMN IF NOT EXISTS `seo_og_image` varchar(255) DEFAULT NULL AFTER `seo_keywords`,
ADD CONSTRAINT `fk_negocios_plan` FOREIGN KEY (`plan_id`) REFERENCES `negocios_planes_global` (`id`) ON DELETE SET NULL;

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS `idx_negocios_plan_id` ON `negocios` (`plan_id`);
