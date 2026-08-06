<?php
// public/api/config/site.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT clave, valor FROM configuracion WHERE tipo IN ('string', 'int', 'bool', 'json')");
    $stmt->execute();
    $config = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    echo json_encode([
        'success' => true,
        'data' => [
            'site_nombre' => $config['site_nombre'] ?? 'CSEscorts',
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
            'seo_url' => $config['seo_url'] ?? 'https://kimi.zona8.cl/',
            'seo_canonical' => $config['seo_canonical'] ?? 'https://kimi.zona8.cl/',
            'seo_robots' => $config['seo_robots'] ?? 'INDEX, FOLLOW',
            'seo_author' => $config['seo_author'] ?? 'Kimi',
            'seo_publisher' => $config['seo_publisher'] ?? 'Kimi',
            'seo_lang' => $config['seo_lang'] ?? 'es',
            'seo_ciudad_h1' => $config['seo_ciudad_h1'] ?? 'Escorts en {ciudad}',
            'seo_ciudad_titulo' => $config['seo_ciudad_titulo'] ?? 'Escorts en {ciudad} | CSEscorts',
            'seo_ciudad_description' => $config['seo_ciudad_description'] ?? 'Encuentra escorts y acompañantes en {ciudad}. Perfiles verificados y actualizados diariamente.',
            'seo_ciudad_keywords' => $config['seo_ciudad_keywords'] ?? 'escorts en {ciudad}, acompañantes en {ciudad}, escorts {ciudad}',
            'seo_escort_titulo' => $config['seo_escort_titulo'] ?? '{nombre}, {edad} años | CSEscorts',
            'seo_escort_description' => $config['seo_escort_description'] ?? 'Perfil de {nombre} en {ciudad}. {descripcion}',
            'seo_escort_og_titulo' => $config['seo_escort_og_titulo'] ?? '{nombre}, {edad} años - CSEscorts',
            'seo_escort_og_description' => $config['seo_escort_og_description'] ?? 'Perfil verificado de {nombre} en {ciudad}',
            'seo_inicio_titulo' => $config['seo_inicio_titulo'] ?? 'Inicio',
            'seo_inicio_description' => $config['seo_inicio_description'] ?? 'Directorio Premium de Escorts en Chile',
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
            'schema_habilitado' => (int) ($config['schema_habilitado'] ?? 1),
            'schema_tipo' => $config['schema_tipo'] ?? 'Organization',
            'schema_nombre' => $config['schema_nombre'] ?? 'CSEscorts',
            'schema_url' => $config['schema_url'] ?? 'https://kimi.zona8.cl/',
            'schema_logo' => $config['schema_logo'] ?? '',
            'schema_description' => $config['schema_description'] ?? 'Directorio Premium de Escorts en Chile',
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
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
