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
require_once __DIR__ . '/../lib/gira.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);

    $pdo = getDBConnection();

    $estado = $_GET['estado'] ?? 'todos';
    $search = trim($_GET['search'] ?? '');
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
$offset = ($page - 1) * $limit;

    // Subconsulta: estado del último plan base (extra_tipo IS NULL)
    $ultimoBaseEstado = "(SELECT b2.estado FROM suscripciones b2 JOIN planes q2 ON q2.id = b2.plan_id WHERE b2.escort_id = e.id AND q2.extra_tipo IS NULL ORDER BY b2.creado_en DESC LIMIT 1)";
    $ultimoBaseFin = "(SELECT b3.fecha_fin FROM suscripciones b3 JOIN planes q3 ON q3.id = b3.plan_id WHERE b3.escort_id = e.id AND q3.extra_tipo IS NULL ORDER BY b3.creado_en DESC LIMIT 1)";
    $esPausada = "COALESCE($ultimoBaseEstado, '') = 'pausada'";
    $noPausada = "COALESCE($ultimoBaseEstado, '') <> 'pausada'";
    $esVenceHoy = "COALESCE($ultimoBaseEstado, '') = 'activa' AND COALESCE($ultimoBaseFin, '') = CURDATE()";

    // Stats por suscripcion_estado + eliminadas
    $statsSql = "
        SELECT 
            SUM(CASE WHEN e.eliminada = 1 THEN 1 ELSE 0 END) as papelera,
            SUM(CASE WHEN e.eliminada = 0 THEN 1 ELSE 0 END) as total,
            SUM(CASE WHEN e.eliminada = 0 AND e.activa = 0 AND $noPausada THEN 1 ELSE 0 END) as pendientes,
            SUM(CASE WHEN e.eliminada = 0 AND e.activa = 1 AND $noPausada THEN 1 ELSE 0 END) as activas,
            SUM(CASE WHEN e.eliminada = 0 AND e.activa = -1 THEN 1 ELSE 0 END) as rechazadas,
            SUM(CASE WHEN e.eliminada = 0 AND e.activa <> -1 AND COALESCE($ultimoBaseEstado, '') = 'pausada' THEN 1 ELSE 0 END) as pausadas,
            SUM(CASE WHEN e.eliminada = 0 AND e.verificado = 1 THEN 1 ELSE 0 END) as verificadas,
            SUM(CASE WHEN e.eliminada = 0 AND e.vip = 1 THEN 1 ELSE 0 END) as vip,
            SUM(CASE WHEN e.eliminada = 0 AND $esVenceHoy THEN 1 ELSE 0 END) as vencen_hoy
        FROM escorts e
    ";
    $statsRow = $pdo->query($statsSql)->fetch(PDO::FETCH_ASSOC);

    $stats = [
        'total' => (int)$statsRow['total'],
        'pendientes' => (int)$statsRow['pendientes'],
        'activas' => (int)$statsRow['activas'],
        'rechazadas' => (int)$statsRow['rechazadas'],
        'pausadas' => (int)$statsRow['pausadas'],
        'verificadas' => (int)$statsRow['verificadas'],
        'vip' => (int)$statsRow['vip'],
        'vencen_hoy' => (int)$statsRow['vencen_hoy'],
        'papelera' => (int)$statsRow['papelera'],
    ];

    // Construir WHERE diníƒÂ¡micamente
    $where = [];
    $params = [];

    if ($estado === 'papelera') {
        $where[] = 'e.eliminada = 1';
    } else {
        $where[] = 'e.eliminada = 0';
switch ($estado) {
            case 'pendientes':
                $where[] = 'e.activa = 0 AND ' . $noPausada;
                break;
            case 'activas':
                $where[] = 'e.activa = 1 AND ' . $noPausada;
                break;
            case 'pausadas':
                $where[] = 'e.activa <> -1 AND ' . $esPausada;
                break;
            case 'vencen_hoy':
                $where[] = 'e.activa = 1 AND ' . $esVenceHoy;
                break;
            case 'rechazadas':
                $where[] = 'e.activa = -1';
                break;
            case 'todos':
            default:
                break;
        }
    }

    if ($search !== '') {
        $where[] = '(e.id = :buscarId OR e.nombre LIKE :buscar1 OR e.ciudad LIKE :buscar2 OR e.email LIKE :buscar3)';
        $params[':buscarId'] = is_numeric($search) ? (int)$search : 0;
        $params[':buscar1'] = '%' . $search . '%';
        $params[':buscar2'] = '%' . $search . '%';
        $params[':buscar3'] = '%' . $search . '%';
    }

    $whereClause = $where ? implode(' AND ', $where) : '1=1';

    // Count
    $countSql = "SELECT COUNT(*) FROM escorts e LEFT JOIN suscripciones s ON s.id = (SELECT s2.id FROM suscripciones s2 WHERE s2.escort_id = e.id ORDER BY s2.creado_en DESC LIMIT 1) WHERE $whereClause";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalFiltered = (int)$countStmt->fetchColumn();

    // Data
    $sql = "
        SELECT 
            e.id, e.nombre, e.edad, e.estado, e.verificado, e.vip, e.activa, e.created_at, " . efectiva_ciudad() . " as ciudad, e.ciudad as ciudad_base, e.email, e.foto_principal, e.rating, e.total_valoraciones, e.eliminada as eliminada,
            -- Estado de la escort basado en activa (la íƒÂºnica fuente de verdad)
            CASE 
                WHEN e.activa = -1 THEN 'rechazada'
                WHEN sb.estado = 'pausada' THEN 'pausada'
                WHEN e.activa = 1 THEN 'aprobada'
                ELSE 'pendiente'
            END as suscripcion_estado,
            -- Base plan (extra_tipo IS NULL)
            pb.nombre as plan_base_nombre,
            pb.badge as plan_base_badge,
            pb.color_badge as plan_base_color,
            sb.estado as plan_base_estado_raw,
            CASE WHEN sb.estado = 'activa' AND sb.fecha_fin >= CURDATE() THEN 'activa' WHEN sb.estado = 'activa' AND sb.fecha_fin < CURDATE() THEN 'expirada' ELSE sb.estado END as plan_base_estado,
            GREATEST(0, DATEDIFF(sb.fecha_fin, CURDATE())) as plan_base_dias,
            -- Extra plan (extra_tipo IS NOT NULL)
            pe.nombre as plan_extra_nombre,
            pe.extra_tipo as plan_extra_tipo,
            pe.badge as plan_extra_badge,
            pe.color_badge as plan_extra_color,
            se.estado as plan_extra_estado_raw,
            CASE WHEN se.estado = 'activa' AND se.fecha_fin >= CURDATE() THEN 'activa' WHEN se.estado = 'activa' AND se.fecha_fin < CURDATE() THEN 'expirada' ELSE se.estado END as plan_extra_estado,
            GREATEST(0, DATEDIFF(se.fecha_fin, CURDATE())) as plan_extra_dias
        FROM escorts e
        LEFT JOIN suscripciones s ON s.id = (
            SELECT s2.id FROM suscripciones s2 WHERE s2.escort_id = e.id ORDER BY s2.creado_en DESC LIMIT 1
        )
        LEFT JOIN suscripciones sb ON sb.id = (
            SELECT s3.id FROM suscripciones s3 JOIN planes p3 ON p3.id = s3.plan_id WHERE s3.escort_id = e.id AND p3.extra_tipo IS NULL ORDER BY s3.creado_en DESC LIMIT 1
        )
        LEFT JOIN planes pb ON pb.id = sb.plan_id
        LEFT JOIN suscripciones se ON se.id = (
            SELECT s4.id FROM suscripciones s4 JOIN planes p4 ON p4.id = s4.plan_id WHERE s4.escort_id = e.id AND p4.extra_tipo IS NOT NULL ORDER BY s4.creado_en DESC LIMIT 1
        )
        LEFT JOIN planes pe ON pe.id = se.plan_id
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE $whereClause
        ORDER BY e.created_at DESC
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'escorts' => $escorts,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $totalFiltered,
            'pages' => ceil($totalFiltered / $limit),
            'hasMore' => ($page * $limit) < $totalFiltered
        ]
    ]);
} catch (PDOException $e) {
    error_log("Error escorts.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error escorts.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

