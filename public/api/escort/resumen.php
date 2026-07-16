<?php
// public_html/api/escort/resumen.php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

try {
    require_once __DIR__ . '/../bootstrap.php';
    $pdo = getDBConnection();

    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = (int) ($tokenData['id'] ?? 0);

    if (!$escortId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID no válido en token']);
        exit;
    }

    // ¿Existe la columna aprobada? (por si la migración aún no se ejecuta)
    $colStmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'aprobada'
    ");
    $colStmt->execute();
    $tieneAprobada = (int)$colStmt->fetchColumn() > 0;

    if ($tieneAprobada) {
        $stmt = $pdo->prepare("
            SELECT id, nombre, usuario as nombreArtistico, email, telefono, whatsapp,
                   edad, altura, peso, medidas, ciudad, descripcion_corta, descripcion_larga,
                   estado, verificado, vip, destacado, sticky, activa, aprobada,
                   plan_id, suscripcion_id, fecha_vip_expira, fecha_destacado_expira,
                   visitas_perfil, contactos_recibidos, rating, total_valoraciones,
                   created_at, updated_at
            FROM escorts WHERE id = ?
        ");
    } else {
        $stmt = $pdo->prepare("
            SELECT id, nombre, usuario as nombreArtistico, email, telefono, whatsapp,
                   edad, altura, peso, medidas, ciudad, descripcion_corta, descripcion_larga,
                   estado, verificado, vip, destacado, sticky, activa,
                   plan_id, suscripcion_id, fecha_vip_expira, fecha_destacado_expira,
                   visitas_perfil, contactos_recibidos, rating, total_valoraciones,
                   created_at, updated_at
            FROM escorts WHERE id = ?
        ");
    }
    $stmt->execute([$escortId]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    // Aprobada si columna aprobada=1, o estado='aprobada', o tiene suscripción aprobada
    $cuentaAprobada = ($tieneAprobada && !empty($escort['aprobada'])) || $escort['estado'] === 'aprobada';

    if (!$cuentaAprobada) {
        $susFallback = $pdo->prepare("
            SELECT 1 FROM suscripciones 
            WHERE escort_id = ? AND fecha_aprobacion IS NOT NULL
            LIMIT 1
        ");
        $susFallback->execute([$escortId]);
        if ($susFallback->fetch()) {
            $cuentaAprobada = true;
        }
    }

    // FOTO PORTADA desde escort_fotos
    $fotoStmt = $pdo->prepare("
        SELECT url FROM escort_fotos 
        WHERE escort_id = ? AND es_portada = 1 
        ORDER BY orden ASC LIMIT 1
    ");
    $fotoStmt->execute([$escortId]);
    $fotoPortada = $fotoStmt->fetchColumn() ?: null;

    if ($escort['activa'] == 0) {
        echo json_encode([
            'success' => true,
            'pendiente' => true,
            'data' => [
                'id' => (int) $escort['id'],
                'nombre' => $escort['nombre'],
                'nombreArtistico' => $escort['nombreArtistico'] ?: $escort['nombre'],
                'email' => $escort['email'],
                'activa' => 0,
                'estado' => 'pendiente',
                'perfilCompleto' => 0,
                'fotosCount' => 0,
                'historiasCount' => 0,
                'visitasHoy' => 0,
                'visitasTotal' => 0,
                'contactosRecibidos' => 0,
                'rating' => 0,
                'totalValoraciones' => 0,
                'planVencido' => false,
                'planVigente' => false,
                'vipVencido' => true,
                'destacadoVencido' => true,
                'fotoPrincipal' => $fotoPortada,
                'aprobada' => (int)$cuentaAprobada,
            ]
        ]);
        exit;
    }

    $fotosStmt = $pdo->prepare("SELECT COUNT(*) FROM escort_fotos WHERE escort_id = ?");
    $fotosStmt->execute([$escortId]);
    $fotosCount = (int) $fotosStmt->fetchColumn();

    $historiasStmt = $pdo->prepare("SELECT COUNT(*) FROM escort_historias WHERE escort_id = ?");
    $historiasStmt->execute([$escortId]);
    $historiasCount = (int) $historiasStmt->fetchColumn();

    $planVencido = false;
    $planNombre = null;
    $planBadge = null;
    $planColor = null;
    $planDiasRestantes = 0;
    $planVigente = false;

    $sus = $pdo->prepare("
        SELECT s.*, p.nombre as plan_nombre, p.badge, p.color_badge
        FROM suscripciones s
        LEFT JOIN planes p ON s.plan_id = p.id
        WHERE s.escort_id = ? AND s.estado = 'activa'
        ORDER BY s.fecha_fin DESC LIMIT 1
    ");
    $sus->execute([$escortId]);
    $suscripcion = $sus->fetch(PDO::FETCH_ASSOC);

    if ($suscripcion) {
        $fechaFin = strtotime($suscripcion['fecha_fin']);
        $ahora = time();
        $planVencido = $fechaFin < $ahora;
        $planDiasRestantes = $planVencido ? 0 : ceil(($fechaFin - $ahora) / 86400);
        $planVigente = !$planVencido;
        $planNombre = $suscripcion['plan_nombre'];
        $planBadge = $suscripcion['badge'];
        $planColor = $suscripcion['color_badge'];
    }

    $vipVencido = $escort['fecha_vip_expira'] ? strtotime($escort['fecha_vip_expira']) < time() : true;
    $destacadoVencido = $escort['fecha_destacado_expira'] ? strtotime($escort['fecha_destacado_expira']) < time() : true;

    $campos = ['nombre', 'usuario', 'email', 'telefono', 'edad', 'altura', 'peso', 'medidas', 'ciudad', 'descripcion_corta', 'descripcion_larga'];
    $llenos = 0;
    foreach ($campos as $c) {
        if (!empty($escort[$c]) && $escort[$c] !== '0' && $escort[$c] !== '') {
            $llenos++;
        }
    }
    $perfilCompleto = min(100, round(($llenos / count($campos)) * 100));

    echo json_encode(['success' => true, 'data' => [
        'id' => (int) $escort['id'],
        'nombre' => $escort['nombre'],
        'aprobada' => (int) $cuentaAprobada,
        'nombreArtistico' => $escort['nombreArtistico'] ?: $escort['nombre'],
        'email' => $escort['email'],
        'telefono' => $escort['telefono'],
        'whatsapp' => $escort['whatsapp'],
        'edad' => (int) $escort['edad'],
        'altura' => $escort['altura'] ? (int) $escort['altura'] : null,
        'peso' => $escort['peso'] ? (int) $escort['peso'] : null,
        'medidas' => $escort['medidas'],
        'ciudad' => $escort['ciudad'],
        'descripcionCorta' => $escort['descripcion_corta'],
        'descripcionLarga' => $escort['descripcion_larga'],
        'estado' => $escort['estado'],
        'verificado' => (int) $escort['verificado'],
        'vip' => (int) $escort['vip'],
        'destacado' => (int) $escort['destacado'],
        'sticky' => (int) $escort['sticky'],
        'activa' => (int) $escort['activa'],
        'planVencido' => $planVencido,
        'planNombre' => $planNombre,
        'planBadge' => $planBadge,
        'planColor' => $planColor,
        'planDiasRestantes' => $planDiasRestantes,
        'planVigente' => $planVigente,
        'vipVencido' => $vipVencido,
        'destacadoVencido' => $destacadoVencido,
        'fotosCount' => $fotosCount,
        'historiasCount' => $historiasCount,
        'visitasHoy' => 0,
        'visitasTotal' => (int) $escort['visitas_perfil'],
        'contactosRecibidos' => (int) $escort['contactos_recibidos'],
        'rating' => (float) $escort['rating'],
        'totalValoraciones' => (int) $escort['total_valoraciones'],
        'perfilCompleto' => $perfilCompleto,
        'fotoPrincipal' => $fotoPortada,
        'createdAt' => $escort['created_at'],
        'updatedAt' => $escort['updated_at']
    ]]);
} catch (Throwable $e) {
    error_log("Error resumen.php: " . $e->getMessage() . " en " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
