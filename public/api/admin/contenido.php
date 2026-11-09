<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

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

    // === Footer ===
    'footer_logo_1'                  => 'Parte 1 del logo del footer (ej: CS)',
    'footer_logo_2'                  => 'Parte 2 del logo del footer (ej: ESCORTS)',
    'footer_titulo_paginas'          => 'Título de la columna "Páginas" del footer',
    'footer_titulo_contacto'         => 'Título de la columna "Contacto" del footer',
    'footer_panel_escort'            => 'Enlace "Panel Escort" del footer',
    'footer_registro_usuario'        => 'Enlace "Registro Usuario" del footer',
    'footer_registro_escort'         => 'Enlace "Registro Escort" del footer',
    'footer_entrar_usuario'          => 'Enlace "Entrar como Usuario" del footer',
    'footer_entrar_escort'           => 'Enlace "Entrar como Escort" del footer',
    'footer_negocios'                => 'Enlace "Negocios" del footer (directorio de negocios del rubro)',
    'footer_anuncia_negocio'         => 'Enlace "Anuncia tu negocio" del footer (formulario de banners)',
    'footer_email_cuenta'            => 'Cuenta del email de contacto (ej: contacto)',
    'footer_derechos'                => 'Texto de derechos reservados',
    'footer_mayores18'               => 'Aviso "Solo para mayores de 18 años"',

    // === Estadísticas (StatsStrip) ===
    'stat_escorts_label'             => 'Etiqueta de la estadística de escorts',
    'stat_ciudades_label'            => 'Etiqueta de la estadística de ciudades',
    'stat_verificadas_label'         => 'Etiqueta de la estadística de perfiles verificados',
    'stat_valoraciones_label'        => 'Etiqueta de la estadística de valoraciones',

    // === Testimonios ===
    'testimonios_titulo'             => 'Título de la sección de opiniones de clientes',

    // === Badges de tarjetas de escort ===
    'badge_disponible'               => 'Texto del badge disponible en las tarjetas',
    'badge_gira'                     => 'Texto del badge de gira (sin ciudad definida)',
    'badge_gira_ciudad'              => 'Texto del badge de gira con ciudad (usa {ciudad})',
    'badge_nueva'                    => 'Texto del badge "Nueva"',
    'badge_verificada'               => 'Texto del badge "Verificada"',
    'badge_vip'                      => 'Texto del badge "VIP"',
    'badge_anios'                    => 'Formato de la edad (usa {edad}, ej: {edad} años)',
    'badge_valoracion'               => 'Formato de la valoración (usa {rating}, {reseñas})',

    // === Modal de ciudades ===
    'modal_ciudades_titulo'          => 'Título del modal de ciudades',
    'modal_ciudades_placeholder'     => 'Placeholder del buscador de ciudades',
    'modal_ciudades_sin_resultados'  => 'Mensaje cuando no hay ciudades',
    'modal_ciudades_no_encontrada'   => 'Mensaje cuando no se encontró la ciudad (usa {query})',
    'modal_ciudades_contador'        => 'Contador de ciudades (usa {cantidad})',
    'modal_ciudades_escorts_count'   => 'Contador de escorts por ciudad (usa {cantidad})',

    // === Contadores y estados de secciones ===
    'seccion_escorts_vacia'          => 'Mensaje cuando no hay escorts en las secciones',
    'seccion_cargando_mas'           => 'Texto del botón "Cargando más"',
    'contador_escorts'               => 'Formato del contador de escorts (usa {cantidad})',
    'contador_nuevas'                => 'Formato del contador de nuevas (usa {cantidad})',
    'contador_disponibles'           => 'Formato del contador de disponibles (usa {cantidad})',

    // === CTA final ===
    'cta_badge'                      => 'Badge del CTA final (ej: Publica tu anuncio)',

    // === Página de ciudad ===
    'ciudad_sin_resultados'          => 'Mensaje cuando no hay resultados de búsqueda',
    'ciudad_sin_resultados_filtros'  => 'Complemento del mensaje de sin resultados con filtros',
    'ciudad_sin_escorts'             => 'Mensaje cuando no hay escorts en la ciudad (usa {ciudad})',
    'ciudad_contador_resultados'     => 'Formato del contador de resultados de ciudad (usa {cantidad})',
    'ciudad_hint_filtros'            => 'Sugerencia cuando hay filtros activos sin resultados',
    'ciudad_hint_vuelve'             => 'Sugerencia cuando la ciudad no tiene publicaciones',
    'ciudad_limpiar_filtros'         => 'Texto del botón "Limpiar filtros"',
];

$tipos = [
    // Por defecto 'string'. Solo listamos los que no lo son.
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
