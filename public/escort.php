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

    $pdo = getDBConnection();

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
    $stmt = $pdo->prepare("SELECT * FROM escorts WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    // Si no existe
    if (!$escort) {
        showNotFound('Esta escort no existe en nuestro sistema');
        exit;
    }

    // Si existe pero no está activa
    if ($escort['activa'] != 1) {
        showNotAvailable($escort);
        exit;
    }

    // === Registrar visita (con dedup por cookie para evitar inflar con recargas) ===
    $cookieName = 'visited_' . $id;
    if (empty($_COOKIE[$cookieName])) {
        try {
            $pdo->prepare("UPDATE escorts SET visitas_perfil = visitas_perfil + 1 WHERE id = ?")->execute([$id]);
            setcookie($cookieName, '1', time() + 21600, '/', '', false, true); // 6 horas
        } catch (Exception $e) {
            // No crítico
        }
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

    // Atributos (label => valor) - solo los que existen
    $atributos = [];
    if (!empty($escort['edad']))         $atributos[] = ['icon' => 'fa-birthday-cake', 'label' => 'Edad',        'valor' => $escort['edad'] . ' años'];
    if (!empty($escort['altura']))       $atributos[] = ['icon' => 'fa-ruler-vertical','label' => 'Altura',      'valor' => $escort['altura'] . ' cm'];
    if (!empty($escort['peso']))         $atributos[] = ['icon' => 'fa-weight-scale',  'label' => 'Peso',        'valor' => $escort['peso'] . ' kg'];
    if (!empty($escort['medidas']))      $atributos[] = ['icon' => 'fa-vector-square',  'label' => 'Medidas',     'valor' => $escort['medidas']];
    if (!empty($escort['nacionalidad'])) $atributos[] = ['icon' => 'fa-flag',           'label' => 'Nacionalidad','valor' => $escort['nacionalidad']];
    if (!empty($escort['etnia']))        $atributos[] = ['icon' => 'fa-user',           'label' => 'Etnia',       'valor' => $escort['etnia']];
    if (!empty($escort['color_pelo']))   $atributos[] = ['icon' => 'fa-scissors',       'label' => 'Color de pelo','valor' => $escort['color_pelo']];
    if (!empty($escort['color_ojos']))   $atributos[] = ['icon' => 'fa-eye',            'label' => 'Color de ojos','valor' => $escort['color_ojos']];
    if (!empty($escort['orientacion']))  $atributos[] = ['icon' => 'fa-heart',          'label' => 'Orientación',  'valor' => $escort['orientacion']];
    if (!empty($escort['estilo']))       $atributos[] = ['icon' => 'fa-star',           'label' => 'Estilo',       'valor' => $escort['estilo']];
    if (!empty($escort['ciudad']))       $atributos[] = ['icon' => 'fa-map-marker-alt', 'label' => 'Ciudad',       'valor' => $escort['ciudad']];
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
        $waLink = 'https://wa.me/' . $waNum;
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
} catch (Throwable $e) {
    error_log("Error escort.php: " . $e->getMessage());
    showNotFound('Error del servidor');
    exit;
}

function e($str)
{
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

// === PÁGINA: Escort no encontrada ===
function showNotFound($mensaje = 'Escort no encontrada')
{
?>
    <!DOCTYPE html>
    <html lang="es">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>No encontrada - CSEscorts</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * {
                font-family: 'Inter', sans-serif
            }

            body {
                background: #0f0f1a;
                color: #fff
            }
        </style>
    </head>

    <body class="min-h-screen flex items-center justify-center">
        <div class="text-center px-4">
            <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <i class="fas fa-search text-red-500 text-3xl"></i>
            </div>
            <h1 class="text-2xl font-bold text-white mb-2">No encontrada</h1>
            <p class="text-gray-400 mb-8 max-w-md mx-auto"><?= e($mensaje) ?></p>
            <a href="/" class="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all">
                <i class="fas fa-arrow-left"></i> Volver al inicio
            </a>
            <div class="mt-8 flex justify-center gap-4 text-sm text-gray-500">
                <a href="/" class="hover:text-red-400 transition-colors">Inicio</a>
                <span>•</span>
                <a href="#" class="hover:text-red-400 transition-colors">Ciudades</a>
                <span>•</span>
                <a href="/panel" class="hover:text-red-400 transition-colors">Panel Escort</a>
            </div>
        </div>
    </body>

    </html>
<?php
}

// === PÁGINA: Escort no disponible (existe pero inactiva) ===
function showNotAvailable($escort)
{
?>
    <!DOCTYPE html>
    <html lang="es">

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>No disponible - <?= e($escort['nombre']) ?> - CSEscorts</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * {
                font-family: 'Inter', sans-serif
            }

            body {
                background: #0f0f1a;
                color: #fff
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
                        <i class="fas fa-user text-gray-500 text-4xl"></i>
                    <?php endif; ?>
                </div>
                <div class="absolute -bottom-2 -right-2 w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center border-2 border-[#0f0f1a]">
                    <i class="fas fa-clock text-gray-400 text-xs"></i>
                </div>
            </div>

            <h1 class="text-2xl font-bold text-white mb-1"><?= e($escort['nombre']) ?></h1>
            <p class="text-gray-500 text-sm mb-6"><?= $escort['edad'] ?> años • <?= e($escort['ciudad']) ?></p>

            <div class="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 mb-8">
                <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <i class="fas fa-pause-circle text-yellow-500 text-2xl"></i>
                </div>
                <h2 class="text-lg font-semibold text-white mb-2">Perfil temporalmente no disponible</h2>
                <p class="text-gray-400 text-sm">
                    Esta escort ha pausado su perfil o está siendo revisado por nuestro equipo.
                    Vuelve a intentarlo más tarde o explora otros perfiles disponibles.
                </p>
            </div>

            <div class="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="/" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all">
                    <i class="fas fa-fire"></i> Ver escorts activas
                </a>
                <a href="/" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a2e] hover:bg-[#252538] text-white border border-white/10 rounded-lg font-medium transition-all">
                    <i class="fas fa-arrow-left"></i> Volver al inicio
                </a>
            </div>

            <div class="mt-8 flex justify-center gap-4 text-sm text-gray-500">
                <a href="/" class="hover:text-red-400 transition-colors">Inicio</a>
                <span>•</span>
                <a href="#" class="hover:text-red-400 transition-colors">Ciudades</a>
                <span>•</span>
                <a href="/panel" class="hover:text-red-400 transition-colors">Publicar</a>
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
    <title><?= e($escort['nombre']) ?>, <?= $escort['edad'] ?> años | CSEscorts.cl</title>
    <meta name="description" content="<?= e($escort['descripcion_corta'] ?? ($escort['descripcion_larga'] ? mb_substr($escort['descripcion_larga'], 0, 160) : 'Perfil de ' . $escort['nombre'] . ' en ' . $escort['ciudad'])) ?>">
    <meta property="og:title" content="<?= e($escort['nombre']) ?>, <?= $escort['edad'] ?> años - CSEscorts">
    <meta property="og:description" content="<?= e($escort['descripcion_corta'] ?? 'Perfil verificado de ' . $escort['nombre'] . ' en ' . $escort['ciudad']) ?>">
    <?php if ($escort['foto_principal']): ?>
    <meta property="og:image" content="<?= e($escort['foto_principal']) ?>">
    <?php endif; ?>
    <meta property="og:url" content="https://kimi.zona8.cl/<?= $id ?>">
    <meta property="og:type" content="profile">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?= e($escort['nombre']) ?>, <?= $escort['edad'] ?> años - CSEscorts">
    <?php if ($escort['foto_principal']): ?>
    <meta name="twitter:image" content="<?= e($escort['foto_principal']) ?>">
    <?php endif; ?>

    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.css">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "<?= e($escort['nombre']) ?>",
        "description": "<?= e($escort['descripcion_corta'] ?? 'Perfil de ' . $escort['nombre']) ?>",
        "url": "https://kimi.zona8.cl/<?= $id ?>",
        "image": "<?= e($escort['foto_principal'] ?? '') ?>",
        "gender": "female",
        "nationality": "<?= e($escort['nacionalidad'] ?? '') ?>"
        <?php if (!empty($escort['ciudad'])): ?>
        ,"address": { "@type": "PostalAddress", "addressLocality": "<?= e($escort['ciudad']) ?>" }
        <?php endif; ?>
    }
    </script>

    <style>
        * {
            font-family: 'Inter', system-ui, sans-serif
        }

        body {
            background: #0f0f1a;
            color: #fff
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
            background: #0f0f1a
        }

        ::-webkit-scrollbar-thumb {
            background: #2d2d44;
            border-radius: 4px
        }

        .fancybox__container {
            --fancybox-bg: rgba(15, 15, 26, .95)
        }
    </style>
</head>

<body class="min-h-screen">

    <!-- NAVBAR -->
    <nav class="fixed top-0 left-0 right-0 z-50 bg-[#0f0f1a]/95 backdrop-blur-sm border-b border-white/5">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <a href="/" class="flex items-center gap-1 shrink-0">
                    <span class="text-red-500 font-bold text-xl">CS</span>
                    <span class="text-white font-semibold text-xl">Escorts</span>
                </a>
                <div class="hidden md:flex items-center gap-2">
                    <a href="/" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <i class="fas fa-home"></i> Inicio
                    </a>
                    <a href="#" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                        <i class="fas fa-map-marker-alt"></i> Ciudades
                    </a>
                </div>
                <div id="navbar-actions" class="hidden md:flex items-center gap-3">
                    <a href="/micuenta/login" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white border border-white/10 hover:border-white/20 transition-all">
                        <i class="fas fa-user-shield"></i> Acceso Escort
                    </a>
                    <a href="/micuenta/registro" class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg shadow-red-500/25">
                        <i class="fas fa-plus"></i> Publicar
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <script>
    (function() {
        var actions = document.getElementById('navbar-actions');
        if (!actions) return;
        var escortData = (function() { try { return JSON.parse(localStorage.getItem('escort_data')); } catch(e) { return null; } })();
        var usuarioData = (function() { try { return JSON.parse(localStorage.getItem('usuario_data')); } catch(e) { return null; } })();

        if (escortData) {
            actions.innerHTML =
                '<span class="text-gray-400 text-sm mr-1"><i class="fas fa-user-shield mr-1.5 text-amber-400"></i>' + escapar(escortData.nombre) + '</span>' +
                '<a href="/micuenta/resumen" class="px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all" title="Mi Panel"><i class="fas fa-tachometer-alt"></i></a>' +
                '<button onclick="localStorage.removeItem(\'escort_token\');localStorage.removeItem(\'escort_data\');window.location.href=\'/\';" class="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-white/5 transition-all" title="Cerrar sesión"><i class="fas fa-sign-out-alt"></i></button>';
        } else if (usuarioData) {
            actions.innerHTML =
                '<span class="text-gray-400 text-sm mr-1"><i class="fas fa-user mr-1.5 text-red-400"></i>' + escapar(usuarioData.nombre) + '</span>' +
                '<a href="/mi-cuenta" class="px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all" title="Mi Cuenta"><i class="fas fa-tachometer-alt"></i></a>' +
                '<a href="/mis-favoritos" class="px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all" title="Mis Favoritos"><i class="fas fa-heart"></i></a>' +
                '<a href="/mi-perfil" class="px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all" title="Mi Perfil"><i class="fas fa-user-edit"></i></a>' +
                '<button onclick="localStorage.removeItem(\'usuario_token\');localStorage.removeItem(\'usuario_data\');window.location.href=\'/\';" class="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-white/5 transition-all" title="Cerrar sesión"><i class="fas fa-sign-out-alt"></i></button>';
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
            <nav class="flex items-center gap-2 text-sm mb-8 text-gray-500">
                <a href="/" class="hover:text-red-400 transition-colors">Inicio</a>
                <span>/</span>
                <a href="/ciudad/<?= urlencode(strtolower($escort['ciudad'])) ?>" class="hover:text-red-400 transition-colors capitalize"><?= e($escort['ciudad']) ?></a>
                <span>/</span>
                <span class="text-gray-400"><?= e($escort['nombre']) ?></span>
            </nav>

            <!-- HEADER -->
            <div class="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
                <div class="shrink-0">
                    <div class="relative">
                        <div class="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden bg-[#1a1a2e] border-2 border-white/10">
                            <?php if ($escort['foto_principal']): ?>
                                <img src="<?= e($escort['foto_principal']) ?>" alt="<?= e($escort['nombre']) ?>" class="w-full h-full object-cover">
                            <?php else: ?>
                                <div class="w-full h-full flex items-center justify-center"><i class="fas fa-user text-gray-600 text-4xl"></i></div>
                            <?php endif; ?>
                        </div>
                        <?php if ($escort['vip'] == 1): ?>
                            <div class="absolute -bottom-1 -right-1 w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center border-2 border-[#0f0f1a] shadow-lg">
                                <i class="fas fa-crown text-white text-xs"></i>
                            </div>
                        <?php endif; ?>
                        <?php if ($escort['verificado'] == 1): ?>
                            <div class="absolute -top-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#0f0f1a]">
                                <i class="fas fa-check text-white text-xs"></i>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-2 flex-wrap">
                        <h1 class="text-2xl md:text-3xl font-bold text-white"><?= e($escort['nombre']) ?></h1>
                        <span class="text-gray-400 text-lg">, <?= $escort['edad'] ?> Años</span>
                    </div>

                    <?php if ($telefonoFormateado): ?>
                        <a href="tel:<?= preg_replace('/\D/', '', $escort['telefono']) ?>" class="inline-block text-green-400 text-lg font-semibold mb-3 hover:text-green-300 transition-colors">
                            <?= e($telefonoFormateado) ?>
                        </a>
                    <?php endif; ?>

                    <div class="flex items-center gap-2 text-sm text-gray-400 mb-5 flex-wrap">
                        <span class="uppercase tracking-wide">MUJER</span>
                        <span class="text-gray-600">/</span>
                        <span class="flex items-center gap-1">
                            <span class="text-white font-semibold" id="likes-count"><?= $likes ?></span>
                            <span class="text-red-400">ME GUSTAS</span>
                            <i class="fas fa-heart text-red-500 text-xs"></i>
                        </span>
                        <span class="text-gray-600">/</span>
                        <span class="uppercase tracking-wide"><?= e($escort['ciudad']) ?></span>
                    </div>

                    <div class="flex flex-wrap gap-3">
                        <?php if ($escort['telefono']): ?>
                            <a href="tel:<?= preg_replace('/\D/', '', $escort['telefono']) ?>" class="flex items-center gap-2 px-5 py-2.5 rounded-lg btn-red text-white font-medium text-sm shadow-lg shadow-red-500/20">
                                <i class="fas fa-phone-alt"></i> Llamar
                            </a>
                        <?php endif; ?>
                        <?php if ($waLink): ?>
                            <a href="<?= $waLink ?>" target="_blank" class="flex items-center gap-2 px-5 py-2.5 rounded-lg btn-green text-white font-medium text-sm shadow-lg shadow-green-500/20">
                                <i class="fab fa-whatsapp"></i> Contáctame
                            </a>
                        <?php endif; ?>
                        <button onclick="compartir()" class="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-medium text-sm transition-all">
                            <i class="fas fa-share-alt"></i> Compartir
                        </button>
                        <button onclick="toggleLike(this)" class="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" id="btn-like">
                            <i class="far fa-heart"></i> Me Gusta
                        </button>
                    </div>
                </div>
            </div>

            <!-- DESCRIPCIÓN -->
            <?php if ($escort['descripcion_larga'] || $escort['descripcion_corta']): ?>
                <div class="mb-8">
                    <p class="text-gray-300 text-base leading-relaxed"><?= nl2br(e($escort['descripcion_larga'] ?: $escort['descripcion_corta'])) ?></p>
                </div>
            <?php endif; ?>

            <!-- DETALLES / CARACTERÍSTICAS -->
            <?php if (!empty($atributos)): ?>
                <div class="mb-8">
                    <h2 class="text-white text-lg font-bold mb-5 flex items-center gap-2"><i class="fas fa-clipboard-list text-gray-600"></i> Detalles</h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
                        <?php foreach ($atributos as $attr): ?>
                            <div class="flex items-start gap-2.5">
                                <i class="fas <?= e($attr['icon']) ?> text-gray-600 mt-0.5 text-xs w-3.5 shrink-0"></i>
                                <div class="min-w-0">
                                    <div class="text-gray-600 text-[0.6rem] uppercase tracking-widest"><?= e($attr['label']) ?></div>
                                    <div class="text-gray-300 text-sm capitalize truncate"><?= e($attr['valor']) ?></div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- SERVICIOS INCLUIDOS -->
            <?php if (!empty($serviciosIncluidos)): ?>
                <div class="mb-8">
                    <h2 class="text-gray-500 text-sm font-medium uppercase tracking-wider mb-3">Servicios Incluidos</h2>
                    <div class="flex flex-wrap gap-2">
                        <?php foreach ($serviciosIncluidos as $serv): ?>
                            <span class="px-3 py-1.5 rounded-md badge-red text-xs font-semibold"><?= e($serv) ?></span>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- SERVICIOS ADICIONALES -->
            <?php if (!empty($serviciosAdicionales)): ?>
                <div class="mb-8">
                    <h2 class="text-gray-500 text-sm font-medium uppercase tracking-wider mb-3">Servicios Adicionales</h2>
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
                    <h2 class="text-gray-500 text-sm font-medium uppercase tracking-wider mb-3">Tarifas</h2>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <?php if (isset($tarifas['30min'])): ?>
                            <div class="bg-[#1a1a2e] border border-white/10 rounded-lg p-4 text-center">
                                <div class="text-gray-500 text-xs mb-1">30 Minutos</div>
                                <div class="text-white font-bold text-lg">$<?= number_format($tarifas['30min'], 0, ',', '.') ?></div>
                            </div>
                        <?php endif; ?>
                        <?php if (isset($tarifas['1h'])): ?>
                            <div class="bg-[#1a1a2e] border border-white/10 rounded-lg p-4 text-center">
                                <div class="text-gray-500 text-xs mb-1">1 Hora</div>
                                <div class="text-white font-bold text-lg">$<?= number_format($tarifas['1h'], 0, ',', '.') ?></div>
                            </div>
                        <?php endif; ?>
                        <?php if (isset($tarifas['2h'])): ?>
                            <div class="bg-[#1a1a2e] border border-white/10 rounded-lg p-4 text-center">
                                <div class="text-gray-500 text-xs mb-1">2 Horas</div>
                                <div class="text-white font-bold text-lg">$<?= number_format($tarifas['2h'], 0, ',', '.') ?></div>
                            </div>
                        <?php endif; ?>
                        <?php if (isset($tarifas['noche'])): ?>
                            <div class="bg-[#1a1a2e] border border-white/10 rounded-lg p-4 text-center">
                                <div class="text-gray-500 text-xs mb-1">Toda la Noche</div>
                                <div class="text-white font-bold text-lg">$<?= number_format($tarifas['noche'], 0, ',', '.') ?></div>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- GALERÍA -->
            <?php if (!empty($fotos)): ?>
                <div class="mb-10">
                    <h2 class="text-white text-lg font-bold mb-4 flex items-center gap-2"><i class="fas fa-images text-red-500"></i> Galería</h2>

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
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-400 text-sm">
                            <i class="fas fa-calendar text-gray-500"></i> <?= date('M Y', strtotime($escort['created_at'])) ?>
                        </span>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-400 text-sm">
                            <i class="fas fa-map-marker-alt text-gray-500"></i> <?= e($escort['ciudad']) ?>
                        </span>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <?php foreach ($fotos as $i => $foto): ?>
                            <?php $isVideo = preg_match('/\.(mp4|webm|mov)$/i', $foto); ?>
                            <a href="<?= e($foto) ?>" data-fancybox="gallery" data-caption="<?= e($escort['nombre']) ?> - <?= $i + 1 ?>" class="gallery-item aspect-[3/4] bg-[#1a1a2e] border border-white/10 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10 transition-all rounded-xl overflow-hidden group">
                                <?php if ($isVideo): ?>
                                <video src="<?= e($foto) ?>" preload="metadata" muted playsinline class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"></video>
                                <?php else: ?>
                                <img src="<?= e($foto) ?>" alt="<?= e($escort['nombre']) ?> - <?= $i + 1 ?>" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="<?= $i < 4 ? 'eager' : 'lazy' ?>">
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
                    <h2 class="text-white text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-comments text-red-500"></i>
                        Comentarios <span id="comentarios-total" class="text-gray-500 text-sm font-normal"></span>
                    </h2>
                </div>

                <div id="comentarios-form" class="hidden mb-8">
                    <div class="bg-[#1a1a2e] border border-white/10 rounded-xl p-5">
                        <h3 class="text-white text-sm font-semibold mb-3">Deja tu comentario</h3>
                        <textarea id="comentario-text" rows="3" placeholder="Escribe tu experiencia con <?= e($escort['nombre']) ?>..." class="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-red-500/50 transition-colors placeholder-gray-600 resize-none mb-3"></textarea>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-gray-400 text-xs">Puntuación:</span>
                                <div class="flex gap-1" id="puntuacion-estrellas">
                                    <?php for ($i = 1; $i <= 5; $i++): ?>
                                    <button type="button" onclick="setPuntuacion(<?= $i ?>)" class="text-gray-600 hover:text-yellow-400 transition-colors text-sm punt-star" data-val="<?= $i ?>">
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
                    <div class="bg-[#1a1a2e] border border-white/10 rounded-xl p-5 text-center">
                        <p class="text-gray-400 text-sm mb-3">
                            <i class="fas fa-user-lock text-gray-500 mr-2"></i>
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
                        <i class="fas fa-comment-slash text-gray-600 text-2xl mb-2"></i>
                        <p class="text-gray-500 text-sm">No hay comentarios aún. ¡Sé el primero!</p>
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
                        el.classList.remove('text-gray-600');
                        el.classList.add('text-yellow-400');
                    } else {
                        icon.classList.remove('fas');
                        icon.classList.add('far');
                        el.classList.remove('text-yellow-400');
                        el.classList.add('text-gray-600');
                    }
                });
            }

            function cargarComentarios() {
                fetch('/api/comentarios/listar.php?escort_id=<?= $id ?>')
                    .then(function(r) { return r.json(); })
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
                            lista.innerHTML += '<div class=\"bg-[#1a1a2e] border border-white/10 rounded-xl p-4\">' +
                                '<div class=\"flex items-center justify-between mb-2\">' +
                                '<div class=\"flex items-center gap-2\">' +
                                '<div class=\"w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs font-bold\">' + c.usuario.charAt(0).toUpperCase() + '</div>' +
                                '<span class=\"text-gray-300 text-sm font-medium\">' + c.usuario + '</span>' +
                                (estrellas ? '<span class=\"flex gap-0.5 ml-1\">' + estrellas + '</span>' : '') +
                                '</div>' +
                                '<span class=\"text-gray-600 text-xs\">' + fecha + '</span>' +
                                '</div>' +
                                '<p class=\"text-gray-400 text-sm leading-relaxed\">' + c.comentario + '</p>' +
                                '</div>';
                        });
                    })
                    .catch(function() {});
            }

            function enviarComentario(btn) {
                var texto = document.getElementById('comentario-text').value.trim();
                var errorEl = document.getElementById('comentario-error');
                errorEl.classList.remove('text-green-400');
                errorEl.classList.add('hidden');
                if (texto.length < 10) {
                    errorEl.textContent = 'El comentario debe tener al menos 10 caracteres';
                    errorEl.classList.remove('hidden');
                    return;
                }
                btn.disabled = true;
                btn.textContent = 'Enviando...';
                fetch('/api/comentarios/crear.php', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ escort_id: <?= $id ?>, comentario: texto, puntuacion: currentPuntuacion || null })
                })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.success) {
                        document.getElementById('comentario-text').value = '';
                        setPuntuacion(0);
                        errorEl.classList.remove('hidden');
                        errorEl.classList.add('text-green-400');
                        errorEl.textContent = 'Comentario enviado. Será revisado antes de publicarse.';
                        setTimeout(function() { errorEl.classList.add('hidden'); }, 5000);
                    } else {
                        if (data.fieldErrors && data.fieldErrors.comentario) {
                            errorEl.textContent = data.fieldErrors.comentario;
                        } else {
                            errorEl.textContent = data.error || 'Error al enviar comentario';
                        }
                        errorEl.classList.remove('hidden');
                    }
                })
                .catch(function() {
                    errorEl.textContent = 'Error de conexión';
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

    <!-- FOOTER -->
    <footer class="bg-[#0a0a12] border-t border-white/5">
        <div class="max-w-7xl mx-auto px-4 py-8 text-center">
            <div class="flex items-center justify-center gap-1 mb-2">
                <span class="text-red-500 font-bold">CS</span>
                <span class="text-white font-semibold">ESCORTS</span>
            </div>
            <p class="text-gray-600 text-xs">© <?= date('Y') ?> cseescorts.cl - Todos los derechos reservados.</p>
            <p class="text-gray-700 text-xs mt-1">Solo para mayores de 18 años.</p>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.umd.js"></script>
    <script>
        Fancybox.bind('[data-fancybox="gallery"]', {
            animated: true,
            showClass: 'f-fadeIn',
            hideClass: 'f-fadeOut',
            dragToClose: true,
            Toolbar: false,
            Thumbs: { autoStart: true },
            Image: { zoom: true }
        });

        function compartir() {
            const url = window.location.href;
            if (navigator.share) {
                navigator.share({ title: document.title, url });
            } else {
                navigator.clipboard.writeText(url).then(() => {
                    const btn = event.currentTarget;
                    const orig = btn.innerHTML;
                    btn.innerHTML = '<i class=\"fas fa-check\"></i> Copiado';
                    setTimeout(() => btn.innerHTML = orig, 2000);
                });
            }
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
                .then(function(r) { return r.json(); })
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
                .then(function(r) { return r.json(); })
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
    </script>
</body>

</html>