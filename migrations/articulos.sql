-- ============================================
-- BLOG / ARTÍCULOS: tablas para la sección de
-- artículos (solo visible en el homepage).
-- Incluye categorías de blog y gestión SEO completa
-- por artículo (meta título, descripción, keywords,
-- url externa, robots, canonical, autor).
-- ============================================

CREATE TABLE IF NOT EXISTS `blog_categorias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `slug` varchar(120) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activa` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `articulos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titulo` varchar(200) NOT NULL,
  `slug` varchar(220) NOT NULL,
  `imagen` varchar(500) DEFAULT NULL,
  `extracto` varchar(500) DEFAULT NULL,
  `contenido` longtext NOT NULL,
  `autor` varchar(150) DEFAULT NULL,
  `categoria_id` int(11) DEFAULT NULL,
  `etiquetas` text DEFAULT NULL,
  `estado` enum('borrador','publicado','archivado') NOT NULL DEFAULT 'borrador',
  `destacado` tinyint(1) NOT NULL DEFAULT 0,
  `vistas` int(11) NOT NULL DEFAULT 0,
  `meta_titulo` varchar(200) DEFAULT NULL,
  `meta_descripcion` varchar(300) DEFAULT NULL,
  `meta_keywords` varchar(500) DEFAULT NULL,
  `url_externa` varchar(500) DEFAULT NULL,
  `robots` enum('index','noindex') NOT NULL DEFAULT 'index',
  `canonical` varchar(500) DEFAULT NULL,
  `published_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_slug` (`slug`),
  KEY `categoria_id` (`categoria_id`),
  KEY `estado` (`estado`),
  KEY `destacado` (`destacado`),
  CONSTRAINT `fk_articulo_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `blog_categorias`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;