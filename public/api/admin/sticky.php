<?php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';
    $tokenData = requireAdminAuth();
    $adminId = intval($tokenData['id'] ?? 0);
    if ($adminId <= 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $search = $_GET['q'] ?? '';
        $ciudadId = isset($_GET['ciudad_id']) ? intval($_GET['ciudad_id']) : 0;
        $params = [];

        // Limpieza automática: borrar posiciones sticky de escorts que ya no son sticky
        // (eliminadas, o sin sticky vigente ni sticky extra activo). Evita que queden
        // fijas en el frontend ni aparezcan como "con posición" en la grilla.
        try {
            $pdo->prepare("DELETE sp FROM sticky_posiciones sp
                LEFT JOIN escorts e ON e.id = sp.escort_id
                WHERE e.id IS NULL OR e.eliminada = 1
                   OR NOT (e.sticky = 1 AND (e.sticky_expira IS NULL OR e.sticky_expira >= CURDATE())
                            OR EXISTS (SELECT 1 FROM suscripciones se JOIN planes pe ON pe.id = se.plan_id AND pe.extra_tipo = 'sticky'
                                       WHERE se.escort_id = e.id AND se.estado = 'activa' AND se.fecha_fin >= CURDATE()))")->execute();
        } catch (Throwable $ce) {
            error_log("Error sticky.php cleanup: " . $ce->getMessage());
        }

        $sql = "
            SELECT
                e.id,
                e.nombre,
                e.email,
                e.telefono,
                COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
                e.ciudad,
                e.ciudad as ciudad_base,
                e.en_gira,
                gc.nombre as gira_ciudad,
                e.sticky,
                e.sticky_expira,
                e.activa,
                e.eliminada,
                CAST(MAX(CASE WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 1 ELSE 0 END) AS UNSIGNED) as tiene_suscripcion_activa,
                CAST(MAX(CASE WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() AND s.fecha_aprobacion IS NOT NULL AND p.extra_tipo = 'sticky' THEN 1 ELSE 0 END) AS UNSIGNED) as tiene_sticky_extra,
                COALESCE(sp.orden, 0) as sticky_orden,
                sp.ciudad_id as sticky_ciudad_id
            FROM escorts e
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
            LEFT JOIN suscripciones s ON s.escort_id = e.id AND s.estado = 'activa' AND s.fecha_fin >= CURDATE()
            LEFT JOIN planes p ON p.id = s.plan_id
            LEFT JOIN sticky_posiciones sp ON sp.escort_id = e.id AND sp.ciudad_id = ?
            WHERE e.eliminada = 0
                " . ($ciudadId > 0
                    ? "AND (e.ciudad = (SELECT nombre FROM ciudades WHERE id = ? LIMIT 1)
                          OR (e.en_gira = 1 AND (e.gira_fecha_inicio IS NULL OR e.gira_fecha_inicio <= CURDATE())
                              AND (e.gira_fecha_fin IS NULL OR e.gira_fecha_fin >= CURDATE())
                              AND e.gira_ciudad_id = ?))"
                    : "") . "
                " . ($search !== '' ? "AND (e.id LIKE ? OR e.nombre LIKE ? OR e.email LIKE ? OR e.telefono LIKE ? OR e.ciudad LIKE ?)" : "") . "
            GROUP BY e.id
            ORDER BY e.sticky DESC, sticky_orden ASC, e.nombre ASC
        ";

        // Parámetro 1: el JOIN sticky_posiciones.sp.ciudad_id (siempre se pasa)
        $params[] = $ciudadId > 0 ? $ciudadId : 0;

        // Parámetro 2 (solo si hay ciudadId > 0): el WHERE e.ciudad = (SELECT... WHERE id = ?)
        if ($ciudadId > 0) {
            $params[] = $ciudadId;
            // Parámetro 3: e.gira_ciudad_id = ?
            $params[] = $ciudadId;
        }

        // Parámetros del search (5 placeholders)
        if ($search !== '') {
            $escapedSearch = str_replace(['%', '_'], ['\\%', '\\_'], $search);
            $s = "%{$escapedSearch}%";
            foreach (range(1, 5) as $i) {
                $params[] = $s;
            }
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $escorts = $stmt->fetchAll();

        foreach ($escorts as &$e) {
            $e['sticky'] = (bool)$e['sticky'];
            $e['sticky_orden'] = (int)$e['sticky_orden'];
            $e['sticky_ciudad_id'] = $e['sticky_ciudad_id'] ? (int)$e['sticky_ciudad_id'] : null;
            $e['activa'] = (bool)$e['activa'];
            $e['eliminada'] = (bool)$e['eliminada'];
            $e['tiene_suscripcion_activa'] = (bool)$e['tiene_suscripcion_activa'];
            $e['tiene_sticky_extra'] = (bool)$e['tiene_sticky_extra'];
        }

        echo json_encode(['success' => true, 'data' => $escorts, 'ciudad_id' => $ciudadId]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';

        // Helper: Obtener orden actual de una escort en una ciudad
        $getOrden = function($pdo, $id, $ciudadId) {
            $s = $pdo->prepare("SELECT orden FROM sticky_posiciones WHERE escort_id = ? AND ciudad_id = ?");
            $s->execute([$id, $ciudadId]);
            $row = $s->fetchColumn();
            return $row !== false ? (int)$row : 0;
        };

        // Helper: Asignar orden a una escort (crea entrada si no existe, solo si orden > 0)
        $setOrden = function($pdo, $id, $ciudadId, $orden) use ($getOrden) {
            if ($orden <= 0) return;
            $current = $getOrden($pdo, $id, $ciudadId);
            if ($current > 0) {
                $pdo->prepare("UPDATE sticky_posiciones SET orden = ? WHERE escort_id = ? AND ciudad_id = ?")->execute([$orden, $id, $ciudadId]);
            } else {
                $pdo->prepare("INSERT INTO sticky_posiciones (escort_id, ciudad_id, orden) VALUES (?, ?, ?)")->execute([$id, $ciudadId, $orden]);
            }
        };

        // Swap entre dos escorts en la misma ciudad
        if ($action === 'swap') {
            $id1 = intval($input['id'] ?? 0);
            $id2 = intval($input['target_id'] ?? 0);
            $ciudadId = intval($input['ciudad_id'] ?? 0);
            if (!$id1 || !$id2 || !$ciudadId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'IDs inválidos']);
                exit;
            }

            // Obtener órdenes actuales
            $o1 = $getOrden($pdo, $id1, $ciudadId);
            $o2 = $getOrden($pdo, $id2, $ciudadId);

            // El swap solo funciona si AMBOS tienen posición válida (> 0)
            if ($o1 === 0 || $o2 === 0) {
                echo json_encode(['success' => false, 'error' => 'Una o ambas escorts no tienen posición sticky asignada']);
                exit;
            }

            $pdo->beginTransaction();
            try {
                // Intercambiar posiciones sin violar unique_posicion (ciudad_id, orden)
                // Paso 1: mover id1 a un orden temporal libre
                $tempOrden = max($o1, $o2) + 1;
                while (true) {
                    $stmtOcup = $pdo->prepare("SELECT COUNT(*) FROM sticky_posiciones WHERE ciudad_id = ? AND orden = ? AND escort_id != ?");
                    $stmtOcup->execute([$ciudadId, $tempOrden, $id1]);
                    if ((int)$stmtOcup->fetchColumn() === 0) break;
                    $tempOrden++;
                }
                $pdo->prepare("UPDATE sticky_posiciones SET orden = ? WHERE escort_id = ? AND ciudad_id = ?")
                    ->execute([$tempOrden, $id1, $ciudadId]);
                // Paso 2: mover id2 al orden que tenía id1 (ya liberado)
                $pdo->prepare("UPDATE sticky_posiciones SET orden = ? WHERE escort_id = ? AND ciudad_id = ?")
                    ->execute([$o1, $id2, $ciudadId]);
                // Paso 3: mover id1 al orden que tenía id2 (ya liberado)
                $pdo->prepare("UPDATE sticky_posiciones SET orden = ? WHERE escort_id = ? AND ciudad_id = ?")
                    ->execute([$o2, $id1, $ciudadId]);

                $pdo->commit();
                echo json_encode(['success' => true]);
                exit;
            } catch (Throwable $e) {
                $pdo->rollBack();
                error_log("Error admin/sticky.php swap: " . $e->getMessage());
                http_response_code(500);
                // Log detallado a archivo
                $logMsg = date('Y-m-d H:i:s') . " - Swap error: " . $e->getMessage() . "\n";
                $logMsg .= "  id1=$id1, id2=$id2, ciudadId=$ciudadId\n";
                $logMsg .= "  o1=$o1, o2=$o2\n";
                $logMsg .= "  Trace: " . $e->getTraceAsString() . "\n";
                file_put_contents(__DIR__ . '/swap_error.log', $logMsg, FILE_APPEND | LOCK_EX);
                echo json_encode(['success' => false, 'error' => 'Error interno en el swap: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine()]);
                exit;
            }
        }

        // Reordenar toda la lista sticky de una ciudad de forma consecutiva
        if ($action === 'reordenar') {
            $ciudadId = intval($input['ciudad_id'] ?? 0);
            $ids = array_values(array_unique(array_map('intval', $input['ids'] ?? [])));
            if (!$ciudadId || empty($ids)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']);
                exit;
            }

            $pdo->beginTransaction();
            try {
                // Borrar TODAS las posiciones de la ciudad y re-insertarlas con órdenes
                // consecutivos (1..N). No se usa upsert porque el ON DUPLICATE KEY choca
                // con las keys únicas (ciudad_id,orden) / (escort_id,ciudad_id) y el
                // orden arrastrado no queda guardado.
                $pdo->prepare("DELETE FROM sticky_posiciones WHERE ciudad_id = ?")->execute([$ciudadId]);

                $insert = $pdo->prepare("
                    INSERT INTO sticky_posiciones (escort_id, ciudad_id, orden)
                    VALUES (?, ?, ?)
                ");
                $orden = 1;
                foreach ($ids as $escortId) {
                    $insert->execute([$escortId, $ciudadId, $orden]);
                    $orden++;
                }

                $pdo->commit();
                echo json_encode(['success' => true]);
                exit;
            } catch (Throwable $e) {
                $pdo->rollBack();
                error_log("Error admin/sticky.php reordenar: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Error interno al reordenar']);
                exit;
            }
        }

        // Asignar/quitar posición para una escort en una ciudad
        if ($action === 'set_orden') {
            $id = intval($input['id'] ?? 0);
            $ciudadId = intval($input['ciudad_id'] ?? 0);
            $orden = intval($input['orden'] ?? 0);
            if (!$id || !$ciudadId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']);
                exit;
            }

            if ($orden > 0) {
                // Verificar que la posición no esté ocupada por otra escort en esa ciudad
                $stmtOcup = $pdo->prepare("SELECT e.nombre FROM sticky_posiciones sp JOIN escorts e ON e.id = sp.escort_id WHERE sp.ciudad_id = ? AND sp.orden = ? AND sp.escort_id != ? LIMIT 1");
                $stmtOcup->execute([$ciudadId, $orden, $id]);
                $rowOcup = $stmtOcup->fetch(PDO::FETCH_ASSOC);
                if ($rowOcup) {
                    http_response_code(409);
                    echo json_encode([
                        'success' => false,
                        'error' => 'posicion_ocupada',
                        'ocupante' => ['nombre' => $rowOcup['nombre']],
                    ]);
                    exit;
                }

                // Reemplazo en transacción: borrar la fila previa del escort en la ciudad
                // y volver a insertarla. Evita el choque con unique_posicion (ciudad_id, orden)
                // que rompía el ON DUPLICATE KEY.
                $pdo->beginTransaction();
                try {
                    $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ? AND ciudad_id = ?")->execute([$id, $ciudadId]);
                    $pdo->prepare("INSERT INTO sticky_posiciones (escort_id, ciudad_id, orden) VALUES (?, ?, ?)")->execute([$id, $ciudadId, $orden]);
                    $pdo->commit();
                } catch (Throwable $e) {
                    $pdo->rollBack();
                    error_log("Error admin/sticky.php set_orden: " . $e->getMessage());
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Error interno al asignar posición']);
                    exit;
                }
            } else {
                // Quitar posición (orden = 0)
                $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ? AND ciudad_id = ?")->execute([$id, $ciudadId]);
            }

            echo json_encode(['success' => true]);
            exit;
        }

        // Saque el estado de sticky de una escort en una ciudad (NO disponible en admin, se gestiona desde extras/plan)
        if ($action === 'remove_sticky') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'La eliminación de sticky se gestiona desde Solicitudes Extras / Plan']);
            exit;
        }
        echo json_encode(['success' => false, 'error' => 'Acción no válida']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error admin/sticky.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}