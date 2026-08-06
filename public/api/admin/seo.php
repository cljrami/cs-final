<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

/**
 * Configuración de Sitemap y robots.txt desde el panel admin.
 * Guarda en la tabla `configuracion` las claves definidas en $fields.
 */

$fields = [
    // === General ===
    'seo_url'                    => 'URL raíz del sitio (se usa para generar el sitemap, sin barra final)',

    // === Sitemap ===
    'sitemap_habilitado'         => 'Generar sitemap.xml automático',
    'sitemap_incluir_escorts'    => 'Incluir perfiles de escorts en el sitemap',
    'sitemap_incluir_ciudades'   => 'Incluir páginas de ciudades en el sitemap',
    'sitemap_incluir_paginas'    => 'Incluir páginas estáticas (/login, /ingresar, /unirse)',
    'sitemap_max_escorts'        => 'Máximo de escorts en el sitemap (0 = sin límite)',
    'sitemap_priority_home'      => 'Prioridad de la página de inicio (ej: 1.0)',
    'sitemap_priority_escort'    => 'Prioridad de perfiles de escort (ej: 0.9)',
    'sitemap_priority_ciudad'    => 'Prioridad de páginas de ciudad (ej: 0.8)',
    'sitemap_priority_pagina'    => 'Prioridad de páginas estáticas (ej: 0.5)',
    'sitemap_freq_home'          => 'Frecuencia del inicio (daily)',
    'sitemap_freq_escort'        => 'Frecuencia de escorts (monthly)',
    'sitemap_freq_ciudad'        => 'Frecuencia de ciudades (weekly)',
    'sitemap_freq_pagina'        => 'Frecuencia de páginas estáticas (monthly)',

    // === robots.txt ===
    'robots_habilitado'           => 'Usar robots.txt gestionado desde admin (si no, se sirve robots.txt estático)',
    'robots_contenido'            => 'Contenido del robots.txt (se sirve tal cual, usa URLs completas)',

    // === URLs adicionales del sitemap (una por línea) ===
    'sitemap_urls_extra'          => 'URLs adicionales para el sitemap (una por línea, ej: /contacto)',
];

$tipos = [
    'sitemap_habilitado'       => 'bool',
    'sitemap_incluir_escorts'  => 'bool',
    'sitemap_incluir_ciudades' => 'bool',
    'sitemap_incluir_paginas'  => 'bool',
    'sitemap_max_escorts'      => 'int',
    'robots_habilitado'        => 'bool',
    'sitemap_urls_extra'       => 'texto',
];

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $claves = array_keys($fields);
        $placeholders = implode(',', array_fill(0, count($claves), '?'));
        $stmt = $pdo->prepare("SELECT clave, valor, descripcion, tipo FROM configuracion WHERE clave IN ($placeholders)");
        $stmt->execute($claves);
        $config = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($config as $c) {
            $result[$c['clave']] = [
                'valor' => $c['valor'],
                'descripcion' => $c['descripcion'],
                'tipo' => $c['tipo'] ?? ($tipos[$c['clave']] ?? 'string'),
            ];
        }

        echo json_encode(['success' => true, 'seo' => $result]);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $updates = [];

        foreach ($fields as $clave => $descripcion) {
            if (isset($input[$clave])) {
                $tipo = $tipos[$clave] ?? 'string';
                $valor = $input[$clave];

                if ($tipo === 'bool') {
                    $valor = $valor ? '1' : '0';
                } elseif ($tipo === 'int') {
                    $valor = (string)(int)$valor;
                } else {
                    $valor = trim((string)$valor);
                }

                $stmt = $pdo->prepare("SELECT id FROM configuracion WHERE clave = ?");
                $stmt->execute([$clave]);
                if ($stmt->fetchColumn()) {
                    $stmt = $pdo->prepare("UPDATE configuracion SET valor = ?, descripcion = ?, tipo = ? WHERE clave = ?");
                    $stmt->execute([$valor, $descripcion, $tipo, $clave]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES (?, ?, ?, ?)");
                    $stmt->execute([$clave, $valor, $tipo, $descripcion]);
                }
                $updates[] = $clave;
            }
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No hay datos para guardar']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Configuración SEO actualizada',
            'actualizados' => $updates,
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error seo.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error seo.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}