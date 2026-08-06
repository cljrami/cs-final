-- ============================================
-- REPORTES: vincular al usuario que reportó
-- Permite al admin ver quién reportó y al usuario
-- ver sus propios reportes (sección "Mis Reportes")
-- ============================================

ALTER TABLE `reportes` ADD COLUMN `usuario_id` INT NULL AFTER `reportado_por`;
ALTER TABLE `reportes` ADD INDEX `idx_usuario_id` (`usuario_id`);
