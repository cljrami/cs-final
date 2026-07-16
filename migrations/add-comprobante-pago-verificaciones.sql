ALTER TABLE verificaciones ADD COLUMN comprobante_pago varchar(255) DEFAULT NULL COMMENT 'Comprobante de pago (opcional)' AFTER notas_revision;
