<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? ($_GET['id'] ?? null);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM logs_auditoria WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);
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
        $where[] = "(a.nombre LIKE ? OR u.nombre LIKE ? OR e.nombre LIKE ? OR la.tabla_afectada LIKE ? OR la.accion LIKE ?)";
        $s = "%{$search}%";
        for ($i = 0; $i < 5; $i++) { $params[] = $s; }
    }

    $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

    // Stats
    $statsStmt = $pdo->query("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN accion = 'crear' THEN 1 ELSE 0 END) as crear,
            SUM(CASE WHEN accion = 'editar' THEN 1 ELSE 0 END) as editar,
            SUM(CASE WHEN accion = 'eliminar' THEN 1 ELSE 0 END) as eliminar,
            SUM(CASE WHEN accion = 'aprobar' THEN 1 ELSE 0 END) as aprobar,
            SUM(CASE WHEN accion = 'rechazar' THEN 1 ELSE 0 END) as rechazar
        FROM logs_auditoria
    ");
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
    foreach ($stats as &$v) { $v = (int)$v; }
    unset($v);

    // Total count
    $countSql = "SELECT COUNT(*) FROM logs_auditoria la LEFT JOIN admins a ON a.id = la.usuario_id LEFT JOIN usuarios u ON u.id = la.usuario_id LEFT JOIN escorts e ON e.id = la.escort_id $whereClause";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $sql = "
        SELECT 
            la.id,
            la.usuario_id,
            la.escort_id,
            a.nombre as admin_nombre,
            a.avatar as admin_foto,
            u.nombre as user_nombre,
            u.avatar as user_foto,
            e.nombre as escort_nombre,
            e.foto_principal as escort_foto,
            la.accion,
            la.tabla_afectada as entidad,
            la.registro_id as entidad_id,
            la.datos_nuevos as detalle,
            la.created_at as creado_en
        FROM logs_auditoria la
        LEFT JOIN admins a ON a.id = la.usuario_id
        LEFT JOIN usuarios u ON u.id = la.usuario_id
        LEFT JOIN escorts e ON e.id = la.escort_id
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
        $nombre = null;
        $foto = null;
        if (!empty($row['admin_nombre'])) {
            $nombre = $row['admin_nombre'];
            $foto = $row['admin_foto'];
        } elseif (!empty($row['user_nombre'])) {
            $nombre = $row['user_nombre'];
            $foto = $row['user_foto'];
        } elseif (!empty($row['escort_nombre'])) {
            $nombre = $row['escort_nombre'];
            $foto = $row['escort_foto'];
        } elseif ($row['usuario_id'] !== null) {
            $nombre = 'Usuario #' . $row['usuario_id'];
        } elseif ($row['escort_id'] !== null) {
            $nombre = 'Escort #' . $row['escort_id'];
        }
        $row['usuario_nombre'] = $nombre;
        $row['usuario_foto'] = empty($foto) ? null : '/api/serve-upload.php?path=/' . ltrim($foto, '/');
        unset($row['admin_nombre'], $row['admin_foto'], $row['user_nombre'], $row['user_foto'], $row['escort_nombre'], $row['escort_foto']);
    }
    unset($row);

    echo json_encode([
        'success' => true,
        'stats' => $stats,
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
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

