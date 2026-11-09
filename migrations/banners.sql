-- ============================================
-- MÓDULO DE BANNERS PUBLICITARIOS
-- Campañas de negocios externos (night clubs, discotecas, sex shops, etc.)
-- Fecha: 2026-10-20
-- Aplicar manualmente (no hay runner de migraciones).
-- ============================================

-- 1) Campañas de banners (incluye las solicitudes de negocios externos)
CREATE TABLE IF NOT EXISTS `banners` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `anunciante` varchar(150) NOT NULL,
  `categoria` enum('night_club','discoteca','sex_shop','bar','sauna','otro') NOT NULL DEFAULT 'otro',
  `contacto` varchar(120) DEFAULT NULL,
  `web` varchar(255) DEFAULT NULL,
  `titulo` varchar(150) NOT NULL,
  `imagen_url` varchar(255) NOT NULL,
  `imagen_mobile_url` varchar(255) DEFAULT NULL,
  `texto` varchar(255) DEFAULT NULL,
  `enlace_url` varchar(500) NOT NULL,
  `placement` enum('home_top','home_sidebar','home_entre_secciones','ciudad_top','ciudad_sidebar',
                    'perfil_top','perfil_lateral','perfil_pre_footer','blog_articulo','footer') NOT NULL,
  `ciudad_id` int(11) DEFAULT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `peso` int(11) DEFAULT 10,
  `orden` int(11) DEFAULT 0,
  `precio` decimal(10,2) NOT NULL DEFAULT 0.00,
  `moneda` varchar(3) DEFAULT 'CLP',
  `estado_pago` enum('pendiente','pagado','gratis','reembolsado') NOT NULL DEFAULT 'pendiente',
  `forma_pago` enum('transferencia','webpay','efectivo','otro') NOT NULL DEFAULT 'transferencia',
  `referencia_pago` varchar(120) DEFAULT NULL,
  `pagado_en` datetime DEFAULT NULL,
  `estado` enum('solicitud','presupuesto','pendiente_pago','activo','pausado','finalizado','rechazado') NOT NULL DEFAULT 'solicitud',
  `codigo_acceso` varchar(16) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `creado_por` int(11) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_banners_codigo` (`codigo_acceso`),
  KEY `idx_banners_slot` (`placement`,`estado`,`fecha_inicio`,`fecha_fin`),
  KEY `idx_banners_ciudad` (`ciudad_id`),
  KEY `idx_banners_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Métricas diarias por banner
CREATE TABLE IF NOT EXISTS `banners_stats` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `banner_id` int(11) UNSIGNED NOT NULL,
  `fecha` date NOT NULL,
  `impresiones` int(11) NOT NULL DEFAULT 0,
  `clicks` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_banners_stats_dia` (`banner_id`,`fecha`),
  KEY `idx_banners_stats_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Directorio de negocios del rubro (Fase 3)
CREATE TABLE IF NOT EXISTS `negocios` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `slug` varchar(160) NOT NULL,
  `categoria` enum('night_club','discoteca','sex_shop','bar','sauna','otro') NOT NULL DEFAULT 'otro',
  `descripcion` text DEFAULT NULL,
  `ciudad_id` int(11) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `telefono` varchar(50) DEFAULT NULL,
  `whatsapp` varchar(50) DEFAULT NULL,
  `web` varchar(255) DEFAULT NULL,
  `instagram` varchar(150) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `banner_id` int(11) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `destacado` tinyint(1) NOT NULL DEFAULT 0,
  `notas` text DEFAULT NULL,
  `creado_por` int(11) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_negocios_slug` (`slug`),
  KEY `idx_negocios_ciudad` (`ciudad_id`),
  KEY `idx_negocios_categoria` (`categoria`),
  KEY `idx_negocios_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
