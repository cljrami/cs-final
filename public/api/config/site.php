<?php
// public/api/config/site.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT clave, valor FROM configuracion WHERE tipo IN ('string', 'int', 'bool', 'json') OR clave IN ('verify_google', 'verify_bing')");
    $stmt->execute();
    $config = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    echo json_encode([
        'success' => true,
        'data' => [
            'site_nombre' => $config['site_nombre'] ?? 'Consexvip',
            'site_descripcion' => $config['site_descripcion'] ?? 'Directorio Premium de Escorts',
            'hero_badge' => $config['hero_badge'] ?? 'Perfiles verificados',
            'hero_titulo' => $config['hero_titulo'] ?? 'Encuentra tu Experiencia Hoy',
            'hero_subtitulo' => $config['hero_subtitulo'] ?? 'Perfiles verificados y actualizados diariamente',
            'confianza_1' => $config['confianza_1'] ?? 'Verificados',
            'confianza_2' => $config['confianza_2'] ?? 'Seguro',
            'confianza_3' => $config['confianza_3'] ?? 'Actualizados hoy',
            'seccion_disponibles_titulo' => $config['seccion_disponibles_titulo'] ?? 'Disponibles ahora',
            'seccion_escorts_titulo' => $config['seccion_escorts_titulo'] ?? 'Escorts',
            'seccion_historias_titulo' => $config['seccion_historias_titulo'] ?? 'Historias',
            'seccion_ciudad_grid_titulo' => $config['seccion_ciudad_grid_titulo'] ?? 'Resultados en {ciudad}',
            'seccion_nuevas_titulo' => $config['seccion_nuevas_titulo'] ?? 'Nuevas en tu ciudad',
            'seccion_valoradas_titulo' => $config['seccion_valoradas_titulo'] ?? 'Más valoradas',
            'seccion_ciudad_disponibles_titulo' => $config['seccion_ciudad_disponibles_titulo'] ?? 'Disponibles ahora en {ciudad}',
            'seccion_ciudad_valoradas_titulo' => $config['seccion_ciudad_valoradas_titulo'] ?? 'Más valoradas en {ciudad}',
            'seccion_ciudad_nuevas_titulo' => $config['seccion_ciudad_nuevas_titulo'] ?? 'Nuevas en {ciudad}',
            'seo_description' => $config['seo_description'] ?? 'Directorio Premium de Escorts en Chile',
            'seo_keywords' => $config['seo_keywords'] ?? 'escorts, chile, acompañantes, escort, modelo',
            'seo_url' => $config['seo_url'] ?? 'https://www.consexvip.cl/',
            'seo_canonical' => $config['seo_canonical'] ?? 'https://www.consexvip.cl/',
            'seo_robots' => $config['seo_robots'] ?? 'INDEX, FOLLOW',
            'seo_author' => $config['seo_author'] ?? 'ConsexVIP',
            'seo_publisher' => $config['seo_publisher'] ?? 'ConsexVIP',
            'seo_lang' => $config['seo_lang'] ?? 'es',
            'seo_ciudad_titulo' => $config['seo_ciudad_titulo'] ?? 'Escorts en {ciudad} | Consexvip',
            'seo_ciudad_description' => $config['seo_ciudad_description'] ?? 'Encuentra escorts verificadas en {ciudad}. Perfiles con fotos, tarifas y contacto directo en Consexvip.',
            'seo_ciudad_keywords' => $config['seo_ciudad_keywords'] ?? 'escorts en {ciudad}, acompañantes en {ciudad}, escorts {ciudad}',
            'seo_escort_titulo' => $config['seo_escort_titulo'] ?? '{nombre}, {edad} años | Consexvip',
            'seo_escort_description' => $config['seo_escort_description'] ?? 'Perfil de {nombre} en {ciudad}. {descripcion}',
            'seo_escort_og_titulo' => $config['seo_escort_og_titulo'] ?? '{nombre}, {edad} años - Consexvip',
            'seo_escort_og_description' => $config['seo_escort_og_description'] ?? 'Perfil verificado de {nombre} en {ciudad}',
            'seo_inicio_titulo' => $config['seo_inicio_titulo'] ?? 'Consexvip: Escorts y Damas de Compañía en Chile',
            'seo_inicio_description' => $config['seo_inicio_description'] ?? 'Directorio premium de escorts en Chile. Perfiles verificados, fotos, tarifas y contacto directo en todas las ciudades.',
            'seo_login_titulo' => $config['seo_login_titulo'] ?? 'Iniciar sesión',
            'seo_login_description' => $config['seo_login_description'] ?? 'Accede a tu cuenta para guardar favoritos y valorar perfiles',
            'seo_registro_titulo' => $config['seo_registro_titulo'] ?? 'Crear cuenta',
            'seo_registro_description' => $config['seo_registro_description'] ?? 'Crea tu cuenta de usuario para guardar favoritos y valorar perfiles',
            'seo_recuperar_titulo' => $config['seo_recuperar_titulo'] ?? 'Recuperar Contraseña',
            'seo_recuperar_description' => $config['seo_recuperar_description'] ?? 'Recupera el acceso a tu cuenta',
            'seo_404_titulo' => $config['seo_404_titulo'] ?? 'Página no encontrada',
            'seo_404_description' => $config['seo_404_description'] ?? 'La página que buscas no existe o fue movida',
            'seo_pausado_titulo' => $config['seo_pausado_titulo'] ?? 'Perfil pausado',
            'seo_pausado_description' => $config['seo_pausado_description'] ?? 'Este perfil está temporalmente pausado',
            'og_imagen' => $config['og_imagen'] ?? '',
            'og_type' => $config['og_type'] ?? 'website',
            'twitter_handle' => $config['twitter_handle'] ?? '',
            'og_fb_app_id' => $config['og_fb_app_id'] ?? '',
            'site_favicon_svg' => $config['site_favicon_svg'] ?? '/favicon.svg',
            'site_favicon_32' => $config['site_favicon_32'] ?? '/favicon-32x32.png',
            'site_favicon_16' => $config['site_favicon_16'] ?? '/favicon-16x16.png',
            'site_apple_touch' => $config['site_apple_touch'] ?? '/apple-touch-icon.png',
            'schema_habilitado' => (int) ($config['schema_habilitado'] ?? 1),
            'verify_google' => $config['verify_google'] ?? '',
            'verify_bing' => $config['verify_bing'] ?? '',
            'indexnow_key' => $config['indexnow_key'] ?? '',
            'schema_tipo' => $config['schema_tipo'] ?? 'Organization',
            'schema_nombre' => $config['schema_nombre'] ?? 'Consexvip',
            'schema_url' => $config['schema_url'] ?? 'https://www.consexvip.cl/',
            'schema_logo' => $config['schema_logo'] ?? 'https://www.consexvip.cl/favicon-32x32.png',
            'schema_description' => $config['schema_description'] ?? 'Directorio premium de escorts en Chile. Perfiles verificados, fotos, tarifas y contacto directo.',
            'schema_sameAs' => $config['schema_sameAs'] ?? '',
            'schema_email' => $config['schema_email'] ?? '',
            'schema_telefono' => $config['schema_telefono'] ?? '',
            'schema_localidad' => $config['schema_localidad'] ?? '',
            'schema_pais' => $config['schema_pais'] ?? 'CL',
            'schema_imagen' => $config['schema_imagen'] ?? '',
            'cta_titulo' => $config['cta_titulo'] ?? '¿Eres escort o agencia?',
            'cta_subtitulo' => $config['cta_subtitulo'] ?? 'Publica tu perfil y llega a miles de clientes potenciales',
            'cta_boton_1' => $config['cta_boton_1'] ?? 'Publicar Ahora',
            'cta_boton_2' => $config['cta_boton_2'] ?? 'Ver Planes',
            'precio_vip_mensual' => (int) ($config['precio_vip_mensual'] ?? 50000),
            'precio_destacado_semanal' => (int) ($config['precio_destacado_semanal'] ?? 15000),
            'nav_logo_1' => $config['nav_logo_1'] ?? 'CS',
            'nav_logo_2' => $config['nav_logo_2'] ?? 'Escorts',
            'nav_inicio' => $config['nav_inicio'] ?? 'Inicio',
            'nav_ciudades' => $config['nav_ciudades'] ?? 'Ciudades',
            'nav_ingresar' => $config['nav_ingresar'] ?? 'Ingresar',
            'nav_publicar' => $config['nav_publicar'] ?? 'Publicar',
            'nav_entrar_usuario' => $config['nav_entrar_usuario'] ?? 'Entrar como Usuario',
            'nav_entrar_usuario_desc' => $config['nav_entrar_usuario_desc'] ?? 'Guarda favoritos, valora',
            'nav_entrar_escort' => $config['nav_entrar_escort'] ?? 'Entrar como Escort',
            'nav_entrar_escort_desc' => $config['nav_entrar_escort_desc'] ?? 'Administra tu perfil',
            'nav_mi_panel' => $config['nav_mi_panel'] ?? 'Mi Panel',
            'nav_mi_cuenta' => $config['nav_mi_cuenta'] ?? 'Mi Cuenta',
            'nav_mis_favoritos' => $config['nav_mis_favoritos'] ?? 'Mis Favoritos',
            'nav_mi_perfil' => $config['nav_mi_perfil'] ?? 'Mi Perfil',
            'nav_cerrar_sesion' => $config['nav_cerrar_sesion'] ?? 'Cerrar sesión',

            // === Footer ===
            'footer_logo_1' => $config['footer_logo_1'] ?? 'CS',
            'footer_logo_2' => $config['footer_logo_2'] ?? 'ESCORTS',
            'footer_titulo_paginas' => $config['footer_titulo_paginas'] ?? 'Páginas',
            'footer_titulo_contacto' => $config['footer_titulo_contacto'] ?? 'Contacto',
            'footer_panel_escort' => $config['footer_panel_escort'] ?? 'Panel Escort',
            'footer_registro_usuario' => $config['footer_registro_usuario'] ?? 'Registro Usuario',
            'footer_registro_escort' => $config['footer_registro_escort'] ?? 'Registro Escort',
            'footer_entrar_usuario' => $config['footer_entrar_usuario'] ?? 'Entrar como Usuario',
            'footer_entrar_escort' => $config['footer_entrar_escort'] ?? 'Entrar como Escort',
            'footer_negocios' => $config['footer_negocios'] ?? 'Negocios',
            'footer_anuncia_negocio' => $config['footer_anuncia_negocio'] ?? 'Anuncia tu negocio',
            'footer_email_cuenta' => $config['footer_email_cuenta'] ?? 'contacto',
            'footer_derechos' => $config['footer_derechos'] ?? 'Todos los derechos reservados.',
            'footer_mayores18' => $config['footer_mayores18'] ?? 'Solo para mayores de 18 años.',

            // === Estadísticas (StatsStrip) ===
            'stat_escorts_label' => $config['stat_escorts_label'] ?? 'Escorts activas',
            'stat_ciudades_label' => $config['stat_ciudades_label'] ?? 'Ciudades',
            'stat_verificadas_label' => $config['stat_verificadas_label'] ?? 'Perfiles verificados',
            'stat_valoraciones_label' => $config['stat_valoraciones_label'] ?? 'Valoraciones',

            // === Testimonios ===
            'testimonios_titulo' => $config['testimonios_titulo'] ?? 'Opiniones de clientes',

            // === Badges de tarjetas de escort ===
            'badge_disponible' => $config['badge_disponible'] ?? 'Disponible',
            'badge_gira' => $config['badge_gira'] ?? 'En gira',
            'badge_gira_ciudad' => $config['badge_gira_ciudad'] ?? 'En gira en {ciudad}',
            'badge_nueva' => $config['badge_nueva'] ?? 'Nueva',
            'badge_verificada' => $config['badge_verificada'] ?? 'Verificada',
            'badge_vip' => $config['badge_vip'] ?? 'VIP',
            'badge_anios' => $config['badge_anios'] ?? '{edad} años',
            'badge_valoracion' => $config['badge_valoracion'] ?? 'Valoración: {rating} estrellas, {reseñas} reseñas',

            // === Modal de ciudades ===
            'modal_ciudades_titulo' => $config['modal_ciudades_titulo'] ?? 'Selecciona una ciudad',
            'modal_ciudades_placeholder' => $config['modal_ciudades_placeholder'] ?? 'Escribe el nombre de la ciudad...',
            'modal_ciudades_sin_resultados' => $config['modal_ciudades_sin_resultados'] ?? 'No hay ciudades disponibles',
            'modal_ciudades_no_encontrada' => $config['modal_ciudades_no_encontrada'] ?? 'No se encontró "{query}"',
            'modal_ciudades_contador' => $config['modal_ciudades_contador'] ?? '{cantidad} ciudades',
            'modal_ciudades_escorts_count' => $config['modal_ciudades_escorts_count'] ?? '{cantidad} escorts',

            // === Contadores y estados de secciones ===
            'seccion_escorts_vacia' => $config['seccion_escorts_vacia'] ?? 'No hay escorts disponibles',
            'seccion_cargando_mas' => $config['seccion_cargando_mas'] ?? 'Cargando más...',
            'contador_escorts' => $config['contador_escorts'] ?? '{cantidad} escorts',
            'contador_nuevas' => $config['contador_nuevas'] ?? '{cantidad} nuevas',
            'contador_disponibles' => $config['contador_disponibles'] ?? '{cantidad} disponibles',

            // === CTA final ===
            'cta_badge' => $config['cta_badge'] ?? 'Publica tu anuncio',

            // === Página de ciudad ===
            'ciudad_sin_resultados' => $config['ciudad_sin_resultados'] ?? 'Sin resultados',
            'ciudad_sin_resultados_filtros' => $config['ciudad_sin_resultados_filtros'] ?? 'con esos filtros',
            'ciudad_sin_escorts' => $config['ciudad_sin_escorts'] ?? 'No hay escorts en {ciudad} por ahora',
            'ciudad_contador_resultados' => $config['ciudad_contador_resultados'] ?? '{cantidad} resultados',
            'ciudad_hint_filtros' => $config['ciudad_hint_filtros'] ?? 'Prueba con otros filtros o término de búsqueda',
            'ciudad_hint_vuelve' => $config['ciudad_hint_vuelve'] ?? 'Vuelve más tarde para ver nuevas publicaciones',
            'ciudad_limpiar_filtros' => $config['ciudad_limpiar_filtros'] ?? 'Limpiar filtros',
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
