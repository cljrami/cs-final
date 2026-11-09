-- Configuración de plantillas de compartir
INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES
('share_site_name', 'Consexvip', 'string', 'Nombre del sitio a usar en mensajes de compartir'),
('share_whatsapp_template', 'Te recomiendo el perfil de {nombre} en {site_name}', 'string', 'Plantilla de mensaje para compartir por WhatsApp. Usa {nombre} y {site_name}'),
('share_twitter_template', 'Te recomiendo el perfil de {nombre} en {site_name}', 'string', 'Plantilla de mensaje para compartir por X/Twitter. Usa {nombre} y {site_name}'),
('share_telegram_template', 'Te recomiendo el perfil de {nombre} en {site_name}', 'string', 'Plantilla de mensaje para compartir por Telegram. Usa {nombre} y {site_name}')
ON DUPLICATE KEY UPDATE valor = VALUES(valor);
