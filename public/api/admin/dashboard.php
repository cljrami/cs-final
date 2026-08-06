<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $stats = [
        'total' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE eliminada = 0")->fetchColumn(),
        'pendientes' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE activa = 0 AND (aprobada = 0 OR aprobada IS NULL) AND eliminada = 0")->fetchColumn(),
        'aprobadas' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE activa = 1 AND eliminada = 0")->fetchColumn(),
        'rechazadas' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE activa = -1 AND eliminada = 0")->fetchColumn(),
        'verificadas' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE verificado = 1 AND eliminada = 0")->fetchColumn(),
        'vip' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE vip = 1 AND eliminada = 0")->fetchColumn(),
        'destacadas' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE destacado = 1 AND eliminada = 0")->fetchColumn(),
'planes_por_activar' => (int)$pdo->query("SELECT COUNT(*) FROM escort_vip_solicitudes WHERE estado = 'enviado'")->fetchColumn(),
        'verificaciones_pendientes' => (int)$pdo->query("SELECT COUNT(*) FROM verificaciones WHERE estado = 'pendiente'")->fetchColumn(),
        'nuevas_hoy' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE DATE(created_at) = CURDATE() AND eliminada = 0")->fetchColumn(),
        'pausadas' => (int)$pdo->query("
            SELECT COUNT(*) FROM escorts e WHERE (
                SELECT COALESCE(s.estado, '') FROM suscripciones s
                JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL
                WHERE s.escort_id = e.id
                ORDER BY s.id DESC LIMIT 1
            ) = 'pausada' AND e.eliminada = 0
        ")->fetchColumn(),
        'por_vencer' => (int)$pdo->query("
            SELECT COUNT(*) FROM suscripciones s
            JOIN escorts e ON e.id = s.escort_id
            JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL
            WHERE s.estado = 'activa' AND e.eliminada = 0
                AND s.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        ")->fetchColumn(),
        'total_usuarios' => (int)$pdo->query("SELECT COUNT(*) FROM usuarios")->fetchColumn(),
        'total_ciudades' => (int)$pdo->query("SELECT COUNT(DISTINCT ciudad) FROM escorts WHERE eliminada = 0 AND ciudad IS NOT NULL AND ciudad != ''")->fetchColumn(),
        'total_categorias' => (int)$pdo->query("SELECT COUNT(*) FROM categorias WHERE activa = 1")->fetchColumn(),
    ];

    $stmt = $pdo->query("
        SELECT 
            DATE(created_at) as fecha,
            COUNT(*) as cantidad
        FROM escorts
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 11 DAY) AND eliminada = 0
        GROUP BY DATE(created_at)
        ORDER BY fecha ASC
    ");
    $actividad = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $actividadCompleta = [];
    for ($i = 11; $i >= 0; $i--) {
        $fecha = date('Y-m-d', strtotime("-$i days"));
        $cantidad = 0;
        foreach ($actividad as $row) {
            if ($row['fecha'] === $fecha) {
                $cantidad = (int)$row['cantidad'];
                break;
            }
        }
        $actividadCompleta[] = [
            'fecha' => $fecha,
            'dia' => date('d/m', strtotime($fecha)),
            'cantidad' => $cantidad
        ];
    }

    $stmt = $pdo->query("
        SELECT 
            e.id,
            e.nombre,
            e.slug,
            e.edad,
            e.estado,
            e.verificado,
            e.vip,
            e.destacado,
            e.activa,
            e.created_at,
            e.ciudad,
            e.foto_principal
        FROM escorts e
        WHERE e.eliminada = 0
        ORDER BY e.created_at DESC
        LIMIT 10
    ");
    $recentEscorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->query("
        SELECT 
            e.id,
            e.nombre,
            e.slug,
            e.edad,
            e.estado,
            e.verificado,
            e.vip,
            e.destacado,
            e.activa,
            e.created_at,
            e.ciudad,
            e.foto_principal
        FROM escorts e
        WHERE e.eliminada = 0
        ORDER BY e.created_at DESC
        LIMIT 50
    ");
    $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Ingresos diarios (íƒÂºltimos 12 díƒÂ­as) desde suscripciones aprobadas
    $ingresos = $pdo->query("
        SELECT
            DATE(s.fecha_aprobacion) as fecha,
            SUM(s.precio_pagado) as total
        FROM suscripciones s
        WHERE s.fecha_aprobacion IS NOT NULL
            AND s.fecha_aprobacion >= DATE_SUB(CURDATE(), INTERVAL 11 DAY)
        GROUP BY DATE(s.fecha_aprobacion)
        ORDER BY fecha ASC
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Rellenar díƒÂ­as sin ingresos con 0
    $ingresosCompletos = [];
    for ($i = 11; $i >= 0; $i--) {
        $ts = strtotime("-$i days");
        $fecha = date('Y-m-d', $ts);
        $label = date('d/m', $ts);
        $total = 0;
        foreach ($ingresos as $row) {
            if ($row['fecha'] === $fecha) {
                $total = (float)$row['total'];
                break;
            }
        }
        $ingresosCompletos[] = [
            'fecha' => $fecha,
            'mes' => $fecha,
            'label' => $label,
            'total' => $total
        ];
    }

    // Top 5 ciudades
    $topCiudades = $pdo->query("
        SELECT ciudad, COUNT(*) as total
        FROM escorts
        WHERE eliminada = 0 AND ciudad IS NOT NULL AND ciudad != ''
        GROUP BY ciudad
        ORDER BY total DESC
        LIMIT 5
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Top 5 escorts míƒÂ¡s visitadas
    $topEscorts = $pdo->query("
        SELECT id, nombre, slug, ciudad, visitas_perfil, foto_principal
        FROM escorts
        WHERE eliminada = 0 AND activa = 1
        ORDER BY visitas_perfil DESC
        LIMIT 5
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Suscripciones por vencer (príƒÂ³ximos 7 díƒÂ­as, solo planes base)
    $porVencer = $pdo->query("
        SELECT s.id, s.fecha_fin, e.nombre as escort_nombre, e.id as escort_id,
               p.nombre as plan_nombre, DATEDIFF(s.fecha_fin, CURDATE()) as dias_restantes
        FROM suscripciones s
        JOIN escorts e ON e.id = s.escort_id
        JOIN planes p ON p.id = s.plan_id
        WHERE s.estado = 'activa' AND e.eliminada = 0 AND p.tipo = 'base'
            AND s.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        ORDER BY s.fecha_fin ASC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'actividad' => $actividadCompleta,
        'recentEscorts' => $recentEscorts,
        'escorts' => $escorts,
        'ingresos' => $ingresosCompletos,
        'topCiudades' => $topCiudades,
        'topEscorts' => $topEscorts,
        'porVencer' => $porVencer
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error de base de datos'
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}

