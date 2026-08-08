<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

try {
    require_once __DIR__ . '/../bootstrap.php';

    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (substr($authHeader, 0, 7) !== 'Bearer ') {
        jsonError('No autorizado', 401);
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || (isset($tokenData['exp']) ? $tokenData['exp'] : 0) < time()) {
        jsonError('Token inválido o expirado', 401);
    }

    $escortId = $tokenData['id'];

    if ($escortId <= 0) {
        jsonError('Token inválido', 401);
    }

    $pdo = getDBConnection();

    $fotoPortada = null;
    try {
        $stmtFoto = $pdo->prepare("SELECT f.url FROM escort_fotos f WHERE f.escort_id = ? AND f.es_portada = 1 LIMIT 1");
        $stmtFoto->execute([$escortId]);
        $fotoPortada = $stmtFoto->fetchColumn();
    } catch (Throwable $e) {
        $fotoPortada = null;
    }

    // ¿Existe la columna aprobada? (por si la migración aún no se ejecuta)
    $colStmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'aprobada'
    ");
    $colStmt->execute();
    $tieneAprobada = (int)$colStmt->fetchColumn() > 0;
    $aprobadaCol = $tieneAprobada ? "CAST(e.aprobada AS UNSIGNED) as aprobada," : "0 as aprobada,";

    $stmt = $pdo->prepare("
        SELECT 
            e.id,
            e.nombre,
            $aprobadaCol
            e.activa as escort_activa,
            e.estado as estado_cuenta,
            CAST(e.verificado AS UNSIGNED) as verificado,
            CAST(e.vip AS UNSIGNED) as vip,
            p.nombre as plan_nombre,
            p.color_badge as plan_color,
            s.estado as plan_estado,
            p.max_pausas_permitidas as pausas_maximas,
            (SELECT COUNT(*) FROM historial_pausas hp WHERE hp.suscripcion_id = s.id AND hp.accion = 'pausa') as pausas_usadas,
            (SELECT GROUP_CONCAT(px.nombre SEPARATOR ', ') FROM suscripciones sx 
             JOIN planes px ON px.id = sx.plan_id 
             WHERE sx.escort_id = e.id 
               AND px.tipo = 'extra' 
               AND sx.estado = 'activa') as extras_activos
        FROM escorts e
        LEFT JOIN suscripciones s ON s.escort_id = e.id 
            AND s.estado IN ('activa', 'pausada')
            AND s.plan_id IN (SELECT id FROM planes WHERE tipo = 'base')
        LEFT JOIN planes p ON p.id = s.plan_id
        WHERE e.id = ?
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        jsonError('Escort no encontrada', 404);
    }

    $escort['foto_portada'] = $fotoPortada;
    $escort['nombre_artistico'] = $escort['nombre'];
    $escort['aprobada'] = (bool)($escort['aprobada'] ?? 0) 
        || ($escort['estado_cuenta'] ?? '') === 'aprobada'
        || $escort['escort_activa'] == 1;

    // Fallback: considerar aprobada solo si tiene una suscripción base aprobada
    // y vigente (NO cancelada/expirada). Evita que una cuenta re-registrada con
    // suscripciones canceladas aparezca como "aprobada" sin plan activo.
    if (!$escort['aprobada']) {
        $susCheck = $pdo->prepare("
            SELECT 1 FROM suscripciones s
            JOIN planes p ON p.id = s.plan_id AND p.tipo = 'base'
            WHERE s.escort_id = ?
              AND s.fecha_aprobacion IS NOT NULL
              AND s.eliminada = 0
              AND s.estado IN ('activa', 'pausada')
              AND (s.estado = 'pausada' OR s.fecha_fin >= CURDATE())
            LIMIT 1
        ");
        $susCheck->execute([$escortId]);
        if ($susCheck->fetch()) {
            $escort['aprobada'] = true;
        }
    }
    $stmtComent = $pdo->prepare("SELECT COUNT(*) FROM comentarios WHERE escort_id = ? AND aprobado = 1");
    $stmtComent->execute([$escortId]);
    $escort['comentarios_count'] = (int)$stmtComent->fetchColumn();

    $escort['pausas_usadas'] = isset($escort['pausas_usadas']) ? (int)$escort['pausas_usadas'] : 0;
    $escort['pausas_maximas'] = isset($escort['pausas_maximas']) ? (int)$escort['pausas_maximas'] : 0;
    $escort['pausas_restantes'] = max(0, $escort['pausas_maximas'] - $escort['pausas_usadas']);

    $stmtVip = $pdo->prepare("
        SELECT estado 
        FROM escort_vip_solicitudes 
        WHERE escort_id = ? 
          AND estado IN ('enviado', 'rechazado')
        ORDER BY created_at DESC 
        LIMIT 1
    ");
    $stmtVip->execute([$escortId]);
    $vipSolicitud = $stmtVip->fetch(PDO::FETCH_ASSOC);
    $escort['vip_solicitud_estado'] = isset($vipSolicitud['estado']) ? $vipSolicitud['estado'] : null;

    if ($escort['verificado'] == 1) {
        $escort['verificacion_estado'] = 'aprobada';
    } else {
        $stmtVerif = $pdo->prepare("
            SELECT estado 
            FROM verificaciones 
            WHERE escort_id = ? 
              AND estado IN ('pendiente', 'rechazada')
            ORDER BY creado_en DESC 
            LIMIT 1
        ");
        $stmtVerif->execute([$escortId]);
        $verifSolicitud = $stmtVerif->fetch(PDO::FETCH_ASSOC);
        $escort['verificacion_estado'] = isset($verifSolicitud['estado']) ? $verifSolicitud['estado'] : null;
    }

    echo json_encode([
        'success' => true,
        'escort' => $escort
    ]);
} catch (Throwable $e) {
    error_log("Error perfil-sidebar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
