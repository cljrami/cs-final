CREATE TABLE IF NOT EXISTS `estadisticas_diarias` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `escort_id` INT NOT NULL,
  `fecha` DATE NOT NULL,
  `visitas` INT DEFAULT 0,
  `contactos` INT DEFAULT 0,
  `favoritos` INT DEFAULT 0,
  UNIQUE KEY (escort_id, fecha),
  INDEX (escort_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
