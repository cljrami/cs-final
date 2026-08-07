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
        ['íƒÂ¡', 'íƒÂ©', 'íƒÂ­', 'íƒÂ³', 'íƒÂº', 'íƒÂ±', 'íƒÂ¼', 'íƒÂ', 'íƒâ€°', 'íƒÂ', 'íƒâ€œ', 'íƒÅ¡', 'íƒâ€˜', 'íƒÅ“', 'íƒÂ ', 'íƒÂ¨', 'íƒÂ¬', 'íƒÂ²', 'íƒÂ¹'],
        ['a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u'],
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

    // === GET ===
    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $estado = isset($_GET['estado']) ? $_GET['estado'] : 'todos';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        $stats = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM categorias")->fetchColumn(),
            'activas' => (int)$pdo->query("SELECT COUNT(*) FROM categorias WHERE activa = 1")->fetchColumn(),
            'inactivas' => (int)$pdo->query("SELECT COUNT(*) FROM categorias WHERE activa = 0")->fetchColumn(),
        ];

        $where = [];
        $params = [];

        if ($estado === 'activas') {
            $where[] = 'activa = 1';
        } elseif ($estado === 'inactivas') {
            $where[] = 'activa = 0';
        }

        if ($search !== '') {
            $where[] = '(nombre LIKE ? OR descripcion LIKE ? OR slug LIKE ?)';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        // Contar total filtrado
        $countSql = "SELECT COUNT(*) FROM categorias $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        // Obtener categoríƒÂ­as - USAR ? POSICIONAL para evitar conflictos
        $sql = "
            SELECT 
                c.id,
                c.nombre,
                c.slug,
                c.descripcion,
                c.icono,
                c.color,
                c.activa,
                c.orden,
                c.total_escorts,
                c.created_at
            FROM categorias c
            $whereClause
            ORDER BY c.orden ASC, c.nombre ASC
            LIMIT ? OFFSET ?
        ";

        $stmt = $pdo->prepare($sql);

        // Merge params con limit y offset
        $allParams = array_merge($params, [$limit, $offset]);
        $stmt->execute($allParams);

        $categorias = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'categorias' => $categorias,
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

    // === POST ===
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        $slug = isset($input['slug']) ? trim($input['slug']) : '';
        $descripcion = isset($input['descripcion']) ? trim($input['descripcion']) : '';
        $icono = isset($input['icono']) ? trim($input['icono']) : 'fa-tag';
        $color = isset($input['color']) ? trim($input['color']) : '#6366f1';
        $orden = isset($input['orden']) ? intval($input['orden']) : 0;
        $activa = isset($input['activa']) ? (int)$input['activa'] : 1;

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
            $checkStmt = $pdo->prepare("SELECT id, nombre FROM categorias WHERE LOWER(nombre) = LOWER(?)");
            $checkStmt->execute([$nombre]);
            if ($checkStmt->fetch()) {
                $fieldErrors['nombre'] = 'Ya existe una categoríƒÂ­a con ese nombre';
            }
        }

        if (!empty($slug)) {
            $slugCheck = $pdo->prepare("SELECT id FROM categorias WHERE slug = ?");
            $slugCheck->execute([$slug]);
            if ($slugCheck->fetch()) {
                $fieldErrors['slug'] = 'Ya existe ese slug';
            }
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors]);
            exit;
        }

        $stmt = $pdo->prepare("
            INSERT INTO categorias (nombre, slug, descripcion, icono, color, orden, activa, total_escorts) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        ");
        $stmt->execute([$nombre, $slug, $descripcion, $icono, $color, $orden, $activa]);
        $newId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => 'CategoríƒÂ­a creada',
            'categoria' => [
                'id' => (int)$newId,
                'nombre' => $nombre,
                'slug' => $slug,
                'descripcion' => $descripcion,
                'icono' => $icono,
                'color' => $color,
                'orden' => $orden,
                'activa' => $activa,
                'total_escorts' => 0
            ]
        ]);
        exit;
    }

    // === PUT ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no víƒÂ¡lido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT id FROM categorias WHERE id = ?");
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No encontrada']);
            exit;
        }

        $updates = [];
        $values = [];
        $fieldErrors = [];

        if (isset($input['nombre'])) {
            $nombre = trim($input['nombre']);
            if (empty($nombre)) {
                $fieldErrors['nombre'] = 'El nombre no puede estar vacíƒÂ­o';
            } elseif (strlen($nombre) > 100) {
                $fieldErrors['nombre'] = 'MíƒÂ¡ximo 100 caracteres';
            } else {
                $dupStmt = $pdo->prepare("SELECT id FROM categorias WHERE LOWER(nombre) = LOWER(?) AND id != ?");
                $dupStmt->execute([$nombre, $id]);
                if ($dupStmt->fetch()) {
                    $fieldErrors['nombre'] = 'Ya existe otra categoríƒÂ­a con ese nombre';
                } else {
                    $updates[] = 'nombre = ?';
                    $values[] = $nombre;
                }
            }
        }

        if (isset($input['slug'])) {
            $slug = trim($input['slug']);
            if (!empty($slug)) {
                $dupSlug = $pdo->prepare("SELECT id FROM categorias WHERE slug = ? AND id != ?");
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

        if (isset($input['icono'])) {
            $updates[] = 'icono = ?';
            $values[] = trim($input['icono']);
        }

        if (isset($input['color'])) {
            $updates[] = 'color = ?';
            $values[] = trim($input['color']);
        }

        if (isset($input['orden'])) {
            $updates[] = 'orden = ?';
            $values[] = intval($input['orden']);
        }

        if (isset($input['activa'])) {
            $updates[] = 'activa = ?';
            $values[] = (int)$input['activa'];
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
        $sql = "UPDATE categorias SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        $getStmt = $pdo->prepare("SELECT * FROM categorias WHERE id = ?");
        $getStmt->execute([$id]);
        $categoria = $getStmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'message' => 'Actualizada',
            'categoria' => $categoria
        ]);
        exit;
    }

    // === DELETE ===
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no víƒÂ¡lido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT nombre, total_escorts FROM categorias WHERE id = ?");
        $checkStmt->execute([$id]);
        $categoria = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$categoria) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No encontrada']);
            exit;
        }

        if ($categoria['total_escorts'] > 0) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => "Tiene {$categoria['total_escorts']} escort(s) asociada(s)"
            ]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM categorias WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Eliminada']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);
} catch (PDOException $e) {
    error_log("Error categorias.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error categorias.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

