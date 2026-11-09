<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../og_util.php';

/**
 * Configuración SEO del panel admin: metadatos, Open Graph, Schema.org,
 * plantillas por página, sitemap y robots.txt.
 * Guarda en la tabla `configuracion` las claves definidas en $fields.
 */

$fields = [
    // === SEO general ===
    'seo_url'                    => 'URL raíz del sitio (se usa para generar el sitemap, sin barra final)',
    'seo_description'            => 'Meta description del sitio (máx 160 caracteres)',
    'seo_keywords'               => 'Meta keywords separadas por coma',
    'seo_canonical'              => 'URL canónica del sitio',
    'seo_robots'                 => 'Directiva robots por defecto (ej: INDEX, FOLLOW)',
    'seo_author'                 => 'Nombre del autor para SEO',
    'seo_publisher'              => 'Nombre del publisher para SEO',
    'seo_lang'                   => 'Idioma del sitio (ej: es)',

    // === Open Graph / Twitter ===
    'og_imagen'                  => 'URL de la imagen Open Graph por defecto (1200x630 recomendado)',
    'og_type'                    => 'Tipo Open Graph por defecto (ej: website)',
    'twitter_handle'             => 'Handle de Twitter/X (ej: @marca)',
    'og_fb_app_id'               => 'Facebook App ID para Open Graph',

    // === Favicon / Iconos ===
    'site_favicon_svg'           => 'Favicon SVG para navegadores modernos',
    'site_favicon_32'            => 'Favicon PNG 32x32',
    'site_favicon_16'            => 'Favicon PNG 16x16',
    'site_apple_touch'           => 'Apple Touch Icon para iOS',

    // === Schema.org (JSON-LD) ===
    'schema_habilitado'          => 'Habilitar Schema.org (JSON-LD) en el sitio',
    'schema_tipo'                => 'Tipo de Schema (ej: Organization, WebSite)',
    'schema_nombre'              => 'Nombre de la organización para Schema',
    'schema_url'                 => 'URL principal para Schema',
    'schema_logo'                => 'URL del logo para Schema',
    'schema_description'         => 'Descripción de la organización para Schema',
    'schema_sameAs'              => 'Perfiles sociales (JSON, ej: ["https://facebook.com/..."])',
    'schema_email'               => 'Email de contacto para Schema',
    'schema_telefono'            => 'Teléfono de contacto para Schema',
    'schema_localidad'           => 'Localidad para Schema (ej: Santiago)',
    'schema_pais'                => 'País para Schema (ej: CL)',
    'schema_imagen'              => 'URL de imagen de la organización para Schema',

    // === Plantillas SEO por página ===
    'seo_inicio_titulo'          => 'Plantilla del título de inicio',
    'seo_inicio_description'     => 'Plantilla de la descripción de inicio',
    'seo_ciudad_titulo'          => 'Plantilla del título de ciudad (usa {ciudad})',
    'seo_ciudad_description'     => 'Plantilla de la descripción de ciudad (usa {ciudad})',
    'seo_ciudad_keywords'        => 'Keywords de ciudad (usa {ciudad})',
    'seo_escort_titulo'          => 'Plantilla del título del perfil de escort (usa {nombre}, {edad})',
    'seo_escort_description'     => 'Plantilla de la descripción del perfil (usa {nombre}, {ciudad}, {descripcion})',
    'seo_escort_og_titulo'       => 'Plantilla del título Open Graph del perfil (usa {nombre}, {edad})',
    'seo_escort_og_description'  => 'Plantilla de la descripción Open Graph del perfil (usa {nombre}, {ciudad})',
    'seo_blog_titulo'            => 'Plantilla del título de artículo (usa {titulo})',
    'seo_blog_description'       => 'Plantilla de la descripción de artículo',
    'seo_login_titulo'           => 'Título de la página de inicio de sesión',
    'seo_login_description'      => 'Descripción de la página de inicio de sesión',
    'seo_registro_titulo'        => 'Título de la página de registro',
    'seo_registro_description'   => 'Descripción de la página de registro',
    'seo_recuperar_titulo'       => 'Título de la página de recuperar contraseña',
    'seo_recuperar_description'  => 'Descripción de la página de recuperar contraseña',
    'seo_404_titulo'             => 'Título de la página 404',
    'seo_404_description'        => 'Descripción de la página 404',
    'seo_pausado_titulo'         => 'Título de la página de perfil pausado',
    'seo_pausado_description'    => 'Descripción de la página de perfil pausado',

    // === Sitemap ===
    'sitemap_habilitado'         => 'Generar sitemap.xml automático',
    'sitemap_incluir_escorts'    => 'Incluir perfiles de escorts en el sitemap',
    'sitemap_incluir_ciudades'   => 'Incluir páginas de ciudades en el sitemap',
    'sitemap_incluir_paginas'    => 'Incluir páginas estáticas (/login, /ingresar, /unirse)',
    'sitemap_max_escorts'        => 'Máximo de escorts en el sitemap (0 = sin límite)',
    'sitemap_priority_home'      => 'Prioridad de la página de inicio (ej: 1.0)',
    'sitemap_priority_escort'    => 'Prioridad de perfiles de escort (ej: 0.9)',
    'sitemap_priority_ciudad'    => 'Prioridad de páginas de ciudad (ej: 0.8)',
    'sitemap_priority_pagina'    => 'Prioridad de páginas estáticas (ej: 0.5)',
    'sitemap_freq_home'          => 'Frecuencia del inicio (daily)',
    'sitemap_freq_escort'        => 'Frecuencia de escorts (monthly)',
    'sitemap_freq_ciudad'        => 'Frecuencia de ciudades (weekly)',
    'sitemap_freq_pagina'        => 'Frecuencia de páginas estáticas (monthly)',

    // === robots.txt ===
    'robots_habilitado'           => 'Usar robots.txt gestionado desde admin (si no, se sirve robots.txt estático)',
    'robots_contenido'            => 'Contenido del robots.txt (se sirve tal cual, usa URLs completas)',

    // === URLs adicionales del sitemap (una por línea) ===
    'sitemap_urls_extra'          => 'URLs adicionales para el sitemap (una por línea, ej: /contacto)',

    // === Artículos de blog en el sitemap ===
    'sitemap_incluir_articulos'   => 'Incluir artículos de blog publicados en el sitemap',

    // === IndexNow (indexación inmediata) ===
    'indexnow_key'                => 'Clave IndexNow (se publica como {clave}.txt en la raíz y notifica a Google/Bing)',

    // === Verificación de buscadores ===
    'verify_google'               => 'Google Search Console (valor del meta google-site-verification)',
    'verify_bing'                 => 'Bing Webmaster Tools (valor del meta msvalidate.01)',
];

$tipos = [
    'sitemap_habilitado'       => 'bool',
    'sitemap_incluir_escorts'  => 'bool',
    'sitemap_incluir_ciudades' => 'bool',
    'sitemap_incluir_paginas'  => 'bool',
    'sitemap_incluir_articulos' => 'bool',
    'sitemap_max_escorts'      => 'int',
    'robots_habilitado'        => 'bool',
    'schema_habilitado'        => 'bool',
    'schema_sameAs'            => 'json',
    'sitemap_urls_extra'       => 'texto',
    'indexnow_key'             => 'texto',
    'verify_google'            => 'texto',
    'verify_bing'              => 'texto',
];

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $claves = array_keys($fields);
        $placeholders = implode(',', array_fill(0, count($claves), '?'));
        $stmt = $pdo->prepare("SELECT clave, valor, descripcion, tipo FROM configuracion WHERE clave IN ($placeholders)");
        $stmt->execute($claves);
        $config = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($config as $c) {
            $result[$c['clave']] = [
                'valor' => $c['valor'],
                'descripcion' => $c['descripcion'],
                'tipo' => $c['tipo'] ?? ($tipos[$c['clave']] ?? 'string'),
            ];
        }

        echo json_encode(['success' => true, 'seo' => $result]);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $updates = [];

        foreach ($fields as $clave => $descripcion) {
            if (isset($input[$clave])) {
                $tipo = $tipos[$clave] ?? 'string';
                $valor = $input[$clave];

                if ($tipo === 'bool') {
                    $valor = $valor ? '1' : '0';
                } elseif ($tipo === 'int') {
                    $valor = (string)(int)$valor;
                } elseif ($tipo === 'json') {
                    $valor = is_array($valor) ? json_encode($valor, JSON_UNESCAPED_UNICODE) : trim((string)$valor);
                } else {
                    $valor = trim((string)$valor);
                }

                $stmt = $pdo->prepare("SELECT id FROM configuracion WHERE clave = ?");
                $stmt->execute([$clave]);
                if ($stmt->fetchColumn()) {
                    $stmt = $pdo->prepare("UPDATE configuracion SET valor = ?, descripcion = ?, tipo = ? WHERE clave = ?");
                    $stmt->execute([$valor, $descripcion, $tipo, $clave]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES (?, ?, ?, ?)");
                    $stmt->execute([$clave, $valor, $tipo, $descripcion]);
                }
                $updates[] = $clave;
            }
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No hay datos para guardar']);
            exit;
        }

        if (in_array('og_imagen', $updates, true) || in_array('schema_imagen', $updates, true)) {
            refrescarOgActual($pdo);
        }

        // Notificar a Google y motores de búsqueda tras guardar SEO
        try {
            require_once __DIR__ . '/../lib/seo.php';
            // Obtener URL base del sitio
            $stmtUrl = $pdo->prepare("SELECT valor FROM configuracion WHERE clave = 'seo_url'");
            $stmtUrl->execute();
            $seoUrl = rtrim($stmtUrl->fetchColumn() ?: 'https://www.consexvip.cl', '/');
            $sitemapUrl = $seoUrl . '/sitemap.xml';
            // Ping Google sitemap
            @file_get_contents('https://www.google.com/ping?sitemap=' . urlencode($sitemapUrl));
            // IndexNow ping de URLs del sitemap
            $stmtIdx = $pdo->prepare("SELECT valor FROM configuracion WHERE clave = 'indexnow_key'");
            $stmtIdx->execute();
            $indexnowKey = trim((string)$stmtIdx->fetchColumn());
            if ($indexnowKey !== '') {
                // Obtener URLs del sitemap actual
                $xml = @file_get_contents($sitemapUrl);
                if ($xml) {
                    if (preg_match_all('/<loc>(.*?)<\/loc>/i', $xml, $m)) {
                        $urls = array_map('trim', $m[1]);
                        // Filtrar URLs internas
                        $host = parse_url($seoUrl, PHP_URL_HOST);
                        $urls = array_filter($urls, function($u) use ($host) {
                            $h = parse_url($u, PHP_URL_HOST);
                            return $h && $h === $host;
                        });
                        // indexnowPing está definido en lib/seo.php
                        if (function_exists('indexnowPing')) {
                            indexnowPing(array_values($urls), $indexnowKey);
                        }
                    }
                }
            }
        } catch (Throwable $e) {
            error_log('SEO ping error: ' . $e->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Configuración SEO actualizada',
            'actualizados' => $updates,
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error seo.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error seo.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}