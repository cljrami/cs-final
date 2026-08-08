<?php
// public/api/escorts/listado.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/gira.php';

try {
    $pdo = getDBConnection();

    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = min(200, max(1, intval($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    // JOIN para nombre de ciudad en gira (necesario para ciudad efectiva)
    $joinGira = "LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id";

    $giraCond = gira_activa();

    $where = ["e.activa = 1", "e.eliminada = 0",
        "EXISTS (SELECT 1 FROM suscripciones s JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL WHERE s.escort_id = e.id AND s.fecha_aprobacion IS NOT NULL AND s.estado = 'activa' AND s.fecha_fin >= CURDATE())"];
    $params = [];

    // Determinar ciudad_id para sticky (si se filtra por ciudad)
    $ciudadId = 0;
    if (!empty($_GET['ciudad'])) {
        $ciudadNorm = normalizar_ciudad($_GET['ciudad']);
        $where[] = "(({$giraCond} AND LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(gc.nombre, 'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u'),'ñ','n')) = ?) OR (NOT ({$giraCond}) AND LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(e.ciudad, 'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u'),'ñ','n')) = ?))";
        $params[] = $ciudadNorm;
        $params[] = $ciudadNorm;
        // Obtener ciudad_id para sticky_posiciones
        $stmtC = $pdo->prepare("SELECT id FROM ciudades WHERE nombre = ? LIMIT 1");
        $stmtC->execute([$_GET['ciudad']]);
        $ciudadId = (int)$stmtC->fetchColumn();
    }

    if (!empty($_GET['q'])) {
        $where[] = "(e.nombre LIKE ? OR e.ciudad LIKE ? OR gc.nombre LIKE ? OR e.descripcion_corta LIKE ? OR e.descripcion_larga LIKE ?)";
        $searchTerm = '%' . $_GET['q'] . '%';
        $params[] = $searchTerm; $params[] = $searchTerm; $params[] = $searchTerm; $params[] = $searchTerm; $params[] = $searchTerm;
    }

    if (isset($_GET['vip']) && $_GET['vip'] === '1') {
        $where[] = "e.vip = 1";
    }
    if (isset($_GET['verificado']) && $_GET['verificado'] === '1') {
        $where[] = "e.verificado = 1";
    }
    if (!empty($_GET['edad_min'])) {
        $where[] = "e.edad >= ?";
        $params[] = intval($_GET['edad_min']);
    }
    if (!empty($_GET['edad_max'])) {
        $where[] = "e.edad <= ?";
        $params[] = intval($_GET['edad_max']);
    }
    if (!empty($_GET['estado'])) {
        $where[] = "e.estado = ?";
        $params[] = $_GET['estado'];
    }
    if (!empty($_GET['disponible']) && $_GET['disponible'] === '1') {
        $where[] = "e.disponible_ahora = 1";
    }
    if (!empty($_GET['en_gira']) && $_GET['en_gira'] === '1') {
        $where[] = "e.en_gira = 1";
    }
    $whereClause = implode(' AND ', $where);

    // Una escort es efefectivamente sticky en la ciudad destino solo si tiene posición sticky
    // asignada EN ESA CIUDAD (sp.orden > 0 con sp.ciudad_id = ciudadId).
    // NOTA: para escorts en gira, el sticky de su ciudad base NO debe excluirlos del random
    //       en la ciudad destino. Por eso NO usamos e.sticky global aquí.
    // Importante: usamos COALESCE para manejar LEFT JOIN sin sticky_posiciones (NULL → 0).
    // Sin COALESCE, "NOT (sp.ciudad_id = ? AND sp.orden > 0)" evalúa a NOT(NULL) = NULL (falso),
    // excluyendo TODOS los escorts no sticky del pool random.
    $stickySQL = "(COALESCE(sp.ciudad_id, 0) = {$ciudadId} AND COALESCE(sp.orden, 0) > 0)";

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM escorts e LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id WHERE $whereClause");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $sortCreated = isset($_GET['sort']) && $_GET['sort'] === 'created_at';
    $sortRating = isset($_GET['sort']) && $_GET['sort'] === 'rating';

    $selectFields = "
        e.id, e.nombre, e.slug, e.edad,
        " . efectiva_ciudad() . " as ciudad, e.ciudad as ciudad_base,
        COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
        e.vip, e.verificado, e.destacado, e.sticky, e.estado,
        e.disponible_ahora,
        e.visitas_perfil, e.rating, e.total_valoraciones, e.created_at,
        (SELECT MIN(s2.fecha_aprobacion) FROM suscripciones s2 JOIN planes p2 ON p2.id = s2.plan_id WHERE s2.escort_id = e.id AND p2.tipo = 'base' AND s2.fecha_aprobacion IS NOT NULL) as fecha_aprobacion,
        e.en_gira, gc.nombre AS gira_ciudad,
        " . gira_activa() . " as gira_activa,
        COALESCE(sp.orden, 0) as sticky_orden
    ";

    if ($sortCreated) {
        $stmt = $pdo->prepare("
            SELECT $selectFields
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
            WHERE $whereClause
            ORDER BY e.created_at DESC
            LIMIT $limit OFFSET $offset
        ");
        array_unshift($params, $ciudadId);
        $stmt->execute($params);
        $escorts = $stmt->fetchAll();
    } elseif ($sortRating) {
        $stmt = $pdo->prepare("
            SELECT $selectFields
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
            WHERE $whereClause
            ORDER BY e.rating DESC, e.total_valoraciones DESC, sticky_orden ASC
            LIMIT $limit OFFSET $offset
        ");
        array_unshift($params, $ciudadId);
        $stmt->execute($params);
        $escorts = $stmt->fetchAll();
    } elseif ($ciudadId > 0) {
        $slotsInicio = $offset + 1;
        $slotsFin = $offset + $limit;

        // sticky fijos en el rango de esta página (usando sticky_posiciones por ciudad)
        $stmtFijos = $pdo->prepare("
            SELECT $selectFields
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
            WHERE $whereClause
              AND {$stickySQL}
              AND COALESCE(sp.orden, 0) BETWEEN ? AND ?
            ORDER BY sp.orden ASC
        ");
        $stmtFijos->execute(array_merge([$ciudadId], $params, [$slotsInicio, $slotsFin]));
        $mapFijos = [];
        foreach ($stmtFijos->fetchAll(PDO::FETCH_ASSOC) as $f) {
            $mapFijos[(int)$f['sticky_orden']] = $f;
        }

        // random para llenar slots vacíos
        $slotsLibres = $limit - count($mapFijos);
        $stmtRand = $pdo->prepare("
            SELECT $selectFields
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
            WHERE $whereClause
              AND NOT $stickySQL
            ORDER BY RAND()
        ");
        $stmtRand->execute(array_merge([$ciudadId], $params));
        $todosRandom = $stmtRand->fetchAll(PDO::FETCH_ASSOC);
        $randomItems = array_slice($todosRandom, 0, $slotsLibres);

        // merge slot por slot
        $escorts = [];
        $randomIdx = 0;
        for ($pos = $slotsInicio; $pos <= $slotsFin; $pos++) {
            if (isset($mapFijos[$pos])) {
                $escorts[] = $mapFijos[$pos];
            } elseif ($randomIdx < count($randomItems)) {
                $escorts[] = $randomItems[$randomIdx];
                $randomIdx++;
            }
        }
    } else {
        // Home/global (sin ciudad): las sticky van primero, luego random no-sticky.
        // En el home no hay posiciones absolutas por ciudad (sticky_posiciones se
        // agrupa por ciudad_id > 0), así que no se puede usar el merge por slots.
        $stmtSticky = $pdo->prepare("
            SELECT $selectFields
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
            WHERE $whereClause
              AND $stickySQL
            ORDER BY e.vip DESC, e.visitas_perfil DESC, e.nombre ASC
        ");
        $stmtSticky->execute(array_merge([$ciudadId], $params));
        $sticky = $stmtSticky->fetchAll(PDO::FETCH_ASSOC);

        $stmtRand = $pdo->prepare("
            SELECT $selectFields
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
            WHERE $whereClause
              AND NOT $stickySQL
            ORDER BY RAND()
        ");
        $stmtRand->execute(array_merge([$ciudadId], $params));
        $todosRandom = $stmtRand->fetchAll(PDO::FETCH_ASSOC);

        // Paginación determinística: primero el bloque sticky, luego el segmento
        // correspondiente del mismo shuffle random (sin duplicados ni huecos).
        $escorts = array_slice($sticky, $offset, $limit);
        $filled = count($escorts);
        if ($filled < $limit) {
            $randomOffset = max(0, $offset - count($sticky));
            $more = array_slice($todosRandom, $randomOffset, $limit - $filled);
            $escorts = array_merge($escorts, $more);
        }
    }

    // cargar likes y servicios para cada escort
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