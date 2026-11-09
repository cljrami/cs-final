<?php
/**
 * sitemap.php - Genera el sitemap.xml configurable desde el panel admin.
 */
header('Content-Type: text/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600');

require_once __DIR__ . '/api/bootstrap.php';

// Valores por defecto
$defaults = [
    'seo_url'                   => 'https://www.consexvip.cl',
    'sitemap_habilitado'        => '1',
    'sitemap_incluir_escorts'   => '1',
    'sitemap_incluir_ciudades'  => '1',
    'sitemap_incluir_paginas'   => '1',
    'sitemap_max_escorts'       => '1000',
    'sitemap_priority_home'     => '1.0',
    'sitemap_priority_escort'   => '0.9',
    'sitemap_priority_ciudad'   => '0.8',
    'sitemap_priority_pagina'   => '0.5',
    'sitemap_freq_home'         => 'daily',
    'sitemap_freq_escort'       => 'monthly',
    'sitemap_freq_ciudad'       => 'weekly',
    'sitemap_freq_pagina'       => 'monthly',
    'sitemap_urls_extra'        => '',
];

// Slug consistente con las páginas de ciudad: se genera SIEMPRE del nombre
// (normalizando acentos), NO de la columna slug de la BD, porque esos slugs
// pueden estar dañados (ej. "chill-n" en vez de "chillan") y generar URLs rotas.
function entradaSlug($slug, $nombre): string {
    $mapa = [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
        'ñ' => 'n', 'ü' => 'u', 'Á' => 'a', 'É' => 'e', 'Í' => 'i',
        'Ó' => 'o', 'Ú' => 'u', 'Ñ' => 'n', 'Ü' => 'u',
    ];
    $nombre = strtr((string)$nombre, $mapa);
    $s = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $nombre));
    return trim($s, '-');
}

try {
    $pdo = getDBConnection();

    // Cargar configuración
    $claves = array_keys($defaults);
    $placeholders = implode(',', array_fill(0, count($claves), '?'));
    $stmt = $pdo->prepare("SELECT clave, valor FROM configuracion WHERE clave IN ($placeholders)");
    $stmt->execute($claves);
    $cfg = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    foreach ($defaults as $k => $v) {
        $cfg[$k] = $cfg[$k] ?? $v;
    }

    if ($cfg['sitemap_habilitado'] !== '1') {
        http_response_code(404);
        header('Content-Type: text/plain');
        echo 'Sitemap deshabilitado';
        exit;
    }

    $base = rtrim($cfg['seo_url'], '/');
    if ($base === '') {
        $base = 'https://www.consexvip.cl';
    }

    // Conteo de escorts por página estática
    $incluirEscorts  = $cfg['sitemap_incluir_escorts'] === '1';
    $incluirCiudades = $cfg['sitemap_incluir_ciudades'] === '1';
    $incluirPaginas  = $cfg['sitemap_incluir_paginas'] === '1';
    $incluirArticulos = ($cfg['sitemap_incluir_articulos'] ?? '1') === '1';
    $maxEscorts      = max(0, (int)$cfg['sitemap_max_escorts']);

    // Fecha del sitemap: las páginas estáticas se regeneran en cada build,
    // así que "ahora" es su fecha real de modificación.
    $buildDate = date('Y-m-d');

    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

    // Home
    $xml .= "  <url>\n";
    $xml .= "    <loc>{$base}/</loc>\n";
    $xml .= "    <lastmod>{$buildDate}</lastmod>\n";
    $xml .= "    <changefreq>{$cfg['sitemap_freq_home']}</changefreq>\n";
    $xml .= "    <priority>{$cfg['sitemap_priority_home']}</priority>\n";
    $xml .= "  </url>\n";

    // Páginas estáticas indexables (login/registro NO se indexan: van con noindex)
    // Solo /ciudades y /negocios. /anunciate NO se indexa (landing de banners, no
    // es lo "estrictamente necesario"). /negocios se emite abajo, condicional a
    // que existan negocios, para evitar URLs duplicadas y páginas vacías.
    if ($incluirPaginas) {
        $paginas = ['/ciudades'];
        foreach ($paginas as $p) {
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$base}{$p}</loc>\n";
            $xml .= "    <lastmod>{$buildDate}</lastmod>\n";
            $xml .= "    <changefreq>{$cfg['sitemap_freq_pagina']}</changefreq>\n";
            $xml .= "    <priority>{$cfg['sitemap_priority_pagina']}</priority>\n";
            $xml .= "  </url>\n";
        }
    }

    // Artículos de blog publicados
    if ($incluirArticulos) {
        try {
            $stmtArt = $pdo->query("
                SELECT slug, published_at, updated_at FROM articulos
                WHERE estado = 'publicado' AND (published_at IS NULL OR published_at <= NOW())
                  AND (robots IS NULL OR robots <> 'noindex')
                ORDER BY published_at DESC LIMIT 500
            ");
            foreach ($stmtArt->fetchAll() as $a) {
                $slug = trim((string)($a['slug'] ?? ''));
                if ($slug === '') continue;
                $lastmod = !empty($a['updated_at'])
                    ? date('Y-m-d', strtotime($a['updated_at']))
                    : (!empty($a['published_at']) ? date('Y-m-d', strtotime($a['published_at'])) : $buildDate);
                $xml .= "  <url>\n";
                $xml .= "    <loc>{$base}/blog/" . rawurlencode($slug) . "</loc>\n";
                $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
                $xml .= "    <changefreq>weekly</changefreq>\n";
                $xml .= "    <priority>0.7</priority>\n";
                $xml .= "  </url>\n";
            }
        } catch (Throwable $e) {
            // sin artículos: se omite el bloque
        }
    }

    // Ciudades
    if ($incluirCiudades) {
        $stmtCiudades = $pdo->query("SELECT * FROM ciudades WHERE activa = 1 ORDER BY nombre ASC");
        foreach ($stmtCiudades->fetchAll() as $c) {
            $slug = entradaSlug($c['slug'] ?? '', $c['nombre'] ?? '');
            if ($slug === '') continue;
            // Las páginas de ciudad son estáticas y se regeneran en cada build:
            // la fecha real de modificación es la del build (updated_at de la BD
            // no cambia cuando se edita un texto SEO).
            $lastmod = $buildDate;
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$base}/escorts-{$slug}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "    <changefreq>{$cfg['sitemap_freq_ciudad']}</changefreq>\n";
            $xml .= "    <priority>{$cfg['sitemap_priority_ciudad']}</priority>\n";
            $xml .= "  </url>\n";
        }
    }

    // Directorio de negocios (listado + fichas)
    try {
        $stmtNeg = $pdo->query("SELECT slug, actualizado_en FROM negocios WHERE activo = 1 ORDER BY destacado DESC, nombre ASC");
        $negocios = $stmtNeg->fetchAll();
        if ($negocios) {
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$base}/negocios</loc>\n";
            $xml .= "    <changefreq>weekly</changefreq>\n";
            $xml .= "    <priority>0.7</priority>\n";
            $xml .= "  </url>\n";
            foreach ($negocios as $neg) {
                $lastmod = !empty($neg['actualizado_en']) ? date('Y-m-d', strtotime($neg['actualizado_en'])) : date('Y-m-d');
                $xml .= "  <url>\n";
                $xml .= "    <loc>{$base}/negocios/" . $neg['slug'] . "</loc>\n";
                $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
                $xml .= "    <changefreq>monthly</changefreq>\n";
                $xml .= "    <priority>0.6</priority>\n";
                $xml .= "  </url>\n";
            }
        }
    } catch (Throwable $e) {
        // sin negocios: se omite el bloque
    }

    // Escorts
    if ($incluirEscorts) {
        $limitSql = $maxEscorts > 0 ? "LIMIT " . (int)$maxEscorts : '';

        // Verificar columnas disponibles para evitar errores en distintos esquemas
        $hasUpdated = null;
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM escorts LIKE 'updated_at'")->fetch();
            $hasUpdated = $cols !== false;
        } catch (Throwable $e) {
            $hasUpdated = true; // asumir que existe
        }

        $selectEsc = $hasUpdated ? "id, updated_at" : "id";

        $stmtEscorts = $pdo->query("
            SELECT $selectEsc
            FROM escorts
            WHERE activa = 1 AND estado = 'aprobada'
              AND EXISTS (
                  SELECT 1 FROM suscripciones s
                  JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL
                  WHERE s.escort_id = escorts.id
                    AND s.fecha_aprobacion IS NOT NULL
                    AND s.estado = 'activa' AND s.fecha_fin >= CURDATE()
              )
            ORDER BY visitas_perfil DESC
            $limitSql
        ");
        foreach ($stmtEscorts->fetchAll() as $e) {
            $lastmod = isset($e['updated_at']) && $e['updated_at'] ? date('Y-m-d', strtotime($e['updated_at'])) : date('Y-m-d');
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$base}/{$e['id']}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "    <changefreq>{$cfg['sitemap_freq_escort']}</changefreq>\n";
            $xml .= "    <priority>{$cfg['sitemap_priority_escort']}</priority>\n";
            $xml .= "  </url>\n";
        }
    }

    // URLs extra (una por línea)
    $extra = trim($cfg['sitemap_urls_extra']);
    if ($extra !== '') {
        foreach (preg_split('/\r\n|\r|\n/', $extra) as $line) {
            $line = trim($line);
            if ($line === '') continue;
            if (str_starts_with($line, 'http')) {
                $loc = $line;
            } elseif (str_starts_with($line, '/')) {
                $loc = $base . $line;
            } else {
                $loc = $base . '/' . $line;
            }
            $xml .= "  <url>\n";
            $xml .= "    <loc>" . htmlspecialchars($loc, ENT_XML1, 'UTF-8') . "</loc>\n";
            $xml .= "    <changefreq>{$cfg['sitemap_freq_pagina']}</changefreq>\n";
            $xml .= "    <priority>{$cfg['sitemap_priority_pagina']}</priority>\n";
            $xml .= "  </url>\n";
        }
    }

    $xml .= '</urlset>';

    echo $xml;
} catch (Throwable $e) {
    error_log("Error sitemap.php: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}