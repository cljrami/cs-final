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
    $adminId = intval($tokenData['id'] ?? 0);
    $adminRol = $tokenData['rol'] ?? '';

    if ($adminId <= 0 || !in_array($adminRol, ['superadmin', 'admin', 'moderador'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }

    $pdo = getDBConnection();

    // Detalle individual: busca la escort y devuelve su plan base + extras
    $detalleId = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($detalleId > 0) {
        // Primero obtener el escort_id desde cualquier suscripción
        $stmtLookup = $pdo->prepare("SELECT escort_id FROM suscripciones WHERE id = ?");
        $stmtLookup->execute([$detalleId]);
        $lookup = $stmtLookup->fetch(PDO::FETCH_ASSOC);

        if (!$lookup) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Suscripción no encontrada']);
            exit;
        }

        $escortId = (int)$lookup['escort_id'];

        // Obtener datos de la escort
        $stmtEscort = $pdo->prepare("SELECT id, nombre, email, telefono, foto_principal FROM escorts WHERE id = ? AND eliminada = 0");
        $stmtEscort->execute([$escortId]);
        $escort = $stmtEscort->fetch(PDO::FETCH_ASSOC);

        if (!$escort) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
            exit;
        }

        // Obtener el plan base de la escort (prioriza: activo → aprobado → más reciente)
        $stmtBase = $pdo->prepare("
            SELECT 
                s.id as suscripcion_id, s.escort_id, s.plan_id,
                s.fecha_inicio, s.fecha_aprobacion, s.fecha_rechazo,
                s.fecha_fin, s.precio_pagado, s.moneda, s.estado,
                s.comprobante_pago, s.creado_en,
                s.notas_pago as notas_admin,
                s.aprobado_por, s.rechazado_por,
                p.nombre as plan_nombre, p.slug as plan_slug,
                p.tipo as plan_tipo, p.duracion_dias,
                p.precio as plan_precio, p.badge as plan_badge,
                p.color_badge, p.max_pausas_permitidas,
                (SELECT COUNT(*) FROM historial_pausas hp WHERE hp.suscripcion_id = s.id AND hp.accion = 'pausa') as contador_pausas,
                COALESCE(s.dias_pausados, 0) as dias_pausados,
                a.nombre as aprobado_por_nombre,
                ar.nombre as rechazado_por_nombre,
                CASE 
                    WHEN s.fecha_aprobacion IS NULL THEN 'pendiente_aprobacion'
                    WHEN s.estado = 'pausada' THEN 'pausada'
                    WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 'activa'
                    WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'expirada'
                    WHEN s.estado = 'expirada' THEN 'expirada'
                    WHEN s.estado = 'cancelada' THEN 'cancelada'
                    WHEN s.estado = 'rechazada' THEN 'rechazada'
                    ELSE s.estado
                END as estado_calculado,
                GREATEST(0, DATEDIFF(s.fecha_fin, CURDATE())) as dias_restantes
            FROM suscripciones s
            JOIN planes p ON p.id = s.plan_id
            LEFT JOIN admins a ON a.id = s.aprobado_por
            LEFT JOIN admins ar ON ar.id = s.rechazado_por
            WHERE s.escort_id = ? AND p.tipo = 'base'
            ORDER BY 
                CASE 
                    WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 1
                    WHEN s.fecha_aprobacion IS NOT NULL THEN 2
                    ELSE 3
                END,
                s.fecha_aprobacion DESC,
                s.id DESC
            LIMIT 1
        ");
        $stmtBase->execute([$escortId]);
        $det = $stmtBase->fetch(PDO::FETCH_ASSOC);

        // Si no tiene plan base, dejamos campos vacíos
        if (!$det) {
            $det = [
                'suscripcion_id' => null,
                'escort_id' => $escortId,
                'plan_id' => null,
                'fecha_inicio' => null,
                'fecha_aprobacion' => null,
                'fecha_rechazo' => null,
                'fecha_fin' => null,
                'precio_pagado' => 0,
                'moneda' => 'CLP',
                'estado' => 'sin_plan',

                'comprobante_pago' => null,
                'creado_en' => null,
                'notas_admin' => null,
                'aprobado_por' => null,
                'rechazado_por' => null,
                'plan_nombre' => 'Sin plan base',
                'plan_slug' => '',
                'plan_tipo' => 'base',
                'duracion_dias' => 0,
                'plan_precio' => 0,
                'plan_badge' => null,
                'color_badge' => '#6b7280',
                'max_pausas_permitidas' => 0,
                'contador_pausas' => 0,
                'dias_pausados' => 0,
                'aprobado_por_nombre' => null,
                'rechazado_por_nombre' => null,
                'estado_calculado' => 'sin_plan',
                'dias_restantes' => 0,
            ];
            $historial = [];
            $fechaPausa = null;
        } else {
            // Historial de pausas del plan base
            $stmtHist = $pdo->prepare("
                SELECT hp.id, hp.accion, hp.fecha_accion, hp.dias_acumulados_pausa, hp.notas,
                       COALESCE(a.nombre, 'Admin') as realizado_por_nombre
                FROM historial_pausas hp
                LEFT JOIN admins a ON a.id = hp.realizado_por
                WHERE hp.suscripcion_id = ?
                ORDER BY hp.fecha_accion DESC
            ");
            $stmtHist->execute([$det['suscripcion_id']]);
            $historial = $stmtHist->fetchAll(PDO::FETCH_ASSOC);

            // Última fecha de pausa
            $fechaPausa = null;
            foreach ($historial as $h) {
                if ($h['accion'] === 'pausa') {
                    $fechaPausa = $h['fecha_accion'];
                    break;
                }
            }
        }

        // Extras de la escort (todos, no solo activos)
        $stmtExtras = $pdo->prepare("
            SELECT 
                s.id as suscripcion_id,
                p.nombre as plan_nombre,
                p.slug as plan_slug,
                p.extra_tipo,
                p.badge as plan_badge,
                p.color_badge,
                s.fecha_inicio,
                s.fecha_fin,
                s.precio_pagado,
                s.moneda,
                s.estado,
                s.creado_en,
                CASE 
                    WHEN s.fecha_aprobacion IS NULL THEN 'pendiente_aprobacion'
                    WHEN s.estado = 'pausada' THEN 'pausada'
                    WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 'activa'
                    WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'expirada'
                    ELSE s.estado
                END as estado_calculado
            FROM suscripciones s
            JOIN planes p ON p.id = s.plan_id
            WHERE s.escort_id = ? AND p.tipo = 'extra'
            ORDER BY s.creado_en DESC
        ");
        $stmtExtras->execute([$escortId]);
        $extras = $stmtExtras->fetchAll(PDO::FETCH_ASSOC);

        // Días activo (desde fecha_inicio hasta hoy)
        $diasActivo = 0;
        if ($det['fecha_inicio']) {
            $inicio = new DateTime($det['fecha_inicio']);
            $hoy = new DateTime();
            $diasActivo = (int)$inicio->diff($hoy)->days;
        }

        // Determinar el tipo de suscripción que se cliqueó (base/extra)
        $stmtTipo = $pdo->prepare("
            SELECT p.tipo FROM suscripciones s JOIN planes p ON p.id = s.plan_id WHERE s.id = ?
        ");
        $stmtTipo->execute([$detalleId]);
        $tipoClick = $stmtTipo->fetchColumn();

        echo json_encode([
            'success' => true,
            'suscripcion' => [
                'suscripcion_id' => $det['suscripcion_id'],
                'escort_id' => (int)$escortId,
                'escort_nombre' => $escort['nombre'],
                'escort_email' => $escort['email'],
                'escort_telefono' => $escort['telefono'],
                'foto_principal' => $escort['foto_principal'],
                'plan_id' => $det['plan_id'],
                'plan_nombre' => $det['plan_nombre'],
                'plan_slug' => $det['plan_slug'],
                'plan_tipo' => $det['plan_tipo'],
                'duracion_dias' => (int)$det['duracion_dias'],
                'plan_precio' => $det['plan_precio'],
                'plan_badge' => $det['plan_badge'],
                'color_badge' => $det['color_badge'],
                'fecha_inicio' => $det['fecha_inicio'],
                'fecha_aprobacion' => $det['fecha_aprobacion'],
                'fecha_fin' => $det['fecha_fin'],
                'fecha_pausa' => $fechaPausa,
                'fecha_rechazo' => $det['fecha_rechazo'],
                'precio_pagado' => (float)$det['precio_pagado'],
                'moneda' => $det['moneda'],
                'estado' => $det['estado'],
                'estado_calculado' => $det['estado_calculado'],
                'dias_restantes' => (int)$det['dias_restantes'],
                'dias_activo' => $diasActivo,

                'comprobante_pago' => !empty($det['comprobante_pago'])
                    ? '/api/serve-upload.php?path=/uploads/comprobantes/' . ltrim($det['comprobante_pago'], '/')
                    : null,
                'creado_en' => $det['creado_en'],
                'contador_pausas' => (int)$det['contador_pausas'],
                'dias_pausados' => (int)$det['dias_pausados'],
                'max_pausas_permitidas' => (int)$det['max_pausas_permitidas'],
                'notas_admin' => $det['notas_admin'],
                'aprobado_por_nombre' => $det['aprobado_por_nombre'],
                'rechazado_por_nombre' => $det['rechazado_por_nombre'],
                'historial_pausas' => $historial,
                'extras' => $extras
            ]
        ]);
        exit;
    }

    // Parámetros de filtro
    $estado = isset($_GET['estado']) ? $_GET['estado'] : 'todos';
    $tipo = isset($_GET['tipo']) ? $_GET['tipo'] : 'todos'; // base, extra, todos
    $search = trim($_GET['search'] ?? '');
    $pendientes = isset($_GET['pendientes']) ? (bool)$_GET['pendientes'] : false;
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $perPage = isset($_GET['per_page']) ? max(10, min(100, intval($_GET['per_page']))) : 20;
    $offset = ($page - 1) * $perPage;

    $params = [];
    $where = "WHERE e.eliminada = 0";

    // Filtro por estado
    if ($estado !== 'todos') {
        $estadosValidos = ['activa', 'expirada', 'cancelada', 'pausada', 'rechazada', 'pendiente_aprobacion'];
        if (in_array($estado, $estadosValidos)) {
            if ($estado === 'pendiente_aprobacion') {
                $where .= " AND s.fecha_aprobacion IS NULL";
            } else {
                $where .= " AND s.estado = ?";
                $params[] = $estado;
            }
        }
    }

    // Solo planes base (los extras se gestionan en el panel de Solicitudes Extras)
    $where .= " AND p.tipo = 'base'";

    // Búsqueda en múltiples campos
    if ($search !== '') {
        $escapedSearch = str_replace(['%', '_'], ['\\%', '\\_'], $search);
        $s = "%{$escapedSearch}%";
        $where .= " AND (s.id LIKE ? OR e.id LIKE ? OR e.nombre LIKE ? OR e.email LIKE ? OR e.telefono LIKE ? OR e.ciudad LIKE ? OR p.nombre LIKE ?)";
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
    }

    // Solo pendientes (sin aprobar)
    if ($pendientes) {
        $where .= " AND s.fecha_aprobacion IS NULL";
    }

    // Contar total
    $stmtCount = $pdo->prepare("
        SELECT COUNT(*) as total 
        FROM suscripciones s
        JOIN escorts e ON e.id = s.escort_id
        JOIN planes p ON p.id = s.plan_id
        $where
    ");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetch(PDO::FETCH_ASSOC)['total'];

    // Obtener suscripciones
    $sql = "
        SELECT 
            s.id as suscripcion_id,
            s.escort_id,
            s.plan_id,
            s.fecha_inicio,
            s.fecha_aprobacion,
            s.fecha_rechazo,
            s.fecha_fin,
            s.precio_pagado,
            s.moneda,
            s.estado,

            s.comprobante_pago,
            s.creado_en,
            s.aprobado_por,
            s.rechazado_por,
            e.nombre as escort_nombre,
            e.email as escort_email,
            e.telefono,
            e.ciudad,
             e.foto_principal,
            e.verificado,
            e.vip,
            p.nombre as plan_nombre,
            p.slug as plan_slug,
            p.tipo as plan_tipo,
            p.duracion_dias,
            p.precio as plan_precio,
            p.badge as plan_badge,
            p.color_badge,
            p.permite_vip,
            p.permite_destacado,
            p.max_pausas_permitidas,
            a.nombre as aprobado_por_nombre,
            ar.nombre as rechazado_por_nombre,
            CASE 
                WHEN s.fecha_aprobacion IS NULL THEN 'pendiente_aprobacion'
                WHEN s.estado = 'pausada' THEN 'pausada'
                WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 'activa'
                WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'expirada'
                WHEN s.estado = 'expirada' THEN 'expirada'
                WHEN s.estado = 'cancelada' THEN 'cancelada'
                WHEN s.estado = 'rechazada' THEN 'rechazada'
                ELSE s.estado
            END as estado_calculado,
            GREATEST(0, DATEDIFF(s.fecha_fin, CURDATE())) as dias_restantes,
            (SELECT COUNT(*) FROM historial_pausas hp WHERE hp.suscripcion_id = s.id AND hp.accion = 'pausa') as contador_pausas
        FROM suscripciones s
        JOIN escorts e ON e.id = s.escort_id
        JOIN planes p ON p.id = s.plan_id
        LEFT JOIN admins a ON a.id = s.aprobado_por
        LEFT JOIN admins ar ON ar.id = s.rechazado_por
        $where
        ORDER BY 
            CASE 
                WHEN s.fecha_aprobacion IS NULL THEN 1
                WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 2
                WHEN s.estado = 'pausada' THEN 3
                ELSE 4
            END,
            s.creado_en DESC
        LIMIT $perPage OFFSET $offset
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $suscripciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $suscripcionesFormateadas = [];
    foreach ($suscripciones as $s) {
        $suscripcionesFormateadas[] = [
            'suscripcion_id' => (int)$s['suscripcion_id'],
            'escort' => [
                'id' => (int)$s['escort_id'],
                'nombre' => $s['escort_nombre'],
                'email' => $s['escort_email'],
                'telefono' => $s['telefono'],
                'ciudad' => $s['ciudad'],
                'foto_principal' => $s['foto_principal'],
                'verificado' => (bool)$s['verificado'],
                'vip' => (bool)$s['vip']
            ],
            'plan' => [
                'id' => (int)$s['plan_id'],
                'nombre' => $s['plan_nombre'],
                'slug' => $s['plan_slug'],
                'tipo' => $s['plan_tipo'],
                'duracion_dias' => (int)$s['duracion_dias'],
                'precio' => (float)$s['plan_precio'],
                'badge' => $s['plan_badge'],
                'color' => $s['color_badge'],
                'permite_vip' => (bool)$s['permite_vip'],
                'permite_destacado' => (bool)$s['permite_destacado'],
                'max_pausas_permitidas' => (int)$s['max_pausas_permitidas']
            ],
            'suscripcion' => [
                'fecha_inicio' => $s['fecha_inicio'],
                'fecha_aprobacion' => $s['fecha_aprobacion'],
                'fecha_rechazo' => $s['fecha_rechazo'],
                'fecha_fin' => $s['fecha_fin'],
                'precio_pagado' => (float)$s['precio_pagado'],
                'moneda' => $s['moneda'],
                'estado' => $s['estado_calculado'],
                'estado_raw' => $s['estado'],
                'dias_restantes' => (int)$s['dias_restantes'],

                'comprobante_pago' => !empty($s['comprobante_pago'])
                    ? '/api/serve-upload.php?path=/uploads/comprobantes/' . ltrim($s['comprobante_pago'], '/')
                    : null,
                'creado_en' => $s['creado_en'],
                'contador_pausas' => (int)$s['contador_pausas'],
                'aprobado_por' => $s['aprobado_por_nombre'],
                'rechazado_por' => $s['rechazado_por_nombre']
            ]
        ];
    }

    // Contadores por estado para los tabs
    $stmtCounts = $pdo->query("
        SELECT 
            SUM(CASE WHEN s.fecha_aprobacion IS NULL THEN 1 ELSE 0 END) as pendientes,
            SUM(CASE WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 1 ELSE 0 END) as activas,
            SUM(CASE WHEN s.estado = 'pausada' THEN 1 ELSE 0 END) as pausadas,
            SUM(CASE WHEN s.estado = 'expirada' OR (s.estado = 'activa' AND s.fecha_fin < CURDATE()) THEN 1 ELSE 0 END) as expiradas,
            SUM(CASE WHEN s.estado = 'rechazada' THEN 1 ELSE 0 END) as rechazadas,
            SUM(CASE WHEN s.estado = 'cancelada' THEN 1 ELSE 0 END) as canceladas
        FROM suscripciones s
        JOIN escorts e ON e.id = s.escort_id
        JOIN planes p ON p.id = s.plan_id
        WHERE e.eliminada = 0 AND p.tipo = 'base'
    ");
    $counts = $stmtCounts->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'suscripciones' => $suscripcionesFormateadas,
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => ceil($total / $perPage)
        ],
        'counts' => [
            'todos' => $total,
            'pendientes' => (int)$counts['pendientes'],
            'activas' => (int)$counts['activas'],
            'pausadas' => (int)$counts['pausadas'],
            'expiradas' => (int)$counts['expiradas'],
            'rechazadas' => (int)$counts['rechazadas'],
            'canceladas' => (int)$counts['canceladas']
        ]
    ]);
} catch (PDOException $e) {
    error_log("Error suscripciones.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error suscripciones.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
