<?php
// Fallback dinámico para ciudades nuevas sin página estática
$slug = isset($_GET['slug']) ? trim($_GET['slug']) : '';
if (!$slug) {
    http_response_code(404);
    echo 'Ciudad no encontrada';
    exit;
}

// Cargar ciudades desde API interno
$apiUrl = 'http://localhost/api/ciudades/listado.php';
$context = stream_context_create(['http' => ['timeout' => 5]]);
$raw = @file_get_contents($apiUrl, false, $context);
if ($raw === false) {
    // Intentar con dominio público
    $apiUrl = 'https://www.consexvip.cl/api/ciudades/listado.php';
    $raw = @file_get_contents($apiUrl, false, $context);
}
$data = json_decode($raw ?: '', true);
$ciudadNombre = null;
if (isset($data['success']) && $data['success'] && is_array($data['data'])) {
    foreach ($data['data'] as $c) {
        if (!empty($c['slug']) && $c['slug'] === $slug) {
            $ciudadNombre = $c['nombre'];
            break;
        }
        // Fallback por slug generado
        if (!empty($c['nombre'])) {
            $gen = strtolower($c['nombre']);
            $gen = preg_replace('/[^\p{L}\p{N}]+/u', '-', $gen);
            $gen = preg_replace('/-+/', '-', $gen);
            $gen = trim($gen, '-');
            if ($gen === $slug) {
                $ciudadNombre = $c['nombre'];
                break;
            }
        }
    }
}

if (!$ciudadNombre) {
    http_response_code(404);
    echo 'Ciudad no encontrada';
    exit;
}

// Servir página genérica de ciudad con nombre en query para SEO y render cliente
// Evita redirección 302 y permite título/meta dinámico
header('Content-Type: text/html; charset=utf-8');
$cityEscaped = htmlspecialchars($ciudadNombre, ENT_QUOTES, 'UTF-8');
$cityUrl = urlencode($ciudadNombre);
$slugEscaped = htmlspecialchars($slug, ENT_QUOTES, 'UTF-8');
?>
<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Escorts en <?php echo $cityEscaped; ?> | Consexvip</title>
<meta name="description" content="Encuentra escorts verificadas en <?php echo $cityEscaped; ?>. Perfiles con fotos, tarifas y contacto directo.">
<link rel="canonical" href="https://www.consexvip.cl/escorts-<?php echo $slugEscaped; ?>">
<meta name="robots" content="index,follow">
</head>
<body>
<div id="ciudad-app" data-ciudad="<?php echo $cityEscaped; ?>"></div>
<script>
  // Reutiliza la página /ciudad/ cargando el componente existente
  window.location.href = '/ciudad/?ciudad=' + encodeURIComponent('<?php echo $cityEscaped; ?>');
</script>
</body>
</html>
<?php
exit;
