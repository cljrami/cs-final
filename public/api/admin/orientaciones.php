<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

// === FUNCIONES AUXILIARES (antes de todo) ===
function createSlug($text)
{
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', $text);
    return $text;
}

// === LIMPIAR BUFFER ===
if (ob_get_level()) ob_end_clean();

// === HEADERS SIEMPRE JSON ===
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../bootstrap.php';

$tokenData = requireAuth();

if (!isset($tokenData['rol']) || !in_array($tokenData['rol'], ['superadmin', 'admin', 'moderador'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'No tienes permisos']);
    exit;
}

$adminId = isset($tokenData['id']) ? intval($tokenData['id']) : 0;

try {
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // ============================================
    // GET - LISTAR ORIENTACIONES
    // ============================================
    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        $stats = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM orientaciones_sexuales")->fetchColumn(),
            'activas' => (int)$pdo->query("SELECT COUNT(*) FROM orientaciones_sexuales WHERE activa = 1")->fetchColumn(),
            'inactivas' => (int)$pdo->query("SELECT COUNT(*) FROM orientaciones_sexuales WHERE activa = 0")->fetchColumn(),
        ];

        $where = ['1=1'];
        $params = [];

        if ($search !== '') {
            $where[] = '(nombre LIKE ? OR descripcion LIKE ? OR slug LIKE ?)';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }

        $whereSql = 'WHERE ' . implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) FROM orientaciones_sexuales $whereSql";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $sql = "SELECT id, nombre, slug, descripcion, orden, activa, created_at,
                    (SELECT COUNT(*) FROM escorts WHERE orientacion = o.nombre AND eliminada = 0) AS total_escorts
                FROM orientaciones_sexuales o
                $whereSql 
                ORDER BY orden ASC, nombre ASC 
                LIMIT ? OFFSET ?";

        $stmt = $pdo->prepare($sql);
        $allParams = array_merge($params, [$limit, $offset]);
        $stmt->execute($allParams);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($data as &$row) {
            $row['id'] = (int)$row['id'];
            $row['orden'] = (int)$row['orden'];
            $row['activa'] = (int)$row['activa'];
        }

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'orientaciones' => $data,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => max(1, ceil($total / $limit)),
                'hasMore' => ($page * $limit) < $total
            ]
        ]);
        exit;
    }

    // ============================================
    // POST - CREAR ORIENTACIí“N
    // ============================================
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Body inválido']);
            exit;
        }

        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        $descripcion = isset($input['descripcion']) ? trim($input['descripcion']) : '';
        $orden = isset($input['orden']) ? intval($input['orden']) : 0;

        $fieldErrors = [];

        if (empty($nombre)) {
            $fieldErrors['nombre'] = 'El nombre es obligatorio';
        } elseif (strlen($nombre) > 100) {
            $fieldErrors['nombre'] = 'Máximo 100 caracteres';
        }

        if (empty($fieldErrors['nombre'])) {
            $stmtDup = $pdo->prepare("SELECT id FROM orientaciones_sexuales WHERE LOWER(nombre) = LOWER(?)");
            $stmtDup->execute([$nombre]);
            if ($stmtDup->fetch()) {
                $fieldErrors['nombre'] = 'Ya existe una orientación con ese nombre';
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

        $slug = createSlug($nombre);

        $stmt = $pdo->prepare("
            INSERT INTO orientaciones_sexuales (nombre, slug, descripcion, orden, activa, created_at)
            VALUES (?, ?, ?, ?, 1, NOW())
        ");
        $stmt->execute([$nombre, $slug, $descripcion, $orden]);

        $id = (int)$pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => 'Orientación creada correctamente',
            'orientacion' => [
                'id' => $id,
                'nombre' => $nombre,
                'slug' => $slug,
                'descripcion' => $descripcion,
                'orden' => $orden,
                'activa' => 1
            ]
        ]);
        exit;
    }

    // ============================================
    // PUT - ACTUALIZAR ORIENTACIí“N (parcial)
    // ============================================
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Body inválido']);
            exit;
        }

        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no válido']);
            exit;
        }

        $stmtOld = $pdo->prepare("SELECT * FROM orientaciones_sexuales WHERE id = ?");
        $stmtOld->execute([$id]);
        $oldData = $stmtOld->fetch(PDO::FETCH_ASSOC);

        if (!$oldData) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Orientación no encontrada']);
            exit;
        }

        $updates = [];
        $values = [];
        $fieldErrors = [];

        // Solo validar/procesar nombre SI viene en el input
        if (isset($input['nombre'])) {
            $nombre = trim($input['nombre']);
            if (empty($nombre)) {
                $fieldErrors['nombre'] = 'El nombre no puede estar vací­o';
            } elseif (strlen($nombre) > 100) {
                $fieldErrors['nombre'] = 'Máximo 100 caracteres';
            } else {
                $dupStmt = $pdo->prepare("SELECT id FROM orientaciones_sexuales WHERE LOWER(nombre) = LOWER(?) AND id != ?");
                $dupStmt->execute([$nombre, $id]);
                if ($dupStmt->fetch()) {
                    $fieldErrors['nombre'] = 'Ya existe otra orientación con ese nombre';
                } else {
                    $updates[] = 'nombre = ?';
                    $values[] = $nombre;
                    $updates[] = 'slug = ?';
                    $values[] = createSlug($nombre);
                }
            }
        }

        // Solo procesar descripcion SI viene en el input
        if (isset($input['descripcion'])) {
            $updates[] = 'descripcion = ?';
            $values[] = trim($input['descripcion']);
        }

        // Solo procesar orden SI viene en el input
        if (isset($input['orden'])) {
            $updates[] = 'orden = ?';
            $values[] = intval($input['orden']);
        }

        // Solo procesar activa SI viene en el input
        if (isset($input['activa'])) {
            $updates[] = 'activa = ?';
            $values[] = (int)$input['activa'];
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
            echo json_encode(['success' => false, 'error' => 'Sin cambios']);
            exit;
        }

        $values[] = $id;
        $sql = "UPDATE orientaciones_sexuales SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        echo json_encode([
            'success' => true,
            'message' => 'Orientación actualizada correctamente'
        ]);
        exit;
    }

    // ============================================
    // DELETE - ELIMINAR ORIENTACIí“N ($_GET)
    // ============================================
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }

        $stmtOld = $pdo->prepare("SELECT * FROM orientaciones_sexuales WHERE id = ?");
        $stmtOld->execute([$id]);
        $oldData = $stmtOld->fetch(PDO::FETCH_ASSOC);

        if (!$oldData) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Orientación no encontrada']);
            exit;
        }

        $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM escorts WHERE orientacion = ? AND orientacion IS NOT NULL AND orientacion != ''");
        $stmtCheck->execute([$oldData['nombre']]);
        $count = (int)$stmtCheck->fetchColumn();

        if ($count > 0) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => ($count === 1 ? 'No se puede eliminar: hay ' . $count . ' escort usando esta orientación' : 'No se puede eliminar: hay ' . $count . ' escorts usando esta orientación')
            ]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM orientaciones_sexuales WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Orientación eliminada correctamente']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error orientaciones.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error orientaciones.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

