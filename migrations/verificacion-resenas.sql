CREATE TABLE IF NOT EXISTS `codigos_verificacion` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `escort_id` INT NOT NULL,
  `codigo` VARCHAR(10) NOT NULL UNIQUE,
  `creado_en` DATETIME NOT NULL,
  `expira_en` DATETIME NOT NULL,
  `usado` TINYINT(1) DEFAULT 0,
  `usado_por` INT DEFAULT NULL,
  `usado_en` DATETIME DEFAULT NULL,
  INDEX (escort_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE comentarios ADD COLUMN cita_verificada TINYINT(1) DEFAULT 0 AFTER aprobado;
