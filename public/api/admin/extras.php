<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Listar extras (desde planes tipo='extra') ===
    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $estado = isset($_GET['estado']) ? $_GET['estado'] : 'todos';
        $tipoFiltro = isset($_GET['tipo']) ? $_GET['tipo'] : 'todos';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        $stats = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM planes WHERE tipo = 'extra'")->fetchColumn(),
            'activos' => (int)$pdo->query("SELECT COUNT(*) FROM planes WHERE tipo = 'extra' AND activo = 1")->fetchColumn(),
            'inactivos' => (int)$pdo->query("SELECT COUNT(*) FROM planes WHERE tipo = 'extra' AND activo = 0")->fetchColumn(),
        ];

        $where = ["p.tipo = 'extra'"];
        $params = [];

        if ($estado === 'activos') $where[] = 'p.activo = 1';
        elseif ($estado === 'inactivos') $where[] = 'p.activo = 0';

        if ($tipoFiltro !== 'todos') {
            $where[] = 'p.extra_tipo = :extra_tipo';
            $params[':extra_tipo'] = $tipoFiltro;
        }

        if ($search !== '') {
            $where[] = '(p.nombre LIKE :search1 OR p.slug LIKE :search2 OR p.descripcion LIKE :search3)';
            $params[':search1'] = '%' . $search . '%';
            $params[':search2'] = '%' . $search . '%';
            $params[':search3'] = '%' . $search . '%';
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) FROM planes p $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        $sql = "
            SELECT 
                p.*,
                (SELECT COUNT(*) FROM suscripciones s WHERE s.plan_id = p.id AND s.estado = 'activa') as total_contrataciones,
                (SELECT COUNT(DISTINCT escort_id) FROM suscripciones WHERE plan_id = p.id) AS total_escorts
            FROM planes p
            $whereClause
            ORDER BY p.extra_tipo ASC, p.orden ASC, p.id ASC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $extras = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'extras' => $extras,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltered,
                'pages' => ceil($totalFiltered / $limit),
                'hasMore' => ($page * $limit) < $totalFiltered
            ]
        ]);
        exit;
    }

    // === POST - Crear extra (insertar en planes) ===
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        $slug = isset($input['slug']) ? trim($input['slug']) : '';
        $descripcion = isset($input['descripcion']) ? trim($input['descripcion']) : '';
        $extra_tipo = isset($input['tipo']) && in_array($input['tipo'], ['destacado', 'sticky', 'otro']) ? $input['tipo'] : 'otro';
        $duracion_dias = isset($input['duracion_dias']) ? intval($input['duracion_dias']) : 7;
        $precio = isset($input['precio']) ? floatval($input['precio']) : 0;
        $moneda = isset($input['moneda']) ? trim($input['moneda']) : 'CLP';
        $color_badge = isset($input['color_badge']) ? trim($input['color_badge']) : '#6b7280';
        $orden = isset($input['orden']) ? intval($input['orden']) : 0;
        $activo = isset($input['activo']) ? (int)$input['activo'] : 1;

        $fieldErrors = [];

        if (empty($nombre)) {
            $fieldErrors['nombre'] = 'El nombre es obligatorio';
        } elseif (strlen($nombre) < 2) {
            $fieldErrors['nombre'] = 'Mínimo 2 caracteres';
        } elseif (strlen($nombre) > 100) {
            $fieldErrors['nombre'] = 'Máximo 100 caracteres';
        }

        if (empty($slug)) {
            $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $nombre), '-'));
        }
        $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9-]+/', '-', $slug), '-'));

        if (empty($slug)) {
            $fieldErrors['slug'] = 'El slug es obligatorio';
        } elseif (strlen($slug) > 100) {
            $fieldErrors['slug'] = 'Máximo 100 caracteres';
        }

        if (empty($fieldErrors['nombre'])) {
            $checkStmt = $pdo->prepare("SELECT id FROM planes WHERE LOWER(nombre) = LOWER(?) AND tipo = 'extra'");
            $checkStmt->execute([$nombre]);
            if ($checkStmt->fetch()) {
                $fieldErrors['nombre'] = 'Ya existe un extra con ese nombre';
            }
        }

        if (empty($fieldErrors['slug'])) {
            $checkSlugStmt = $pdo->prepare("SELECT id FROM planes WHERE slug = ? AND tipo = 'extra'");
            $checkSlugStmt->execute([$slug]);
            if ($checkSlugStmt->fetch()) {
                $fieldErrors['slug'] = 'Slug ya existe';
            }
        }

        if ($duracion_dias <= 0) {
            $fieldErrors['duracion_dias'] = 'Debe ser mayor a 0';
        }

        if ($precio < 0) {
            $fieldErrors['precio'] = 'No puede ser negativo';
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors, 'error' => 'Corrige los errores']);
            exit;
        }

        $stmt = $pdo->prepare("
            INSERT INTO planes (nombre, slug, descripcion, tipo, extra_tipo, duracion_dias, precio, moneda, color_badge, orden, activo, creado_en, actualizado_en)
            VALUES (?, ?, ?, 'extra', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([$nombre, $slug, $descripcion, $extra_tipo, $duracion_dias, $precio, $moneda, $color_badge, $orden, $activo]);
        $newId = $pdo->lastInsertId();

        // Log auditoría
        $log = $pdo->prepare("
            INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
            VALUES (?, 'crear_extra', 'planes', ?, ?, ?)
        ");
        $log->execute([
            $tokenData['id'],
            $newId,
            json_encode($input),
            $_SERVER['REMOTE_ADDR'] ?? null
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Extra creado correctamente',
            'extra' => [
                'id' => (int)$newId,
                'nombre' => $nombre,
                'slug' => $slug,
                'descripcion' => $descripcion,
                'tipo' => $extra_tipo,
                'duracion_dias' => $duracion_dias,
                'precio' => $precio,
                'moneda' => $moneda,
                'color_badge' => $color_badge,
                'orden' => $orden,
                'activo' => $activo,
                'total_contrataciones' => 0
            ]
        ]);
        exit;
    }

    // === PUT - Actualizar extra ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no válido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT id FROM planes WHERE id = ? AND tipo = 'extra'");
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Extra no encontrado']);
            exit;
        }

        $updates = ['actualizado_en = NOW()'];
        $values = [];
        $fieldErrors = [];

        if (isset($input['nombre'])) {
            $nombre = trim($input['nombre']);
            if (empty($nombre)) {
                $fieldErrors['nombre'] = 'El nombre no puede estar vacío';
            } elseif (strlen($nombre) < 2) {
                $fieldErrors['nombre'] = 'Mínimo 2 caracteres';
            } elseif (strlen($nombre) > 100) {
                $fieldErrors['nombre'] = 'Máximo 100 caracteres';
            } else {
                $dupStmt = $pdo->prepare("SELECT id FROM planes WHERE LOWER(nombre) = LOWER(?) AND id != ? AND tipo = 'extra'");
                $dupStmt->execute([$nombre, $id]);
                if ($dupStmt->fetch()) {
                    $fieldErrors['nombre'] = 'Nombre duplicado';
                } else {
                    $updates[] = 'nombre = ?';
                    $values[] = $nombre;
                }
            }
        }

        if (isset($input['slug'])) {
            $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9-]+/', '-', trim($input['slug'])), '-'));
            if (empty($slug)) {
                $fieldErrors['slug'] = 'Slug vacío';
            } elseif (strlen($slug) > 100) {
                $fieldErrors['slug'] = 'Máximo 100 caracteres';
            } else {
                $dupSlugStmt = $pdo->prepare("SELECT id FROM planes WHERE slug = ? AND id != ? AND tipo = 'extra'");
                $dupSlugStmt->execute([$slug, $id]);
                if ($dupSlugStmt->fetch()) {
                    $fieldErrors['slug'] = 'Slug duplicado';
                } else {
                    $updates[] = 'slug = ?';
                    $values[] = $slug;
                }
            }
        }

        if (isset($input['descripcion'])) {
            $updates[] = 'descripcion = ?';
            $values[] = trim($input['descripcion']);
        }

        if (isset($input['tipo']) && in_array($input['tipo'], ['destacado', 'sticky', 'otro'])) {
            $updates[] = 'extra_tipo = ?';
            $values[] = $input['tipo'];
        }

        if (isset($input['duracion_dias'])) {
            $val = intval($input['duracion_dias']);
            if ($val <= 0) {
                $fieldErrors['duracion_dias'] = 'Debe ser mayor a 0';
            } else {
                $updates[] = 'duracion_dias = ?';
                $values[] = $val;
            }
        }

        if (isset($input['precio'])) {
            $precio = floatval($input['precio']);
            if ($precio < 0) {
                $fieldErrors['precio'] = 'No puede ser negativo';
            } else {
                $updates[] = 'precio = ?';
                $values[] = $precio;
            }
        }

        if (isset($input['moneda'])) {
            $updates[] = 'moneda = ?';
            $values[] = trim($input['moneda']);
        }

        if (isset($input['color_badge'])) {
            $updates[] = 'color_badge = ?';
            $values[] = trim($input['color_badge']);
        }

        if (isset($input['orden'])) {
            $updates[] = 'orden = ?';
            $values[] = intval($input['orden']);
        }

        if (isset($input['activo'])) {
            $updates[] = 'activo = ?';
            $values[] = (int)$input['activo'];
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors, 'error' => 'Corrige los errores']);
            exit;
        }

        if (count($updates) <= 1) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Sin datos para actualizar']);
            exit;
        }

        $values[] = $id;
        $sql = "UPDATE planes SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        // Log auditoría
        $log = $pdo->prepare("
            INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
            VALUES (?, 'actualizar_extra', 'planes', ?, ?, ?)
        ");
        $log->execute([
            $tokenData['id'],
            $id,
            json_encode($input),
            $_SERVER['REMOTE_ADDR'] ?? null
        ]);

        $getStmt = $pdo->prepare("
            SELECT p.*, 
                (SELECT COUNT(*) FROM suscripciones s WHERE s.plan_id = p.id AND s.estado = 'activa') as total_contrataciones,
                (SELECT COUNT(DISTINCT escort_id) FROM suscripciones WHERE plan_id = p.id) AS total_escorts
            FROM planes p WHERE p.id = ?
        ");
        $getStmt->execute([$id]);
        $extra = $getStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'message' => 'Extra actualizado', 'extra' => $extra]);
        exit;
    }

    // === DELETE - Eliminar extra ===
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no válido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT nombre FROM planes WHERE id = ? AND tipo = 'extra'");
        $checkStmt->execute([$id]);
        $extra = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$extra) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Extra no encontrado']);
            exit;
        }

        $contratacionesStmt = $pdo->prepare("SELECT COUNT(*) FROM suscripciones WHERE plan_id = ? AND estado = 'activa'");
        $contratacionesStmt->execute([$id]);
        $contrataciones = (int)$contratacionesStmt->fetchColumn();

        if ($contrataciones > 0) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => "Tiene $contrataciones contratación(es) activa(s)"]);
            exit;
        }

        // Log auditoría
        $log = $pdo->prepare("
            INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address)
            VALUES (?, 'eliminar_extra', 'planes', ?, ?, ?)
        ");
        $log->execute([
            $tokenData['id'],
            $id,
            json_encode($extra),
            $_SERVER['REMOTE_ADDR'] ?? null
        ]);

        $stmt = $pdo->prepare("DELETE FROM planes WHERE id = ? AND tipo = 'extra'");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Extra eliminado']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error extras.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error extras.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno: ' . $e->getMessage()]);
}
