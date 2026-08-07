<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    if (!in_array($tokenData['rol'] ?? '', ['admin', 'superadmin', 'moderador'], true)) {
        jsonError('No tienes permisos para realizar esta accion', 403);
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $filtro = isset($_GET['filtro']) ? $_GET['filtro'] : 'todos';
        $tipoFiltro = isset($_GET['tipo']) ? $_GET['tipo'] : 'todos';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        $where = [];
        $params = [];

        if ($tipoFiltro !== 'todos') {
            $where[] = 'tipo = :tipo';
            $params[':tipo'] = $tipoFiltro;
        }

        if ($filtro === 'activos') {
            $where[] = 'activo = 1';
        } elseif ($filtro === 'inactivos') {
            $where[] = 'activo = 0';
        }

        if ($search !== '') {
            $where[] = 'nombre LIKE :search';
            $params[':search'] = '%' . $search . '%';
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $stats = ['total' => 0, 'activos' => 0, 'inactivos' => 0];
        $stats['total'] = (int)$pdo->query("SELECT COUNT(*) FROM colores")->fetchColumn();
        $stats['activos'] = (int)$pdo->query("SELECT COUNT(*) FROM colores WHERE activo = 1")->fetchColumn();
        $stats['inactivos'] = (int)$pdo->query("SELECT COUNT(*) FROM colores WHERE activo = 0")->fetchColumn();

        $countSql = "SELECT COUNT(*) FROM colores $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        $sql = "SELECT id, nombre, tipo, orden, activo, created_at,
                    CASE WHEN tipo = 'ojos' THEN (SELECT COUNT(*) FROM escorts WHERE color_ojos = c.nombre AND eliminada = 0)
                         ELSE (SELECT COUNT(*) FROM escorts WHERE color_pelo = c.nombre AND eliminada = 0)
                    END AS total_escorts
                FROM colores c $whereClause ORDER BY orden ASC, nombre ASC
                LIMIT :limit OFFSET :offset";
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'colores' => $rows,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltered,
                'pages' => $totalFiltered > 0 ? (int)ceil($totalFiltered / $limit) : 1,
                'hasMore' => ($page * $limit) < $totalFiltered
            ]
        ]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        $orden = isset($input['orden']) ? intval($input['orden']) : 0;
        $activo = isset($input['activo']) ? (int)$input['activo'] : 1;
        $tipo = isset($input['tipo']) && $input['tipo'] === 'ojos' ? 'ojos' : 'pelo';

        $fieldErrors = [];

        if (empty($nombre)) {
            $fieldErrors['nombre'] = 'El nombre del color es obligatorio';
        } elseif (strlen($nombre) < 2) {
            $fieldErrors['nombre'] = 'El nombre debe tener al menos 2 caracteres';
        } elseif (strlen($nombre) > 30) {
            $fieldErrors['nombre'] = 'El nombre no puede exceder 30 caracteres';
        }

        if (empty($fieldErrors['nombre'])) {
            $checkStmt = $pdo->prepare("SELECT id, nombre FROM colores WHERE LOWER(nombre) = LOWER(?) AND tipo = ?");
            $checkStmt->execute([$nombre, $tipo]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $fieldErrors['nombre'] = 'Ya existe un color llamado "' . $existing['nombre'] . '"';
            }
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors, 'error' => 'Por favor corrige los errores del formulario']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO colores (nombre, tipo, orden, activo) VALUES (?, ?, ?, ?)");
        $stmt->execute([$nombre, $tipo, $orden, $activo]);
        $newId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => 'Color creado correctamente',
            'color' => ['id' => (int)$newId, 'nombre' => $nombre, 'tipo' => $tipo, 'orden' => $orden, 'activo' => $activo]
        ]);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de color no válido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT id, nombre, tipo, orden, activo FROM colores WHERE id = ?");
        $checkStmt->execute([$id]);
        $old = $checkStmt->fetch(PDO::FETCH_ASSOC);
        if (!$old) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Color no encontrado']);
            exit;
        }

        $updates = [];
        $values = [];
        $fieldErrors = [];

        if (isset($input['nombre'])) {
            $nombre = trim($input['nombre']);
            if (empty($nombre)) {
                $fieldErrors['nombre'] = 'El nombre no puede estar vací­o';
            } elseif (strlen($nombre) < 2) {
                $fieldErrors['nombre'] = 'El nombre debe tener al menos 2 caracteres';
            } elseif (strlen($nombre) > 30) {
                $fieldErrors['nombre'] = 'El nombre no puede exceder 30 caracteres';
            } else {
                $nuevoTipo = isset($input['tipo']) && $input['tipo'] === 'ojos' ? 'ojos' : 'pelo';
                $dupStmt = $pdo->prepare("SELECT id, nombre FROM colores WHERE LOWER(nombre) = LOWER(?) AND tipo = ? AND id != ?");
                $dupStmt->execute([$nombre, $nuevoTipo, $id]);
                $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);
                if ($existing) {
                    $fieldErrors['nombre'] = 'Ya existe otro color llamado "' . $existing['nombre'] . '"';
                } else {
                    $updates[] = 'nombre = ?';
                    $values[] = $nombre;
                }
            }
        }

        if (isset($input['tipo'])) {
            $updates[] = 'tipo = ?';
            $values[] = $input['tipo'] === 'ojos' ? 'ojos' : 'pelo';
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
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors, 'error' => 'Por favor corrige los errores del formulario']);
            exit;
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No hay datos para actualizar']);
            exit;
        }

        $values[] = $id;
        $sql = "UPDATE colores SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        $getStmt = $pdo->prepare("SELECT id, nombre, tipo, orden, activo, created_at FROM colores WHERE id = ?");
        $getStmt->execute([$id]);
        $color = $getStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'message' => 'Color actualizado correctamente', 'color' => $color]);
        exit;
    }

    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de color no válido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT id, nombre, tipo FROM colores WHERE id = ?");
        $checkStmt->execute([$id]);
        $color = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$color) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Color no encontrado']);
            exit;
        }

        $escortField = $color['tipo'] === 'ojos' ? 'color_ojos' : 'color_pelo';
        $escortStmt = $pdo->prepare("SELECT COUNT(*) FROM escorts WHERE $escortField = ? AND eliminada = 0");
        $escortStmt->execute([$color['nombre']]);
        $escortCount = (int)$escortStmt->fetchColumn();

        if ($escortCount > 0) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => ($escortCount === 1 ? "No se puede eliminar el color porque tiene {$escortCount} escort asociada" : "No se puede eliminar el color porque tiene {$escortCount} escorts asociadas")]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM colores WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Color eliminado correctamente']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error colores.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error colores.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

