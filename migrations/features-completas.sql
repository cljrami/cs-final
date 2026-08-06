-- ============================================
-- MIGRACIÓN COMPLETA — Kimi Features
-- ============================================

-- 1. Reportes
CREATE TABLE IF NOT EXISTS `reportes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `escort_id` INT NOT NULL,
  `reportado_por` VARCHAR(45) DEFAULT NULL,
  `motivo` VARCHAR(255) NOT NULL,
  `detalle` TEXT NULL,
  `estado` ENUM('pending','reviewed','dismissed') DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_escort_id` (`escort_id`),
  INDEX `idx_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Notificaciones
CREATE TABLE IF NOT EXISTS `notificaciones` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `escort_id` INT NOT NULL,
  `mensaje` TEXT NOT NULL,
  `tipo` ENUM('warning','info','success') DEFAULT 'info',
  `leida` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_escort_id` (`escort_id`),
  INDEX `idx_leida` (`leida`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- REPARACIÓN DE CODIFICACIÓN UTF-8 EN NOTIFICACIONES
-- Corrige textos como "VerificaciÃ³n" -> "Verificación"
-- Método seguro: REPLACE dirigido, sin conversión global (no genera warnings)
-- ============================================

UPDATE notificaciones
SET titulo = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    titulo,
    'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã±', 'ñ'), 'Ã¼', 'ü')
WHERE titulo LIKE '%Ã%' OR titulo LIKE '%Â%';

UPDATE notificaciones
SET mensaje = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    mensaje,
    'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã±', 'ñ'), 'Ã¼', 'ü')
WHERE mensaje LIKE '%Ã%' OR mensaje LIKE '%Â%';

-- 3. Rate limiting
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ip` VARCHAR(45) NOT NULL,
  `endpoint` VARCHAR(100) NOT NULL,
  `contador` INT DEFAULT 1,
  `ventana_inicio` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ip_endpoint` (`ip`, `endpoint`),
  INDEX `idx_ventana` (`ventana_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
