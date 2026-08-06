ALTER TABLE escorts ADD COLUMN contactos_whatsapp INT DEFAULT 0 AFTER visitas_perfil;
ALTER TABLE escorts ADD COLUMN contactos_llamar INT DEFAULT 0 AFTER contactos_whatsapp;
ALTER TABLE estadisticas_diarias ADD COLUMN contactos_whatsapp INT DEFAULT 0 AFTER contactos;
ALTER TABLE estadisticas_diarias ADD COLUMN contactos_llamar INT DEFAULT 0 AFTER contactos_whatsapp;
