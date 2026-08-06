-- ============================================================
-- Migración: pausas unificadas (modelo de días activos fijos)
-- ============================================================
-- Reglas:
--   fecha_fin = fecha_aprobacion + duracion_dias + suscripciones.dias_pausados
--   Pausar  → estado='pausada', fecha_pausa = CURDATE() (reloj congelado)
--   Reactivar → dias_pausados += (hoy - fecha_pausa); fecha_fin recalculada
--   Plazo para pausar → solo se puede pausar hasta fecha_primer_pausa + duracion_dias
--                       (calendario real; la 1ª pausa = MIN fecha_accion de historial_pausas).
-- Se elimina el campo sin uso planes.dias_pausa_maximos y la "ventana"
-- de expiración del plan por fecha_primer_pausa.
-- ============================================================

-- 1. Eliminar columna sin uso (solo si existe)
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'planes'
               AND COLUMN_NAME = 'dias_pausa_maximos');
SET @sql := IF(@col > 0,
               'ALTER TABLE `planes` DROP COLUMN `dias_pausa_maximos`',
               'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Recrear la vista v_escort_plan_activo con el modelo unificado
DROP VIEW IF EXISTS `v_escort_plan_activo`;

CREATE VIEW `v_escort_plan_activo` AS
SELECT
  `e`.`id` AS `escort_id`,
  CASE
    WHEN `s`.`id` IS NULL THEN NULL
    WHEN `s`.`estado` = 'pausada' THEN GREATEST(0, DATEDIFF(COALESCE(`s`.`fecha_fin`, CURDATE()), COALESCE(`s`.`fecha_pausa`, CURDATE())))
    WHEN `s`.`estado` = 'activa' THEN GREATEST(0, DATEDIFF(`s`.`fecha_fin`, CURDATE()))
    ELSE 0
  END AS `dias_restantes_calculados`,
  CASE
    WHEN `s`.`estado` = 'activa' AND `s`.`fecha_aprobacion` IS NOT NULL AND `s`.`fecha_fin` >= CURDATE()
         AND COALESCE((SELECT COUNT(0) FROM `historial_pausas` `hp` WHERE `hp`.`suscripcion_id` = `s`.`id` AND `hp`.`accion` = 'pausa'), 0) < `p`.`max_pausas_permitidas`
         AND (
           (SELECT MIN(DATE(`hp`.`fecha_accion`)) FROM `historial_pausas` `hp` WHERE `hp`.`suscripcion_id` = `s`.`id` AND `hp`.`accion` = 'pausa') IS NULL
           OR CURDATE() <= DATE_ADD((SELECT MIN(DATE(`hp`.`fecha_accion`)) FROM `historial_pausas` `hp` WHERE `hp`.`suscripcion_id` = `s`.`id` AND `hp`.`accion` = 'pausa'), INTERVAL `p`.`duracion_dias` DAY)
         )
      THEN 1 ELSE 0
  END AS `puede_pausar`,
  CASE WHEN `s`.`estado` = 'pausada' THEN 1 ELSE 0 END AS `puede_reactivar`,
  CASE
    WHEN `s`.`id` IS NULL THEN 'No tienes un plan activo'
    WHEN `s`.`fecha_aprobacion` IS NULL AND `s`.`fecha_rechazo` IS NULL THEN 'Pendiente de aprobacion por el administrador'
    WHEN `s`.`fecha_rechazo` IS NOT NULL THEN 'Tu solicitud fue rechazada'
    WHEN `s`.`estado` = 'cancelada' THEN 'Tu plan fue cancelado'
    WHEN `s`.`estado` = 'activa' AND `s`.`fecha_fin` < CURDATE() THEN 'Tu plan ha expirado'
    WHEN `s`.`estado` = 'activa'
         AND (SELECT MIN(DATE(`hp`.`fecha_accion`)) FROM `historial_pausas` `hp` WHERE `hp`.`suscripcion_id` = `s`.`id` AND `hp`.`accion` = 'pausa') IS NOT NULL
         AND CURDATE() > DATE_ADD((SELECT MIN(DATE(`hp`.`fecha_accion`)) FROM `historial_pausas` `hp` WHERE `hp`.`suscripcion_id` = `s`.`id` AND `hp`.`accion` = 'pausa'), INTERVAL `p`.`duracion_dias` DAY)
      THEN CONCAT('Tu plazo para usar pausas vencio el ', DATE_FORMAT(DATE_ADD((SELECT MIN(DATE(`hp`.`fecha_accion`)) FROM `historial_pausas` `hp` WHERE `hp`.`suscripcion_id` = `s`.`id` AND `hp`.`accion` = 'pausa'), INTERVAL `p`.`duracion_dias` DAY), '%d/%m/%Y'))
    WHEN `s`.`estado` = 'activa' AND COALESCE((SELECT COUNT(0) FROM `historial_pausas` `hp` WHERE `hp`.`suscripcion_id` = `s`.`id` AND `hp`.`accion` = 'pausa'), 0) >= `p`.`max_pausas_permitidas` THEN CONCAT('Limite de ', `p`.`max_pausas_permitidas`, ' pausas alcanzado')
    WHEN `s`.`estado` = 'pausada' THEN NULL
    ELSE NULL
  END AS `motivo_no_pausar`,
  CASE
    WHEN `s`.`id` IS NOT NULL AND (`s`.`estado` = 'pausada' OR (`s`.`estado` = 'activa' AND `s`.`fecha_fin` >= CURDATE())) THEN 1
    ELSE 0
  END AS `plan_vigente`,
  CASE
    WHEN `s`.`id` IS NULL THEN 'Sin plan'
    WHEN `s`.`fecha_aprobacion` IS NULL AND `s`.`fecha_rechazo` IS NULL THEN 'Pendiente de aprobacion'
    WHEN `s`.`fecha_rechazo` IS NOT NULL THEN 'Rechazada'
    WHEN `s`.`estado` = 'cancelada' THEN 'Cancelada'
    WHEN `s`.`estado` = 'pausada' THEN 'Pausada'
    WHEN `s`.`estado` = 'activa' AND `s`.`fecha_fin` < CURDATE() THEN 'Expirada'
    WHEN `s`.`estado` = 'activa' THEN 'Activa'
    ELSE `s`.`estado`
  END AS `estado_texto`
FROM (`escorts` `e`
LEFT JOIN `suscripciones` `s` ON (`s`.`escort_id` = `e`.`id`)
LEFT JOIN `planes` `p` ON (`p`.`id` = `s`.`plan_id`));
