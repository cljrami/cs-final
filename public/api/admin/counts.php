<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

function getSince(string $key): string {
    $ts = $_GET["since_$key"] ?? '';
    if ($ts === '') return '';
    // Convert ISO 8601 (2026-07-09T12:48:00.000Z) to MySQL datetime (2026-07-09 12:48:00)
    $dt = date_create($ts);
    return $dt ? $dt->format('Y-m-d H:i:s') : '';
}

function safeCount(PDO $pdo, string $sql): int {
    try {
        return (int)$pdo->query($sql)->fetchColumn();
    } catch (PDOException $e) {
        if ($e->getCode() === '42S02') {
            return 0;
        }
        throw $e;
    }
}

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $sinceEscorts = getSince('escorts');
    $escorts = safeCount($pdo, "SELECT COUNT(*) FROM escorts WHERE eliminada = 0" . ($sinceEscorts ? " AND created_at > " . $pdo->quote($sinceEscorts) : ""));

    $escortsEnGira = safeCount($pdo, "SELECT COUNT(*) FROM escorts WHERE en_gira = 1 AND eliminada = 0");

    $verificacionesPendientes = safeCount($pdo, "SELECT COUNT(*) FROM verificaciones WHERE estado = 'pendiente'");

    $verificacionesRechazadas = safeCount($pdo, "SELECT COUNT(*) FROM verificaciones WHERE estado = 'rechazada'");

    $verificacionesAprobadasTabla = safeCount($pdo, "SELECT COUNT(*) FROM verificaciones WHERE estado = 'aprobada'");

    $verificacionesLegacy = safeCount($pdo, "
        SELECT COUNT(*) FROM escorts e 
        WHERE e.verificado = 1 
        AND NOT EXISTS (SELECT 1 FROM verificaciones v WHERE v.escort_id = e.id)"
        . ($sinceEscorts ? " AND e.created_at > " . $pdo->quote($sinceEscorts) : "")
    );

    $verificacionesTotal = $verificacionesPendientes;

    $extrasPendientes = safeCount($pdo, "
        SELECT COUNT(*) FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE p.tipo = 'extra' AND s.fecha_aprobacion IS NULL"
    );

    $solicitudesVip = safeCount($pdo, "
        SELECT COUNT(*) FROM escort_vip_solicitudes 
        WHERE estado = 'enviado'"
    );

    $pagosPendientes = safeCount($pdo, "
        SELECT COUNT(*) FROM pagos 
        WHERE estado_pago = 'pendiente'"
    );

    $categorias = safeCount($pdo, "SELECT COUNT(*) FROM categorias WHERE activa = 1");
    $servicios = safeCount($pdo, "SELECT COUNT(*) FROM servicios WHERE activo = 1");
    $ciudades = safeCount($pdo, "SELECT COUNT(*) FROM ciudades WHERE activa = 1");
    $planes = safeCount($pdo, "SELECT COUNT(*) FROM planes WHERE activo = 1");
    $extras = safeCount($pdo, "SELECT COUNT(*) FROM planes WHERE tipo = 'extra' AND activo = 1");

    $nacionalidades = safeCount($pdo, "SELECT COUNT(*) FROM nacionalidades WHERE activo = 1");
    $orientaciones = safeCount($pdo, "SELECT COUNT(*) FROM orientaciones_sexuales WHERE activa = 1");
    $etnias = safeCount($pdo, "SELECT COUNT(*) FROM etnias WHERE activo = 1");
    $colores = safeCount($pdo, "SELECT COUNT(*) FROM colores WHERE activo = 1");
    $estilos = safeCount($pdo, "SELECT COUNT(*) FROM estilos WHERE activo = 1");
    $idiomas = safeCount($pdo, "SELECT COUNT(*) FROM idiomas WHERE activo = 1");

    $suscripcionesPendientes = safeCount($pdo, "
        SELECT COUNT(*) FROM suscripciones s
        JOIN escorts e ON e.id = s.escort_id
        WHERE s.fecha_aprobacion IS NULL 
          AND e.eliminada = 0"
    );

    $comentariosPendientes = safeCount($pdo, "
        SELECT COUNT(*) FROM comentarios WHERE aprobado = 0"
    );

    $reportesPendientes = safeCount($pdo, "
        SELECT COUNT(*) FROM reportes WHERE estado = 'pending'"
    );

    echo json_encode([
        'success' => true,
        'counts' => [
            'escorts' => $escorts,
            'escortsEnGira' => $escortsEnGira,
            'verificaciones' => $verificacionesTotal,
            'verificacionesPendientes' => $verificacionesPendientes,
            'solicitudesVip' => $solicitudesVip,
            'extrasPendientes' => $extrasPendientes,
            'pagosPendientes' => $pagosPendientes,
            'categorias' => $categorias,
            'servicios' => $servicios,
            'ciudades' => $ciudades,
            'planes' => $planes,
            'nacionalidades' => $nacionalidades,
            'orientaciones' => $orientaciones,
            'etnias' => $etnias,
            'colores' => $colores,
            'estilos' => $estilos,
            'idiomas' => $idiomas,
            'extras' => $extras,
            'suscripcionesPendientes' => $suscripcionesPendientes,
            'comentariosPendientes' => $comentariosPendientes,
            'reportesPendientes' => $reportesPendientes,
        ]
    ]);
} catch (PDOException $e) {
    error_log("Error counts.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error counts.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
