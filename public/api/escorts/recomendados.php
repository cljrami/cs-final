<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/gira.php';

try {
    $pdo = getDBConnection();
    $escortId = isset($_GET['escort_id']) ? intval($_GET['escort_id']) : 0;
    if ($escortId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'escort_id requerido']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT e.ciudad, e.categoria_id, " . gira_activa() . " as gira_activa, gc.nombre AS gira_ciudad
        FROM escorts e
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE e.id = ?
    ");
    $stmt->execute([$escortId]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$escort) {
        echo json_encode(['success' => true, 'data' => []]);
        exit;
    }

    $ciudad = $escort['gira_activa'] ? $escort['gira_ciudad'] : $escort['ciudad'];
    $categoriaId = $escort['categoria_id'];

    $params = [$escortId];
    $condiciones = ["e.id != ?", "e.activa = 1", "e.eliminada = 0",
        "EXISTS (SELECT 1 FROM suscripciones s JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL WHERE s.escort_id = e.id AND s.fecha_aprobacion IS NOT NULL AND s.estado = 'activa' AND s.fecha_fin >= CURDATE())"];

    if ($ciudad) {
        $giraCond = gira_activa();
        $condiciones[] = "(({$giraCond} AND gc.nombre = ?) OR (NOT ({$giraCond}) AND e.ciudad = ?))";
        $params[] = $ciudad;
        $params[] = $ciudad;
    }
    if ($categoriaId) {
        $condiciones[] = "e.categoria_id = ?";
        $params[] = $categoriaId;
    }

    $where = implode(' AND ', $condiciones);

    $stmt = $pdo->prepare("
        SELECT e.id, e.nombre, e.slug, e.edad,
               " . efectiva_ciudad() . " as ciudad, e.ciudad as ciudad_base,
               COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
               e.vip, e.verificado, e.destacado, e.estado,
               e.disponible_ahora,
               e.rating, e.total_valoraciones, e.en_gira,
               gc.nombre AS gira_ciudad,
               " . gira_activa() . " as gira_activa
        FROM escorts e
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE $where
        ORDER BY e.destacado DESC, e.vip DESC, e.rating DESC, RAND()
        LIMIT 12
    ");
    $stmt->execute($params);
    $recomendados = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fallback: si menos de 6, ampliar búsqueda (solo ciudad -> solo categoría -> todas)
    if (count($recomendados) < 6) {
        $paramsFallback = [$escortId];
        $condicionesFb = ["e.id != ?", "e.activa = 1", "e.eliminada = 0",
            "EXISTS (SELECT 1 FROM suscripciones s JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL WHERE s.escort_id = e.id AND s.fecha_aprobacion IS NOT NULL AND s.estado = 'activa' AND s.fecha_fin >= CURDATE())"];
        // solo ciudad (ignorar categoría)
        if ($ciudad) {
            $giraCond = gira_activa();
            $condicionesFb[] = "(({$giraCond} AND gc.nombre = ?) OR (NOT ({$giraCond}) AND e.ciudad = ?))";
            $paramsFallback[] = $ciudad;
            $paramsFallback[] = $ciudad;
        }
        $whereFb = implode(' AND ', $condicionesFb);
        $stmtFb = $pdo->prepare("
            SELECT e.id, e.nombre, e.slug, e.edad,
                   " . efectiva_ciudad() . " as ciudad, e.ciudad as ciudad_base,
                   COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
                   e.vip, e.verificado, e.destacado, e.estado,
                   e.disponible_ahora,
                   e.rating, e.total_valoraciones, e.en_gira,
                   gc.nombre AS gira_ciudad,
                   " . gira_activa() . " as gira_activa
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            WHERE $whereFb
            ORDER BY e.destacado DESC, e.vip DESC, e.rating DESC, RAND()
            LIMIT 12
        ");
        $stmtFb->execute($paramsFallback);
        $recomendadosFb = $stmtFb->fetchAll(PDO::FETCH_ASSOC);
        // merge evitando duplicados
        $ids = array_column($recomendados, 'id');
        foreach ($recomendadosFb as $r) {
            if (!in_array($r['id'], $ids) && count($recomendados) < 12) {
                $recomendados[] = $r;
            }
        }
    }

    foreach ($recomendados as &$r) {
        $lk = $pdo->prepare("SELECT COUNT(*) FROM favoritos WHERE escort_id = ?");
        $lk->execute([$r['id']]);
        $r['likes'] = (int)$lk->fetchColumn();

        $sv = $pdo->prepare("SELECT s.nombre, s.icono FROM escort_servicios es JOIN servicios s ON es.servicio_id = s.id WHERE es.escort_id = ? AND s.activo = 1 LIMIT 3");
        $sv->execute([$r['id']]);
        $r['servicios'] = $sv->fetchAll();
    }

    echo json_encode(['success' => true, 'data' => $recomendados]);
} catch (Throwable $e) {
    error_log("Error recomendados.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
