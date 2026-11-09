<?php
// public/api/public/analytics.php
// Endpoint público que devuelve el bootstrap de Google Analytics (gtag.js)
// leyendo el ID de medición desde la tabla `configuracion` (clave google_analytics_id).
// Se incluye como <script src="/api/public/analytics.php" async></script> en el
// <head> de todas las páginas públicas. Editable desde Admin > Configuración.
// Sin autenticación. Protegido en tipo de dato para no permitir inyección.

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

$gaId = '';

try {
    require_once __DIR__ . '/../bootstrap.php';
    $pdo = getDBConnection();
    $stmt = $pdo->query("SELECT valor FROM configuracion WHERE clave = 'google_analytics_id' LIMIT 1");
    $gaId = trim((string)($stmt->fetchColumn() ?: ''));
} catch (Throwable $e) {
    // Sin conexión o sin clave: no se emite el tag (sitio funciona igual)
}

// Solo IDs con formato válido: G-XXXX, UA-XXXX, AW-XXXX, DC-XXXX, MX-XXXX
if (!preg_match('/^(?:G|UA|AW|DC|MX)-[A-Za-z0-9_-]{4,20}$/', $gaId)) {
    $gaId = '';
}

echo '(function(){if(window.__gtagKimiInit)return;window.__gtagKimiInit=true;'
    . 'var ID=' . json_encode($gaId) . ';window.GA_MEASUREMENT_ID=ID;'
    . 'window.dataLayer=window.dataLayer||[];'
    . 'window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};'
    . 'if(!ID)return;'
    . "window.gtag('js',new Date());window.gtag('config',ID,{'anonymize_ip':true});"
    . 'var s=document.createElement("script");s.async=true;'
    . 's.src="https://www.googletagmanager.com/gtag/js?id="+ID;'
    . 's.onerror=function(){console.info("[GA] No se pudo cargar googletagmanager; se activa con blocker desactivado");};'
    . 'document.head.appendChild(s);})();';
