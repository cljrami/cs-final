<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../og_util.php';

$textos = [
    // === Inicio (Hero) ===
    'hero_badge'                     => 'Texto del badge superior del inicio (ej: Perfiles verificados)',
    'hero_titulo'                    => 'Título principal del inicio',
    'hero_subtitulo'                 => 'Subtítulo bajo el título del inicio (ej: Perfiles verificados y actualizados diariamente)',
    'confianza_1'                    => 'Primer texto de confianza bajo el hero (ej: Verificados)',
    'confianza_2'                    => 'Segundo texto de confianza bajo el hero (ej: Seguro)',
    'confianza_3'                    => 'Tercer texto de confianza bajo el hero (ej: Actualizados hoy)',

    // === Secciones del inicio ===
    'seccion_disponibles_titulo'     => 'Título de la sección "Disponibles ahora" del inicio',
    'seccion_escorts_titulo'         => 'Título de la sección de escorts del inicio',
    'seccion_historias_titulo'       => 'Título de la sección de historias del inicio',
    'seccion_nuevas_titulo'          => 'Título de la sección "Nuevas en tu ciudad" del inicio',
    'seccion_valoradas_titulo'       => 'Título de la sección "Más valoradas" del inicio',

    // === Página de ciudad (secciones) ===
    'seccion_ciudad_disponibles_titulo' => 'Título de la sección de disponibles en la página de ciudad (usa {ciudad})',
    'seccion_ciudad_valoradas_titulo'   => 'Título de la sección de más valoradas en la página de ciudad (usa {ciudad})',
    'seccion_ciudad_nuevas_titulo'      => 'Título de la sección de nuevas en la página de ciudad (usa {ciudad})',
    'seccion_ciudad_grid_titulo'        => 'Título de la sección de escorts principales en la página de ciudad (usa {ciudad})',

    // === SEO Página de ciudad ===
    'seo_ciudad_h1'                 => 'Encabezado H1 de la página de ciudad (usa {ciudad})',
    'seo_ciudad_titulo'             => 'Título <title> de la página de ciudad (usa {ciudad})',
    'seo_ciudad_description'        => 'Meta description de la página de ciudad (usa {ciudad}, máx 160 chars)',
    'seo_ciudad_keywords'           => 'Meta keywords de la página de ciudad (usa {ciudad})',

    // === SEO Perfil de escort ===
    'seo_escort_titulo'             => 'Título <title> del perfil de escort (usa {nombre}, {edad})',
    'seo_escort_description'        => 'Meta description del perfil de escort (usa {nombre}, {ciudad}, {descripcion})',
    'seo_escort_og_titulo'          => 'Título Open Graph del perfil de escort (usa {nombre}, {edad})',
    'seo_escort_og_description'     => 'Descripción Open Graph del perfil de escort (usa {nombre}, {ciudad})',

    // === SEO Páginas del sitio ===
    'seo_inicio_titulo'             => 'Título <title> de la página de inicio',
    'seo_inicio_description'        => 'Meta description de la página de inicio',
    'seo_login_titulo'              => 'Título <title> de la página de inicio de sesión',
    'seo_login_description'         => 'Meta description de la página de inicio de sesión',
    'seo_registro_titulo'           => 'Título <title> de la página de registro',
    'seo_registro_description'      => 'Meta description de la página de registro',
    'seo_recuperar_titulo'          => 'Título <title> de la página de recuperar contraseña',
    'seo_recuperar_description'     => 'Meta description de la página de recuperar contraseña',
    'seo_404_titulo'                => 'Título <title> de la página 404',
    'seo_404_description'           => 'Meta description de la página 404',
    'seo_pausado_titulo'            => 'Título <title> de la página de perfil pausado',
    'seo_pausado_description'       => 'Meta description de la página de perfil pausado',

    // === SEO General ===
    'seo_description'                   => 'Meta description del sitio (máx 160 caracteres)',
    'seo_keywords'                      => 'Meta keywords separadas por coma',
    'seo_url'                           => 'URL principal del sitio',
    'seo_canonical'                     => 'URL canónica del sitio',
    'seo_robots'                        => 'Directiva robots (ej: INDEX, FOLLOW)',
    'seo_author'                        => 'Nombre del autor para SEO',
    'seo_publisher'                     => 'Nombre del publisher para SEO',
    'seo_lang'                          => 'Idioma del sitio (ej: es, en)',

    // === Open Graph / Twitter ===
    'og_imagen'                      => 'URL de la imagen Open Graph por defecto (1200x630 recomendado)',
    'og_type'                        => 'Tipo Open Graph por defecto (ej: website)',
    'twitter_handle'                 => 'Handle de Twitter/X (ej: @marca)',
    'og_fb_app_id'                   => 'Facebook App ID para Open Graph',

    // === Schema.org (JSON-LD) ===
    'schema_habilitado'              => 'Habilitar Schema.org (JSON-LD) en el sitio',
    'schema_tipo'                    => 'Tipo de Schema (ej: Organization, WebSite)',
    'schema_nombre'                  => 'Nombre de la organización para Schema',
    'schema_url'                     => 'URL principal para Schema',
    'schema_logo'                    => 'URL del logo para Schema',
    'schema_description'             => 'Descripción de la organización para Schema',
    'schema_sameAs'                  => 'Perfiles sociales (JSON, ej: ["https://facebook.com/...", "https://instagram.com/..."])',
    'schema_email'                   => 'Email de contacto para Schema',
    'schema_telefono'                => 'Teléfono de contacto para Schema',
    'schema_localidad'               => 'Localidad para Schema (ej: Santiago)',
    'schema_pais'                    => 'País para Schema (ej: CL)',
    'schema_imagen'                  => 'URL de imagen de la organización para Schema',

    // === CTA final ===
    'cta_titulo'                     => 'Título del CTA final (ej: ¿Eres escort o agencia?)',
    'cta_subtitulo'                  => 'Subtítulo del CTA final',
    'cta_boton_1'                    => 'Texto del botón principal del CTA (ej: Publicar Ahora)',
    'cta_boton_2'                    => 'Texto del botón secundario del CTA (ej: Ver Planes)',

    // === Sitio ===
    'site_nombre'                    => 'Nombre del sitio (se muestra en el footer)',
    'site_descripcion'               => 'Descripción del sitio (se muestra en el footer)',

    // === Header (Barra de navegación) ===
    'nav_logo_1'                     => 'Parte 1 del logo (color rojo, ej: CS)',
    'nav_logo_2'                     => 'Parte 2 del logo (color blanco, ej: Escorts)',
    'nav_inicio'                     => 'Texto del enlace Inicio',
    'nav_ciudades'                   => 'Texto del enlace Ciudades',
    'nav_ingresar'                   => 'Texto del botón Ingresar',
    'nav_publicar'                   => 'Texto del botón Publicar',
    'nav_entrar_usuario'             => 'Título del acceso "Entrar como Usuario"',
    'nav_entrar_usuario_desc'        => 'Subtexto del acceso como Usuario',
    'nav_entrar_escort'              => 'Título del acceso "Entrar como Escort"',
    'nav_entrar_escort_desc'         => 'Subtexto del acceso como Escort',
    'nav_mi_panel'                   => 'Texto del enlace "Mi Panel" (escort)',
    'nav_mi_cuenta'                  => 'Texto del enlace "Mi Cuenta" (usuario)',
    'nav_mis_favoritos'              => 'Texto del enlace "Mis Favoritos" (usuario)',
    'nav_mi_perfil'                  => 'Texto del enlace "Mi Perfil" (usuario)',
    'nav_cerrar_sesion'              => 'Texto del botón "Cerrar sesión"',
];

$tipos = [
    // Por defecto 'string'. Solo listamos los que no lo son.
    'schema_habilitado' => 'bool',
    'schema_sameAs'     => 'json',
    'precio_vip_mensual' => 'int',
    'precio_destacado_semanal' => 'int',
];

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Obtener textos ===
    if ($method === 'GET') {
        $claves = array_keys($textos);
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

        echo json_encode(['success' => true, 'textos' => $result]);
        exit;
    }

    // === PUT - Guardar textos ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $updates = [];

        foreach ($textos as $clave => $descripcion) {
            if (isset($input[$clave])) {
                $tipo = $tipos[$clave] ?? 'string';
                $valor = $input[$clave];

                if ($tipo === 'bool') {
                    $valor = $valor ? '1' : '0';
                } elseif ($tipo === 'int') {
                    $valor = (string) (int) $valor;
                } elseif ($tipo === 'json') {
                    $valor = is_array($valor) ? json_encode($valor, JSON_UNESCAPED_UNICODE) : (string) $valor;
                } else {
                    $valor = trim((string) $valor);
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

        if (in_array('og_imagen', $updates, true) || in_array('schema_imagen', $updates, true)) {
            refrescarOgActual($pdo);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Contenido actualizado',
            'actualizados' => $updates
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error contenido.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error contenido.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
