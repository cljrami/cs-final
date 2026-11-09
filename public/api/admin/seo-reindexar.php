<?php
// public/api/admin/seo-reindexar.php
// Notifica a Google/Bing (IndexNow) las URLs clave del sitio, para reindexar en minutos.
// POST (opcional body: { urls: [...] } para notificar URLs concretas)

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/seo.php';

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método no permitido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $urls = [];

    if (!empty($input['urls']) && is_array($input['urls'])) {
        foreach ($input['urls'] as $u) {
            $u = trim((string)$u);
            if (preg_match('#^https?://#i', $u)) $urls[] = $u;
        }
    }

    if (!$urls) {
        // URLs clave por defecto: home, ciudades, negocios y artículos publicados
        $base = rtrim((string)getSeoConfig()['seo_url'] ?? 'https://www.consexvip.cl', '/');
        $urls[] = $base . '/';
        try {
            $stmt = $pdo->query("SELECT nombre FROM ciudades WHERE activa = 1 ORDER BY nombre ASC");
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $c) {
                $slug = strtolower(trim((string)$c['nombre']));
                $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
                $slug = trim((string)$slug, '-');
                if ($slug !== '') $urls[] = $base . '/escorts-' . $slug;
            }
        } catch (Throwable $e) { /* no-op */ }
        $urls[] = $base . '/negocios';
        try {
            $stmt = $pdo->query("SELECT slug FROM articulos WHERE estado = 'publicado' ORDER BY published_at DESC LIMIT 50");
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $a) {
                $urls[] = $base . '/blog/' . $a['slug'];
            }
        } catch (Throwable $e) { /* no-op */ }
    }

    $urls = array_values(array_unique(array_slice($urls, 0, 10000)));

    // Comprobar que la clave existe y que el archivo está publicado
    $cfg = getSeoConfig();
    $clave = trim((string)($cfg['indexnow_key'] ?? ''));
    if ($clave === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No hay clave IndexNow configurada (Admin → SEO)']);
        exit;
    }

    indexnowPing($urls, $clave);

    echo json_encode([
        'success' => true,
        'message' => 'IndexNow notificado: ' . count($urls) . ' URL(s)',
        'urls' => count($urls),
    ]);
} catch (PDOException $e) {
    error_log('Error seo-reindexar.php PDO: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log('Error seo-reindexar.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
