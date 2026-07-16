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

    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Listar ciudades ===
    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $estado = isset($_GET['estado']) ? $_GET['estado'] : 'todos';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        // === STATS ===
        $stats = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM ciudades")->fetchColumn(),
            'activas' => (int)$pdo->query("SELECT COUNT(*) FROM ciudades WHERE activa = 1")->fetchColumn(),
            'inactivas' => (int)$pdo->query("SELECT COUNT(*) FROM ciudades WHERE activa = 0")->fetchColumn(),
        ];

        // === CONSTRUIR QUERY ===
        $where = [];
        $params = [];

        if ($estado === 'activas') {
            $where[] = 'activa = 1';
        } elseif ($estado === 'inactivas') {
            $where[] = 'activa = 0';
        }

        // FIX: Parámetros únicos para cada LIKE (PDO no permite reutilizar :search)
        if ($search !== '') {
            $where[] = '(nombre LIKE :search1)';
            $params[':search1'] = '%' . $search . '%';
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        // Contar total filtrado
        $countSql = "SELECT COUNT(*) FROM ciudades $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        // Obtener ciudades con conteo de escorts real
        $sql = "
            SELECT 
                c.id,
                c.nombre,
                c.activa,
                c.orden,
                c.created_at,
                (SELECT COUNT(*) FROM escorts WHERE ciudad = c.nombre AND eliminada = 0) as total_escorts_real
            FROM ciudades c
            $whereClause
            ORDER BY c.orden ASC, c.nombre ASC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $ciudades = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Actualizar total_escorts en la tabla (mantener sincronizado)
        foreach ($ciudades as $ciudad) {
            $updateStmt = $pdo->prepare("UPDATE ciudades SET total_escorts = ? WHERE id = ?");
            $updateStmt->execute([$ciudad['total_escorts_real'], $ciudad['id']]);
        }

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'ciudades' => $ciudades,
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

    // === POST - Crear ciudad ===
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        $orden = isset($input['orden']) ? intval($input['orden']) : 0;
        $activa = isset($input['activa']) ? (int)$input['activa'] : 1;

        // === VALIDACIÓN CON ERRORES POR CAMPO ===
        $fieldErrors = [];

        if (empty($nombre)) {
            $fieldErrors['nombre'] = 'El nombre de la ciudad es obligatorio';
        } elseif (strlen($nombre) < 2) {
            $fieldErrors['nombre'] = 'El nombre debe tener al menos 2 caracteres';
        } elseif (strlen($nombre) > 100) {
            $fieldErrors['nombre'] = 'El nombre no puede exceder 100 caracteres';
        }

        // Solo verificar duplicado si el nombre es válido
        if (empty($fieldErrors['nombre'])) {
            $checkStmt = $pdo->prepare("SELECT id, nombre FROM ciudades WHERE LOWER(nombre) = LOWER(?)");
            $checkStmt->execute([$nombre]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $fieldErrors['nombre'] = 'Ya existe una ciudad llamada "' . $existing['nombre'] . '"';
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
            INSERT INTO ciudades (nombre, orden, activa, total_escorts) 
            VALUES (?, ?, ?, 0)
        ");
        $stmt->execute([$nombre, $orden, $activa]);
        $newId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => 'Ciudad creada correctamente',
            'ciudad' => [
                'id' => (int)$newId,
                'nombre' => $nombre,
                'orden' => $orden,
                'activa' => $activa,
                'total_escorts' => 0
            ]
        ]);
        exit;
    }

    // === PUT - Actualizar ciudad ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de ciudad no válido']);
            exit;
        }

        // Verificar que existe
        $checkStmt = $pdo->prepare("SELECT id FROM ciudades WHERE id = ?");
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Ciudad no encontrada']);
            exit;
        }

        $updates = [];
        $values = [];
        $fieldErrors = [];

        if (isset($input['nombre'])) {
            $nombre = trim($input['nombre']);

            if (empty($nombre)) {
                $fieldErrors['nombre'] = 'El nombre no puede estar vacío';
            } elseif (strlen($nombre) < 2) {
                $fieldErrors['nombre'] = 'El nombre debe tener al menos 2 caracteres';
            } elseif (strlen($nombre) > 100) {
                $fieldErrors['nombre'] = 'El nombre no puede exceder 100 caracteres';
            } else {
                // Verificar duplicado (excluyendo la ciudad actual)
                $dupStmt = $pdo->prepare("SELECT id, nombre FROM ciudades WHERE LOWER(nombre) = LOWER(?) AND id != ?");
                $dupStmt->execute([$nombre, $id]);
                $existing = $dupStmt->fetch(PDO::FETCH_ASSOC);
                if ($existing) {
                    $fieldErrors['nombre'] = 'Ya existe otra ciudad llamada "' . $existing['nombre'] . '"';
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

        if (isset($input['activa'])) {
            $updates[] = 'activa = ?';
            $values[] = (int)$input['activa'];
        }

        // Si hay errores de validación, devolverlos
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
        $sql = "UPDATE ciudades SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        // Obtener ciudad actualizada
        $getStmt = $pdo->prepare("
            SELECT c.*, 
                (SELECT COUNT(*) FROM escorts WHERE ciudad = c.nombre AND eliminada = 0) as total_escorts_real
            FROM ciudades c WHERE c.id = ?
        ");
        $getStmt->execute([$id]);
        $ciudad = $getStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'message' => 'Ciudad actualizada correctamente',
            'ciudad' => $ciudad
        ]);
        exit;
    }

    // === DELETE - Eliminar ciudad ===
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de ciudad no válido']);
            exit;
        }

        // Verificar que existe
        $checkStmt = $pdo->prepare("SELECT nombre FROM ciudades WHERE id = ?");
        $checkStmt->execute([$id]);
        $ciudad = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$ciudad) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Ciudad no encontrada']);
            exit;
        }

        // Verificar si hay escorts asociadas
        $escortsStmt = $pdo->prepare("SELECT COUNT(*) FROM escorts WHERE ciudad = ? AND eliminada = 0");
        $escortsStmt->execute([$ciudad['nombre']]);
        $escortsCount = (int)$escortsStmt->fetchColumn();

        if ($escortsCount > 0) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => ($escortsCount === 1 ? "No se puede eliminar la ciudad porque tiene $escortsCount escort asociada. Reasigne o elimine la escort primero." : "No se puede eliminar la ciudad porque tiene $escortsCount escorts asociadas. Reasigne o elimine las escorts primero.")
            ]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM ciudades WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode([
            'success' => true,
            'message' => 'Ciudad eliminada correctamente'
        ]);
        exit;
    }

    // Método no permitido
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error ciudades.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Error ciudades.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno: ' . $e->getMessage()]);
}
