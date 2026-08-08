-- Migración: Agregar gif_url a escort_fotos
-- Permite almacenar la URL del GIF generado cuando un video se usa como portada
-- Compatibilidad: MySQL 5.7+ / MariaDB 10.2+
-- Fecha: 2026-08-08

SET @column_exists := (
  SELECT COUNT(*) 
  FROM information_schema.columns 
  WHERE table_schema = DATABASE() 
    AND table_name = 'escort_fotos' 
    AND column_name = 'gif_url'
);

SET @sql := IF(@column_exists = 0,
  'ALTER TABLE escort_fotos ADD COLUMN gif_url VARCHAR(255) NULL DEFAULT NULL COMMENT ''URL del GIF generado a partir del video (derivado)'' AFTER tipo',
  'SELECT ''gif_url ya existe'' AS status'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Opcional: índice para búsqueda de GIFs generados
SET @idx_exists := (
  SELECT COUNT(*) 
  FROM information_schema.statistics 
  WHERE table_schema = DATABASE() 
    AND table_name = 'escort_fotos' 
    AND index_name = 'idx_gif_url'
);

SET @sql2 := IF(@idx_exists = 0,
  'CREATE INDEX idx_gif_url ON escort_fotos (gif_url)',
  'SELECT ''idx_gif_url ya existe'' AS status'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
