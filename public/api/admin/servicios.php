<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function generarSlug($str)
{
    $str = strtolower(trim($str));
    $str = str_replace(
        ['íƒÂ¡', 'íƒÂ©', 'íƒÂ­', 'íƒÂ³', 'íƒÂº', 'íƒÂ±', 'íƒÂ¼', 'íƒÂ', 'íƒâ€°', 'íƒÂ', 'íƒâ€œ', 'íƒÅ¡', 'íƒâ€˜', 'íƒÅ“', 'íƒÂ ', 'íƒÂ¨', 'íƒÂ¬', 'íƒÂ²', 'íƒÂ¹', 'íƒÂ§', 'íƒâ€¡'],
        ['a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u', 'c', 'c'],
        $str
    );
    $str = preg_replace('/[^a-z0-9]+/', '-', $str);
    return trim($str, '-');
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Listar servicios ===
    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $grupo = isset($_GET['grupo']) ? $_GET['grupo'] : 'todos';
        $filtro = isset($_GET['filtro']) ? $_GET['filtro'] : 'todos';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        // Stats
        $stats = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM servicios")->fetchColumn(),
            'activos' => (int)$pdo->query("SELECT COUNT(*) FROM servicios WHERE activo = 1")->fetchColumn(),
            'inactivos' => (int)$pdo->query("SELECT COUNT(*) FROM servicios WHERE activo = 0")->fetchColumn(),
            'adicionales' => (int)$pdo->query("SELECT COUNT(*) FROM servicios WHERE tipicamente_adicional = 1")->fetchColumn(),
            'incluidos' => (int)$pdo->query("SELECT COUNT(*) FROM servicios WHERE tipicamente_adicional = 0")->fetchColumn(),
        ];

        $where = ['1=1'];
        $params = [];

        if ($grupo !== 'todos') {
            $where[] = 'grupo = ?';
            $params[] = $grupo;
        }

        if ($filtro === 'activos') {
            $where[] = 'activo = 1';
        } elseif ($filtro === 'inactivos') {
            $where[] = 'activo = 0';
        } elseif ($filtro === 'adicionales') {
            $where[] = 'tipicamente_adicional = 1';
        } elseif ($filtro === 'incluidos') {
            $where[] = 'tipicamente_adicional = 0';
        }

        if ($search !== '') {
            $where[] = '(nombre LIKE ? OR descripcion LIKE ? OR descripcion_corta LIKE ?)';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) FROM servicios $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        $sql = "
            SELECT 
                id, nombre, slug, descripcion, descripcion_corta,
                grupo, icono, color, tipicamente_adicional,
                orden, activo, created_at,
                (SELECT COUNT(*) FROM escort_servicios es JOIN escorts e ON e.id = es.escort_id WHERE es.servicio_id = s.id AND e.eliminada = 0) AS total_escorts
            FROM servicios s
            $whereClause
            ORDER BY orden ASC, nombre ASC
            LIMIT ? OFFSET ?
        ";

        $stmt = $pdo->prepare($sql);
        $allParams = array_merge($params, [$limit, $offset]);
        $stmt->execute($allParams);
        $servicios = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Grupos disponibles para filtros
        $gruposStmt = $pdo->query("SELECT DISTINCT grupo FROM servicios WHERE activo = 1 ORDER BY grupo");
        $grupos = $gruposStmt->fetchAll(PDO::FETCH_COLUMN);

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'grupos' => $grupos,
            'servicios' => $servicios,
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

    // === POST - Crear servicio ===
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        $slug = isset($input['slug']) ? trim($input['slug']) : '';
        $descripcion = isset($input['descripcion']) ? trim($input['descripcion']) : '';
        $descripcion_corta = isset($input['descripcion_corta']) ? trim($input['descripcion_corta']) : '';
        $grupo = isset($input['grupo']) ? trim($input['grupo']) : 'sexual';
        $icono = isset($input['icono']) ? trim($input['icono']) : 'circle';
        $color = isset($input['color']) ? trim($input['color']) : '#6366f1';
        $tipicamente_adicional = isset($input['tipicamente_adicional']) ? (int)$input['tipicamente_adicional'] : 0;
        $orden = isset($input['orden']) ? intval($input['orden']) : 0;
        $activo = isset($input['activo']) ? (int)$input['activo'] : 1;

        if (empty($slug) && !empty($nombre)) {
            $slug = generarSlug($nombre);
        }

        $fieldErrors = [];

        if (empty($nombre)) {
            $fieldErrors['nombre'] = 'El nombre es obligatorio';
        } elseif (strlen($nombre) < 2) {
            $fieldErrors['nombre'] = 'MíƒÂ­nimo 2 caracteres';
        } elseif (strlen($nombre) > 100) {
            $fieldErrors['nombre'] = 'MíƒÂ¡ximo 100 caracteres';
        }

        if (empty($fieldErrors['nombre'])) {
            $checkStmt = $pdo->prepare("SELECT id FROM servicios WHERE LOWER(nombre) = LOWER(?)");
            $checkStmt->execute([$nombre]);
            if ($checkStmt->fetch()) {
                $fieldErrors['nombre'] = 'Ya existe un servicio con ese nombre';
            }
        }

        if (!empty($slug)) {
            $slugCheck = $pdo->prepare("SELECT id FROM servicios WHERE slug = ?");
            $slugCheck->execute([$slug]);
            if ($slugCheck->fetch()) {
                $fieldErrors['slug'] = 'Ya existe ese slug';
            }
        }

        $gruposValidos = ['sexual', 'relajacion', 'acompanamiento', 'experiencia', 'adicional', 'lugar', 'tiempo', 'virtual'];
        if (!in_array($grupo, $gruposValidos)) {
            $fieldErrors['grupo'] = 'Grupo no víƒÂ¡lido';
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors]);
            exit;
        }

        $stmt = $pdo->prepare("
            INSERT INTO servicios (nombre, slug, descripcion, descripcion_corta, grupo, icono, color, tipicamente_adicional, orden, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$nombre, $slug, $descripcion, $descripcion_corta, $grupo, $icono, $color, $tipicamente_adicional, $orden, $activo]);
        $newId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => 'Servicio creado',
            'servicio' => [
                'id' => (int)$newId,
                'nombre' => $nombre,
                'slug' => $slug,
                'descripcion' => $descripcion,
                'descripcion_corta' => $descripcion_corta,
                'grupo' => $grupo,
                'icono' => $icono,
                'color' => $color,
                'tipicamente_adicional' => $tipicamente_adicional,
                'orden' => $orden,
                'activo' => $activo
            ]
        ]);
        exit;
    }

    // === PUT - Actualizar servicio ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no víƒÂ¡lido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT id FROM servicios WHERE id = ?");
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Servicio no encontrado']);
            exit;
        }

        $updates = [];
        $values = [];
        $fieldErrors = [];

        $gruposValidos = ['sexual', 'relajacion', 'acompanamiento', 'experiencia', 'adicional', 'lugar', 'tiempo', 'virtual'];

        if (isset($input['nombre'])) {
            $nombre = trim($input['nombre']);
            if (empty($nombre)) {
                $fieldErrors['nombre'] = 'El nombre no puede estar vacíƒÂ­o';
            } elseif (strlen($nombre) > 100) {
                $fieldErrors['nombre'] = 'MíƒÂ¡ximo 100 caracteres';
            } else {
                $dupStmt = $pdo->prepare("SELECT id FROM servicios WHERE LOWER(nombre) = LOWER(?) AND id != ?");
                $dupStmt->execute([$nombre, $id]);
                if ($dupStmt->fetch()) {
                    $fieldErrors['nombre'] = 'Ya existe otro servicio con ese nombre';
                } else {
                    $updates[] = 'nombre = ?';
                    $values[] = $nombre;
                }
            }
        }

        if (isset($input['slug'])) {
            $slug = trim($input['slug']);
            if (!empty($slug)) {
                $dupSlug = $pdo->prepare("SELECT id FROM servicios WHERE slug = ? AND id != ?");
                $dupSlug->execute([$slug, $id]);
                if ($dupSlug->fetch()) {
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

        if (isset($input['descripcion_corta'])) {
            $updates[] = 'descripcion_corta = ?';
            $values[] = trim($input['descripcion_corta']);
        }

        if (isset($input['grupo'])) {
            $grupo = trim($input['grupo']);
            if (!in_array($grupo, $gruposValidos)) {
                $fieldErrors['grupo'] = 'Grupo no víƒÂ¡lido';
            } else {
                $updates[] = 'grupo = ?';
                $values[] = $grupo;
            }
        }

        if (isset($input['icono'])) {
            $updates[] = 'icono = ?';
            $values[] = trim($input['icono']);
        }

        if (isset($input['color'])) {
            $updates[] = 'color = ?';
            $values[] = trim($input['color']);
        }

        if (isset($input['tipicamente_adicional'])) {
            $updates[] = 'tipicamente_adicional = ?';
            $values[] = (int)$input['tipicamente_adicional'];
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
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors]);
            exit;
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Sin cambios']);
            exit;
        }

        $values[] = $id;
        $sql = "UPDATE servicios SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        $getStmt = $pdo->prepare("SELECT * FROM servicios WHERE id = ?");
        $getStmt->execute([$id]);
        $servicio = $getStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'message' => 'Actualizado', 'servicio' => $servicio]);
        exit;
    }

    // === DELETE - Eliminar servicio ===
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no víƒÂ¡lido']);
            exit;
        }

        // Verificar si hay escorts usando este servicio
        $escortsStmt = $pdo->prepare("SELECT COUNT(*) FROM escort_servicios WHERE servicio_id = ?");
        $escortsStmt->execute([$id]);
        $escortsCount = (int)$escortsStmt->fetchColumn();

        if ($escortsCount > 0) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => ($escortsCount === 1 ? "No se puede eliminar: $escortsCount escort usa este servicio" : "No se puede eliminar: $escortsCount escorts usan este servicio")
            ]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM servicios WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Servicio eliminado']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);
} catch (PDOException $e) {
    error_log("Error servicios.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error servicios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

