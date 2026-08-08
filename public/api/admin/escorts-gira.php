<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/gira.php';

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);

    $pdo = getDBConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $estado = $_GET['estado'] ?? 'todos';
        $search = trim($_GET['search'] ?? '');
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        $where = ['e.en_gira = 1', 'e.eliminada = 0'];
        $params = [];

        $giraActiva = gira_activa();

        switch ($estado) {
            case 'vigentes':
                $where[] = $giraActiva;
                break;
            case 'vencidas':
                $where[] = "NOT ({$giraActiva})";
                break;
            case 'todos':
            default:
                break;
        }

        if ($search !== '') {
            $where[] = '(e.nombre LIKE :buscar1 OR e.email LIKE :buscar2 OR e.ciudad LIKE :buscar3 OR gc.nombre LIKE :buscar4)';
            $term = '%' . $search . '%';
            $params[':buscar1'] = $term;
            $params[':buscar2'] = $term;
            $params[':buscar3'] = $term;
            $params[':buscar4'] = $term;
        }

        $whereClause = implode(' AND ', $where);

        $countSql = "
            SELECT COUNT(*)
            FROM escorts e
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            WHERE {$whereClause}
        ";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        $sql = "
            SELECT
                e.id, e.nombre, e.slug, e.edad,
                COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
                e.email,
                e.ciudad as ciudad_base,
                gc.nombre as gira_ciudad,
                e.en_gira,
                e.gira_fecha_inicio,
                e.gira_fecha_fin,
                {$giraActiva} as gira_activa,
                e.activa,
                e.vip,
                e.verificado,
                e.destacado,
                e.rating,
                e.total_valoraciones,
                e.created_at,
                CASE
                    WHEN sb.estado = 'pausada' THEN 'pausada'
                    WHEN e.activa = 1 AND (sb.estado IS NULL OR sb.estado <> 'activa' OR sb.fecha_fin < CURDATE()) THEN 'expirada'
                    WHEN e.activa = 1 THEN 'aprobada'
                    WHEN sb.estado IS NULL THEN 'sin_plan'
                    ELSE 'pendiente'
                END as suscripcion_estado
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            LEFT JOIN suscripciones sb ON sb.id = (
                SELECT s2.id FROM suscripciones s2 JOIN planes p2 ON p2.id = s2.plan_id
                WHERE s2.escort_id = e.id AND p2.extra_tipo IS NULL
                ORDER BY s2.creado_en DESC LIMIT 1
            )
            WHERE {$whereClause}
            ORDER BY e.gira_fecha_inicio ASC, e.nombre ASC
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

        foreach ($escorts as &$e) {
            $e['id'] = (int)$e['id'];
            $e['edad'] = (int)$e['edad'];
            $e['en_gira'] = (int)$e['en_gira'];
            $e['gira_activa'] = (bool)$e['gira_activa'];
            $e['activa'] = (int)$e['activa'];
            $e['vip'] = (int)$e['vip'];
            $e['verificado'] = (int)$e['verificado'];
            $e['destacado'] = (int)$e['destacado'];
            $e['rating'] = $e['rating'] !== null ? (float)$e['rating'] : null;
            $e['total_valoraciones'] = (int)$e['total_valoraciones'];
            $e['foto_principal'] = $e['foto_principal']
                ? '/api/serve-upload.php?path=/' . ltrim($e['foto_principal'], '/')
                : null;

            if ($e['gira_fecha_inicio'] && $e['gira_fecha_fin']) {
                $fin = new DateTime($e['gira_fecha_fin']);
                $hoy = new DateTime('today');
                $diasRestantes = $fin->diff($hoy)->days;
                $e['gira_dias_restantes'] = $fin < $hoy ? -$diasRestantes : $diasRestantes;
            } else {
                $e['gira_dias_restantes'] = null;
            }
        }

        echo json_encode([
            'success' => true,
            'escorts' => $escorts,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltered,
                'pages' => ceil($totalFiltered / $limit),
                'hasMore' => ($page * $limit) < $totalFiltered
            ]
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';
        $id = intval($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }

        if ($action === 'end') {
            $stmt = $pdo->prepare("
                UPDATE escorts
                SET en_gira = 0,
                    gira_ciudad_id = NULL,
                    gira_fecha_inicio = NULL,
                    gira_fecha_fin = NULL,
                    updated_at = NOW()
                WHERE id = ? AND en_gira = 1
            ");
            $stmt->execute([$id]);

            if ($stmt->rowCount() === 0) {
                echo json_encode(['success' => false, 'error' => 'Escort no encontrada o no está en gira']);
                exit;
            }

            echo json_encode(['success' => true, 'message' => 'Gira finalizada correctamente']);
            exit;
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Acción no válida']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error escorts-gira.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error escorts-gira.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}