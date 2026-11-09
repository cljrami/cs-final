<?php
// public/blog.php - Página pública individual de artículo: /blog/{slug}
// Renderiza un artículo publicado con SEO completo (meta, canonical, robots,
// OpenGraph, JSON-LD Article) y navegación del sitio.
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
    require_once __DIR__ . '/api/bootstrap.php';
    if (!defined('SITE_URL')) { require_once __DIR__ . '/api/config/mail.php'; }
    $pdo = getDBConnection();

    // Configuración del sitio
    $cfg = [];
    try {
        $cStmt = $pdo->query("SELECT clave, valor FROM configuracion");
        foreach ($cStmt->fetchAll(PDO::FETCH_KEY_PAIR) as $k => $v) {
            $cfg[$k] = $v;
        }
    } catch (Throwable $e) {}

    $nav = [
        'logo1'    => $cfg['nav_logo_1'] ?? 'CS',
        'logo2'    => $cfg['nav_logo_2'] ?? 'Escorts',
        'inicio'   => $cfg['nav_inicio'] ?? 'Inicio',
        'ciudades' => $cfg['nav_ciudades'] ?? 'Ciudades',
    ];

    $siteName = defined('SITE_NAME') ? SITE_NAME : 'ConsexVIP';
    $defaultTitle = ($cfg['seo_titulo'] ?? '') ?: ($siteName . ' | Escorts');
    $defaultDesc = $cfg['seo_descripcion'] ?? '';

    $slug = isset($_GET['slug']) ? trim($_GET['slug']) : '';

    // Sin slug → redirigir a home
    if ($slug === '') {
        header('Location: /');
        exit;
    }

    // Artículo publicado y vigente
    $stmt = $pdo->prepare("
        SELECT a.*, c.nombre AS categoria_nombre, c.slug AS categoria_slug
        FROM articulos a
        LEFT JOIN blog_categorias c ON c.id = a.categoria_id
        WHERE a.slug = ? AND a.estado = 'publicado' AND a.published_at <= NOW()
        LIMIT 1
    ");
    $stmt->execute([$slug]);
    $a = $stmt->fetch(PDO::FETCH_ASSOC);

    $pageCssV = @filemtime(__DIR__ . '/_astro/escort-profile.css');
    $pageCssV = $pageCssV ?: time();

    function blog_head_seo($a) {
        global $siteName, $defaultDesc;
        $title = $a['meta_titulo'] ?: ($a['titulo'] . ' | ' . $siteName);
        $desc  = $a['meta_descripcion'] ?: ($a['extracto'] ?: $defaultDesc);
        $url   = $a['canonical'] ? $a['canonical'] : (SITE_URL . '/blog/' . $a['slug']);
        $img   = $a['imagen'] ? (strpos($a['imagen'], 'http') === 0 ? $a['imagen'] : (SITE_URL . $a['imagen'])) : '';
        $fecha = $a['published_at'] ?: $a['created_at'];
        $robots = ($a['robots'] === 'noindex') ? 'noindex,nofollow' : 'index,follow';
        $tags = htmlspecialchars($a['meta_keywords'] ?? '', ENT_QUOTES, 'UTF-8');
        $json = [
            '@context' => 'https://schema.org',
            '@type' => 'Article',
            'headline' => $title,
            'description' => $desc,
            'image' => $img,
            'author' => ['@type' => 'Person', 'name' => $a['autor'] ?: $siteName],
            'publisher' => ['@type' => 'Organization', 'name' => $siteName],
            'datePublished' => $fecha,
            'dateModified' => $a['updated_at'],
            'mainEntityOfPage' => ['@type' => 'WebPage', 'url' => $url],
        ];
        echo '<title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</title>';
        echo '<meta name="description" content="' . htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') . '">' . "\n";
        if ($tags) echo '<meta name="keywords" content="' . $tags . '">' . "\n";
        echo '<meta name="robots" content="' . $robots . '">' . "\n";
        echo '<link rel="canonical" href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '">' . "\n";
        echo '<meta property="og:title" content="' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '">' . "\n";
        echo '<meta property="og:description" content="' . htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') . '">' . "\n";
        echo '<meta property="og:type" content="article">' . "\n";
        echo '<meta property="og:url" content="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '">' . "\n";
        if ($img) echo '<meta property="og:image" content="' . htmlspecialchars($img, ENT_QUOTES, 'UTF-8') . '">' . "\n";
        echo '<meta property="article:published_time" content="' . htmlspecialchars($fecha, ENT_QUOTES, 'UTF-8') . '">' . "\n";
        echo '<meta property="article:modified_time" content="' . htmlspecialchars($a['updated_at'], ENT_QUOTES, 'UTF-8') . '">' . "\n";
        if ($a['categoria_nombre']) echo '<meta property="article:section" content="' . htmlspecialchars($a['categoria_nombre'], ENT_QUOTES, 'UTF-8') . '">' . "\n";
        echo '<script type="application/ld+json">' . json_encode($json, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_LINE_TERMINATORS) . '</script>' . "\n";
    }
    function blog_notFound() {
        global $pageCssV, $nav;
        http_response_code(404);
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/svg+xml" href="/favicon.svg" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#0a0a0f">
    <meta name="robots" content="noindex, nofollow">
    <title>Artículo no encontrado - Consexvip</title>
    <link rel="stylesheet" href="/_astro/escort-profile.css?v=<?= $pageCssV ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { font-family: 'Inter', sans-serif }
        body { background: var(--color-page); color: var(--color-ink) }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center">
    <div class="text-center px-4">
        <div class="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <i class="fas fa-search text-red-500 text-3xl"></i>
        </div>
        <h1 class="text-2xl font-bold mb-2">Artículo no encontrado</h1>
        <p class="text-muted mb-8 max-w-md mx-auto">El artículo que buscas no existe o aún no está publicado.</p>
        <a href="/" class="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all">
            <i class="fas fa-arrow-left"></i> Volver al inicio
        </a>
        <div class="mt-8 flex justify-center gap-4 text-sm text-muted">
            <a href="/" class="hover:text-red-400"><?= htmlspecialchars($nav['inicio'], ENT_QUOTES, 'UTF-8') ?></a>
            <span>&bull;</span>
            <a href="/ciudades" class="hover:text-red-400"><?= htmlspecialchars($nav['ciudades'], ENT_QUOTES, 'UTF-8') ?></a>
        </div>
    </div>
</body>
</html>
<?php
        exit;
    }

    if (!$a) {
        blog_notFound();
    }

    // Artículos relacionados (misma categoría o comparten etiquetas)
    $tags = [];
    if (!empty($a['etiquetas'])) {
        foreach (explode(',', $a['etiquetas']) as $t) {
            $t = trim($t);
            if ($t !== '') $tags[] = $t;
        }
    }
    $relParam = '';
    $relValues = [];
    if (!empty($a['categoria_id'])) {
        $relParam = 'a.categoria_id = ? OR ';
        $relValues[] = $a['categoria_id'];
    }
    if (!empty($tags)) {
        $in = implode(',', array_fill(0, count($tags), '?'));
        $relParam .= "a.etiquetas REGEXP ? OR ";
        $relValues[] = implode('|', array_map(function ($t) { return preg_quote(trim($t), '/'); }, $tags));
    }
    $relWhere = '';
    if ($relParam !== '') {
        $relWhere = 'AND (' . rtrim($relParam, ' OR ') . ') ';
    }
    $relWhere .= 'AND a.id != ?';
    $relValues[] = $a['id'];

    $relStmt = $pdo->prepare("
        SELECT a.id, a.titulo, a.slug, a.imagen, a.extracto, a.published_at, c.nombre AS categoria_nombre
        FROM articulos a
        LEFT JOIN blog_categorias c ON c.id = a.categoria_id
        WHERE a.estado = 'publicado' AND a.published_at <= NOW()
        " . $relWhere . "
        ORDER BY (CASE WHEN a.categoria_id = ? THEN 1 ELSE 0 END) DESC, a.published_at DESC, a.id DESC
        LIMIT 4
    ");
    // Bind rel params, then the ORDER BY categoria param
    $bindIdx = 1;
    foreach ($relValues as $rv) {
        if (is_int($rv)) { $relStmt->bindValue($bindIdx++, $rv, PDO::PARAM_INT); }
        else { $relStmt->bindValue($bindIdx++, $rv, PDO::PARAM_STR); }
    }
    $relStmt->bindValue($bindIdx, $a['categoria_id'] ?? null);
    $relStmt->execute();
    $relacionados = $relStmt->fetchAll(PDO::FETCH_ASSOC);

    // Incrementar vistas
    try {
        $pdo->prepare("UPDATE articulos SET vistas = vistas + 1 WHERE id = ?")->execute([$a['id']]);
    } catch (Throwable $e) {}
} catch (Throwable $e) {
    error_log("Error blog.php: " . $e->getMessage());
    if (!headers_sent()) {
        http_response_code(500);
        echo "Error del servidor";
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/svg+xml" href="/favicon.svg" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#0a0a0f">
    <link rel="preload" href="/_astro/escort-profile.css?v=<?= $pageCssV ?>" as="style">
    <link rel="stylesheet" href="/_astro/escort-profile.css?v=<?= $pageCssV ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <?= blog_head_seo($a) ?>
    <style>
        * { font-family: 'Inter', sans-serif }
        body { background: var(--color-page); color: var(--color-ink) }
        .prose { max-width: none; color: var(--color-ink) }
        .prose a { color: #f87317; }
        .prose img { max-width: 100%; height: auto; border-radius: 12px; }
        .prose video { max-width: 100%; border-radius: 12px; }
        .prose blockquote { border-left: 4px solid #f87317; padding-left: 1rem; margin: 1.5rem 0; color: var(--color-muted); }
        .prose pre { background: #0f0f23; border: 1px solid var(--color-border, #2a2a3e); border-radius: 12px; padding: 1rem; overflow-x: auto; }
    </style>
</head>

<body class="min-h-screen bg-page text-ink antialiased">
    <?php include __DIR__ . '/header.php'; ?>

    <main class="max-w-3xl mx-auto px-4 py-10">
        <article class="prose">
            <header class="mb-8">
                <?php if (!empty($a['categoria_nombre'])): ?>
                    <a href="/categoria/<?= rawurlencode($a['categoria_slug'] ?? '') ?>"
                       class="text-xs font-semibold text-amber-400 uppercase tracking-wider"><?= htmlspecialchars($a['categoria_nombre'], ENT_QUOTES, 'UTF-8') ?></a>
                <?php endif; ?>
                <h1 class="text-3xl md:text-4xl font-bold text-white mt-2 mb-3"><?= htmlspecialchars($a['titulo'], ENT_QUOTES, 'UTF-8') ?></h1>
                <div class="flex items-center gap-4 text-sm text-gray-500">
                    <?php if (!empty($a['autor'])): ?>
                        <span class="flex items-center gap-1.5"><i class="fas fa-user"></i> <?= htmlspecialchars($a['autor'], ENT_QUOTES, 'UTF-8') ?></span>
                    <?php endif; ?>
                    <span class="flex items-center gap-1.5"><i class="fas fa-clock"></i> <?= date('d M Y · H:i', strtotime($a['published_at'] ?: $a['created_at'])) ?></span>
                    <span class="flex items-center gap-1.5"><i class="fas fa-eye"></i> <?= (int)$a['vistas'] ?> vistas</span>
                </div>
                <?php if (!empty($a['etiquetas'])): ?>
                    <div class="mt-3 flex flex-wrap gap-2">
                        <?php foreach ($tags as $t): ?>
                            <span class="text-xs px-2.5 py-1 bg-[#1a1a2e] border border-gray-700/50 rounded-full text-gray-400">#<?= htmlspecialchars($t, ENT_QUOTES, 'UTF-8') ?></span>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </header>

            <?php if (!empty($a['imagen'])): ?>
                <figure class="mb-6">
                    <img src="<?= htmlspecialchars($a['imagen'], ENT_QUOTES, 'UTF-8') ?>"
                         alt="<?= htmlspecialchars($a['titulo'], ENT_QUOTES, 'UTF-8') ?>" class="w-full h-auto rounded-xl">
                </figure>
            <?php endif; ?>

            <div class="prose max-w-none text-gray-300 leading-relaxed">
                <?= $a['contenido'] ?: '<p>' . htmlspecialchars($a['extracto'], ENT_QUOTES, 'UTF-8') . '</p>' ?>
            </div>

            <?php if (!empty($a['url_externa'])): ?>
                <div class="mt-10 pt-6 border-t border-gray-800/50">
                    <a href="<?= htmlspecialchars($a['url_externa'], ENT_QUOTES, 'UTF-8') ?>" target="_blank" rel="noopener noreferrer"
                       class="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20">
                        <i class="fas fa-up-right-from-square"></i> Ir al sitio externo
                    </a>
                </div>
            <?php endif; ?>

            <?php if (!empty($relacionados)): ?>
                <aside class="mt-14 pt-8 border-t border-gray-800/50">
                    <h3 class="text-white font-bold text-lg mb-4 flex items-center gap-2"><i class="fas fa-newspaper text-amber-400"></i> Más artículos</h3>
                    <div class="grid sm:grid-cols-2 gap-4">
                        <?php foreach ($relacionados as $r): ?>
                            <a href="/blog/<?= rawurlencode($r['slug']) ?>" class="block p-4 bg-[#1a1a2e] border border-gray-800/50 rounded-xl hover:border-amber-400/40 transition-colors">
                                <div class="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1"><?= htmlspecialchars($r['categoria_nombre'] ?: '', ENT_QUOTES, 'UTF-8') ?></div>
                                <div class="font-medium text-white text-sm line-clamp-2 mb-1"><?= htmlspecialchars($r['titulo'], ENT_QUOTES, 'UTF-8') ?></div>
                                <div class="text-xs text-gray-500"><?= date('d M Y', strtotime($r['published_at'])) ?></div>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </aside>
            <?php endif; ?>
        </article>

        <!-- BANNER EN EL ARTÍCULO (blog_articulo) -->
        <?php
        require_once __DIR__ . '/api/lib/banners.php';
        $bannersArticulo = banners_html('blog_articulo', null, 'mt-8');
        ?>
        <?php if ($bannersArticulo !== ''): ?>
        <div class="max-w-3xl mx-auto px-4"><?= $bannersArticulo ?></div>
        <?php endif; ?>
    </main>

    <footer class="border-t border-gray-800/50 mt-12">
        <div class="max-w-3xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
            <p>&copy; <?= date('Y') ?> <?= htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8') ?>. Todos los derechos reservados.</p>
            <div class="flex justify-center gap-4 mt-3">
                <a href="/" class="hover:text-amber-400 transition-colors"><?= htmlspecialchars($nav['inicio'], ENT_QUOTES, 'UTF-8') ?></a>
                <a href="/ciudades" class="hover:text-amber-400 transition-colors"><?= htmlspecialchars($nav['ciudades'], ENT_QUOTES, 'UTF-8') ?></a>
            </div>
        </div>
    </footer>
</body>

</html>
