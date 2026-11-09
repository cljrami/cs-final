-- ============================================================
-- MIGRACION DE DOMINIO: kimi.zona8.cl -> consexvip.cl
-- Base de datos: consexvip_app
-- Ejecutar ANTES del build (npm run build) y del deploy.
-- ============================================================

-- 1) URLs publicas (leidas por sitemap.php, escort.php y /api/config/site.php)
UPDATE configuracion SET valor = 'https://www.consexvip.cl/' WHERE clave IN ('seo_url', 'seo_canonical', 'schema_url');

-- 2) Remitente y nombre visible en emails (leidos por api/mail.php y api/admin/email-config.php)
UPDATE configuracion SET valor = 'noresponder@consexvip.cl' WHERE clave IN ('email_from', 'schema_email', 'footer_email_cuenta');
UPDATE configuracion SET valor = 'ConsexVIP - No responder' WHERE clave = 'email_from_name';
UPDATE configuracion SET valor = 'ConsexVIP' WHERE clave IN ('seo_author', 'seo_publisher', 'schema_nombre', 'site_nombre');

-- 3) Imagen Open Graph (debe apuntar a un archivo que exista en /uploads/og/)
-- Reemplazar <ARCHIVO> por el nombre real del archivo subido (ej: current-og.jpg)
UPDATE configuracion SET valor = '/uploads/og/20260804_194736_og_6a7241d8cbb46.webp' WHERE clave = 'og_imagen';

-- 4) Verificacion rapida
SELECT clave, valor FROM configuracion
WHERE clave IN ('seo_url','seo_canonical','schema_url','email_from','email_from_name','seo_author','seo_publisher','og_imagen','schema_email','footer_email_cuenta','site_nombre');
