-- Migración: Permitir audio de presentación por plan
-- Agrega la columna permite_audio a planes para controlar quién puede subir saludo de audio.
-- Sigue el patrón de permite_historias / permite_verificacion.
-- Aplicar: source migrations/permisos_plan_audio.sql (o ejecutar el ALTER manualmente).

SET @done = 0;
SELECT IF(COUNT(*) > 0, @done := 1, @done := 0) AS ya_existe
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'planes'
  AND COLUMN_NAME = 'permite_audio';

-- Aplicar si no existe
SET @sql = IF(@done = 0,
  'ALTER TABLE planes ADD COLUMN permite_audio TINYINT(1) NOT NULL DEFAULT 0 AFTER permite_verificacion',
  'SELECT ''permite_audio ya existe'' AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
