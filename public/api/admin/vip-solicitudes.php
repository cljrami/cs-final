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

    // Parámetros de filtro
    $estado = isset($_GET['estado']) ? $_GET['estado'] : 'todos';
    $search = trim($_GET['search'] ?? '');
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $perPage = isset($_GET['per_page']) ? max(10, min(100, intval($_GET['per_page']))) : 20;
    $offset = ($page - 1) * $perPage;

    $estadosValidos = ['enviado', 'en_revision', 'aprobado', 'rechazado'];
    $params = [];
    $where = "WHERE 1=1";

    if ($estado !== 'todos' && in_array($estado, $estadosValidos)) {
        $where .= " AND vs.estado = ?";
        $params[] = $estado;
    }

    if ($search !== '') {
        $where .= " AND (e.nombre LIKE ? OR e.email LIKE ?)";
        $s = "%{$search}%";
        $params[] = $s;
        $params[] = $s;
    }

    // Contar total
    $stmtCount = $pdo->prepare("SELECT COUNT(*) as total FROM escort_vip_solicitudes vs JOIN escorts e ON e.id = vs.escort_id $where");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetch(PDO::FETCH_ASSOC)['total'];

    // Obtener solicitudes (con subquery para evitar duplicados por múltiples suscripciones)
    $sql = "
        SELECT 
            vs.id,
            vs.escort_id,
            vs.plan as plan_vip,
            vs.estado,
            vs.comprobante_pago,
            vs.admin_notas,
            vs.fecha_respuesta,
            vs.created_at as fecha_solicitud,
            e.nombre as escort_nombre,
            e.email as escort_email,
            e.telefono,
            e.ciudad,
            e.foto_principal,
            e.verificado,
            sb.nombre as plan_base_nombre,
            sb.color_badge as plan_base_color,
            s.fecha_fin as plan_base_vence,
            DATEDIFF(s.fecha_fin, CURDATE()) as dias_restantes_base,
            a.nombre as revisado_por_nombre
        FROM escort_vip_solicitudes vs
        JOIN escorts e ON e.id = vs.escort_id
        LEFT JOIN suscripciones s ON s.id = (
            SELECT s2.id FROM suscripciones s2
            JOIN planes p2 ON p2.id = s2.plan_id AND p2.tipo = 'base'
            WHERE s2.escort_id = e.id
              AND s2.estado = 'activa'
              AND s2.fecha_aprobacion IS NOT NULL
            ORDER BY s2.creado_en DESC
            LIMIT 1
        )
        LEFT JOIN planes sb ON sb.id = s.plan_id
        LEFT JOIN admins a ON a.nombre = vs.revisado_por
        $where
        ORDER BY 
            CASE vs.estado 
                WHEN 'enviado' THEN 1 
                WHEN 'en_revision' THEN 2 
                WHEN 'aprobado' THEN 3 
                WHEN 'rechazado' THEN 4 
            END,
            vs.created_at DESC
        LIMIT $perPage OFFSET $offset
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $solicitudes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $solicitudesFormateadas = [];
    foreach ($solicitudes as $s) {
        $solicitudesFormateadas[] = [
            'id' => (int)$s['id'],
            'escort' => [
                'id' => (int)$s['escort_id'],
                'nombre' => $s['escort_nombre'],
                'email' => $s['escort_email'],
                'telefono' => $s['telefono'],
                'ciudad' => $s['ciudad'],
                'foto_principal' => $s['foto_principal']
                    ? '/api/serve-upload.php?path=/' . ltrim($s['foto_principal'], '/')
                    : null,
                'verificado' => (bool)$s['verificado']
            ],
            'plan_vip' => $s['plan_vip'],
            'estado' => $s['estado'],
            'comprobante_pago' => $s['comprobante_pago']
                ? '/api/serve-upload.php?path=/' . ltrim($s['comprobante_pago'], '/')
                : null,
            'admin_notas' => $s['admin_notas'],
            'fecha_solicitud' => $s['fecha_solicitud'],
            'fecha_respuesta' => $s['fecha_respuesta'],
            'plan_base' => [
                'nombre' => $s['plan_base_nombre'],
                'color' => $s['plan_base_color'],
                'vence' => $s['plan_base_vence'],
                'dias_restantes' => max(0, (int)$s['dias_restantes_base'])
            ],
            'revisado_por' => $s['revisado_por_nombre']
        ];
    }

    // Contadores por estado para los tabs
    $stmtCounts = $pdo->query("
        SELECT 
            SUM(CASE WHEN estado = 'enviado' THEN 1 ELSE 0 END) as enviados,
            SUM(CASE WHEN estado = 'en_revision' THEN 1 ELSE 0 END) as en_revision,
            SUM(CASE WHEN estado = 'aprobado' THEN 1 ELSE 0 END) as aprobados,
            SUM(CASE WHEN estado = 'rechazado' THEN 1 ELSE 0 END) as rechazados
        FROM escort_vip_solicitudes
    ");
    $counts = $stmtCounts->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'solicitudes' => $solicitudesFormateadas,
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => ceil($total / $perPage)
        ],
        'counts' => [
            'todos' => $total,
            'enviados' => (int)$counts['enviados'],
            'en_revision' => (int)$counts['en_revision'],
            'aprobados' => (int)$counts['aprobados'],
            'rechazados' => (int)$counts['rechazados']
        ]
    ]);
} catch (PDOException $e) {
    error_log("Error vip-solicitudes.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Error vip-solicitudes.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
