<?php
require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getDBConnection();

    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, min(100, intval($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $categoria = $_GET['categoria'] ?? '';
    $ciudad_id = $_GET['ciudad_id'] ?? '';
    $search = trim($_GET['search'] ?? '');
    $destacado = $_GET['destacado'] ?? '';
    $activo = $_GET['activo'] ?? '1';

    $where = ['n.activo = 1'];
    $params = [];

    if ($categoria !== '') {
        $where[] = 'LOWER(n.categoria) = LOWER(?)';
        $params[] = $categoria;
    }
    if ($ciudad_id !== '') {
        $where[] = 'n.ciudad_id = ?';
        $params[] = intval($ciudad_id);
    }
    if ($search !== '') {
        $where[] = '(LOWER(n.nombre) LIKE LOWER(?) OR LOWER(n.descripcion) LIKE LOWER(?) OR LOWER(n.direccion) LIKE LOWER(?) OR LOWER(n.telefono) LIKE LOWER(?) OR LOWER(n.whatsapp) LIKE LOWER(?) OR LOWER(n.web) LIKE LOWER(?) OR LOWER(n.instagram) LIKE LOWER(?) OR LOWER(c.nombre) LIKE LOWER(?) )';
        $like = '%'.$search.'%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }
    if ($destacado !== '') {
        $where[] = 'n.destacado = ?';
        $params[] = intval($destacado);
    }
    if ($activo !== '') {
        $where[] = 'n.activo = ?';
        $params[] = intval($activo);
    }

    $whereSql = implode(' AND ', $where);

    $sql = "
        SELECT n.id, n.nombre, n.slug, n.categoria, n.descripcion, n.direccion,
               n.telefono, n.whatsapp, n.web, n.instagram, n.logo_url,
               n.destacado, n.activo, n.actualizado_en,
               c.nombre AS ciudad_nombre
        FROM negocios n
        LEFT JOIN ciudades c ON c.id = n.ciudad_id
        WHERE $whereSql
        ORDER BY n.destacado DESC, n.nombre ASC
        LIMIT ? OFFSET ?
    ";
    $params[] = $limit;
    $params[] = $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $data = $stmt->fetchAll();

    $countSql = "
        SELECT COUNT(*) as total
        FROM negocios n
        WHERE $whereSql
    ";
    $countParams = array_slice($params, 0, count($params)-2);
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($countParams);
    $total = (int)$stmtCount->fetchColumn();

    jsonResponse(true, [
        'negocios' => $data,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'has_more' => $offset + $limit < $total
        ]
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    jsonResponse(false, ['error' => $e->getMessage()]);
}
