<?php
// public/escort.php - Perfil de escort con UI premium

ini_set('display_errors', 0);
error_reporting(E_ALL);

// === DEBUG (descomentar para probar) ===
// header('Content-Type: text/plain');
// echo "ID: " . ($_GET['id'] ?? 'NO') . "\n";
// echo "URI: " . $_SERVER['REQUEST_URI'] . "\n";
// exit;

try {
    require_once __DIR__ . '/api/bootstrap.php';
    require_once __DIR__ . '/api/lib/gira.php';

    $pdo = getDBConnection();
    limpiar_gira_vencida($pdo);

    // Configuración del sitio (textos/SEO editables desde "Contenido del sitio")
    $cfg = [];
    try {
        $cStmt = $pdo->query("SELECT clave, valor FROM configuracion");
        foreach ($cStmt->fetchAll(PDO::FETCH_KEY_PAIR) as $k => $v) {
            $cfg[$k] = $v;
        }
    } catch (Throwable $e) {}

    // Textos del navbar administrables (nav_*) con fallback a los actuales
    $nav = [
        'logo1'    => $cfg['nav_logo_1'] ?? 'CS',
        'logo2'    => $cfg['nav_logo_2'] ?? 'Escorts',
        'inicio'   => $cfg['nav_inicio'] ?? 'Inicio',
        'ciudades' => $cfg['nav_ciudades'] ?? 'Ciudades',
        'ingresar' => $cfg['nav_ingresar'] ?? 'Ingresar',
        'publicar' => $cfg['nav_publicar'] ?? 'Publicar',
        'entrar_usuario'     => $cfg['nav_entrar_usuario'] ?? 'Entrar como Usuario',
        'entrar_usuario_desc' => $cfg['nav_entrar_usuario_desc'] ?? 'Guarda favoritos, valora',
        'entrar_escort'       => $cfg['nav_entrar_escort'] ?? 'Entrar como Escort',
        'entrar_escort_desc'  => $cfg['nav_entrar_escort_desc'] ?? 'Administra tu perfil',
        'mi_panel'     => $cfg['nav_mi_panel'] ?? 'Mi Panel',
        'mi_cuenta'    => $cfg['nav_mi_cuenta'] ?? 'Mi Cuenta',
        'mis_favoritos' => $cfg['nav_mis_favoritos'] ?? 'Mis Favoritos',
        'mi_perfil'    => $cfg['nav_mi_perfil'] ?? 'Mi Perfil',
        'cerrar_sesion' => $cfg['nav_cerrar_sesion'] ?? 'Cerrar sesión',
    ];
    $navJS = json_encode($nav, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

    $escortCssV = @filemtime(__DIR__ . '/_astro/escort-profile.css');
    if (!$escortCssV) { $escortCssV = time(); }

    // Leer ID
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($id <= 0) {
        $uri = $_SERVER['REQUEST_URI'];
        if (preg_match('/\/(\d+)\/?$/', $uri, $matches)) {
            $id = intval($matches[1]);
        }
    }

    if ($id <= 0) {
        showNotFound('ID inválido');
        exit;
    }

    // Buscar escort (sin filtro de activa primero, para saber si existe)
    $stmt = $pdo->prepare("
        SELECT e.*, c.nombre as categoria_nombre, gc.nombre AS gira_ciudad,
               " . gira_activa() . " as gira_activa
        FROM escorts e
        LEFT JOIN categorias c ON e.categoria_id = c.id
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE e.id = ? LIMIT 1
    ");
    $stmt->execute([$id]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    // Si no existe
    if (!$escort) {
        showNotFound('Esta escort no existe en nuestro sistema');
        exit;
    }

    // Ciudad efectiva (en gira) — para recomendaciones
    $ciudadEfectiva = ($escort['gira_activa'] == 1 && !empty($escort['gira_ciudad'])) ? $escort['gira_ciudad'] : ($escort['ciudad'] ?? '');

    // Si existe pero no está activa o su último plan base está pausado
    $subEstado = $pdo->prepare("SELECT COALESCE(s.estado,'') FROM suscripciones s JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL WHERE s.escort_id = ? ORDER BY s.id DESC LIMIT 1");
    $subEstado->execute([$id]);
    $ultimoEstadoSub = $subEstado->fetchColumn();

    if ($escort['activa'] != 1 || $ultimoEstadoSub === 'pausada') {
        showNotAvailable($escort);
        exit;
    }

    // === Registrar visita (con dedup por cookie para evitar inflar con recargas) ===
    $cookieName = 'visited_' . $id;
    $esNuevaVisita = empty($_COOKIE[$cookieName]);
    try {
        if ($esNuevaVisita) {
            $updateVisita = $pdo->prepare("UPDATE escorts SET visitas_perfil = visitas_perfil + 1 WHERE id = ?");
            $updateVisita->execute([$id]);
            $pdo->prepare("INSERT INTO estadisticas_diarias (escort_id, fecha, visitas) VALUES (?, CURDATE(), 1) ON DUPLICATE KEY UPDATE visitas = visitas + 1")->execute([$id]);
            setcookie($cookieName, '1', time() + 21600, '/', '', false, true);
        }
    } catch (Exception $e) {
        // No crítico
    }

    // === ESCORT ACTIVA - Cargar datos completos ===

    // Fotos
    $stmtFotos = $pdo->prepare("
        SELECT url FROM escort_fotos 
        WHERE escort_id = ? AND (visibilidad = 'publica' OR visibilidad IS NULL)
        ORDER BY es_portada DESC, orden ASC, created_at ASC
    ");
    $stmtFotos->execute([$id]);
    $fotos = $stmtFotos->fetchAll(PDO::FETCH_COLUMN);

    // Si no hay foto_principal, usar la primera foto de la galería (portada)
    if (empty($escort['foto_principal']) && !empty($fotos)) {
        $escort['foto_principal'] = $fotos[0];
    }

    // Incluir foto_principal al inicio de la galería si no está ya
    if (!empty($escort['foto_principal']) && !in_array($escort['foto_principal'], $fotos)) {
        array_unshift($fotos, $escort['foto_principal']);
    }

    // Servicios incluidos
    $serviciosIncluidos = [];
    try {
        $stmt = $pdo->prepare("
            SELECT s.nombre FROM servicios s 
            JOIN escort_servicios es ON s.id = es.servicio_id 
            WHERE es.escort_id = ? AND es.incluido = 1
        ");
        $stmt->execute([$id]);
        $serviciosIncluidos = $stmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (PDOException $e) {
    }

    // Servicios adicionales
    $serviciosAdicionales = [];
    try {
        $stmt = $pdo->prepare("
            SELECT s.nombre FROM servicios s 
            JOIN escort_servicios es ON s.id = es.servicio_id 
            WHERE es.escort_id = ? AND es.incluido = 0
        ");
        $stmt->execute([$id]);
        $serviciosAdicionales = $stmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (PDOException $e) {
    }

    // Idiomas
    $idiomas = [];
    try {
        $stmt = $pdo->prepare("
            SELECT i.nombre FROM idiomas i
            JOIN escort_idiomas ei ON i.id = ei.idioma_id
            WHERE ei.escort_id = ?
        ");
        $stmt->execute([$id]);
        $idiomas = $stmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (PDOException $e) {
    }

    // Privacidad: campos que el usuario NO quiere mostrar
    $ocultos = [];
    if (!empty($escort['privacidad'])) {
        $decoded = json_decode($escort['privacidad'], true);
        if (is_array($decoded)) $ocultos = $decoded;
    }

    // Atributos (label => valor) - solo los que existen y no están ocultos
    $atributos = [];
    if (!empty($escort['edad']))         $atributos[] = ['icon' => 'fa-birthday-cake', 'label' => 'Edad',        'valor' => $escort['edad'] . ' años'];
    if (!empty($escort['altura']))       $atributos[] = ['icon' => 'fa-ruler-vertical','label' => 'Altura',      'valor' => $escort['altura'] . ' cm'];
    if (!empty($escort['peso']))         $atributos[] = ['icon' => 'fa-weight-scale',  'label' => 'Peso',        'valor' => $escort['peso'] . ' kg'];
    if (!empty($escort['medidas']) && !in_array('medidas', $ocultos))      $atributos[] = ['icon' => 'fa-vector-square',  'label' => 'Medidas',     'valor' => $escort['medidas']];
    if (!empty($escort['nacionalidad']) && !in_array('nacionalidad', $ocultos)) $atributos[] = ['icon' => 'fa-flag',           'label' => 'Nacionalidad','valor' => $escort['nacionalidad']];
    if (!empty($escort['etnia']) && !in_array('etnia', $ocultos))        $atributos[] = ['icon' => 'fa-user',           'label' => 'Etnia',       'valor' => $escort['etnia']];
    if (!empty($escort['color_pelo']))   $atributos[] = ['icon' => 'fa-scissors',       'label' => 'Color de pelo','valor' => $escort['color_pelo']];
    if (!empty($escort['color_ojos']))   $atributos[] = ['icon' => 'fa-eye',            'label' => 'Color de ojos','valor' => $escort['color_ojos']];
    if (!empty($escort['orientacion']) && !in_array('orientacion', $ocultos))  $atributos[] = ['icon' => 'fa-heart',          'label' => 'Orientación',  'valor' => $escort['orientacion']];
    if (!empty($escort['estilo']))       $atributos[] = ['icon' => 'fa-star',           'label' => 'Estilo',       'valor' => $escort['estilo']];
    if (!empty($ciudadEfectiva))          $atributos[] = ['icon' => 'fa-map-marker-alt', 'label' => 'Ciudad',       'valor' => $ciudadEfectiva];
    if (!empty($idiomas))                $atributos[] = ['icon' => 'fa-language',        'label' => 'Idiomas',      'valor' => implode(', ', $idiomas)];

    // Tarifas (desde planes_precios si existe)
    $tarifas = [];
    try {
        $stmtTarifas = $pdo->prepare("
            SELECT pp.duracion, pp.precio FROM planes_precios pp
            JOIN planes p ON p.id = pp.plan_id
            WHERE p.id = ? AND pp.activo = 1
            ORDER BY pp.duracion ASC
        ");
        $stmtTarifas->execute([$escort['plan_id']]);
        while ($row = $stmtTarifas->fetch(PDO::FETCH_ASSOC)) {
            $tarifas[$row['duracion']] = (int)$row['precio'];
        }
    } catch (Throwable $e) {
        $tarifas = [];
    }
    // Fallback: si no hay tarifas en planes_precios y la columna existe en escorts
    if (empty($tarifas)) {
        if (!empty($escort['tarifa_30min'])) $tarifas['30min'] = (int)$escort['tarifa_30min'];
        if (!empty($escort['tarifa_1h'])) $tarifas['1h'] = (int)$escort['tarifa_1h'];
        if (!empty($escort['tarifa_2h'])) $tarifas['2h'] = (int)$escort['tarifa_2h'];
        if (!empty($escort['tarifa_noche'])) $tarifas['noche'] = (int)$escort['tarifa_noche'];
    }

    // Teléfono formateado
    $telefonoFormateado = '';
    if ($escort['telefono']) {
        $cleaned = preg_replace('/\D/', '', $escort['telefono']);
        if (strlen($cleaned) == 11 && strpos($cleaned, '56') === 0) {
            $telefonoFormateado = '+' . substr($cleaned, 0, 2) . ' ' . substr($cleaned, 2, 1) . ' ' . substr($cleaned, 3, 4) . ' ' . substr($cleaned, 7);
        } else {
            $telefonoFormateado = $escort['telefono'];
        }
    }

    // WhatsApp
    $waLink = '';
    if ($escort['telefono']) {
        $waNum = preg_replace('/\D/', '', $escort['telefono']);
        $waNum = strpos($waNum, '56') === 0 ? $waNum : '56' . $waNum;
        $msg = urlencode("Hola {$escort['nombre']}!, vi tu perfil en Kimi y me gustaría contactarte.");
        $waLink = 'https://wa.me/' . $waNum . '?text=' . $msg;
    }

    // Likes
    $likes = 0;
    try {
        $likesStmt = $pdo->prepare("SELECT COUNT(*) FROM favoritos WHERE escort_id = ?");
        $likesStmt->execute([$id]);
        $likes = (int)$likesStmt->fetchColumn();
    } catch (Throwable $e) {
        $likes = 0;
    }

    // Rating real desde comentarios (aprobados)
    $ratingReal = 0;
    $totalValoraciones = 0;
    try {
        $stmtRating = $pdo->prepare("
            SELECT AVG(puntuacion) as promedio, COUNT(*) as total
            FROM comentarios
            WHERE escort_id = ? AND aprobado = 1
        ");
        $stmtRating->execute([$id]);
        $r = $stmtRating->fetch(PDO::FETCH_ASSOC);
        if ($r) {
            $ratingReal = $r['promedio'] ? (float)$r['promedio'] : 0;
            $totalValoraciones = $r['total'] ? (int)$r['total'] : 0;
        }
    } catch (Throwable $e) {
        $ratingReal = 0;
        $totalValoraciones = 0;
    }
} catch (Throwable $e) {
    error_log("Error escort.php: " . $e->getMessage());
    showNotFound('Error del servidor');
    exit;
}

function e($str)
{
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

// Slug amigable de ciudad (consistente con sitemap.php y /escorts-{slug})
function entradaSlug($nombre)
{
    $mapa = [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
        'ñ' => 'n', 'ü' => 'u', 'Á' => 'a', 'É' => 'e', 'Í' => 'i',
        'Ó' => 'o', 'Ú' => 'u', 'Ñ' => 'n', 'Ü' => 'u',
    ];
    $nombre = strtr((string) $nombre, $mapa);
    $s = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $nombre));
    return trim($s, '-');
}

// === PÍGINA: Escort no encontrada ===
function showNotFound($mensaje = 'Escort no encontrada')
{
?>
    <!DOCTYPE html>
    <html lang="es">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>No encontrada - CSEscorts</title>
        <link rel="stylesheet" href="/_astro/escort-profile.css?v=<?= $escortCssV ?>">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * {
                font-family: 'Inter', sans-serif
            }

            body {
                background: var(--color-page);
            color: var(--color-ink)
            }
        </style>
    </head>

    <body class="min-h-screen flex items-center justify-center">
        <div class="text-center px-4">
            <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <i class="fas fa-search text-red-500 text-3xl"></i>
            </div>
            <h1 class="text-2xl font-bold text-ink mb-2">No encontrada</h1>
            <p class="text-muted mb-8 max-w-md mx-auto"><?= e($mensaje) ?></p>
            <a href="/" class="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all">
                <i class="fas fa-arrow-left"></i> Volver al inicio
            </a>
            <div class="mt-8 flex justify-center gap-4 text-sm text-muted">
                <a href="/" class="hover:text-red-400 transition-colors"><?= htmlspecialchars($nav['inicio'], ENT_QUOTES, 'UTF-8') ?></a>
                <span>â€¢</span>
                <a href="#" class="hover:text-red-400 transition-colors"><?= htmlspecialchars($nav['ciudades'], ENT_QUOTES, 'UTF-8') ?></a>
                <span>â€¢</span>
                <a href="/panel" class="hover:text-red-400 transition-colors">Panel Escort</a>
            </div>
        </div>
    </body>

    </html>
<?php
}

// === PÍGINA: Escort no disponible (existe pero inactiva) ===
function showNotAvailable($escort)
{
?>
    <!DOCTYPE html>
    <html lang="es">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>No disponible - <?= e($escort['nombre']) ?> - CSEscorts</title>
        <link rel="stylesheet" href="/_astro/escort-profile.css?v=<?= $escortCssV ?>">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * {
                font-family: 'Inter', sans-serif
            }

            body {
                background: var(--color-page);
            color: var(--color-ink)
            }
        </style>
    </head>

    <body class="min-h-screen flex items-center justify-center">
        <div class="text-center px-4 max-w-lg mx-auto">
            <!-- Avatar borroso/gris -->
            <div class="relative w-32 h-32 mx-auto mb-6">
                <div class="w-full h-full rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-gray-600">
                    <?php if ($escort['foto_principal']): ?>
                        <img src="<?= e($escort['foto_principal']) ?>" alt="" class="w-full h-full object-cover opacity-30 grayscale">
                    <?php else: ?>
                        <i class="fas fa-user text-muted text-4xl"></i>
                    <?php endif; ?>
                </div>
                <div class="absolute -bottom-2 -right-2 w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center border-2 border-page">
                    <i class="fas fa-clock text-muted text-xs"></i>
                </div>
            </div>

            <h1 class="text-2xl font-bold text-ink mb-1"><?= e($escort['nombre']) ?></h1>
            <p class="text-muted text-sm mb-6"><?= $escort['edad'] ?> años â€¢ <?= e($ciudadEfectiva) ?></p>

            <div class="bg-surface border border-white/10 rounded-xl p-6 mb-8">
                <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <i class="fas fa-pause-circle text-yellow-500 text-2xl"></i>
                </div>
                <h2 class="text-lg font-semibold text-ink mb-2">Perfil temporalmente no disponible</h2>
                <p class="text-muted text-sm">
                    Esta escort ha pausado su perfil o está siendo revisado por nuestro equipo.
                    Vuelve a intentarlo más tarde o explora otros perfiles disponibles.
                </p>
            </div>

            <div class="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="/" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all">
                    <i class="fas fa-fire"></i> Ver escorts activas
                </a>
                <a href="/" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-surface hover:bg-surface2 text-ink border border-white/10 rounded-lg font-medium transition-all">
                    <i class="fas fa-arrow-left"></i> Volver al inicio
                </a>
            </div>

            <div class="mt-8 flex justify-center gap-4 text-sm text-muted">
                <a href="/" class="hover:text-red-400 transition-colors"><?= htmlspecialchars($nav['inicio'], ENT_QUOTES, 'UTF-8') ?></a>
                <span>â€¢</span>
                <a href="#" class="hover:text-red-400 transition-colors"><?= htmlspecialchars($nav['ciudades'], ENT_QUOTES, 'UTF-8') ?></a>
                <span>â€¢</span>
                <a href="/panel" class="hover:text-red-400 transition-colors"><?= htmlspecialchars($nav['publicar'], ENT_QUOTES, 'UTF-8') ?></a>
            </div>
        </div>
    </body>

    </html>
<?php
}
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script>
        (function () {
            var t, m;
            try { t = localStorage.getItem('theme'); } catch (e) {}
            if (t === 'light' || t === 'dark') {
                document.documentElement.dataset.theme = t;
            } else {
                document.documentElement.dataset.theme = 'dark';
            }
        })();
    </script>
    <?php
    // === SEO configurable (Contenido del sitio) ===
    $baseURL = rtrim($cfg['seo_url'] ?? 'https://kimi.zona8.cl/', '/');
    $siteNombreSEO = $cfg['site_nombre'] ?? 'CSEscorts';
    $descCortaSEO = trim($escort['descripcion_corta'] ?? '');
    if ($descCortaSEO === '') {
        $descCortaSEO = trim(mb_substr(strip_tags($escort['descripcion_larga'] ?? ''), 0, 160));
    }
    $varsSEO = [
        'nombre' => $escort['nombre'],
        'edad' => $escort['edad'],
        'ciudad' => $ciudadEfectiva,
        'descripcion' => $descCortaSEO,
        'site_nombre' => $siteNombreSEO,
    ];
    function seoTpl($tpl, $vars) {
        $out = preg_replace_callback('/\{(\w+)\}/', function ($m) use ($vars) {
            return isset($vars[$m[1]]) && $vars[$m[1]] !== '' ? $vars[$m[1]] : $m[0];
        }, $tpl);
        return strpos($out, '{') === false ? $out : '';
    }
    $seoEscortTitulo = seoTpl($cfg['seo_escort_titulo'] ?? '{nombre}, {edad} años | CSEscorts', $varsSEO);
    $seoEscortDesc = seoTpl($cfg['seo_escort_description'] ?? 'Perfil de {nombre} en {ciudad}. {descripcion}', $varsSEO);
    $seoEscortOgTitulo = seoTpl($cfg['seo_escort_og_titulo'] ?? '{nombre}, {edad} años - CSEscorts', $varsSEO);
    $seoEscortOgDesc = seoTpl($cfg['seo_escort_og_description'] ?? 'Perfil verificado de {nombre} en {ciudad}', $varsSEO);
    if ($seoEscortTitulo === '') $seoEscortTitulo = $escort['nombre'] . ', ' . $escort['edad'] . ' años | ' . $siteNombreSEO;
    if ($seoEscortDesc === '') $seoEscortDesc = $descCortaSEO !== '' ? $descCortaSEO : ('Perfil de ' . $escort['nombre'] . ' en ' . $ciudadEfectiva);
    if ($seoEscortOgTitulo === '') $seoEscortOgTitulo = $escort['nombre'] . ', ' . $escort['edad'] . ' años - ' . $siteNombreSEO;
    if ($seoEscortOgDesc === '') $seoEscortOgDesc = $descCortaSEO !== '' ? $descCortaSEO : ('Perfil verificado de ' . $escort['nombre'] . ' en ' . $ciudadEfectiva);

    $ogImage = '';
    if (!empty($escort['foto_principal'])) {
        $fp = $escort['foto_principal'];
        $ogImage = strpos($fp, 'http') === 0 ? $fp : $baseURL . $fp;
    }
    if ($ogImage === '' && !empty($cfg['og_imagen'])) $ogImage = $cfg['og_imagen'];
    $schemaHabilitadoEscort = ($cfg['schema_habilitado'] ?? '1') != '0';
    ?>
    <title><?= e($seoEscortTitulo) ?></title>
    <meta name="description" content="<?= e($seoEscortDesc) ?>">
    <link rel="canonical" href="<?= $baseURL ?>/<?= $id ?>">
    <meta property="og:title" content="<?= e($seoEscortOgTitulo) ?>">
    <meta property="og:description" content="<?= e($seoEscortOgDesc) ?>">
    <?php if ($ogImage): ?>
    <meta property="og:image" content="<?= e($ogImage) ?>">
    <?php endif; ?>
    <meta property="og:url" content="<?= $baseURL ?>/<?= $id ?>">
    <meta property="og:type" content="profile">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?= e($seoEscortOgTitulo) ?>">
    <meta name="twitter:description" content="<?= e($seoEscortOgDesc) ?>">
    <?php if ($ogImage): ?>
    <meta name="twitter:image" content="<?= e($ogImage) ?>">
    <?php endif; ?>

    <link rel="stylesheet" href="/_astro/escort-profile.css?v=<?= $escortCssV ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@14/swiper-bundle.min.css">
    <?php if ($schemaHabilitadoEscort): ?>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "<?= e($escort['nombre']) ?>",
        "description": "<?= e($descCortaSEO !== '' ? $descCortaSEO : ('Perfil de ' . $escort['nombre'])) ?>",
        "url": "<?= $baseURL ?>/<?= $id ?>",
        "image": "<?= e($ogImage) ?>",
        "gender": "female",
        "nationality": "<?= e($escort['nacionalidad'] ?? '') ?>"
        <?php if (!empty($ciudadEfectiva)): ?>
        ,"address": { "@type": "PostalAddress", "addressLocality": "<?= e($ciudadEfectiva) ?>" }
        <?php endif; ?>
    }
    </script>
    <?php if (!empty($cfg['schema_nombre'])): ?>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "<?= e($cfg['schema_tipo'] ?? 'Organization') ?>",
        "name": "<?= e($cfg['schema_nombre']) ?>",
        "url": "<?= e($cfg['schema_url'] ?? $baseURL) ?>"
        <?php if (!empty($cfg['schema_description'])): ?>
        ,"description": "<?= e($cfg['schema_description']) ?>"
        <?php endif; ?>
        <?php if (!empty($cfg['schema_logo'])): ?>
        ,"logo": "<?= e($cfg['schema_logo']) ?>"
        <?php endif; ?>
        <?php if (!empty($cfg['schema_email'])): ?>
        ,"email": "<?= e($cfg['schema_email']) ?>"
        <?php endif; ?>
        <?php if (!empty($cfg['schema_telefono'])): ?>
        ,"telephone": "<?= e($cfg['schema_telefono']) ?>"
        <?php endif; ?>
        <?php if (!empty($cfg['schema_localidad']) || !empty($cfg['schema_pais'])): ?>
        ,"address": { "@type": "PostalAddress"<?= !empty($cfg['schema_localidad']) ? ', "addressLocality": "' . e($cfg['schema_localidad']) . '"' : '' ?><?= !empty($cfg['schema_pais']) ? ', "addressCountry": "' . e($cfg['schema_pais']) . '"' : '' ?> }
        <?php endif; ?>
    }
    </script>
    <?php endif; ?>
    <?php endif; ?>

    <style>
        * {
            font-family: 'Inter', system-ui, sans-serif
        }

        body {
            background: var(--color-page);
            color: var(--color-ink)
        }

        html, body {
            overflow-x: hidden;
        }

        .btn-red {
            background: #ef4444;
            transition: all .2s
        }

        .btn-red:hover {
            background: #dc2626
        }

        .btn-green {
            background: #22c55e;
            transition: all .2s
        }

        .btn-green:hover {
            background: #16a34a
        }

        .badge-red {
            background: #ef4444;
            color: #fff
        }

        .badge-red-outline {
            background: rgba(239, 68, 68, .2);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, .3)
        }

        .gallery-item {
            position: relative;
            overflow: hidden;
            border-radius: .5rem;
            cursor: zoom-in
        }

        .gallery-item img {
            transition: transform .3s
        }

        .gallery-item:hover img {
            transform: scale(1.05)
        }

        .play-badge {
            width: 2.75rem;
            height: 2.75rem;
            border-radius: 9999px;
            background: rgba(0, 0, 0, .6);
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px)
        }

        .play-badge i {
            color: #fff;
            font-size: 1.125rem;
            margin-left: 2px
        }

        ::-webkit-scrollbar {
            width: 8px
        }

        ::-webkit-scrollbar-track {
            background: var(--color-page)
        }

        ::-webkit-scrollbar-thumb {
            background: #2d2d44;
            border-radius: 4px
        }

        .fancybox__container {
            --fancybox-bg: rgba(15, 15, 26, .95)
        }

        .toast {
            animation: slideIn 0.3s ease-out forwards;
        }
        .toast.hiding {
            animation: slideOut 0.3s ease-in forwards;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    </style>
</head>

<body class="min-h-screen">

    <!-- NAVBAR -->
    <nav class="fixed top-0 left-0 right-0 z-50 bg-page/95 backdrop-blur-sm border-b border-white/5">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <!-- Logo -->
                <a href="/" class="flex items-center gap-1 shrink-0">
                    <span class="text-red-500 font-bold text-xl"><?= htmlspecialchars($nav['logo1'], ENT_QUOTES, 'UTF-8') ?></span>
                    <span class="text-ink font-semibold text-xl"><?= htmlspecialchars($nav['logo2'], ENT_QUOTES, 'UTF-8') ?></span>
                </a>

                <!-- Desktop Navigation -->
                <div class="hidden md:flex items-center gap-2">
                    <a href="/" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <i class="fas fa-home"></i> <?= htmlspecialchars($nav['inicio'], ENT_QUOTES, 'UTF-8') ?>
                    </a>
                    <button id="btn-ciudades" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5 transition-all">
                        <i class="fas fa-map-marker-alt"></i> <?= htmlspecialchars($nav['ciudades'], ENT_QUOTES, 'UTF-8') ?>
                    </button>
                </div>

                <!-- Desktop Actions (filled by JS from localStorage) -->
                <div class="hidden md:flex items-center gap-3">
                    <button id="theme-toggle" aria-label="Cambiar tema" class="p-2 rounded-lg text-muted hover:text-ink hover:bg-white/5 transition-all shrink-0">
                        <i class="fas fa-sun text-base"></i>
                    </button>
                    <div id="navbar-actions" class="flex items-center gap-3"></div>
                </div>

                <!-- Mobile menu button + theme toggle -->
                <button id="menu-toggle-mobile" aria-label="Abrir menú" class="md:hidden p-2 rounded-lg text-muted hover:text-ink hover:bg-white/5">
                    <i class="fas fa-bars"></i>
                </button>
                <button id="theme-toggle-mobile" aria-label="Cambiar tema" class="md:hidden p-2 rounded-lg text-muted hover:text-ink hover:bg-white/5">
                    <i class="fas fa-sun text-base"></i>
                </button>
            </div>
        </div>

        <!-- Mobile Menu -->
        <div id="mobile-menu" class="md:hidden hidden bg-page border-t border-white/5 px-4 py-4 space-y-2">
            <a href="/" class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-red-500/10 text-red-400">
                <i class="fas fa-home w-5"></i> <?= htmlspecialchars($nav['inicio'], ENT_QUOTES, 'UTF-8') ?>
            </a>
            <button id="btn-ciudades-mobile" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5">
                <i class="fas fa-map-marker-alt w-5"></i> <?= htmlspecialchars($nav['ciudades'], ENT_QUOTES, 'UTF-8') ?>
            </button>
            <div id="mobile-actions" class="pt-2 border-t border-white/5 space-y-2"></div>
        </div>
    </nav>

    <!-- CIUDADES MODAL -->
    <div id="ciudades-modal" class="fixed inset-0 z-50 hidden items-center justify-center px-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative bg-surface border border-white/10 rounded-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div class="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <h2 class="text-ink text-lg font-semibold flex items-center gap-2"><i class="fas fa-map-marker-alt text-red-400"></i> Seleccionar Ciudad</h2>
                <button id="close-ciudades-modal" class="text-muted hover:text-ink text-xl p-1"><i class="fas fa-times"></i></button>
            </div>
            <div class="px-5 py-3 border-b border-white/5">
                <input type="text" id="ciudades-search" placeholder="Buscar ciudad..." class="w-full bg-surface2 border border-edge rounded-lg px-4 py-3 text-ink text-sm outline-none focus:border-red-500/50 transition-colors placeholder-gray-600">
            </div>
            <div class="flex-1 overflow-y-auto px-5 py-3" id="ciudades-list">
                <div class="text-center text-muted py-8">Cargando...</div>
            </div>
            <div class="px-5 py-3 border-t border-white/5 text-center">
                <span class="text-muted text-xs" id="ciudades-count">0 ciudades</span>
            </div>
        </div>
    </div>

    <script>
    var NAV = <?= $navJS ?>;
    // Navbar actions from localStorage (matching Astro Navbar)
    (function() {
        var actions = document.getElementById('navbar-actions');
        var mobileActions = document.getElementById('mobile-actions');
        var escortData = (function() { try { return JSON.parse(localStorage.getItem('escort_data')); } catch(e) { return null; } })();
        var usuarioData = (function() { try { return JSON.parse(localStorage.getItem('usuario_data')); } catch(e) { return null; } })();

        function escapar(s) {
            var d = document.createElement('div');
            d.appendChild(document.createTextNode(s || ''));
            return d.innerHTML;
        }

        if (escortData) {
            if (actions) actions.innerHTML =
                '<span class="text-muted text-sm mr-1"><i class="fas fa-user-shield mr-1.5 text-amber-400"></i>' + escapar(escortData.nombre) + '</span>' +
                '<a href="/micuenta/resumen" class="px-3 py-2 rounded-lg text-sm text-muted hover:text-ink hover:bg-white/5 transition-all" title="' + NAV.mi_panel + '"><i class="fas fa-tachometer-alt"></i></a>' +
                '<button onclick="localStorage.removeItem(\'escort_token\');localStorage.removeItem(\'escort_data\');window.location.href=\'/\';" class="px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-white/5 transition-all" title="' + NAV.cerrar_sesion + '"><i class="fas fa-sign-out-alt"></i></button>';
            if (mobileActions) mobileActions.innerHTML =
                '<div class="flex items-center gap-3 px-4 py-2 text-amber-400 text-sm"><i class="fas fa-user-shield"></i> ' + escapar(escortData.nombre) + '</div>' +
                '<a href="/micuenta/resumen" class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5"><i class="fas fa-tachometer-alt w-5 text-amber-400"></i> ' + NAV.mi_panel + '</a>' +
                '<button onclick="localStorage.removeItem(\'escort_token\');localStorage.removeItem(\'escort_data\');window.location.href=\'/\';" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-red-400 hover:bg-white/5"><i class="fas fa-sign-out-alt w-5"></i> ' + NAV.cerrar_sesion + '</button>';
        } else if (usuarioData) {
            if (actions) actions.innerHTML =
                '<span class="text-muted text-sm mr-1"><i class="fas fa-user mr-1.5 text-red-400"></i>' + escapar(usuarioData.nombre) + '</span>' +
                '<a href="/mi-cuenta" class="px-3 py-2 rounded-lg text-sm text-muted hover:text-ink hover:bg-white/5 transition-all" title="' + NAV.mi_cuenta + '"><i class="fas fa-tachometer-alt"></i></a>' +
                '<a href="/mis-favoritos" class="px-3 py-2 rounded-lg text-sm text-muted hover:text-ink hover:bg-white/5 transition-all" title="' + NAV.mis_favoritos + '"><i class="fas fa-heart"></i></a>' +
                '<a href="/mi-perfil" class="px-3 py-2 rounded-lg text-sm text-muted hover:text-ink hover:bg-white/5 transition-all" title="' + NAV.mi_perfil + '"><i class="fas fa-user-edit"></i></a>' +
                '<button onclick="localStorage.removeItem(\'usuario_token\');localStorage.removeItem(\'usuario_data\');window.location.href=\'/\';" class="px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-white/5 transition-all" title="' + NAV.cerrar_sesion + '"><i class="fas fa-sign-out-alt"></i></button>';
            if (mobileActions) mobileActions.innerHTML =
                '<div class="flex items-center gap-3 px-4 py-2 text-muted text-sm"><i class="fas fa-user text-red-400"></i> ' + escapar(usuarioData.nombre) + '</div>' +
                '<a href="/mi-cuenta" class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5"><i class="fas fa-tachometer-alt w-5 text-red-400"></i> ' + NAV.mi_cuenta + '</a>' +
                '<a href="/mis-favoritos" class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5"><i class="fas fa-heart w-5 text-red-400"></i> ' + NAV.mis_favoritos + '</a>' +
                '<a href="/mi-perfil" class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5"><i class="fas fa-user-edit w-5 text-red-400"></i> ' + NAV.mi_perfil + '</a>' +
                '<button onclick="localStorage.removeItem(\'usuario_token\');localStorage.removeItem(\'usuario_data\');window.location.href=\'/\';" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-red-400 hover:bg-white/5"><i class="fas fa-sign-out-alt w-5"></i> ' + NAV.cerrar_sesion + '</button>';
        } else {
            if (actions) actions.innerHTML =
                '<div class="relative" id="login-dropdown">' +
                    '<button id="login-toggle" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-ink border border-white/10 hover:border-white/20 transition-all">' +
                        '<i class="fas fa-user"></i> ' + NAV.ingresar + ' <i class="fas fa-chevron-down text-xs transition-transform"></i>' +
                    '</button>' +
                    '<div id="login-menu" class="hidden absolute top-full right-0 mt-2 w-56 bg-surface border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">' +
                        '<a href="/ingresar" class="flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-ink hover:bg-white/5 transition-colors">' +
                            '<i class="fas fa-user text-red-400 w-5"></i><div><div class="font-medium">' + NAV.entrar_usuario + '</div><div class="text-xs text-muted">' + NAV.entrar_usuario_desc + '</div></div>' +
                        '</a>' +
                        '<div class="border-t border-white/5"></div>' +
                        '<a href="/micuenta/login" class="flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-ink hover:bg-white/5 transition-colors">' +
                            '<i class="fas fa-user-shield text-amber-400 w-5"></i><div><div class="font-medium">' + NAV.entrar_escort + '</div><div class="text-xs text-muted">' + NAV.entrar_escort_desc + '</div></div>' +
                        '</a>' +
                    '</div>' +
                '</div>' +
                '<a href="/micuenta/registro" class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg shadow-red-500/25"><i class="fas fa-plus"></i> ' + NAV.publicar + '</a>';
            if (mobileActions) mobileActions.innerHTML =
                '<div class="space-y-1">' +
                    '<a href="/ingresar" class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5"><i class="fas fa-user w-5 text-red-400"></i> ' + NAV.entrar_usuario + '</a>' +
                    '<a href="/micuenta/login" class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5"><i class="fas fa-user-shield w-5 text-amber-400"></i> ' + NAV.entrar_escort + '</a>' +
                    '<a href="/micuenta/registro" class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold bg-red-500 text-white justify-center"><i class="fas fa-plus"></i> ' + NAV.publicar + '</a>' +
                '</div>';
        }
    })();

    // Login dropdown toggle + close on outside click
    (function() {
        var btn = document.getElementById('login-toggle');
        var menu = document.getElementById('login-menu');
        if (!btn || !menu) return;
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            menu.classList.toggle('hidden');
            var chevron = btn.querySelector('.fa-chevron-down');
            if (chevron) chevron.classList.toggle('rotate-180');
        });
        document.addEventListener('mousedown', function(e) {
            if (btn.contains(e.target) || menu.contains(e.target)) return;
            menu.classList.add('hidden');
        });
    })();

    // Mobile menu toggle
    (function() {
        var btn = document.getElementById('menu-toggle-mobile');
        var menu = document.getElementById('mobile-menu');
        if (!btn || !menu) return;
        btn.addEventListener('click', function() {
            menu.classList.toggle('hidden');
            var icon = btn.querySelector('i');
            if (icon) icon.className = 'fas ' + (menu.classList.contains('hidden') ? 'fa-bars' : 'fa-times');
        });
        menu.addEventListener('click', function(e) {
            if (e.target.closest('a, button')) {
                menu.classList.add('hidden');
                var icon = btn.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            }
        });
    })();

    // Theme toggle
    (function() {
        function applyIcon(btn, theme) {
            if (!btn) return;
            btn.innerHTML = '<i class="fas ' + (theme === 'light' ? 'fa-moon' : 'fa-sun') + ' text-base"></i>';
        }
        var theme = document.documentElement.dataset.theme || 'dark';
        var btns = [document.getElementById('theme-toggle'), document.getElementById('theme-toggle-mobile')];
        btns.forEach(function(b) { applyIcon(b, theme); });
        btns.forEach(function(b) {
            if (!b) return;
            b.addEventListener('click', function() {
                var next = (document.documentElement.dataset.theme === 'light') ? 'dark' : 'light';
                document.documentElement.dataset.theme = next;
                try { localStorage.setItem('theme', next); } catch(e) {}
                btns.forEach(function(x) { applyIcon(x, next); });
            });
        });
    })();

    // Ciudades Modal
    (function() {
        var modal = document.getElementById('ciudades-modal');
        var btnOpen = document.getElementById('btn-ciudades');
        var btnOpenMobile = document.getElementById('btn-ciudades-mobile');
        var btnClose = document.getElementById('close-ciudades-modal');
        var search = document.getElementById('ciudades-search');
        var list = document.getElementById('ciudades-list');
        var countEl = document.getElementById('ciudades-count');
        var ciudadesCache = [];

        function openModal() { modal.classList.remove('hidden'); modal.classList.add('flex'); loadCiudades(); }
        function closeModal() { modal.classList.add('hidden'); modal.classList.remove('flex'); }

        btnOpen?.addEventListener('click', openModal);
        btnOpenMobile?.addEventListener('click', openModal);
        btnClose?.addEventListener('click', closeModal);
        modal?.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

        async function loadCiudades() {
            if (ciudadesCache.length) { renderCiudades(ciudadesCache); return; }
            list.innerHTML = '<div class="text-center text-muted py-8">Cargando...</div>';
            try {
                var res = await fetch('/api/ciudades/listado.php');
                var data = await res.json();
                if (data.success && data.data) {
                    ciudadesCache = data.data;
                    renderCiudades(ciudadesCache);
                } else {
                    list.innerHTML = '<div class="text-center text-red-400 py-8">Error al cargar</div>';
                }
            } catch (e) {
                list.innerHTML = '<div class="text-center text-red-400 py-8">Error de conexión</div>';
            }
        }

        function renderCiudades(ciudades) {
            var searchTerm = (search.value || '').toLowerCase();
            var filtered = ciudades.filter(function(c) {
                return c.nombre.toLowerCase().includes(searchTerm);
            });
            countEl.textContent = filtered.length + ' ciudad' + (filtered.length !== 1 ? 'es' : '');
            if (filtered.length === 0) {
                list.innerHTML = '<div class="text-center text-muted py-8">No hay coincidencias</div>';
                return;
            }
            list.innerHTML = filtered.map(function(c) {
                return '<a href="/escorts-' + slugify(c.nombre) + '" class="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors group">' +
                    '<div class="flex items-center gap-3">' +
                    '<div class="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors"><i class="fas fa-city text-red-400 text-xs"></i></div>' +
                    '<span class="text-ink text-sm font-medium capitalize">' + escapar(c.nombre) + '</span>' +
                    '</div>' +
                    '<div class="flex items-center gap-2">' +
                    '<span class="text-xs bg-white/10 text-muted px-2 py-0.5 rounded-full">' + c.escorts_activas + ' escort' + (c.escorts_activas !== 1 ? 's' : '') + '</span>' +
                    '<i class="fas fa-chevron-right text-muted text-xs group-hover:text-red-400 transition-colors"></i>' +
                    '</div>' +
                    '</a>';
            }).join('');
        }

        search?.addEventListener('input', function() { renderCiudades(ciudadesCache); });

        function slugify(nombre) {
            return nombre
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        }

        function escapar(s) {
            var d = document.createElement('div');
            d.appendChild(document.createTextNode(s || ''));
            return d.innerHTML;
        }
    })();

    </script>

    <!-- MAIN -->
    <main class="pt-20 pb-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <!-- BREADCRUMB -->
            <nav class="flex items-center gap-2 text-sm mb-8 text-muted">
                <a href="/" class="hover:text-red-400 transition-colors"><?= htmlspecialchars($nav['inicio'], ENT_QUOTES, 'UTF-8') ?></a>
                <span>/</span>
                <a href="/escorts-<?= entradaSlug($ciudadEfectiva) ?>" class="hover:text-red-400 transition-colors capitalize"><?= e($ciudadEfectiva) ?></a>
                <span>/</span>
                <span class="text-muted"><?= e($escort['nombre']) ?></span>
            </nav>

            <!-- HEADER -->
            <div class="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
                <div class="shrink-0">
                    <div class="relative inline-block">
                        <div class="w-44 h-44 rounded-full overflow-hidden bg-surface border-2 border-white/10">
                            <?php if ($escort['foto_principal']): ?>
                                <img src="<?= e($escort['foto_principal']) ?>" alt="<?= e($escort['nombre']) ?>" class="w-full h-full object-cover">
                            <?php else: ?>
                                <div class="w-full h-full flex items-center justify-center"><i class="fas fa-user text-muted text-4xl"></i></div>
                            <?php endif; ?>
                        </div>
                        <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            <?php if ($escort['vip'] == 1): ?>
                                <div class="w-8 h-8 bg-amber-400 text-black rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30 border-2 border-page">
                                    <i class="fas fa-crown text-[0.6rem]"></i>
                                </div>
                            <?php endif; ?>
                            <?php if ($escort['verificado'] == 1): ?>
                                <div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-page">
                                    <i class="fas fa-check text-[0.6rem]"></i>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-2 flex-wrap">
                        <h1 class="text-2xl md:text-3xl font-bold text-ink"><?= e($escort['nombre']) ?></h1>
                        <?php if (!empty($escort['disponible_ahora'])): ?>
                        <span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-600/50 animate-pulse" title="En línea"></span>
                        <?php endif; ?>
                        <span class="text-muted text-lg">, <?= $escort['edad'] ?> Años</span>
                    </div>

                    <?php if ($totalValoraciones > 0): ?>
                    <div class="flex items-center gap-2 mb-3">
                        <div class="flex items-center gap-0.5">
                            <?php for ($n = 1; $n <= 5; $n++): ?>
                            <i class="fas fa-star text-sm <?= $n <= $ratingReal ? 'text-amber-400' : 'text-muted' ?>"></i>
                            <?php endfor; ?>
                        </div>
                        <span class="text-ink text-sm font-medium"><?= number_format($ratingReal, 1) ?></span>
                        <span class="text-muted text-xs">(<?= $totalValoraciones ?>)</span>
                    </div>
                    <?php endif; ?>

                    <?php if ($telefonoFormateado): ?>
                        <a href="tel:<?= preg_replace('/\D/', '', $escort['telefono']) ?>" class="inline-block text-green-400 text-lg font-semibold hover:text-green-300 transition-colors">
                            <?= e($telefonoFormateado) ?>
                        </a>
                    <?php endif; ?>
                    <?php if (!empty($escort['categoria_nombre'])): ?>
                    <div class="text-muted text-sm mb-3">
                        <i class="fas fa-tag text-red-400 text-xs mr-1.5"></i><?= e($escort['categoria_nombre']) ?>
                    </div>
                    <?php endif; ?>

                    <div class="flex items-center gap-2 text-sm text-muted mb-5 flex-wrap">
                        <span class="uppercase tracking-wide">MUJER</span>
                        <span class="text-muted">/</span>
                        <span class="flex items-center gap-1">
                            <span class="text-ink font-semibold" id="likes-count"><?= $likes ?></span>
                            <span class="text-red-400">ME GUSTAS</span>
                            <i class="fas fa-heart text-red-500 text-xs"></i>
                        </span>
                        <span class="text-muted">/</span>
                        <span class="uppercase tracking-wide"><?= e($ciudadEfectiva) ?></span>
                    </div>

                    <div class="flex flex-wrap gap-3">
                        <?php if ($escort['telefono']): ?>
                            <a href="tel:<?= preg_replace('/\D/', '', $escort['telefono']) ?>" onclick="trackContacto(<?= $id ?>, 'llamar')" class="flex items-center gap-2 px-5 py-2.5 rounded-lg btn-red text-ink font-medium text-sm shadow-lg shadow-red-500/20">
                                <i class="fas fa-phone-alt"></i> Llamar
                            </a>
                        <?php endif; ?>
                        <?php if ($waLink): ?>
                            <a href="<?= $waLink ?>" target="_blank" onclick="trackContacto(<?= $id ?>, 'whatsapp')" class="flex items-center gap-2 px-5 py-2.5 rounded-lg btn-green text-ink font-medium text-sm shadow-lg shadow-green-500/20">
                                <i class="fab fa-whatsapp"></i> Contáctame
                            </a>
                        <?php endif; ?>
                        <button onclick="compartir()" class="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-medium text-sm transition-all">
                            <i class="fas fa-share-alt"></i> Compartir
                        </button>
                        <button onclick="openQR()" class="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-500/80 hover:bg-purple-500 text-white font-medium text-sm transition-all">
                            <i class="fas fa-qrcode"></i> QR
                        </button>
                        <button onclick="toggleLike(this)" class="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" id="btn-like">
                            <i class="far fa-heart"></i> Me Gusta
                        </button>
                        <button onclick="openReportModal()" class="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all bg-gray-500/20 text-muted hover:bg-gray-500/30 border border-gray-500/30">
                            <i class="fas fa-flag"></i> Reportar
                        </button>
                    </div>
                </div>
            </div>

            <!-- DESCRIPCIÍ“N -->
            <?php if ($escort['descripcion_corta'] || $escort['descripcion_larga']): ?>
                <div class="mb-8">
                    <?php if (!empty($escort['descripcion_corta'])): ?>
                    <div class="text-muted text-base leading-relaxed mb-6 descripcion-corta"><?= strip_tags($escort['descripcion_corta'], '<p><br><span><strong><b><em><i><u><s><strike><h1><h2><h3><h4><h5><h6><blockquote><pre><code><ol><ul><li><a><img><video><iframe><table><thead><tbody><tr><th><td><caption><div>') ?></div>
                    <?php endif; ?>
                    <?php if (!empty($escort['descripcion_larga'])): ?>
                    <div class="text-muted text-base leading-relaxed descripcion-larga"><?= strip_tags($escort['descripcion_larga'], '<p><br><span><strong><b><em><i><u><s><strike><h1><h2><h3><h4><h5><h6><blockquote><pre><code><ol><ul><li><a><img><video><iframe><table><thead><tbody><tr><th><td><caption><div>') ?></div>
                    <?php endif; ?>
                </div>
            <?php endif; ?>

            <!-- DETALLES / CARACTERÍSTICAS -->
            <?php if (!empty($atributos)): ?>
                <div class="mb-8">
                    <h2 class="text-ink text-lg font-bold mb-5 flex items-center gap-2"><i class="fas fa-clipboard-list text-muted"></i> Detalles</h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
                        <?php foreach ($atributos as $attr): ?>
                            <div class="flex items-start gap-2.5">
                                <i class="fas <?= e($attr['icon']) ?> text-muted mt-0.5 text-xs w-3.5 shrink-0"></i>
                                <div class="min-w-0">
                                    <div class="text-muted text-[0.6rem] uppercase tracking-widest"><?= e($attr['label']) ?></div>
                                    <div class="text-muted text-sm capitalize truncate"><?= e($attr['valor']) ?></div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- SERVICIOS INCLUIDOS -->
            <?php if (!empty($serviciosIncluidos) && !in_array('servicios', $ocultos)): ?>
                <div class="mb-8">
                    <h2 class="text-muted text-sm font-medium uppercase tracking-wider mb-3">Servicios Incluidos</h2>
                    <div class="flex flex-wrap gap-2">
                        <?php foreach ($serviciosIncluidos as $serv): ?>
                            <span class="px-3 py-1.5 rounded-md badge-red text-xs font-semibold"><?= e($serv) ?></span>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- SERVICIOS ADICIONALES -->
            <?php if (!empty($serviciosAdicionales) && !in_array('servicios', $ocultos)): ?>
                <div class="mb-8">
                    <h2 class="text-muted text-sm font-medium uppercase tracking-wider mb-3">Servicios Adicionales</h2>
                    <div class="flex flex-wrap gap-2">
                        <?php foreach ($serviciosAdicionales as $serv): ?>
                            <span class="px-3 py-1.5 rounded-md badge-red-outline text-xs font-semibold"><?= e($serv) ?></span>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- TARIFAS -->
            <?php if (!empty($tarifas)): ?>
                <div class="mb-10">
                    <h2 class="text-muted text-sm font-medium uppercase tracking-wider mb-3">Tarifas</h2>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <?php if (isset($tarifas['30min'])): ?>
                            <div class="bg-surface border border-white/10 rounded-lg p-4 text-center">
                                <div class="text-muted text-xs mb-1">30 Minutos</div>
                                <div class="text-ink font-bold text-lg">$<?= number_format($tarifas['30min'], 0, ',', '.') ?></div>
                            </div>
                        <?php endif; ?>
                        <?php if (isset($tarifas['1h'])): ?>
                            <div class="bg-surface border border-white/10 rounded-lg p-4 text-center">
                                <div class="text-muted text-xs mb-1">1 Hora</div>
                                <div class="text-ink font-bold text-lg">$<?= number_format($tarifas['1h'], 0, ',', '.') ?></div>
                            </div>
                        <?php endif; ?>
                        <?php if (isset($tarifas['2h'])): ?>
                            <div class="bg-surface border border-white/10 rounded-lg p-4 text-center">
                                <div class="text-muted text-xs mb-1">2 Horas</div>
                                <div class="text-ink font-bold text-lg">$<?= number_format($tarifas['2h'], 0, ',', '.') ?></div>
                            </div>
                        <?php endif; ?>
                        <?php if (isset($tarifas['noche'])): ?>
                            <div class="bg-surface border border-white/10 rounded-lg p-4 text-center">
                                <div class="text-muted text-xs mb-1">Toda la Noche</div>
                                <div class="text-ink font-bold text-lg">$<?= number_format($tarifas['noche'], 0, ',', '.') ?></div>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- GALERÍA -->
            <?php if (!empty($fotos)): ?>
                <div class="mb-10">
                    <h2 class="text-ink text-lg font-bold mb-4 flex items-center gap-2"><i class="fas fa-images text-red-500"></i> Galería</h2>

                    <div class="flex flex-wrap items-center gap-3 mb-6">
                        <?php if ($escort['verificado'] == 1): ?>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-blue-400 text-sm font-medium">
                            <i class="fas fa-check-circle text-blue-400"></i> Verificada
                        </span>
                        <?php endif; ?>
                        <?php if ($escort['vip'] == 1): ?>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-yellow-400 text-sm font-medium">
                            <i class="fas fa-crown text-yellow-400"></i> VIP
                        </span>
                        <?php endif; ?>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-muted text-sm">
                            <i class="fas fa-calendar text-muted"></i> <?= date('M Y', strtotime($escort['created_at'])) ?>
                        </span>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-muted text-sm">
                            <i class="fas fa-map-marker-alt text-muted"></i> <?= e($ciudadEfectiva) ?>
                        </span>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <?php foreach ($fotos as $i => $foto): ?>
                            <?php $isVideo = preg_match('/\.(mp4|webm|mov)$/i', $foto); ?>
                            <a href="<?= e($foto) ?>" data-fancybox="gallery" class="gallery-item aspect-[3/4] bg-surface border border-white/10 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10 transition-all rounded-xl overflow-hidden group">
                                <?php if ($isVideo): ?>
                                <video src="<?= e($foto) ?>" preload="metadata" muted playsinline class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"></video>
                                <?php else: ?>
                                <img src="<?= e($foto) ?>" alt="<?= e($escort['nombre']) ?> - <?= $i + 1 ?>" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="<?= $i < 4 ? 'eager' : 'lazy' ?>" decoding="async">
                                <?php endif; ?>
                                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                    <i class="fas fa-expand-alt text-white/0 group-hover:text-white/80 text-xl transition-all"></i>
                                </div>
                                <?php if ($isVideo): ?>
                                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div class="play-badge">
                                        <i class="fas fa-play"></i>
                                    </div>
                                </div>
                                <?php endif; ?>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

        </div>

        <!-- COMENTARIOS -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
            <div id="comentarios-section">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-ink text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-comments text-red-500"></i>
                        Comentarios <span id="comentarios-total" class="text-muted text-sm font-normal"></span>
                    </h2>
                </div>

                <div id="comentarios-form" class="hidden mb-8">
                    <div class="bg-surface border border-white/10 rounded-xl p-5">
                        <h3 class="text-ink text-sm font-semibold mb-3">Deja tu comentario</h3>
                        <textarea id="comentario-text" rows="3" placeholder="Escribe tu experiencia con <?= e($escort['nombre']) ?>..." class="w-full bg-surface2 border border-edge rounded-lg px-4 py-3 text-ink text-sm outline-none focus:border-red-500/50 transition-colors placeholder-gray-600 resize-none mb-3"></textarea>
                        <div class="mb-3">
                            <label class="text-muted text-xs block mb-1.5">
                                <i class="fas fa-check-circle text-green-400 mr-1"></i>Código de verificación <span class="text-red-400">*</span>
                            </label>
                            <input type="text" id="comentario-codigo" maxlength="6" autocomplete="off" placeholder="Código entregado por la escort (ej: A1B2C3)" class="w-full bg-surface2 border border-edge rounded-lg px-4 py-2.5 text-ink text-sm uppercase tracking-widest placeholder-gray-600 placeholder:normal-case placeholder:tracking-normal outline-none focus:border-green-500/50 transition-colors" />
                            <p class="text-muted text-xs mt-1">La escort te entrega este código tras confirmar tu cita. Es obligatorio para comentar.</p>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-muted text-xs">Puntuación:</span>
                                <div class="flex gap-1" id="puntuacion-estrellas">
                                    <?php for ($i = 1; $i <= 5; $i++): ?>
                                    <button type="button" onclick="setPuntuacion(<?= $i ?>)" class="text-muted hover:text-yellow-400 transition-colors text-sm punt-star" data-val="<?= $i ?>">
                                        <i class="far fa-star"></i>
                                    </button>
                                    <?php endfor; ?>
                                </div>
                            </div>
                            <button onclick="enviarComentario(this)" class="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-red-500/20">
                                Enviar
                            </button>
                        </div>
                        <div id="comentario-error" class="text-red-400 text-xs mt-2 hidden"></div>
                    </div>
                </div>

                <div id="comentarios-login" class="hidden mb-8">
                    <div class="bg-surface border border-white/10 rounded-xl p-5 text-center">
                        <p class="text-muted text-sm mb-3">
                            <i class="fas fa-user-lock text-muted mr-2"></i>
                            Debe ser <a href="/unirse" class="text-red-400 hover:underline font-medium">usuario registrado</a> para poder comentar
                        </p>
                        <a href="/unirse" class="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all">
                            <i class="fas fa-user-plus"></i> Registrarse
                        </a>
                    </div>
                </div>

                <div id="comentarios-lista" class="space-y-4"></div>

                <div id="comentarios-empty" class="hidden">
                    <div class="text-center py-8">
                        <i class="fas fa-comment-slash text-muted text-2xl mb-2"></i>
                        <p class="text-muted text-sm">No hay comentarios aún. Â¡Sé el primero!</p>
                    </div>
                </div>
            </div>
        </div>

        <script>
            var currentPuntuacion = 0;

            function getUsuarioToken() { return localStorage.getItem('usuario_token'); }

            function getAuthHeaders() {
                var h = { 'Content-Type': 'application/json' };
                var t = getUsuarioToken();
                if (t) h['Authorization'] = 'Bearer ' + t;
                return h;
            }

            function setPuntuacion(val) {
                currentPuntuacion = val;
                document.querySelectorAll('.punt-star').forEach(function(el) {
                    var v = parseInt(el.dataset.val);
                    var icon = el.querySelector('i');
                    if (v <= val) {
                        icon.classList.remove('far');
                        icon.classList.add('fas');
                        el.classList.remove('text-muted');
                        el.classList.add('text-yellow-400');
                    } else {
                        icon.classList.remove('fas');
                        icon.classList.add('far');
                        el.classList.remove('text-yellow-400');
                        el.classList.add('text-muted');
                    }
                });
            }

            function cargarComentarios() {
                fetch('/api/comentarios/listar.php?escort_id=<?= $id ?>')
                    .then(function(r) {
                        if (!r.headers.get('content-type') || !r.headers.get('content-type').includes('application/json')) {
                            throw new Error('Respuesta inválida del servidor');
                        }
                        return r.json();
                    })
                    .then(function(data) {
                        if (!data.success) return;
                        var lista = document.getElementById('comentarios-lista');
                        var totalEl = document.getElementById('comentarios-total');
                        var emptyEl = document.getElementById('comentarios-empty');
                        lista.innerHTML = '';
                        if (data.total === 0) {
                            emptyEl.classList.remove('hidden');
                            totalEl.textContent = '';
                            return;
                        }
                        emptyEl.classList.add('hidden');
                        totalEl.textContent = '(' + data.total + ')';
                        data.comentarios.forEach(function(c) {
                            var estrellas = '';
                            if (c.puntuacion) {
                                for (var i = 0; i < c.puntuacion; i++) estrellas += '<i class=\"fas fa-star text-yellow-400 text-[10px]\"></i>';
                            }
                            var fecha = new Date(c.created_at + ' UTC').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
                            var verifBadge = c.cita_verificada ? '<span class=\"inline-flex items-center gap-1 ml-2 text-[0.55rem] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20\"><i class=\"fas fa-check-circle text-[0.45rem]\"></i> Cita verificada</span>' : '';
                            lista.innerHTML += '<div class=\"bg-surface border border-white/10 rounded-xl p-4\">' +
                                '<div class=\"flex items-center gap-2 mb-1\">' +
                                '<div class=\"w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs font-bold\">' + c.usuario.charAt(0).toUpperCase() + '</div>' +
                                '<span class=\"text-muted text-sm font-medium\">' + c.usuario + '</span>' +
                                verifBadge +
                                '</div>' +
                                '<div class=\"flex items-center gap-2 mb-2 pl-9\">' +
                                (estrellas ? '<span class=\"flex gap-0.5\">' + estrellas + '</span>' : '') +
                                '<span class=\"text-muted text-xs\">' + fecha + '</span>' +
                                '</div>' +
                                '<p class=\"text-muted text-sm leading-relaxed\">' + c.comentario + '</p>' +
                                '</div>';
                        });
                    })
                    .catch(function() {});
            }

            function enviarComentario(btn) {
                var texto = document.getElementById('comentario-text').value.trim();
                var codigo = document.getElementById('comentario-codigo').value.trim().toUpperCase();
                var errorEl = document.getElementById('comentario-error');
                errorEl.classList.remove('text-green-400');
                errorEl.classList.add('hidden');
                if (texto.length < 10) {
                    errorEl.textContent = 'El comentario debe tener al menos 10 caracteres';
                    errorEl.classList.remove('hidden');
                    return;
                }
                if (!codigo) {
                    errorEl.textContent = 'Se requiere el código de verificación entregado por la escort';
                    errorEl.classList.remove('hidden');
                    return;
                }
                btn.disabled = true;
                btn.textContent = 'Enviando...';
                fetch('/api/comentarios/crear.php', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ escort_id: <?= $id ?>, comentario: texto, puntuacion: currentPuntuacion || null, codigo_verificacion: codigo })
                })
                 .then(function(r) {
                     if (!r.headers.get('content-type') || !r.headers.get('content-type').includes('application/json')) {
                         throw new Error('Respuesta inválida del servidor');
                     }
                     return r.json();
                 })
                 .then(function(data) {
                     if (data.success) {
                         document.getElementById('comentario-text').value = '';
                         document.getElementById('comentario-codigo').value = '';
                         setPuntuacion(0);
                         errorEl.classList.remove('hidden');
                         errorEl.classList.add('text-green-400');
                         errorEl.textContent = 'Comentario enviado. Será revisado antes de publicarse.';
                         setTimeout(function() { errorEl.classList.add('hidden'); }, 5000);
                     } else {
                         if (data.fieldErrors && (data.fieldErrors.comentario || data.fieldErrors.codigo_verificacion)) {
                             errorEl.textContent = data.fieldErrors.codigo_verificacion || data.fieldErrors.comentario;
                         } else {
                             errorEl.textContent = data.error || 'Error al enviar comentario';
                         }
                         errorEl.classList.remove('hidden');
                     }
                 })
                 .catch(function(err) {
                     errorEl.textContent = err.message || 'Error de conexión';
                     errorEl.classList.remove('hidden');
                 })
                .finally(function() {
                    btn.disabled = false;
                    btn.textContent = 'Enviar';
                });
            }

            (function() {
                var token = getUsuarioToken();
                var formEl = document.getElementById('comentarios-form');
                var loginEl = document.getElementById('comentarios-login');
                if (token) {
                    formEl.classList.remove('hidden');
                } else {
                    loginEl.classList.remove('hidden');
                }
                cargarComentarios();
            })();
        </script>
    </main>

    <!-- REPORT MODAL -->
    <div id="report-modal" class="fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto px-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeReportModal()"></div>
        <div class="relative bg-surface border border-white/10 rounded-2xl max-w-md w-full p-6 my-auto max-h-[90vh] overflow-y-auto">
            <button onclick="closeReportModal()" class="absolute top-3 right-3 text-muted hover:text-ink text-xl p-1"><i class="fas fa-times"></i></button>
            <h3 class="text-ink font-bold text-lg mb-4 flex items-center gap-2">
                <i class="fas fa-flag text-red-400"></i> Reportar perfil
            </h3>
            <p class="text-muted text-sm mb-4">Selecciona el motivo del reporte:</p>
            <div class="space-y-2 mb-4">
                <button data-motivo="fotos engañosas" onclick="selectReportMotivo('fotos engañosas')" class="report-motivo-btn w-full text-left px-3 py-2 bg-surface2 hover:bg-raised text-muted hover:text-ink rounded-lg text-sm transition-all border border-transparent"><i class="fas fa-check text-red-400 mr-2 report-check hidden"></i>Fotos engañosas o editadas</button>
                <button data-motivo="contenido inapropiado" onclick="selectReportMotivo('contenido inapropiado')" class="report-motivo-btn w-full text-left px-3 py-2 bg-surface2 hover:bg-raised text-muted hover:text-ink rounded-lg text-sm transition-all border border-transparent"><i class="fas fa-check text-red-400 mr-2 report-check hidden"></i>Contenido inapropiado</button>
                <button data-motivo="acoso o amenazas" onclick="selectReportMotivo('acoso o amenazas')" class="report-motivo-btn w-full text-left px-3 py-2 bg-surface2 hover:bg-raised text-muted hover:text-ink rounded-lg text-sm transition-all border border-transparent"><i class="fas fa-check text-red-400 mr-2 report-check hidden"></i>Acoso o amenazas</button>
                <button data-motivo="información falsa" onclick="selectReportMotivo('información falsa')" class="report-motivo-btn w-full text-left px-3 py-2 bg-surface2 hover:bg-raised text-muted hover:text-ink rounded-lg text-sm transition-all border border-transparent"><i class="fas fa-check text-red-400 mr-2 report-check hidden"></i>Información falsa</button>
                <button data-motivo="otro" onclick="selectReportMotivo('otro')" class="report-motivo-btn w-full text-left px-3 py-2 bg-surface2 hover:bg-raised text-muted hover:text-ink rounded-lg text-sm transition-all border border-transparent"><i class="fas fa-check text-red-400 mr-2 report-check hidden"></i>Otro motivo</button>
            </div>
            <div id="report-detalle-container" class="hidden mb-4">
                <textarea id="report-detalle" rows="3" placeholder="Detalles adicionales (opcional)" class="w-full bg-surface2 border border-edge rounded-lg px-3 py-2 text-ink text-sm outline-none focus:border-red-500/50 transition-colors placeholder-gray-600 resize-none"></textarea>
            </div>
            <div class="flex gap-3">
                <button onclick="enviarReporte()" class="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg text-sm transition-all">
                    <i class="fas fa-paper-plane mr-1"></i> Enviar reporte
                </button>
                <button onclick="closeReportModal()" class="flex-1 px-4 py-2.5 bg-surface2 hover:bg-raised text-muted font-medium rounded-lg text-sm transition-all">
                    Cancelar
                </button>
            </div>
        </div>
    </div>

    <!-- QR CODE MODAL -->
    <div id="qr-modal" class="fixed inset-0 z-50 hidden items-center justify-center px-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeQR()"></div>
        <div class="relative bg-surface border border-white/10 rounded-2xl max-w-sm w-full p-6 text-center">
            <button onclick="closeQR()" class="absolute top-3 right-3 text-muted hover:text-ink text-xl p-1"><i class="fas fa-times"></i></button>
            <h3 class="text-ink font-bold text-lg mb-4 flex items-center justify-center gap-2">
                <i class="fas fa-qrcode text-red-400"></i> QR de <?= e($escort['nombre']) ?>
            </h3>
            <div id="qr-container" class="flex justify-center mb-4">
                <canvas id="qr-canvas" width="200" height="200"></canvas>
            </div>
            <p class="text-muted text-xs mb-4">Escanea para ver el perfil</p>
            <button onclick="downloadQR()" class="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2 mx-auto">
                <i class="fas fa-download"></i> Descargar QR
            </button>
        </div>
    </div>

    <!-- SHARE MODAL -->
    <div id="share-modal" class="fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto px-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeShareModal()"></div>
        <div class="relative bg-surface border border-white/10 rounded-2xl max-w-md w-full p-6 my-auto max-h-[90vh] overflow-y-auto">
            <button onclick="closeShareModal()" class="absolute top-3 right-3 text-muted hover:text-ink text-xl p-1"><i class="fas fa-times"></i></button>
            <h3 class="text-ink font-bold text-lg mb-1 flex items-center gap-2">
                <i class="fas fa-share-alt text-red-400"></i> Compartir perfil
            </h3>
            <p class="text-muted text-sm mb-5">Comparte el perfil de <?= e($escort['nombre']) ?> con quien quieras</p>
            <div class="grid grid-cols-3 gap-3">
                <a id="share-wa" href="#" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center gap-2 p-3 bg-surface2 hover:bg-raised rounded-xl transition-all">
                    <span class="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style="background:#25D366"><i class="fab fa-whatsapp"></i></span>
                    <span class="text-ink text-xs font-medium">WhatsApp</span>
                </a>
                <a id="share-x" href="#" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center gap-2 p-3 bg-surface2 hover:bg-raised rounded-xl transition-all">
                    <span class="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style="background:#000"><i class="fab fa-twitter"></i></span>
                    <span class="text-ink text-xs font-medium">X / Twitter</span>
                </a>
                <a id="share-fb" href="#" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center gap-2 p-3 bg-surface2 hover:bg-raised rounded-xl transition-all">
                    <span class="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style="background:#1877F2"><i class="fab fa-facebook-f"></i></span>
                    <span class="text-ink text-xs font-medium">Facebook</span>
                </a>
                <a id="share-tg" href="#" target="_blank" rel="noopener noreferrer" class="flex flex-col items-center gap-2 p-3 bg-surface2 hover:bg-raised rounded-xl transition-all">
                    <span class="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style="background:#229ED9"><i class="fab fa-telegram-plane"></i></span>
                    <span class="text-ink text-xs font-medium">Telegram</span>
                </a>
                <a id="share-em" href="#" class="flex flex-col items-center gap-2 p-3 bg-surface2 hover:bg-raised rounded-xl transition-all">
                    <span class="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style="background:#6b7280"><i class="fas fa-envelope"></i></span>
                    <span class="text-ink text-xs font-medium">Email</span>
                </a>
            </div>
            <button id="share-copiar" onclick="copiarEnlace(this)" class="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg text-sm transition-all">
                <i class="fas fa-link"></i> Copiar enlace
            </button>
            </div>
    </div>

    <!-- VOLVER ARRIBA -->
    <button id="btn-volver-arriba" onclick="volverArriba()" class="fixed bottom-6 right-6 z-40 hidden items-center justify-center w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transition-all" aria-label="Volver arriba">
        <i class="fas fa-arrow-up"></i>
    </button>

    <script src="https://cdn.jsdelivr.net/npm/qrcode@1/build/qrcode.min.js"></script>
    <script>
        var qrUrl = window.location.href;

        function trackContacto(escortId, tipo) {
            fetch('/api/tracking/contacto.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ escort_id: escortId, tipo: tipo }),
                keepalive: true
            }).catch(function(e) {});
        }

        function openQR() {
            document.getElementById('qr-modal').classList.remove('hidden');
            document.getElementById('qr-modal').classList.add('flex');
            QRCode.toCanvas(document.getElementById('qr-canvas'), qrUrl, {
                width: 200,
                margin: 2,
                color: { dark: '#ffffff', light: '#1a1a2e' }
            }, function(err) { if (err) console.error(err); });
        }

        function closeQR() {
            document.getElementById('qr-modal').classList.add('hidden');
            document.getElementById('qr-modal').classList.remove('flex');
        }

        function downloadQR() {
            var canvas = document.getElementById('qr-canvas');
            var link = document.createElement('a');
            link.download = 'qr-<?= e($escort['slug'] ?? $escort['nombre']) ?>.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    </script>

    <!-- TE PODRÍA GUSTAR -->
    <?php
    $recomendados = [];
    try {
        $paramsRec = [$id];
        $condRec = ["e.id != ?", "e.activa = 1", "e.eliminada = 0",
            "EXISTS (SELECT 1 FROM suscripciones s JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL WHERE s.escort_id = e.id AND s.fecha_aprobacion IS NOT NULL AND s.estado = 'activa' AND s.fecha_fin >= CURDATE())"];
        if (!empty($ciudadEfectiva)) {
            $condRec[] = "e.ciudad = ?";
            $paramsRec[] = $ciudadEfectiva;
        }
        if (!empty($escort['categoria_id'])) {
            $condRec[] = "e.categoria_id = ?";
            $paramsRec[] = $escort['categoria_id'];
        }
        $whereRec = implode(' AND ', $condRec);
        $rStmt = $pdo->prepare("
            SELECT e.id, e.nombre, e.edad, e.ciudad,
                   COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
                   e.vip, e.verificado, e.destacado, e.disponible_ahora,
                   e.rating, e.total_valoraciones, e.en_gira, gc.nombre AS gira_ciudad
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            WHERE $whereRec
            ORDER BY e.destacado DESC, e.vip DESC, e.rating DESC, RAND()
            LIMIT 6
        ");
        $rStmt->execute($paramsRec);
        $recomendados = $rStmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {}
    ?>

    <?php if (!empty($recomendados)): ?>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <h2 class="text-ink text-lg font-bold mb-6 flex items-center gap-2">
            <i class="fas fa-thumbs-up text-red-500"></i> Te podría gustar
        </h2>
        <div class="relative pb-2 recomendados-swiper">
            <div class="swiper-wrapper">
            <?php foreach ($recomendados as $rec): ?>
            <div class="swiper-slide h-auto">
            <a href="/<?= $rec['id'] ?>" class="group block bg-surface rounded-xl overflow-hidden border border-white/5 hover:border-red-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/5">
                <div class="relative aspect-[3/4] bg-gradient-to-b from-raised to-surface overflow-hidden">
                    <?php if ($rec['foto_principal']): ?>
                    <img src="<?= e($rec['foto_principal']) ?>" alt="<?= e($rec['nombre']) ?>" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
                    <?php else: ?>
                    <div class="w-full h-full flex items-center justify-center"><i class="fas fa-user text-muted text-3xl"></i></div>
                    <?php endif; ?>
                    <?php if (!empty($rec['disponible_ahora'])): ?>
                    <span class="absolute top-2 left-2 bg-red-600 text-white text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg shadow-red-600/50 animate-pulse">
                        <i class="fas fa-fire text-[0.5rem]"></i> Disponible Ahora
                    </span>
                    <?php endif; ?>
                    <?php if ($rec['verificado'] == 1): ?>
                    <span class="absolute top-2 <?= !empty($rec['disponible_ahora']) ? 'right-2' : 'left-2' ?> bg-blue-500 text-white text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                        <i class="fas fa-check text-[0.5rem]"></i> Verificada
                    </span>
                    <?php endif; ?>
                    <?php if ($rec['vip'] == 1): ?>
                    <span class="absolute top-2 right-2 bg-amber-400 text-black text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                        <i class="fas fa-crown text-[0.5rem]"></i> VIP
                    </span>
                    <?php endif; ?>
                </div>
                <div class="p-3">
                    <div class="flex items-start justify-between mb-1">
                        <h3 class="text-ink font-semibold text-sm leading-tight pr-2 truncate"><?= e($rec['nombre']) ?></h3>
                        <?php if (!empty($rec['total_valoraciones']) && $rec['total_valoraciones'] > 0): ?>
                        <div class="flex items-center gap-1 text-yellow-400 text-xs flex-shrink-0">
                            <i class="fas fa-star text-[0.55rem]"></i>
                            <span><?= number_format((float)$rec['rating'], 1) ?></span>
                        </div>
                        <?php endif; ?>
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-muted">
                        <i class="fas fa-map-marker-alt text-[0.55rem] flex-shrink-0"></i>
                        <span class="truncate"><?= e($rec['ciudad']) ?></span>
                        <span class="text-muted">â€¢</span>
                        <span class="text-red-400"><?= $rec['edad'] ?> años</span>
                    </div>
                </div>
            </a>
            </div>
            <?php endforeach; ?>
            </div>
        </div>
    </div>
    <style>
        .recomendados-swiper .swiper-button-next,
        .recomendados-swiper .swiper-button-prev {
            width: 36px;
            height: 36px;
            background: rgba(20, 20, 30, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 50%;
            color: #ef4444;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            z-index: 10;
        }
        .recomendados-swiper .swiper-button-next:hover,
        .recomendados-swiper .swiper-button-prev:hover {
            background: rgba(30, 30, 45, 0.95);
            border-color: rgba(239, 68, 68, 0.5);
        }
        .recomendados-swiper .swiper-button-next::after,
        .recomendados-swiper .swiper-button-prev::after {
            font-size: 14px;
            font-weight: 700;
        }
        .recomendados-swiper .swiper-button-prev { left: 4px; }
        .recomendados-swiper .swiper-button-next { right: 4px; }
    </style>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof Swiper === 'undefined') return;
            var el = document.querySelector('.recomendados-swiper');
            if (!el) return;
            new Swiper(el, {
                modules: [Swiper.FreeMode, Swiper.Navigation],
                loop: false,
                slidesPerView: 2.2,
                spaceBetween: 8,
                freeMode: true,
                grabCursor: true,
                navigation: true,
                breakpoints: {
                    640: { slidesPerView: 3.3 },
                    768: { slidesPerView: 4.3 },
                    1024: { slidesPerView: 5.5 },
                    1280: { slidesPerView: 5.5 }
                }
            });
        });
    </script>
    <?php endif; ?>

    <!-- FOOTER -->
    <footer class="bg-page border-t border-white/5">
        <div class="max-w-7xl mx-auto px-4 py-8 text-center">
            <div class="flex items-center justify-center gap-1 mb-2">
                <span class="text-red-500 font-bold">CS</span>
                <span class="text-ink font-semibold">ESCORTS</span>
            </div>
            <p class="text-muted text-xs">Â© <?= date('Y') ?> cseescorts.cl - Todos los derechos reservados.</p>
            <p class="text-muted text-xs mt-1">Solo para mayores de 18 años.</p>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.umd.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swiper@14/swiper-bundle.min.js"></script>
    <script>
        Fancybox.bind('[data-fancybox="gallery"]', {
            animated: true,
            showClass: 'f-fadeIn',
            hideClass: 'f-fadeOut',
            dragToClose: true,
            Toolbar: false,
            Thumbs: false,
            Image: { zoom: true }
        });

        function compartir() { openShareModal(); }

        function openShareModal() {
            var u = encodeURIComponent(window.location.href);
            var t = encodeURIComponent('Te recomiendo el perfil de <?= e($escort['nombre']) ?> en Kimi');
            document.getElementById('share-wa').href = 'https://wa.me/?text=' + t + '%0A' + u;
            document.getElementById('share-x').href = 'https://twitter.com/intent/tweet?text=' + t + '&url=' + u;
            document.getElementById('share-fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + u;
            document.getElementById('share-tg').href = 'https://t.me/share/url?url=' + u + '&text=' + t;
            document.getElementById('share-em').href = 'mailto:?subject=' + t + '&body=' + t + '%0A' + u;
            var modal = document.getElementById('share-modal');
            modal.classList.remove('hidden'); modal.classList.add('flex');
            document.addEventListener('keydown', function escShare(e) {
                if (e.key === 'Escape') { closeShareModal(); document.removeEventListener('keydown', escShare); }
            });
        }

        function closeShareModal() {
            var modal = document.getElementById('share-modal');
            modal.classList.add('hidden'); modal.classList.remove('flex');
        }

        function volverArriba() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        (function() {
            var btn = document.getElementById('btn-volver-arriba');
            if (!btn) return;
            function toggle() {
                if (window.scrollY > 400) {
                    btn.classList.remove('hidden'); btn.classList.add('flex');
                } else {
                    btn.classList.add('hidden'); btn.classList.remove('flex');
                }
            }
            window.addEventListener('scroll', toggle, { passive: true });
            toggle();
        })();

        function copiarEnlace(btn) {
            navigator.clipboard.writeText(window.location.href).then(function() {
                var orig = btn.innerHTML;
                var origClass = btn.className;
                btn.innerHTML = '<i class="fas fa-check"></i> ¡Enlace copiado!';
                btn.className = btn.className.replace('bg-red-500', 'bg-green-500').replace('hover:bg-red-600', 'hover:bg-green-600');
                setTimeout(function() { btn.innerHTML = orig; btn.className = origClass; }, 2000);
            }).catch(function(e) {});
        }

        function getUsuarioToken() { return localStorage.getItem('usuario_token'); }

        function getAuthHeaders() {
            var h = { 'Content-Type': 'application/json' };
            var t = getUsuarioToken();
            if (t) h['Authorization'] = 'Bearer ' + t;
            return h;
        }

        // Verificar si el usuario ya dio like
        (function() {
            var token = getUsuarioToken();
            if (!token) return;
             fetch('/api/escorts/favorito.php?id=<?= $id ?>', { headers: getAuthHeaders() })
                 .then(function(r) {
                     if (!r.headers.get('content-type') || !r.headers.get('content-type').includes('application/json')) {
                         throw new Error('Respuesta inválida');
                     }
                     return r.json();
                 })
                .then(function(d) {
                    if (d.success && d.favorito) {
                        var btn = document.getElementById('btn-like');
                        if (!btn) return;
                        btn.classList.remove('bg-red-500/20', 'text-red-400', 'border', 'border-red-500/30');
                        btn.classList.add('bg-red-500', 'text-white', 'shadow-lg', 'shadow-red-500/20');
                        var icon = btn.querySelector('i');
                        if (icon) { icon.classList.remove('far'); icon.classList.add('fas'); }
                    }
                })
                .catch(function() {});
        })();

        function toggleLike(btn) {
            var icon = btn.querySelector('i');
            var countEl = document.getElementById('likes-count');
            var liked = btn.classList.contains('bg-red-500');
            var token = getUsuarioToken();
            if (!token) { window.location.href = '/ingresar'; return; }
             fetch('/api/escorts/favorito.php?id=<?= $id ?>', { method: liked ? 'DELETE' : 'POST', headers: getAuthHeaders() })
                 .then(function(r) {
                     if (!r.headers.get('content-type') || !r.headers.get('content-type').includes('application/json')) {
                         throw new Error('Respuesta inválida');
                     }
                     return r.json();
                 })
                .then(function(d) {
                    if (d.success) {
                        if (liked) {
                            btn.classList.remove('bg-red-500', 'text-white', 'shadow-lg', 'shadow-red-500/20');
                            btn.classList.add('bg-red-500/20', 'text-red-400', 'border', 'border-red-500/30');
                            icon.classList.remove('fas');
                            icon.classList.add('far');
                        } else {
                            btn.classList.remove('bg-red-500/20', 'text-red-400', 'border', 'border-red-500/30');
                            btn.classList.add('bg-red-500', 'text-white', 'shadow-lg', 'shadow-red-500/20');
                            icon.classList.remove('far');
                            icon.classList.add('fas');
                        }
                        if (countEl) countEl.textContent = d.likes;
                    }
                })
                .catch(function() {});
        }

        // Report modal functions
        var reportMotivo = '';

        // Toast/notification system (replaces alert)
        function showToast(message, type) {
            var container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.className = 'fixed bottom-6 right-6 z-50 space-y-2';
                document.body.appendChild(container);
            }
            var toast = document.createElement('div');
            toast.className = 'px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 transform transition-all duration-300 animate-slide-in ' +
                (type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white');
            toast.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle') + '"></i>' +
                '<span class="text-sm font-medium">' + message + '</span>';
            container.appendChild(toast);
            setTimeout(function() {
                toast.classList.add('opacity-0', '-translate-x-full');
                setTimeout(function() { toast.remove(); }, 300);
            }, 3000);
        }

        function showConfirm(message, onConfirm) {
            var modal = document.getElementById('confirm-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'confirm-modal';
                modal.className = 'fixed inset-0 z-50 hidden items-center justify-center px-4';
                modal.innerHTML = '<div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeConfirmModal()"></div>' +
                    '<div class="relative bg-surface border border-white/10 rounded-2xl max-w-md w-full p-6">' +
                    '<button onclick="closeConfirmModal()" class="absolute top-3 right-3 text-muted hover:text-ink text-xl p-1"><i class="fas fa-times"></i></button>' +
                    '<h3 class="text-ink font-bold text-lg mb-4"><i class="fas fa-question-circle text-yellow-400 mr-2"></i>Confirmar</h3>' +
                    '<p class="text-muted text-sm mb-6" id="confirm-message"></p>' +
                    '<div class="flex justify-end gap-3">' +
                    '<button onclick="closeConfirmModal()" class="px-4 py-2 bg-surface2 hover:bg-raised text-muted font-medium rounded-lg text-sm transition-all">Cancelar</button>' +
                    '<button onclick="executeConfirm()" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg text-sm transition-all flex items-center gap-2"><i class="fas fa-check"></i> Confirmar</button>' +
                    '</div></div>';
                document.body.appendChild(modal);
            }
            document.getElementById('confirm-message').textContent = message;
            window.confirmCallback = onConfirm;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeConfirmModal() {
            var modal = document.getElementById('confirm-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            window.confirmCallback = null;
        }

        function executeConfirm() {
            if (window.confirmCallback) {
                window.confirmCallback();
            }
            closeConfirmModal();
        }

        function getUsuarioToken() { return localStorage.getItem('usuario_token'); }

        function getAuthHeaders() {
            var h = { 'Content-Type': 'application/json' };
            var t = getUsuarioToken();
            if (t) h['Authorization'] = 'Bearer ' + t;
            return h;
        }

        // Report modal functions
        var reportMotivo = '';

        function openReportModal() {
            var token = getUsuarioToken();
            if (!token) {
                showConfirm('Debes iniciar sesión para reportar un perfil. Â¿Quieres ir a la página de acceso?', function() {
                    window.location.href = '/ingresar';
                });
                return;
            }
            reportMotivo = '';
            resetReportMotivos();
            document.getElementById('report-modal').classList.remove('hidden');
            document.getElementById('report-modal').classList.add('flex');
            document.getElementById('report-detalle-container').classList.add('hidden');
            document.getElementById('report-detalle').value = '';
        }

        function resetReportMotivos() {
            var btns = document.querySelectorAll('#report-modal .report-motivo-btn');
            for (var i = 0; i < btns.length; i++) {
                var b = btns[i];
                b.style.backgroundColor = '';
                b.style.borderColor = '';
                b.style.color = '';
                var check = b.querySelector('.report-check');
                if (check) check.classList.add('hidden');
            }
        }

        function closeReportModal() {
            document.getElementById('report-modal').classList.add('hidden');
            document.getElementById('report-modal').classList.remove('flex');
        }

        function selectReportMotivo(motivo) {
            reportMotivo = motivo;
            var btns = document.querySelectorAll('#report-modal .report-motivo-btn');
            for (var i = 0; i < btns.length; i++) {
                var b = btns[i];
                var check = b.querySelector('.report-check');
                var selected = b.getAttribute('data-motivo') === motivo;
                if (selected) {
                    b.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                    b.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                    b.style.color = '#fca5a5';
                    if (check) check.classList.remove('hidden');
                } else {
                    b.style.backgroundColor = '';
                    b.style.borderColor = '';
                    b.style.color = '';
                    if (check) check.classList.add('hidden');
                }
            }
            if (motivo === 'otro') {
                document.getElementById('report-detalle-container').classList.remove('hidden');
            } else {
                document.getElementById('report-detalle-container').classList.add('hidden');
            }
        }

        function enviarReporte() {
            if (!reportMotivo) {
                showToast('Selecciona un motivo', 'error');
                return;
            }
            var detalle = document.getElementById('report-detalle').value.trim();
            var btn = event.target;
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            fetch('/api/reportes.php', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    escort_id: <?= $id ?>,
                    motivo: reportMotivo,
                    detalle: detalle || null
                })
            })
             .then(function(r) {
                 if (!r.headers.get('content-type') || !r.headers.get('content-type').includes('application/json')) {
                     throw new Error('Respuesta inválida del servidor');
                 }
                 return r.json();
             })
             .then(function(d) {
                 if (d.success) {
                     showToast('Reporte enviado correctamente. Nuestro equipo lo revisará pronto.', 'success');
                     closeReportModal();
                 } else {
                     showToast(d.error || 'Error al enviar reporte', 'error');
                 }
             })
             .catch(function(err) {
                 showToast(err.message || 'Error de conexión', 'error');
             })
            .finally(function() {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Enviar reporte';
            });
        }
    </script>
</body>

</html>


