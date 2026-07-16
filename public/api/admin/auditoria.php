<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método no permitido']);
        exit;
    }

    $accionFilter = $_GET['accion'] ?? 'todos';
    $search = trim($_GET['search'] ?? '');
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, min(200, intval($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    $where = [];
    $params = [];

    if ($accionFilter !== 'todos') {
        $where[] = "la.accion = ?";
        $params[] = $accionFilter;
    }

    if ($search !== '') {
        $where[] = "(a.nombre LIKE ? OR la.tabla_afectada LIKE ? OR la.accion LIKE ?)";
        $s = "%{$search}%";
        $params[] = $s;
        $params[] = $s;
        $params[] = $s;
    }

    $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

    // Total count
    $countSql = "SELECT COUNT(*) FROM logs_auditoria la LEFT JOIN admins a ON a.id = la.usuario_id $whereClause";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $sql = "
        SELECT 
            la.id,
            COALESCE(a.nombre, 'Desconocido') as usuario_nombre,
            la.accion,
            la.tabla_afectada as entidad,
            la.registro_id as entidad_id,
            la.datos_nuevos as detalle,
            la.created_at as creado_en
        FROM logs_auditoria la
        LEFT JOIN admins a ON a.id = la.usuario_id
        $whereClause
        ORDER BY la.created_at DESC
        LIMIT $limit OFFSET $offset
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format detalle from JSON if possible
    foreach ($data as &$row) {
        if ($row['detalle'] !== null) {
            $decoded = json_decode($row['detalle'], true);
            if ($decoded !== null) {
                $row['detalle'] = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            }
        }
    }
    unset($row);

    echo json_encode([
        'success' => true,
        'data' => $data,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => max(1, ceil($total / $limit))
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
