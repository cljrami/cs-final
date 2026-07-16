<?php
// public/api/escorts/destacadas.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();
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
            e.destacado,
            e.sticky,
            e.estado,
            e.visitas_perfil,
            e.rating,
            e.total_valoraciones,
            e.created_at
        FROM escorts e
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        WHERE e.activa = 1 
          AND e.eliminada = 0
          AND (e.destacado = 1 OR e.vip = 1 OR e.sticky = 1)
        ORDER BY 
            e.sticky DESC,
            e.destacado DESC,
            e.vip DESC,
            e.visitas_perfil DESC
        LIMIT 12
    ");

    $stmt->execute();
    $escorts = $stmt->fetchAll();

    foreach ($escorts as &$escort) {
        $likesStmt = $pdo->prepare("SELECT COUNT(*) FROM favoritos WHERE escort_id = ?");
        $likesStmt->execute([$escort['id']]);
        $escort['likes'] = (int) $likesStmt->fetchColumn();
    }

    echo json_encode([
        'success' => true,
        'data' => $escorts,
        'total' => count($escorts)
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
