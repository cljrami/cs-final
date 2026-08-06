<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();

    // Ciudad opcional para filtrar por sticky_posiciones de esa ciudad
    $ciudadId = 0;
    if (!empty($_GET['ciudad'])) {
        $stmtC = $pdo->prepare("SELECT id FROM ciudades WHERE nombre = ? LIMIT 1");
        $stmtC->execute([$_GET['ciudad']]);
        $ciudadId = (int)$stmtC->fetchColumn();
    }

    // Una escort es efectivamente sticky si tiene sticky vigente o un extra sticky activo.
    $stickySQL = "(e.sticky = 1 AND (e.sticky_expira IS NULL OR e.sticky_expira >= CURDATE()) OR EXISTS (SELECT 1 FROM suscripciones se JOIN planes pe ON pe.id = se.plan_id AND pe.extra_tipo = 'sticky' WHERE se.escort_id = e.id AND se.estado = 'activa' AND se.fecha_fin >= CURDATE()))";

    // Sin ciudad: cualquier posición fija (la de su ciudad); con ciudad: solo la de esa ciudad.
    $spJoin = $ciudadId > 0
        ? "LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = {$ciudadId}"
        : "LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id";

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
            COALESCE(sp.orden, 0) as sticky_orden,
            e.visitas_perfil,
            e.rating,
            e.total_valoraciones,
            (SELECT COUNT(*) FROM favoritos f WHERE f.escort_id = e.id) as likes
        FROM escorts e
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        $spJoin
        WHERE e.activa = 1
          AND e.eliminada = 0
          AND sp.orden > 0
          AND $stickySQL
        ORDER BY sp.orden ASC, e.vip DESC, e.visitas_perfil DESC
    ");

    $stmt->execute();
    $escorts = $stmt->fetchAll();

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
