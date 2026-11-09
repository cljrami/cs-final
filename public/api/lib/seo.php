<?php
// public/api/lib/seo.php
// Helpers SEO: IndexNow (ping automático a Google/Bing) y verificación de buscadores.
// IndexNow: https://www.indexnow.org/ — clave de 8-128 caracteres alfanuméricos.

if (!defined('INDEXNOW_ENDPOINTS')) {
    define('INDEXNOW_ENDPOINTS', [
        'https://api.indexnow.org/indexnow',
        'https://www.bing.com/indexnow',
        'https://searchadvisor.naver.com/indexnow', // opcional
    ]);
}

/**
 * Genera una clave IndexNow válida (38 caracteres, como pide Google).
 */
function indexnowGenerarClave(): string
{
    return bin2hex(random_bytes(19)); // 38 hex chars
}

/**
 * Publica/actualiza el archivo {clave}.txt en la raíz del sitio.
 * Devuelve true si se pudo escribir.
 */
function indexnowPublicarClave(string $clave): bool
{
    if (!preg_match('/^[a-zA-Z0-9_-]{8,128}$/', $clave)) return false;
    $root = dirname(__DIR__, 2); // public/
    $contenido = $clave . "\nhost: www.consexvip.cl\n";
    return @file_put_contents($root . '/' . $clave . '.txt', $contenido) !== false;
}

/**
 * Envía pings IndexNow para un array de URLs.
 * No lanza excepciones: falla silenciosamente (log opcional).
 */
function indexnowPing(array $urls, ?string $clave = null): void
{
    if (empty($urls)) return;
    $clave = $clave ?: (string)(getSeoConfig()['indexnow_key'] ?? '');
    if ($clave === '' || !preg_match('/^[a-zA-Z0-9_-]{8,128}$/', $clave)) return;

    $host = 'www.consexvip.cl';
    $payload = json_encode([
        'host' => $host,
        'key' => $clave,
        'keyLocation' => 'https://' . $host . '/' . $clave . '.txt',
        'urlList' => array_values(array_unique(array_slice($urls, 0, 10000))),
    ]);
    if ($payload === false) return;

    foreach (INDEXNOW_ENDPOINTS as $endpoint) {
        $ch = curl_init($endpoint);
        if (!$ch) continue;
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json; charset=utf-8'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_CONNECTTIMEOUT => 3,
        ]);
        curl_exec($ch);
        curl_close($ch);
    }
}

/**
 * Lee la fila de configuración SEO (clave indexnow, verificaciones).
 */
function getSeoConfig(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->query("SELECT clave, valor FROM configuracion WHERE clave IN ('indexnow_key','verify_google','verify_bing')");
        $cache = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
    } catch (Throwable $e) {
        $cache = [];
    }
    return $cache;
}
