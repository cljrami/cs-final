<?php
// public/api/banners/solicitud.php
// Formulario público: un negocio externo envía su banner para revisión.
// POST { anunciante, categoria, contacto, web, texto, titulo, enlace_url, imagen_url }
// Queda en estado 'solicitud' y aparece en la cola del panel admin.

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/banners.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

// Límite por IP (evita spam de solicitudes)
$rlSolicitud = rateLimitCheck('banner_solicitud', 5, 60, '');
if (!empty($rlSolicitud['blocked'])) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Demasiadas solicitudes. Intenta más tarde.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

$anunciante = trim((string)($input['anunciante'] ?? ''));
$categoria = (string)($input['categoria'] ?? 'otro');
$contacto = trim((string)($input['contacto'] ?? ''));
$web = trim((string)($input['web'] ?? ''));
$texto = trim((string)($input['texto'] ?? ''));
$titulo = trim((string)($input['titulo'] ?? ''));
$enlaceUrl = trim((string)($input['enlace_url'] ?? ''));
$imagenUrl = trim((string)($input['imagen_url'] ?? ''));

$categoriasValidas = ['night_club', 'discoteca', 'sex_shop', 'bar', 'sauna', 'otro'];
if (!in_array($categoria, $categoriasValidas, true)) $categoria = 'otro';

$errores = [];
if (mb_strlen($anunciante) < 2) $errores['anunciante'] = 'Indica el nombre del negocio';
if (mb_strlen($anunciante) > 150) $errores['anunciante'] = 'Máximo 150 caracteres';
if ($contacto === '' && $web === '') $errores['contacto'] = 'Indica un contacto o sitio web';
if ($enlaceUrl !== '' && banners_url_segura($enlaceUrl) === '') $errores['enlace_url'] = 'URL inválida (debe empezar por http:// o https://)';
if ($web !== '' && banners_url_segura($web) === '') $errores['web'] = 'URL inválida (debe empezar por http:// o https://)';
if ($imagenUrl !== '' && !preg_match('#^https?://#i', $imagenUrl)) $errores['imagen_url'] = 'URL de imagen inválida';
if (mb_strlen($texto) > 255) $errores['texto'] = 'Máximo 255 caracteres';

if (!empty($errores)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Revisa los datos', 'fieldErrors' => $errores]);
    exit;
}

try {
    $pdo = getDBConnection();

    // Fechas por defecto: 30 días desde hoy (el admin las ajusta)
    $fechaInicio = date('Y-m-d');
    $fechaFin = date('Y-m-d', strtotime('+30 days'));

    $stmt = $pdo->prepare("
        INSERT INTO banners
            (anunciante, categoria, contacto, web, titulo, imagen_url, texto, enlace_url,
             placement, fecha_inicio, fecha_fin, estado, estado_pago, precio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'footer', ?, ?, 'solicitud', 'pendiente', 0)
    ");
    $stmt->execute([
        $anunciante,
        $categoria,
        $contacto !== '' ? $contacto : null,
        $web !== '' ? banners_url_segura($web) : null,
        $titulo !== '' ? $titulo : $anunciante,
        $imagenUrl !== '' ? $imagenUrl : '',
        $texto !== '' ? $texto : null,
        $enlaceUrl !== '' ? banners_url_segura($enlaceUrl) : ($web !== '' ? banners_url_segura($web) : ''),
        $fechaInicio,
        $fechaFin,
    ]);

    $id = (int)$pdo->lastInsertId();

    // Aviso al admin
    $pdo->prepare("
        INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, actor_foto)
        VALUES (NULL, 'sistema', 'Nuevo banner solicitado', ?, '/admin/banners', NULL)
    ")->execute(["{$anunciante} envió su banner para revisión."]);

    echo json_encode([
        'success' => true,
        'message' => 'Recibimos tu solicitud. Te contactaremos para activarlo.',
        'id' => $id,
    ]);
} catch (PDOException $e) {
    error_log('banners/solicitud.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log('banners/solicitud.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
