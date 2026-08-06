<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Listar nacionalidades ===
    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $filtro = isset($_GET['filtro']) ? $_GET['filtro'] : 'todos';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        // === STATS ===
        $stats = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM nacionalidades")->fetchColumn(),
            'activas' => (int)$pdo->query("SELECT COUNT(*) FROM nacionalidades WHERE activo = 1")->fetchColumn(),
            'inactivas' => (int)$pdo->query("SELECT COUNT(*) FROM nacionalidades WHERE activo = 0")->fetchColumn(),
        ];

        // === CONSTRUIR QUERY ===
        $where = [];
        $params = [];

        if ($filtro === 'activas') {
            $where[] = 'activo = 1';
        } elseif ($filtro === 'inactivas') {
            $where[] = 'activo = 0';
        }

        if ($search !== '') {
            $where[] = 'nombre LIKE :search1';
            $params[':search1'] = '%' . $search . '%';
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        // Contar total filtrado
        $countSql = "SELECT COUNT(*) FROM nacionalidades $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        // Obtener nacionalidades
        $sql = "
            SELECT 
                id,
                nombre,
                orden,
                activo,
                created_at,
                (SELECT COUNT(*) FROM escorts WHERE nacionalidad = n.nombre AND eliminada = 0) AS total_escorts
            FROM nacionalidades n
            $whereClause
            ORDER BY orden ASC, nombre ASC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $nacionalidades = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'nacionalidades' => $nacionalidades,
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

    // === POST - Crear nacionalidad ===
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        $orden = isset($input['orden']) ? intval($input['orden']) : 0;
        $activo = isset($input['activo']) ? (int)$input['activo'] : 1;

        $fieldErrors = [];

        if (empty($nombre)) {
            $fieldErrors['nombre'] = 'El nombre de la nacionalidad es obligatorio';
        } elseif (strlen($nombre) < 2) {
            $fieldErrors['nombre'] = 'El nombre debe tener al menos 2 caracteres';
        } elseif (strlen($nombre) > 50) {
            $fieldErrors['nombre'] = 'El nombre no puede exceder 50 caracteres';
        }

        if (!empty($fieldErrors['nombre'])) {
            // skip duplicate check
        } else {
            $checkStmt = $pdo->prepare("SELECT id, nombre FROM nacionalidades WHERE LOWER(nombre) = LOWER(?)");
            $checkStmt->execute([$nombre]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $fieldErrors['nombre'] = 'Ya existe una nacionalidad llamada "' . $existing['nombre'] . '"';
            }
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'fieldErrors' => $fieldErrors,
                'error' => 'Por favor corrige los errores del formulario'
            ]);
            exit;
        }

        $stmt = $pdo->prepare("
            INSERT INTO nacionalidades (nombre, orden, activo) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$nombre, $orden, $activo]);
        $newId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => 'Nacionalidad creada correctamente',
            'nacionalidad' => [
                'id' => (int)$newId,
                'nombre' => $nombre,
                'orden' => $orden,
                'activo' => $activo
            ]
        ]);
        exit;
    }

    // === PUT - Actualizar nacionalidad ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de nacionalidad no víƒÂ¡lido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT id FROM nacionalidades WHERE id = ?");
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Nacionalidad no encontrada']);
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
                $fieldErrors['nombre'] = 'El nombre debe tener al menos 2 caracteres';
            } elseif (strlen($nombre) > 50) {
                $fieldErrors['nombre'] = 'El nombre no puede exceder 50 caracteres';
            } else {
                $dupStmt = $pdo->prepare("SELECT id, nombre FROM nacionalidades WHERE LOWER(nombre) = LOWER(?) AND id != ?");
                $dupStmt->execute([$nombre, $id]);
                $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);
                if ($existing) {
                    $fieldErrors['nombre'] = 'Ya existe otra nacionalidad llamada "' . $existing['nombre'] . '"';
                } else {
                    $updates[] = 'nombre = ?';
                    $values[] = $nombre;
                }
            }
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
            echo json_encode([
                'success' => false,
                'fieldErrors' => $fieldErrors,
                'error' => 'Por favor corrige los errores del formulario'
            ]);
            exit;
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No hay datos para actualizar']);
            exit;
        }

        $values[] = $id;
        $sql = "UPDATE nacionalidades SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        $getStmt = $pdo->prepare("SELECT * FROM nacionalidades WHERE id = ?");
        $getStmt->execute([$id]);
        $nacionalidad = $getStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'message' => 'Nacionalidad actualizada correctamente',
            'nacionalidad' => $nacionalidad
        ]);
        exit;
    }

    // === DELETE - Eliminar nacionalidad ===
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de nacionalidad no víƒÂ¡lido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT nombre FROM nacionalidades WHERE id = ?");
        $checkStmt->execute([$id]);
        $nacionalidad = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$nacionalidad) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Nacionalidad no encontrada']);
            exit;
        }

        // Verificar si hay escorts usando esta nacionalidad
        $escortStmt = $pdo->prepare("SELECT COUNT(*) FROM escorts WHERE nacionalidad = ? AND eliminada = 0");
        $escortStmt->execute([$nacionalidad['nombre']]);
        $escortCount = (int)$escortStmt->fetchColumn();

        if ($escortCount > 0) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => ($escortCount === 1 ? "No se puede eliminar la nacionalidad porque tiene {$escortCount} escort asociada" : "No se puede eliminar la nacionalidad porque tiene {$escortCount} escorts asociadas")
            ]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM nacionalidades WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode([
            'success' => true,
            'message' => 'Nacionalidad eliminada correctamente'
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);
} catch (PDOException $e) {
    error_log("Error nacionalidades.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error nacionalidades.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

