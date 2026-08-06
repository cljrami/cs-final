-- Reparación de codificación UTF-8 doblemente codificada en notificaciones
-- Corrige textos como "VerificaciÃ³n" -> "Verificación"
-- Método seguro: REPLACE dirigido, sin conversión global (no genera warnings)
-- Ejecutar en phpMyAdmin sobre la base de datos kimi_app

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
