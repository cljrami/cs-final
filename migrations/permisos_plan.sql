-- ============================================
-- PERMISOS POR PLAN: permisos extra configurables
-- para que un plan pueda tener historias (24h),
-- solicitud de verificación, pausar aviso y VIP.
-- Nota: permite_vip, permite_destacado, max_pausas_permitidas
-- ya existen; aquí se agregan historias y verificación.
-- date: 2026-08-10
-- ============================================

ALTER TABLE `planes`
  ADD COLUMN `permite_historias` TINYINT(1) NOT NULL DEFAULT 0 AFTER `permite_destacado`,
  ADD COLUMN `permite_verificacion` TINYINT(1) NOT NULL DEFAULT 0 AFTER `permite_historias`;