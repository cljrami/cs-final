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
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    $pdo = getDBConnection();

    // === PARÁMETROS DE FILTRO ===
    $estado = isset($_GET['estado']) ? $_GET['estado'] : 'todos';
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
    $offset = ($page - 1) * $limit;

    // === STATS ===
    $stats = [
        'total' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE eliminada = 0")->fetchColumn(),
        'pendientes' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE activa = 0 AND eliminada = 0")->fetchColumn(),
        'aprobadas' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE activa = 1 AND eliminada = 0")->fetchColumn(),
        'rechazadas' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE activa = -1 AND eliminada = 0")->fetchColumn(),
        'planes_por_activar' => (int)$pdo->query("SELECT COUNT(*) FROM escort_vip_solicitudes WHERE estado = 'enviado'")->fetchColumn(),
        'papelera' => (int)$pdo->query("SELECT COUNT(*) FROM escorts WHERE eliminada = 1")->fetchColumn(),
    ];

    // === CONSTRUIR QUERY DINÁMICA ===
    $where = ['e.eliminada = 0']; // SIEMPRE excluir eliminadas del listado principal
    $params = [];

    // Filtro por estado (activa)
    switch ($estado) {
        case 'pendientes':
            $where[] = 'e.activa = 0';
            break;
        case 'aprobadas':
            $where[] = 'e.activa = 1';
            break;
        case 'rechazadas':
            $where[] = 'e.activa = -1';
            break;
        case 'todos':
        default:
            // No filtrar por activa
            break;
    }

    // Filtro por búsqueda (nombre o ciudad)
    if ($search !== '') {
        $where[] = '(e.nombre LIKE :buscar1 OR e.ciudad LIKE :buscar2)';
        $params[':buscar1'] = '%' . $search . '%';
        $params[':buscar2'] = '%' . $search . '%';
    }

    $whereClause = implode(' AND ', $where);

    // === CONTAR TOTAL PARA PAGINACIÓN ===
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM escorts e WHERE $whereClause");
    $countStmt->execute($params);
    $totalFiltered = (int)$countStmt->fetchColumn();

    // === OBTENER ESCORTS ===
    $sql = "
        SELECT 
            e.id,
            e.nombre,
            e.edad,
            e.estado,
            e.verificado,
            e.vip,
            e.activa,
            e.created_at,
            e.ciudad
        FROM escorts e
        WHERE $whereClause
        ORDER BY e.created_at DESC
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $pdo->prepare($sql);

    // Bind params de filtros
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val);
    }

    // Bind limit y offset como enteros
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    $stmt->execute();
    $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // === RESPUESTA ===
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
    echo json_encode(['success' => false, 'error' => 'Error interno: ' . $e->getMessage()]);
}
