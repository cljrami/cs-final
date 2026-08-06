<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/admin/orientaciones.php

if (ob_get_level()) ob_end_clean();

// === AUTENTICACIÓN ===
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';

if (strpos($authHeader, 'Bearer ') !== 0) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'No autorizado']);
    exit;
}

$token = substr($authHeader, 7);
$tokenData = verifyToken($token);

if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Token expirado']);
    exit;
}

if (!isset($tokenData['rol']) || !in_array($tokenData['rol'], ['superadmin', 'admin', 'moderador'], true)) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'No tienes permisos']);
    exit;
}

$adminId = isset($tokenData['id']) ? intval($tokenData['id']) : 0;

try {
    require_once __DIR__ . '/../bootstrap.php';
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // ============================================
    // GET - LISTAR ORIENTACIONES
    // ============================================
    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 10;
        $offset = ($page - 1) * $limit;

        $stats = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM orientaciones_sexuales")->fetchColumn(),
            'activas' => (int)$pdo->query("SELECT COUNT(*) FROM orientaciones_sexuales WHERE activa = 1")->fetchColumn(),
            'inactivas' => (int)$pdo->query("SELECT COUNT(*) FROM orientaciones_sexuales WHERE activa = 0")->fetchColumn(),
        ];

        $where = [];
        $params = [];

        if ($search !== '') {
            $where[] = '(nombre LIKE :search1 OR descripcion LIKE :search2 OR slug LIKE :search3)';
            $params[':search1'] = '%' . $search . '%';
            $params[':search2'] = '%' . $search . '%';
            $params[':search3'] = '%' . $search . '%';
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $countSql = "SELECT COUNT(*) FROM orientaciones_sexuales $whereSql";
        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $key => $val) {
            $countStmt->bindValue($key, $val);
        }
        $countStmt->execute();
        $total = (int)$countStmt->fetchColumn();

        $sql = "SELECT id, nombre, slug, descripcion, orden, activa, created_at 
                FROM orientaciones_sexuales 
                $whereSql 
                ORDER BY orden ASC, nombre ASC 
                LIMIT :limit OFFSET :offset";

        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($data as &$row) {
            $row['id'] = (int)$row['id'];
            $row['orden'] = (int)$row['orden'];
            $row['activa'] = (int)$row['activa'];
        }

        header('Content-Type: application/json; charset=utf-8');
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
    // POST - CREAR ORIENTACIÓN
    // ============================================
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input)) {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
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
            $stmtDup = $pdo->prepare("SELECT id FROM orientaciones_sexuales WHERE nombre = ?");
            $stmtDup->execute([$nombre]);
            if ($stmtDup->fetch()) {
                $fieldErrors['nombre'] = 'Ya existe una orientación con ese nombre';
            }
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            header('Content-Type: application/json; charset=utf-8');
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

        $stmtLog = $pdo->prepare("
            INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address, user_agent)
            VALUES (?, 'crear_orientacion', 'orientaciones_sexuales', ?, ?, ?, ?)
        ");
        $stmtLog->execute([
            $adminId,
            $id,
            json_encode(['nombre' => $nombre, 'slug' => $slug, 'descripcion' => $descripcion, 'orden' => $orden]),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

        header('Content-Type: application/json; charset=utf-8');
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
    // PUT - ACTUALIZAR ORIENTACIÓN
    // ============================================
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input)) {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'Body inválido']);
            exit;
        }

        $id = isset($input['id']) ? intval($input['id']) : 0;
        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        $descripcion = isset($input['descripcion']) ? trim($input['descripcion']) : '';
        $orden = isset($input['orden']) ? intval($input['orden']) : 0;
        $activa = isset($input['activa']) ? (intval($input['activa']) ? 1 : 0) : null;

        $fieldErrors = [];

        if ($id <= 0) {
            $fieldErrors['id'] = 'ID inválido';
        }

        if (empty($nombre)) {
            $fieldErrors['nombre'] = 'El nombre es obligatorio';
        } elseif (strlen($nombre) > 100) {
            $fieldErrors['nombre'] = 'Máximo 100 caracteres';
        }

        if (empty($fieldErrors['nombre']) && $id > 0) {
            $stmtDup = $pdo->prepare("SELECT id FROM orientaciones_sexuales WHERE nombre = ? AND id != ?");
            $stmtDup->execute([$nombre, $id]);
            if ($stmtDup->fetch()) {
                $fieldErrors['nombre'] = 'Ya existe otra orientación con ese nombre';
            }
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'fieldErrors' => $fieldErrors,
                'error' => 'Por favor corrige los errores del formulario'
            ]);
            exit;
        }

        $stmtOld = $pdo->prepare("SELECT * FROM orientaciones_sexuales WHERE id = ?");
        $stmtOld->execute([$id]);
        $oldData = $stmtOld->fetch(PDO::FETCH_ASSOC);

        if (!$oldData) {
            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'Orientación no encontrada']);
            exit;
        }

        $slug = createSlug($nombre);
        $fields = [];
        $values = [];

        $fields[] = 'nombre = ?';
        $values[] = $nombre;
        $fields[] = 'slug = ?';
        $values[] = $slug;
        $fields[] = 'descripcion = ?';
        $values[] = $descripcion;
        $fields[] = 'orden = ?';
        $values[] = $orden;

        if ($activa !== null) {
            $fields[] = 'activa = ?';
            $values[] = $activa;
        }

        $values[] = $id;

        $sql = "UPDATE orientaciones_sexuales SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        $stmtLog = $pdo->prepare("
            INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, ip_address, user_agent)
            VALUES (?, 'actualizar_orientacion', 'orientaciones_sexuales', ?, ?, ?, ?, ?)
        ");
        $stmtLog->execute([
            $adminId,
            $id,
            json_encode($oldData),
            json_encode(['nombre' => $nombre, 'slug' => $slug, 'descripcion' => $descripcion, 'orden' => $orden, 'activa' => $activa]),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => true,
            'message' => 'Orientación actualizada correctamente'
        ]);
        exit;
    }

    // ============================================
    // DELETE - ELIMINAR ORIENTACIÓN
    // ============================================
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input)) {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'Body inválido']);
            exit;
        }

        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }

        $stmtOld = $pdo->prepare("SELECT * FROM orientaciones_sexuales WHERE id = ?");
        $stmtOld->execute([$id]);
        $oldData = $stmtOld->fetch(PDO::FETCH_ASSOC);

        if (!$oldData) {
            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'error' => 'Orientación no encontrada']);
            exit;
        }

        $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM escorts WHERE orientacion = ? AND orientacion IS NOT NULL AND orientacion != ''");
        $stmtCheck->execute([$oldData['nombre']]);
        $count = (int)$stmtCheck->fetchColumn();

        if ($count > 0) {
            http_response_code(400);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'error' => 'No se puede eliminar: hay ' . $count . ' escort(s) usando esta orientación'
            ]);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM orientaciones_sexuales WHERE id = ?");
        $stmt->execute([$id]);

        $stmtLog = $pdo->prepare("
            INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address, user_agent)
            VALUES (?, 'eliminar_orientacion', 'orientaciones_sexuales', ?, ?, ?, ?)
        ");
        $stmtLog->execute([
            $adminId,
            $id,
            json_encode($oldData),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => true,
            'message' => 'Orientación eliminada correctamente'
        ]);
        exit;
    }

    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error orientaciones.php PDO: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error orientaciones.php: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

function createSlug($text)
{
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', $text);
    return $text;
}
