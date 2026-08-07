<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Listar planes ===
    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $estado = isset($_GET['estado']) ? $_GET['estado'] : 'todos';
        $tipo = isset($_GET['tipo']) ? $_GET['tipo'] : 'todos';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        $stats = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM planes")->fetchColumn(),
            'activos' => (int)$pdo->query("SELECT COUNT(*) FROM planes WHERE activo = 1")->fetchColumn(),
            'inactivos' => (int)$pdo->query("SELECT COUNT(*) FROM planes WHERE activo = 0")->fetchColumn(),
            'bases' => (int)$pdo->query("SELECT COUNT(*) FROM planes WHERE tipo = 'base' AND activo = 1")->fetchColumn(),
            'extras' => (int)$pdo->query("SELECT COUNT(*) FROM planes WHERE tipo = 'extra' AND activo = 1")->fetchColumn(),
        ];

        $where = [];
        $params = [];

        if ($estado === 'activos') {
            $where[] = 'activo = 1';
        } elseif ($estado === 'inactivos') {
            $where[] = 'activo = 0';
        }

        if ($tipo !== 'todos') {
            $where[] = 'tipo = :tipo';
            $params[':tipo'] = $tipo;
        }

        if ($search !== '') {
            $where[] = '(nombre LIKE :search1 OR slug LIKE :search2 OR descripcion LIKE :search3 OR badge LIKE :search4)';
            $params[':search1'] = '%' . $search . '%';
            $params[':search2'] = '%' . $search . '%';
            $params[':search3'] = '%' . $search . '%';
            $params[':search4'] = '%' . $search . '%';
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $countSql = "SELECT COUNT(*) FROM planes $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        $sql = "
            SELECT 
                p.id,
                p.nombre,
                p.slug,
                p.descripcion,
                p.tipo,
                p.duracion_dias,
                p.precio,
                p.moneda,
                p.max_fotos,
                p.max_videos,
                p.max_pausas_permitidas,
                p.permite_vip,
                p.permite_destacado,
                p.uso_unico,
                p.badge,
                p.color_badge,
                p.orden,
                p.activo,
                p.creado_en,
                p.actualizado_en,
                (SELECT COUNT(*) FROM suscripciones WHERE plan_id = p.id AND estado = 'activa') as total_suscripciones,
                (SELECT COUNT(DISTINCT escort_id) FROM suscripciones WHERE plan_id = p.id) AS total_escorts
            FROM planes p
            $whereClause
            ORDER BY p.tipo ASC, p.orden ASC, p.id ASC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $planes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'planes' => $planes,
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

    // === POST - Crear plan ===
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        $slug = isset($input['slug']) ? trim($input['slug']) : '';
        $descripcion = isset($input['descripcion']) ? trim($input['descripcion']) : '';
        $tipo = isset($input['tipo']) && in_array($input['tipo'], ['base', 'extra']) ? $input['tipo'] : 'base';
        $duracion_dias = isset($input['duracion_dias']) ? intval($input['duracion_dias']) : 30;
        $precio = isset($input['precio']) ? floatval($input['precio']) : 0;
        $moneda = isset($input['moneda']) ? trim($input['moneda']) : 'CLP';
        $max_fotos = isset($input['max_fotos']) ? intval($input['max_fotos']) : 5;
        $max_videos = isset($input['max_videos']) ? intval($input['max_videos']) : 0;
        $max_pausas_permitidas = isset($input['max_pausas_permitidas']) ? intval($input['max_pausas_permitidas']) : 3;
        $permite_vip = isset($input['permite_vip']) ? (int)$input['permite_vip'] : 0;
        $permite_destacado = isset($input['permite_destacado']) ? (int)$input['permite_destacado'] : 0;
        $uso_unico = isset($input['uso_unico']) ? (int)$input['uso_unico'] : 0;
        $badge = isset($input['badge']) ? trim($input['badge']) : '';
        $color_badge = isset($input['color_badge']) ? trim($input['color_badge']) : '#6b7280';
        $orden = isset($input['orden']) ? intval($input['orden']) : 0;
        $activo = isset($input['activo']) ? (int)$input['activo'] : 1;

        $fieldErrors = [];

        if (empty($nombre)) {
            $fieldErrors['nombre'] = 'El nombre es obligatorio';
        } elseif (strlen($nombre) < 2) {
            $fieldErrors['nombre'] = 'MíƒÂ­nimo 2 caracteres';
        } elseif (strlen($nombre) > 100) {
            $fieldErrors['nombre'] = 'MíƒÂ¡ximo 100 caracteres';
        }

        if (empty($slug)) {
            $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $nombre), '-'));
        }
        $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9-]+/', '-', $slug), '-'));

        if (empty($slug)) {
            $fieldErrors['slug'] = 'El slug es obligatorio';
        } elseif (strlen($slug) > 100) {
            $fieldErrors['slug'] = 'MíƒÂ¡ximo 100 caracteres';
        }

        if (empty($fieldErrors['nombre'])) {
            $checkStmt = $pdo->prepare("SELECT id, nombre FROM planes WHERE LOWER(nombre) = LOWER(?)");
            $checkStmt->execute([$nombre]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $fieldErrors['nombre'] = 'Ya existe un plan llamado "' . $existing['nombre'] . '"';
            }
        }

        if (empty($fieldErrors['slug'])) {
            $checkSlugStmt = $pdo->prepare("SELECT id FROM planes WHERE slug = ?");
            $checkSlugStmt->execute([$slug]);
            if ($checkSlugStmt->fetch()) {
                $fieldErrors['slug'] = 'Slug ya existe';
            }
        }

        if ($duracion_dias < 0) {
            $fieldErrors['duracion_dias'] = 'No puede ser negativo (0 = permanente)';
        }

        if ($precio < 0) {
            $fieldErrors['precio'] = 'No puede ser negativo';
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'fieldErrors' => $fieldErrors,
                'error' => 'Corrige los errores'
            ]);
            exit;
        }

        $stmt = $pdo->prepare("
            INSERT INTO planes 
            (nombre, slug, descripcion, tipo, duracion_dias, precio, moneda, 
             max_fotos, max_videos, max_pausas_permitidas,
             permite_vip, permite_destacado, 
             uso_unico, badge, color_badge, orden, activo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $nombre,
            $slug,
            $descripcion,
            $tipo,
            $duracion_dias,
            $precio,
            $moneda,
            $max_fotos,
            $max_videos,
            $max_pausas_permitidas,
            $permite_vip,
            $permite_destacado,
            $uso_unico,
            $badge,
            $color_badge,
            $orden,
            $activo
        ]);
        $newId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => 'Plan creado correctamente',
            'plan' => [
                'id' => (int)$newId,
                'nombre' => $nombre,
                'slug' => $slug,
                'descripcion' => $descripcion,
                'tipo' => $tipo,
                'duracion_dias' => $duracion_dias,
                'precio' => $precio,
                'moneda' => $moneda,
                'max_fotos' => $max_fotos,
                'max_videos' => $max_videos,
                'max_pausas_permitidas' => $max_pausas_permitidas,
                'permite_vip' => $permite_vip,
                'permite_destacado' => $permite_destacado,
                'uso_unico' => $uso_unico,
                'badge' => $badge,
                'color_badge' => $color_badge,
                'orden' => $orden,
                'activo' => $activo,
                'total_suscripciones' => 0
            ]
        ]);
        exit;
    }

    // === PUT - Actualizar plan ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no víƒÂ¡lido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT id FROM planes WHERE id = ?");
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Plan no encontrado']);
            exit;
        }

        $updates = [];
        $values = [];
        $fieldErrors = [];

        if (isset($input['nombre'])) {
            $nombre = trim($input['nombre']);
            if (empty($nombre)) {
                $fieldErrors['nombre'] = 'El nombre no puede estar vacíƒÂ­o';
            } elseif (strlen($nombre) < 2) {
                $fieldErrors['nombre'] = 'MíƒÂ­nimo 2 caracteres';
            } elseif (strlen($nombre) > 100) {
                $fieldErrors['nombre'] = 'MíƒÂ¡ximo 100 caracteres';
            } else {
                $dupStmt = $pdo->prepare("SELECT id FROM planes WHERE LOWER(nombre) = LOWER(?) AND id != ?");
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
                $fieldErrors['slug'] = 'Slug vacíƒÂ­o';
            } elseif (strlen($slug) > 100) {
                $fieldErrors['slug'] = 'MíƒÂ¡ximo 100 caracteres';
            } else {
                $dupSlugStmt = $pdo->prepare("SELECT id FROM planes WHERE slug = ? AND id != ?");
                $dupSlugStmt->execute([$slug, $id]);
                if ($dupSlugStmt->fetch()) {
                    $fieldErrors['slug'] = 'Slug duplicado';
                } else {
                    $updates[] = 'slug = ?';
                    $values[] = $slug;
                }
            }
        }

        $stringFields = ['descripcion', 'moneda', 'badge', 'color_badge'];
        foreach ($stringFields as $field) {
            if (isset($input[$field])) {
                $updates[] = "$field = ?";
                $values[] = trim($input[$field]);
            }
        }

        if (isset($input['tipo']) && in_array($input['tipo'], ['base', 'extra'])) {
            $updates[] = 'tipo = ?';
            $values[] = $input['tipo'];
        }

        $intFields = ['duracion_dias', 'max_fotos', 'max_videos', 'orden', 'max_pausas_permitidas'];
        foreach ($intFields as $field) {
            if (isset($input[$field])) {
                $val = intval($input[$field]);
                if ($field === 'duracion_dias' && $val < 0) {
                    $fieldErrors[$field] = 'No puede ser negativo';
                } else {
                    $updates[] = "$field = ?";
                    $values[] = $val;
                }
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

        $boolFields = ['permite_vip', 'permite_destacado', 'uso_unico', 'activo'];
        foreach ($boolFields as $field) {
            if (isset($input[$field])) {
                $updates[] = "$field = ?";
                $values[] = (int)$input[$field];
            }
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'fieldErrors' => $fieldErrors,
                'error' => 'Corrige los errores'
            ]);
            exit;
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Sin datos para actualizar']);
            exit;
        }

        $values[] = $id;
        $sql = "UPDATE planes SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        $getStmt = $pdo->prepare("
            SELECT p.*, 
                (SELECT COUNT(*) FROM suscripciones WHERE plan_id = p.id AND estado = 'activa') as total_suscripciones,
                (SELECT COUNT(DISTINCT escort_id) FROM suscripciones WHERE plan_id = p.id) AS total_escorts
            FROM planes p WHERE p.id = ?
        ");
        $getStmt->execute([$id]);
        $plan = $getStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'message' => 'Plan actualizado',
            'plan' => $plan
        ]);
        exit;
    }

    // === DELETE - Eliminar plan ===
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no víƒÂ¡lido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT nombre FROM planes WHERE id = ?");
        $checkStmt->execute([$id]);
        $plan = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$plan) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Plan no encontrado']);
            exit;
        }

        $susStmt = $pdo->prepare("SELECT COUNT(*) FROM suscripciones WHERE plan_id = ? AND estado = 'activa'");
        $susStmt->execute([$id]);
        $susCount = (int)$susStmt->fetchColumn();

        if ($susCount > 0) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => ($susCount === 1 ? "Tiene $susCount suscripciíƒÂ³n activa" : "Tiene $susCount suscripciones activas")
            ]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM planes WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Plan eliminado']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'M&#233;todo no permitido']);
} catch (PDOException $e) {
    error_log("Error planes.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error planes.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

