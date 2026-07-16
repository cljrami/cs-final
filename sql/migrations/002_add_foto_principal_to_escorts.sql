-- Agregar columna foto_principal a la tabla escorts
-- Ejecutar: mysql -u kimi_app -p kimi_app < sql/migrations/002_add_foto_principal_to_escorts.sql

ALTER TABLE `escorts` ADD `foto_principal` VARCHAR(255) DEFAULT NULL AFTER `whatsapp`;

-- Poblar desde escort_fotos donde es_portada = 1
UPDATE escorts e
JOIN escort_fotos ef ON ef.escort_id = e.id AND ef.es_portada = 1
SET e.foto_principal = ef.url;

-- Si alguna escort no tiene foto de portada, usar la primera foto pública
UPDATE escorts e
SET e.foto_principal = (
    SELECT ef.url FROM escort_fotos ef
    WHERE ef.escort_id = e.id AND ef.visibilidad = 'publica'
    ORDER BY ef.orden ASC, ef.id ASC
    LIMIT 1
)
WHERE e.foto_principal IS NULL;
