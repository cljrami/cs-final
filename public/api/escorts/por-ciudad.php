<?php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/gira.php';

try {
    $ciudad = trim($_GET['ciudad'] ?? '');
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = isset($_GET['limit']) ? min(20, max(1, intval($_GET['limit']))) : 20;
    $sort = $_GET['sort'] ?? '';
    $offset = ($page - 1) * $limit;

    if (!$ciudad) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parámetro ciudad requerido']);
        exit;
    }

    $ciudadNorm = normalizar_ciudad($ciudad);
    $pdo = getDBConnection();

    // Obtener ciudad_id para sticky_posiciones
    $ciudadId = 0;
    $stmtC = $pdo->prepare("SELECT id FROM ciudades WHERE nombre = ? LIMIT 1");
    $stmtC->execute([$ciudad]);
    $ciudadId = (int)$stmtC->fetchColumn();

    // JOIN para nombre de ciudad en gira (necesario para ciudad efectiva)
    $joinGira = "LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id";

    // JOIN con categorías para búsqueda por nombre de categoría
    $joinCategorias = "LEFT JOIN categorias c ON e.categoria_id = c.id";

    $giraCond = gira_activa();
    // Comparación normalizada: insensible a acentos y mayúsculas
    $efectivaCond = "(({$giraCond} AND LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(gc.nombre, 'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u'),'ñ','n')) = ?) OR (NOT ({$giraCond}) AND LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(e.ciudad, 'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u'),'ñ','n')) = ?))";
    $baseWhere = "e.activa = 1 AND e.eliminada = 0 AND {$efectivaCond} AND EXISTS (SELECT 1 FROM suscripciones s JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL WHERE s.escort_id = e.id AND s.fecha_aprobacion IS NOT NULL AND s.estado = 'activa' AND s.fecha_fin >= CURDATE())";
    $paramsBase = [$ciudadNorm, $ciudadNorm];

    // Búsqueda completa en TODOS los campos del perfil + servicios + categorías
    if (!empty($_GET['q'])) {
        $q = $_GET['q'];
        $words = preg_split('/\s+/', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $q)), -1, PREG_SPLIT_NO_EMPTY);
        $fields = [
            'e.nombre', 'e.usuario', 'e.ciudad', 'gc.nombre', 'e.descripcion_corta', 'e.descripcion_larga',
            'e.nacionalidad', 'e.etnia', 'e.color_ojos', 'e.color_pelo',
            'e.orientacion', 'e.estilo', 'e.telefono', 'e.whatsapp',
            'e.medidas', 'e.altura', 'e.peso',
            'c.nombre'
        ];
        $conditions = [];
        foreach ($words as $word) {
            $term = '%' . $word . '%';
            $fieldConds = [];
            foreach ($fields as $f) {
                $fieldConds[] = "LOWER($f) LIKE ?";
                $paramsBase[] = $term;
            }
            // Servicios
            $fieldConds[] = "EXISTS (
                SELECT 1 FROM escort_servicios es2 
                JOIN servicios s2 ON s2.id = es2.servicio_id 
                WHERE es2.escort_id = e.id AND LOWER(s2.nombre) LIKE ?
            )";
            $paramsBase[] = $term;
            // Idiomas (badges)
            $fieldConds[] = "EXISTS (
                SELECT 1 FROM escort_idiomas ei2
                JOIN idiomas i2 ON i2.id = ei2.idioma_id
                WHERE ei2.escort_id = e.id AND LOWER(i2.nombre) LIKE ?
            )";
            $paramsBase[] = $term;

            $conditions[] = '(' . implode(' OR ', $fieldConds) . ')';
        }
        if ($conditions) {
            $baseWhere .= ' AND ' . implode(' AND ', $conditions);
        }
    }

    if (isset($_GET['vip']) && $_GET['vip'] === '1') {
        $baseWhere .= " AND e.vip = 1";
    }

    if (isset($_GET['verificado']) && $_GET['verificado'] === '1') {
        $baseWhere .= " AND e.verificado = 1";
    }

    if (isset($_GET['disponible']) && $_GET['disponible'] === '1') {
        $baseWhere .= " AND e.disponible_ahora = 1";
    }

    $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM escorts e $joinCategorias $joinGira WHERE $baseWhere");
    $stmt->execute($paramsBase);
    $total = (int)$stmt->fetchColumn();

    // Mismos campos que listado.php (los que existen en la BD + likes subquery)
    $selectFields = "
        e.id, e.nombre, e.slug, e.edad,
        " . efectiva_ciudad() . " as ciudad, e.ciudad as ciudad_base,
        COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
        e.vip, e.verificado, e.destacado, e.sticky, e.estado,
        e.visitas_perfil, e.rating, e.total_valoraciones, e.created_at,
        (SELECT MIN(s2.fecha_aprobacion) FROM suscripciones s2 JOIN planes p2 ON p2.id = s2.plan_id WHERE s2.escort_id = e.id AND p2.tipo = 'base' AND s2.fecha_aprobacion IS NOT NULL) as fecha_aprobacion,
        COALESCE(sp.orden, 0) as sticky_orden, e.disponible_ahora, e.en_gira, gc.nombre AS gira_ciudad,
        e.gira_fecha_inicio, e.gira_fecha_fin,
        " . gira_activa() . " as gira_activa,
        c.nombre as categoria_nombre
    ";

    // Una escort es efefectivamente sticky en la ciudad destino solo si tiene posición sticky
    // asignada EN ESA CIUDAD (sp.orden > 0 con sp.ciudad_id = ciudadId).
    // NOTA: para escorts en gira, el sticky de su ciudad base NO debe excluirlos del random
    //       en la ciudad destino. Por eso NO usamos e.sticky global aquí.
    // Importante: usamos COALESCE para manejar LEFT JOIN sin sticky_posiciones (NULL → 0).
    // Sin COALESCE, "NOT (sp.ciudad_id = ? AND sp.orden > 0)" evalúa a NOT(NULL) = NULL (falso),
    // excluyendo TODOS los escorts no sticky del pool random.
    $stickySQL = "(COALESCE(sp.ciudad_id, 0) = {$ciudadId} AND COALESCE(sp.orden, 0) > 0)";

    // === Sort por nuevas (sección "Nuevas en {ciudad}"): aprobadas en los últimos 5 días ===
    // NOTA: escorts en gira a otra ciudad se incluyen siempre (no filtramos por fecha_aprobacion
    //       porque pueden haber sido aprobadas meses antes de hacerse cargo en gira).
    if ($sort === 'nuevas' || $sort === 'created_at') {
        $giraCond = gira_activa();
        $stmt = $pdo->prepare("
            SELECT $selectFields,
                   (SELECT COUNT(*) FROM favoritos f WHERE f.escort_id = e.id) as likes
            FROM escorts e
            $joinCategorias
            $joinGira
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
            WHERE $baseWhere
              AND ({$giraCond} OR (SELECT MIN(s2.fecha_aprobacion) FROM suscripciones s2 JOIN planes p2 ON p2.id = s2.plan_id WHERE s2.escort_id = e.id AND p2.tipo = 'base' AND s2.fecha_aprobacion IS NOT NULL) >= (CURDATE() - INTERVAL 5 DAY))
            ORDER BY e.sticky DESC, e.destacado DESC, fecha_aprobacion DESC, e.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute(array_merge([$ciudadId], $paramsBase, [$limit, $offset]));
        $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fallback: si no hay aprobaciones en los últimos 5 días, mostrar recién creadas
        if (empty($escorts)) {
            $stmt = $pdo->prepare("
                SELECT $selectFields,
                       (SELECT COUNT(*) FROM favoritos f WHERE f.escort_id = e.id) as likes
                FROM escorts e
                $joinCategorias
                $joinGira
                LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
                LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
                WHERE $baseWhere
                ORDER BY e.created_at DESC
                LIMIT ? OFFSET ?
            ");
            $stmt->execute(array_merge([$ciudadId], $paramsBase, [$limit, $offset]));
            $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
    } elseif ($sort === 'rating') {
        // === Sort por valoración (sección "Más valoradas") ===
        $stmt = $pdo->prepare("
            SELECT $selectFields,
                   (SELECT COUNT(*) FROM favoritos f WHERE f.escort_id = e.id) as likes
            FROM escorts e
            $joinCategorias
            $joinGira
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
            WHERE $baseWhere
            ORDER BY e.rating DESC, e.total_valoraciones DESC, sticky_orden ASC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute(array_merge([$ciudadId], $paramsBase, [$limit, $offset]));
        $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Listado principal (sin sort): los sticky SIEMPRE van primero, en orden de sp.orden
        if ($sort === '' && !isset($_GET['disponible'])) {
            $stmtFijos = $pdo->prepare("
                SELECT $selectFields,
                       (SELECT COUNT(*) FROM favoritos f WHERE f.escort_id = e.id) as likes
                FROM escorts e
                $joinCategorias
                $joinGira
                LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
                LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
                WHERE $baseWhere
                  AND {$stickySQL}
                ORDER BY sp.orden ASC
                LIMIT ? OFFSET ?
            ");
            $stmtFijos->execute(array_merge([$ciudadId], $paramsBase, [$limit, $offset]));
            $fijos = $stmtFijos->fetchAll(PDO::FETCH_ASSOC);

            // Random para llenar slots vacíos (excluir solo los que YA tienen posición sticky asignada)
            $slotsLibres = max(0, $limit - count($fijos));
            $stmtRand = $pdo->prepare("
                SELECT $selectFields,
                       (SELECT COUNT(*) FROM favoritos f WHERE f.escort_id = e.id) as likes
                FROM escorts e
                $joinCategorias
                $joinGira
                LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
                LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
                WHERE $baseWhere
                  AND NOT {$stickySQL}
                ORDER BY RAND()
                LIMIT ?
            ");
            $stmtRand->execute(array_merge([$ciudadId], $paramsBase, [$slotsLibres]));
            $escorts = array_merge($fijos, $stmtRand->fetchAll(PDO::FETCH_ASSOC));
        } else {
            // Fijos en el rango de esta página
            $stmtFijos = $pdo->prepare("
                SELECT $selectFields,
                       (SELECT COUNT(*) FROM favoritos f WHERE f.escort_id = e.id) as likes
                FROM escorts e
                $joinCategorias
                $joinGira
                LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
                LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
                WHERE $baseWhere
                  AND {$stickySQL}
                  AND COALESCE(sp.orden, 0) BETWEEN ? AND ?
                ORDER BY sp.orden ASC
            ");
            $stmtFijos->execute(array_merge([$ciudadId], $paramsBase, [$offset + 1, $offset + $limit]));
            $mapFijos = [];
            foreach ($stmtFijos->fetchAll(PDO::FETCH_ASSOC) as $f) {
                $mapFijos[(int)$f['sticky_orden']] = $f;
            }

            // Random para llenar slots vacíos
            $slotsLibres = max(0, $limit - count($mapFijos));
            $stmtRand = $pdo->prepare("
                SELECT $selectFields,
                       (SELECT COUNT(*) FROM favoritos f WHERE f.escort_id = e.id) as likes
                FROM escorts e
                $joinCategorias
                $joinGira
                LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
                LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
                WHERE $baseWhere
                  AND NOT {$stickySQL}
            ");
            $stmtRand->execute(array_merge([$ciudadId], $paramsBase));
            $todosRandom = $stmtRand->fetchAll(PDO::FETCH_ASSOC);
            shuffle($todosRandom);
            $randomItems = array_slice($todosRandom, 0, $slotsLibres);

            // Merge posición por posición
            $escorts = [];
            $randomIdx = 0;
            $inicio = $offset + 1;
            $fin = $offset + $limit;
            for ($pos = $inicio; $pos <= $fin; $pos++) {
                if (isset($mapFijos[$pos])) {
                    $escorts[] = $mapFijos[$pos];
                } elseif ($randomIdx < count($randomItems)) {
                    $escorts[] = $randomItems[$randomIdx];
                    $randomIdx++;
                }
            }
        }
    }

    // Cargar servicios para cada escort (igual que listado.php)
    foreach ($escorts as &$escort) {
        $servStmt = $pdo->prepare("
            SELECT s.nombre, s.icono 
            FROM escort_servicios es
            JOIN servicios s ON es.servicio_id = s.id
            WHERE es.escort_id = ? AND s.activo = 1
            LIMIT 4
        ");
        $servStmt->execute([$escort['id']]);
        $escort['servicios'] = $servStmt->fetchAll();
    }

    echo json_encode([
        'success' => true,
        'ciudad' => $ciudad,
        'total' => $total,
        'data' => $escorts,
        'page' => $page,
        'has_more' => ($offset + $limit) < $total
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    error_log("Error por-ciudad.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}