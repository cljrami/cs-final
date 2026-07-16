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

    function obtenerTabla($tipo): string {
        return $tipo === 'ojos' ? 'colores_ojos' : 'colores_pelo';
    }

    function obtenerTipo($tabla): string {
        return $tabla === 'colores_ojos' ? 'ojos' : 'pelo';
    }

    function buscarRegistro($pdo, $id, &$tabla): ?array {
        foreach (['colores_pelo', 'colores_ojos'] as $t) {
            $stmt = $pdo->prepare("SELECT id, nombre, orden, activo, created_at FROM $t WHERE id = ?");
            $stmt->execute([$id]);
            $r = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($r) {
                $tabla = $t;
                return $r;
            }
        }
        return null;
    }

    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $filtro = isset($_GET['filtro']) ? $_GET['filtro'] : 'todos';
        $tipoFiltro = isset($_GET['tipo']) ? $_GET['tipo'] : 'todos';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        $tables = ($tipoFiltro === 'todos')
            ? ['colores_pelo', 'colores_ojos']
            : [obtenerTabla($tipoFiltro)];

        $where = [];
        $params = [];

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
        foreach (['colores_pelo', 'colores_ojos'] as $t) {
            $stats['total'] += (int)$pdo->query("SELECT COUNT(*) FROM $t")->fetchColumn();
            $stats['activos'] += (int)$pdo->query("SELECT COUNT(*) FROM $t WHERE activo = 1")->fetchColumn();
            $stats['inactivos'] += (int)$pdo->query("SELECT COUNT(*) FROM $t WHERE activo = 0")->fetchColumn();
        }

        $rows = [];
        $totalFiltered = 0;

        foreach ($tables as $t) {
            $countSql = "SELECT COUNT(*) FROM $t $whereClause";
            $countStmt = $pdo->prepare($countSql);
            $countStmt->execute($params);
            $totalFiltered += (int)$countStmt->fetchColumn();

            $sql = "SELECT id, nombre, orden, activo, created_at,
                        (SELECT COUNT(*) FROM escorts WHERE " . ($t === 'colores_pelo' ? 'color_pelo' : 'color_ojos') . " = c.nombre AND eliminada = 0) AS total_escorts
                    FROM $t c $whereClause ORDER BY orden ASC, nombre ASC";
            $stmt = $pdo->prepare($sql);
            foreach ($params as $key => $val) {
                $stmt->bindValue($key, $val);
            }
            $stmt->execute();
            $partial = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($partial as &$r) {
                $r['tipo'] = obtenerTipo($t);
            }
            unset($r);
            $rows = array_merge($rows, $partial);
        }

        usort($rows, function($a, $b) {
            $cmp = ($a['orden'] ?? 0) <=> ($b['orden'] ?? 0);
            return $cmp !== 0 ? $cmp : strcasecmp($a['nombre'] ?? '', $b['nombre'] ?? '');
        });

        $rows = array_slice($rows, $offset, $limit);

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
        $tabla = obtenerTabla($tipo);

        $fieldErrors = [];

        if (empty($nombre)) {
            $fieldErrors['nombre'] = 'El nombre del color es obligatorio';
        } elseif (strlen($nombre) < 2) {
            $fieldErrors['nombre'] = 'El nombre debe tener al menos 2 caracteres';
        } elseif (strlen($nombre) > 30) {
            $fieldErrors['nombre'] = 'El nombre no puede exceder 30 caracteres';
        }

        if (empty($fieldErrors['nombre'])) {
            $checkStmt = $pdo->prepare("SELECT id, nombre FROM $tabla WHERE LOWER(nombre) = LOWER(?)");
            $checkStmt->execute([$nombre]);
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

        $stmt = $pdo->prepare("INSERT INTO $tabla (nombre, orden, activo) VALUES (?, ?, ?)");
        $stmt->execute([$nombre, $orden, $activo]);
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

        $oldTabla = '';
        $oldRecord = buscarRegistro($pdo, $id, $oldTabla);
        if (!$oldRecord) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Color no encontrado']);
            exit;
        }

        $nuevoTipo = isset($input['tipo']) && $input['tipo'] === 'ojos' ? 'ojos' : 'pelo';
        $nuevaTabla = obtenerTabla($nuevoTipo);

        $updates = [];
        $values = [];
        $fieldErrors = [];

        if (isset($input['nombre'])) {
            $nombre = trim($input['nombre']);
            if (empty($nombre)) {
                $fieldErrors['nombre'] = 'El nombre no puede estar vacío';
            } elseif (strlen($nombre) < 2) {
                $fieldErrors['nombre'] = 'El nombre debe tener al menos 2 caracteres';
            } elseif (strlen($nombre) > 30) {
                $fieldErrors['nombre'] = 'El nombre no puede exceder 30 caracteres';
            } else {
                $dupStmt = $pdo->prepare("SELECT id, nombre FROM $nuevaTabla WHERE LOWER(nombre) = LOWER(?) AND id != ?");
                $dupStmt->execute([$nombre, $id]);
                $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);
                if ($existing) {
                    $fieldErrors['nombre'] = 'Ya existe otro color llamado "' . $existing['nombre'] . '"';
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
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors, 'error' => 'Por favor corrige los errores del formulario']);
            exit;
        }

        if (empty($updates) && $oldTabla === $nuevaTabla) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No hay datos para actualizar']);
            exit;
        }

        if ($oldTabla !== $nuevaTabla) {
            $deleteStmt = $pdo->prepare("DELETE FROM $oldTabla WHERE id = ?");
            $deleteStmt->execute([$id]);

            $insertNombre = isset($input['nombre']) ? trim($input['nombre']) : $oldRecord['nombre'];
            $insertOrden = isset($input['orden']) ? intval($input['orden']) : $oldRecord['orden'];
            $insertActivo = isset($input['activo']) ? (int)$input['activo'] : $oldRecord['activo'];

            $stmt = $pdo->prepare("INSERT INTO $nuevaTabla (nombre, orden, activo) VALUES (?, ?, ?)");
            $stmt->execute([$insertNombre, $insertOrden, $insertActivo]);
            $newId = (int)$pdo->lastInsertId();

            echo json_encode([
                'success' => true,
                'message' => 'Color actualizado correctamente',
                'color' => ['id' => $newId, 'nombre' => $insertNombre, 'tipo' => $nuevoTipo, 'orden' => $insertOrden, 'activo' => $insertActivo]
            ]);
            exit;
        }

        $values[] = $id;
        $sql = "UPDATE $nuevaTabla SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        $getStmt = $pdo->prepare("SELECT id, nombre, orden, activo, created_at FROM $nuevaTabla WHERE id = ?");
        $getStmt->execute([$id]);
        $color = $getStmt->fetch(PDO::FETCH_ASSOC);
        if ($color) {
            $color['tipo'] = obtenerTipo($nuevaTabla);
        }

        echo json_encode(['success' => true, 'message' => 'Color actualizado correctamente', 'color' => $color]);
        exit;
    }

    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        $tipo = isset($_GET['tipo']) && $_GET['tipo'] === 'ojos' ? 'ojos' : 'pelo';
        $tabla = obtenerTabla($tipo);

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de color no válido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT nombre FROM $tabla WHERE id = ?");
        $checkStmt->execute([$id]);
        $color = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$color) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Color no encontrado']);
            exit;
        }

        $escortField = $tipo === 'ojos' ? 'color_ojos' : 'color_pelo';
        $escortStmt = $pdo->prepare("SELECT COUNT(*) FROM escorts WHERE $escortField = ? AND eliminada = 0");
        $escortStmt->execute([$color['nombre']]);
        $escortCount = (int)$escortStmt->fetchColumn();

        if ($escortCount > 0) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => ($escortCount === 1 ? "No se puede eliminar el color porque tiene {$escortCount} escort asociada" : "No se puede eliminar el color porque tiene {$escortCount} escorts asociadas")]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM $tabla WHERE id = ?");
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
    echo json_encode(['success' => false, 'error' => 'Error interno: ' . $e->getMessage()]);
}
