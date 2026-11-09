<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Obtener configuraci?n ===
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT clave, valor, descripcion FROM configuracion WHERE clave IN ('precio_vip', 'moneda_vip', 'duracion_vip_dias', 'google_analytics_id', 'banner_etiqueta_publicidad', 'banner_tarifa_home_top', 'banner_tarifa_perfil_top', 'banner_tarifa_duracion_dias', 'banner_moneda', 'share_site_name', 'share_whatsapp_template', 'share_twitter_template', 'share_telegram_template', 'chat_whatsapp_template')");
        $config = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($config as $c) {
            $result[$c['clave']] = [
                'valor' => $c['valor'],
                'descripcion' => $c['descripcion']
            ];
        }

        echo json_encode(['success' => true, 'config' => $result]);
        exit;
    }

    // === PUT - Actualizar configuraci?n ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        $allowedKeys = ['precio_vip', 'moneda_vip', 'duracion_vip_dias', 'google_analytics_id',
            'banner_etiqueta_publicidad', 'banner_tarifa_home_top',
            'banner_tarifa_perfil_top', 'banner_tarifa_duracion_dias', 'banner_moneda',
            'share_site_name', 'share_whatsapp_template', 'share_twitter_template', 'share_telegram_template', 'chat_whatsapp_template'];
        // Asegurar que duracion_vip_dias exista en la BD
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM configuracion WHERE clave = 'duracion_vip_dias'");
        $stmt->execute();
        if ((int)$stmt->fetchColumn() === 0) {
            $pdo->exec("INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES ('duracion_vip_dias', '30', 'int', 'Duraci?n del badge VIP en d?as (0 = permanente)')");
        }
        // Asegurar que google_analytics_id exista en la BD
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM configuracion WHERE clave = 'google_analytics_id'");
        $stmt->execute();
        if ((int)$stmt->fetchColumn() === 0) {
            $pdo->exec("INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES ('google_analytics_id', '', 'text', 'ID de medicion de Google Analytics 4 (G-XXXXXXXXXX). Inserta gtag.js en todo el sitio publico.')");
        }
        // Claves del modulo de banners (tarifario y etiqueta)
        $bannerDefaults = [
            'banner_etiqueta_publicidad' => ['Publicidad', 'Texto de la etiqueta que se muestra bajo cada banner'],
            'banner_tarifa_home_top'      => ['15000', 'Tarifa referencial por 7 dias del banner superior del inicio (CLP)'],
            'banner_tarifa_perfil_top'    => ['15000', 'Tarifa referencial por 7 dias del banner superior en perfiles (CLP)'],
            'banner_tarifa_duracion_dias' => ['7', 'Dias de duracion por defecto de cada campana'],
            'banner_moneda'               => ['CLP', 'Moneda de las tarifas de publicidad'],
        ];
        foreach ($bannerDefaults as $clave => $info) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM configuracion WHERE clave = ?");
            $stmt->execute([$clave]);
            if ((int)$stmt->fetchColumn() === 0) {
                $pdo->prepare("INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES (?, ?, 'string', ?)")
                    ->execute([$clave, $info[0], $info[1]]);
            }
        }
        // Claves de compartir y chat
        $shareDefaults = [
            'share_site_name' => ['Consexvip', 'Nombre del sitio a usar en mensajes de compartir'],
            'share_whatsapp_template' => ['Te recomiendo el perfil de {nombre} en {site_name}', 'Plantilla de mensaje para compartir por WhatsApp. Usa {nombre} y {site_name}'],
            'share_twitter_template' => ['Te recomiendo el perfil de {nombre} en {site_name}', 'Plantilla de mensaje para compartir por X/Twitter. Usa {nombre} y {site_name}'],
            'share_telegram_template' => ['Te recomiendo el perfil de {nombre} en {site_name}', 'Plantilla de mensaje para compartir por Telegram. Usa {nombre} y {site_name}'],
            'chat_whatsapp_template' => ['Hola, vi tu perfil en {site_name}. Me interesa conocer más sobre {nombre}.', 'Plantilla de mensaje para iniciar chat por WhatsApp con la escort. Usa {nombre} y {site_name}'],
        ];
        foreach ($shareDefaults as $clave => $info) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM configuracion WHERE clave = ?");
            $stmt->execute([$clave]);
            if ((int)$stmt->fetchColumn() === 0) {
                $pdo->prepare("INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES (?, ?, 'string', ?)")
                    ->execute([$clave, $info[0], $info[1]]);
            }
        }
        $updates = [];

        foreach ($allowedKeys as $key) {
            if (isset($input[$key])) {
                $valor = trim((string)$input[$key]);
                if ($key === 'google_analytics_id' && $valor !== '' && !preg_match('/^(?:G|UA|AW|DC|MX)-[A-Za-z0-9_-]{4,20}$/', $valor)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'ID de Google Analytics inválido. Formato esperado: G-XXXXXXXXXX']);
                    exit;
                }
                $stmt = $pdo->prepare("INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)");
                $stmt->execute([$key, $valor]);
                $updates[] = $key;
            }
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No hay datos para actualizar']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Configuraci?n actualizada',
            'actualizados' => $updates
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'M?todo no permitido']);
} catch (PDOException $e) {
    error_log("Error configuracion.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error configuracion.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

