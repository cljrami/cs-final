<?php
// public/api/escorts/buscar.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();
    $q = $_GET['q'] ?? '';
    $limit = min(20, max(1, intval($_GET['limit'] ?? 10)));

    if (strlen($q) < 2) {
        echo json_encode(['success' => true, 'data' => []]);
        exit;
    }

    $searchTerm = '%' . $q . '%';

    $stmt = $pdo->prepare("
        SELECT 
            e.id,
            e.nombre,
            e.slug,
            e.edad,
            e.ciudad,
            COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
            e.vip,
            e.verificado,
            e.estado
        FROM escorts e
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        WHERE e.activa = 1 
          AND e.eliminada = 0
          AND (e.nombre LIKE ? OR e.ciudad LIKE ? OR e.descripcion_corta LIKE ?)
        ORDER BY e.visitas_perfil DESC
        LIMIT ?
    ");

    $stmt->execute([$searchTerm, $searchTerm, $searchTerm, $limit]);
    $escorts = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => $escorts,
        'query' => $q
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
