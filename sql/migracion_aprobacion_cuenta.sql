-- =============================================================
-- Migración: aprobación de cuenta de escort + nuevos tipos de notificación
-- Proyecto Kimi (app-web)
--
-- Ejecutar en phpMyAdmin o mysql CLI contra la base de datos `kimi_app`:
--   mysql -u kimi_app -p kimi_app < sql/migracion_aprobacion_cuenta.sql
--
-- Esta migración es idempotente: puede ejecarse varias veces sin error.
-- =============================================================

-- ----------------------------------------------------------------
-- 1) Agregar columna `aprobada` a la tabla `escorts` (solo si no existe)
-- ----------------------------------------------------------------
SET @existe = 0;
SELECT COUNT(*) INTO @existe
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'escorts'
  AND COLUMN_NAME = 'aprobada';

SET @sql = IF(
  @existe = 0,
  "ALTER TABLE escorts ADD COLUMN aprobada TINYINT(1) NOT NULL DEFAULT 0 AFTER activa",
  "SELECT 1"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Marcar como aprobadas las cuentas que ya estaban en estado 'aprobada'
UPDATE escorts SET aprobada = 1 WHERE estado = 'aprobada' AND aprobada = 0;

-- ----------------------------------------------------------------
-- 2) Extender el ENUM de `tipo` en `notificaciones` con los nuevos tipos
--    (re-declarar la lista completa es seguro y no borra datos existentes)
-- ----------------------------------------------------------------
ALTER TABLE notificaciones MODIFY COLUMN tipo ENUM(
  'vip_aprobado',
  'nueva_valoracion',
  'mensaje_nuevo',
  'escort_online',
  'promocion',
  'sistema',
  'cuenta_aprobada',
  'verificacion_aprobada',
  'verificacion_rechazada',
  'vip_rechazado',
  'fotos_actualizadas',
  'plan_aprobado',
  'plan_rechazado',
  'suscripcion_aprobada',
  'comprobante_aprobado'
) NOT NULL;
