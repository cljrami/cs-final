-- =============================================================
-- MIGRACIÓN: Corregir esquema de BD (aplicar sobre BD existente)
-- =============================================================
-- Ejecutar con: mysql -u usuario -p nombre_bd < sql/migracion.sql
-- =============================================================

-- 1. ELIMINAR TRIGGER sync_activa_estado (si existe)
DROP TRIGGER IF EXISTS sync_activa_estado;

-- 2. MODIFICAR enum de escorts.estado (quitar en_revision)
ALTER TABLE escorts
  MODIFY COLUMN `estado` enum('pendiente','aprobada','rechazada','pausada','expirada','cancelada','suspendida','eliminada')
  DEFAULT 'pendiente';

-- 3. ELIMINAR columnas redundantes de escorts (con verificación)
SET @db = (SELECT DATABASE());
SET @exists_vip_expira = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND COLUMN_NAME='vip_expira');
SET @exists_pinned = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND COLUMN_NAME='pinned');
SET @exists_plan_id = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND COLUMN_NAME='plan_id');
SET @exists_suscripcion_id = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND COLUMN_NAME='suscripcion_id');
SET @exists_contactos = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND COLUMN_NAME='contactos_recibidos');

SET @sql = '';
SELECT IF(@exists_vip_expira>0, 'ALTER TABLE escorts DROP COLUMN `vip_expira`;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(@exists_pinned>0, 'ALTER TABLE escorts DROP COLUMN `pinned`;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(@exists_plan_id>0, 'ALTER TABLE escorts DROP COLUMN `plan_id`;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(@exists_suscripcion_id>0, 'ALTER TABLE escorts DROP COLUMN `suscripcion_id`;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(@exists_contactos>0, 'ALTER TABLE escorts DROP COLUMN `contactos_recibidos`;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. ELIMINAR índices huérfanos (con verificación)
SET @exists_idx_plan = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND INDEX_NAME='idx_plan');
SET @exists_idx_susc = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND INDEX_NAME='idx_suscripcion');

SELECT IF(@exists_idx_plan>0, 'ALTER TABLE escorts DROP INDEX `idx_plan`;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(@exists_idx_susc>0, 'ALTER TABLE escorts DROP INDEX `idx_suscripcion`;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. AGREGAR columnas de "En Gira" (si no existen)
SET @exists_en_gira = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND COLUMN_NAME='en_gira');
SET @exists_gira_ciudad = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND COLUMN_NAME='gira_ciudad_id');
SET @exists_gira_ini = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND COLUMN_NAME='gira_fecha_inicio');
SET @exists_gira_fin = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='escorts' AND COLUMN_NAME='gira_fecha_fin');

SELECT IF(@exists_en_gira=0, 'ALTER TABLE escorts ADD COLUMN en_gira TINYINT(1) DEFAULT 0 AFTER privacidad;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(@exists_gira_ciudad=0, 'ALTER TABLE escorts ADD COLUMN gira_ciudad_id INT(11) DEFAULT NULL AFTER en_gira;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(@exists_gira_ini=0, 'ALTER TABLE escorts ADD COLUMN gira_fecha_inicio DATE DEFAULT NULL AFTER gira_ciudad_id;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(@exists_gira_fin=0, 'ALTER TABLE escorts ADD COLUMN gira_fecha_fin DATE DEFAULT NULL AFTER gira_fecha_inicio;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. ELIMINAR columna auto_renovar de suscripciones
SET @exists_auto = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='suscripciones' AND COLUMN_NAME='auto_renovar');
SELECT IF(@exists_auto>0, 'ALTER TABLE suscripciones DROP COLUMN `auto_renovar`;', 'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. MODIFICAR enum de escort_vip_solicitudes.estado (quitar en_revision)
ALTER TABLE escort_vip_solicitudes
  MODIFY COLUMN `estado` enum('enviado','aprobado','rechazado')
  DEFAULT 'enviado';

-- 7. ELIMINAR tablas duplicadas de colores (si existen)
DROP TABLE IF EXISTS `colores_ojos`;
DROP TABLE IF EXISTS `colores_pelo`;

-- 8. CORREGIR encoding corrupto en descripciones (suscripciones_historial)
UPDATE suscripciones_historial
  SET plan_nombre = REPLACE(plan_nombre, 'días', 'días')
  WHERE plan_nombre LIKE '%d�as%';

-- 9. AGREGAR FKs de comentarios (si no existen)
SET @has_fk_escort = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='comentarios' AND CONSTRAINT_NAME='fk_comentarios_escort');
SET @has_fk_user = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='comentarios' AND CONSTRAINT_NAME='fk_comentarios_usuario');

SELECT IF(@has_fk_escort=0,
  'ALTER TABLE comentarios ADD CONSTRAINT fk_comentarios_escort FOREIGN KEY (escort_id) REFERENCES escorts(id) ON DELETE CASCADE',
  'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(@has_fk_user=0,
  'ALTER TABLE comentarios ADD CONSTRAINT fk_comentarios_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE',
  'SELECT 1;') INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
