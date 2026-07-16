<?php
// public/api/escorts/listado.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = min(50, max(1, intval($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $where = ["e.activa = 1", "e.eliminada = 0"];
    $params = [];

    if (!empty($_GET['ciudad'])) {
        $where[] = "e.ciudad = ?";
        $params[] = $_GET['ciudad'];
    }

    if (!empty($_GET['q'])) {
        $where[] = "(e.nombre LIKE ? OR e.ciudad LIKE ? OR e.descripcion_corta LIKE ? OR e.descripcion_larga LIKE ?)";
        $searchTerm = '%' . $_GET['q'] . '%';
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    if (isset($_GET['vip']) && $_GET['vip'] === '1') {
        $where[] = "e.vip = 1";
    }

    if (isset($_GET['verificado']) && $_GET['verificado'] === '1') {
        $where[] = "e.verificado = 1";
    }

    if (!empty($_GET['estado'])) {
        $where[] = "e.estado = ?";
        $params[] = $_GET['estado'];
    }

    $whereClause = implode(' AND ', $where);

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM escorts e WHERE $whereClause");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $sql = "
        SELECT 
            e.id,
            e.nombre,
            e.slug,
            e.edad,
            e.ciudad,
            COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
            e.vip,
            e.verificado,
            e.destacado,
            e.sticky,
            e.estado,
            e.visitas_perfil,
            e.rating,
            e.total_valoraciones,
            e.created_at
        FROM escorts e
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        WHERE $whereClause
        ORDER BY 
            e.sticky DESC,
            e.destacado DESC,
            e.vip DESC,
            e.visitas_perfil DESC,
            e.created_at DESC
        LIMIT ? OFFSET ?
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge($params, [$limit, $offset]));
    $escorts = $stmt->fetchAll();

    foreach ($escorts as &$escort) {
        $likesStmt = $pdo->prepare("SELECT COUNT(*) FROM favoritos WHERE escort_id = ?");
        $likesStmt->execute([$escort['id']]);
        $escort['likes'] = (int) $likesStmt->fetchColumn();

        $servStmt = $pdo->prepare("
            SELECT s.nombre, s.icono 
            FROM escort_servicios es
            JOIN servicios s ON es.servicio_id = s.id
            WHERE es.escort_id = ? AND s.activo = 1
            LIMIT 3
        ");
        $servStmt->execute([$escort['id']]);
        $escort['servicios'] = $servStmt->fetchAll();
    }

    echo json_encode([
        'success' => true,
        'data' => $escorts,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => ceil($total / $limit),
            'has_more' => ($offset + $limit) < $total
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
