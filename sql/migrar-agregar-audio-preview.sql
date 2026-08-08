-- Migración: Agregar audio_preview a escorts
-- Almacena la URL del audio de presentación (máx 15s) para cada escort
-- Compatibilidad: MySQL 5.7+ / MariaDB 10.2+
-- Fecha: 2026-08-08

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'escorts'
    AND column_name = 'audio_preview'
);

SET @sql := IF(@column_exists = 0,
  'ALTER TABLE escorts ADD COLUMN audio_preview VARCHAR(255) NULL DEFAULT NULL COMMENT ''Audio de presentacion (max 15s)'' AFTER foto_principal',
  'SELECT ''audio_preview ya existe'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;