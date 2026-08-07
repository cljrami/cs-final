<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    $tokenData = requireAuth();
    $adminId = intval($tokenData['id'] ?? 0);
    $adminRol = $tokenData['rol'] ?? '';
    if ($adminId <= 0 || !in_array($adminRol, ['superadmin', 'admin', 'moderador'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        $accion = $input['accion'] ?? '';
        $motivo = trim($input['motivo'] ?? '');
        if ($id <= 0 || !in_array($accion, ['aprobar', 'rechazar'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
            exit;
        }
        $aprobado = $accion === 'aprobar' ? 1 : 0;
        $previo = $pdo->prepare("SELECT escort_id, usuario_id, comentario, aprobado FROM comentarios WHERE id = ?");
        $previo->execute([$id]);
        $row = $previo->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Comentario no encontrado']);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE comentarios SET aprobado = ? WHERE id = ?");
        $stmt->execute([$aprobado, $id]);

        // Auditoría
        require_once __DIR__ . '/../mail.php';
        $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, ip_address, user_agent, created_at) VALUES (?, ?, ?, 'comentarios', ?, ?, ?, ?, ?, NOW())")
            ->execute([
                $adminId,
                $row['escort_id'],
                $accion === 'aprobar' ? 'aprobar_comentario' : 'rechazar_comentario',
                $id,
                json_encode(['aprobado_previo' => $row['aprobado']]),
                json_encode(['aprobado' => $aprobado, 'motivo_rechazo' => $motivo !== '' ? $motivo : null]),
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
            ]);

        // Notificar al autor (usuario) cuando se rechaza, con motivo
        if ($accion === 'rechazar') {
            $mensaje = $motivo !== ''
                ? "Tu comentario fue rechazado: {$motivo}"
                : "Tu comentario fue rechazado por el moderador.";
            $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, created_at) VALUES (?, 'sistema', 'Comentario rechazado', ?, '/micuenta/comentarios', NOW())")
                ->execute([$row['usuario_id'], $mensaje]);
        }

        echo json_encode(['success' => true]);
        exit;
    }

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID requerido']); exit; }
        // Eliminar comentario: admin / superadmin solo
        requireAdminRole($tokenData, ['admin', 'superadmin']);

        $checkStmt = $pdo->prepare("SELECT id, escort_id FROM comentarios WHERE id = ?");
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Comentario no encontrado']);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM comentarios WHERE id = ?");
        $stmt->execute([$id]);

        $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, ip_address, user_agent, created_at) VALUES (?, ?, 'eliminar_comentario', 'comentarios', ?, ?, ?, NOW())")
            ->execute([
                $adminId,
                null,
                $id,
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
            ]);

        echo json_encode(['success' => true]);
        exit;
    }

    // GET: listar comentarios
    $search = trim($_GET['search'] ?? '');
    $estado = trim($_GET['estado'] ?? ''); // pendientes, aprobados, todos
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $perPage = 20;
    $offset = ($page - 1) * $perPage;

    $where = "WHERE 1=1";
    $params = [];

    if ($estado === 'pendientes') {
        $where .= " AND c.aprobado = 0";
    } elseif ($estado === 'aprobados') {
        $where .= " AND c.aprobado = 1";
    }

    if ($search !== '') {
        $where .= " AND (c.id LIKE ? OR c.escort_id LIKE ? OR c.comentario LIKE ? OR u.nombre LIKE ? OR e.nombre LIKE ?)";
        $s = "%{$search}%";
        $params[] = $s; $params[] = $s; $params[] = $s; $params[] = $s; $params[] = $s;
    }

    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM comentarios c LEFT JOIN usuarios u ON u.id = c.usuario_id LEFT JOIN escorts e ON e.id = c.escort_id $where");
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT c.id, c.comentario, c.puntuacion, c.aprobado, c.created_at,
               COALESCE(u.nombre, '(usuario eliminado)') as usuario_nombre,
               COALESCE(u.email, '') as usuario_email,
               COALESCE(e.nombre, '(escort eliminada)') as escort_nombre,
               e.id as escort_id
        FROM comentarios c
        LEFT JOIN usuarios u ON u.id = c.usuario_id
        LEFT JOIN escorts e ON e.id = c.escort_id
        $where
        ORDER BY c.created_at DESC
        LIMIT $perPage OFFSET $offset
    ");
    $stmt->execute($params);
    $comentarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Stats - usar LEFT JOIN para contar correctamente incluso si hay registros huerfanos
    $stmtPend = $pdo->query("SELECT COUNT(*) FROM comentarios c LEFT JOIN usuarios u ON u.id = c.usuario_id LEFT JOIN escorts e ON e.id = c.escort_id WHERE c.aprobado = 0");
    $pendientes = (int)$stmtPend->fetchColumn();
    $stmtAprob = $pdo->query("SELECT COUNT(*) FROM comentarios c LEFT JOIN usuarios u ON u.id = c.usuario_id LEFT JOIN escorts e ON e.id = c.escort_id WHERE c.aprobado = 1");
    $aprobados = (int)$stmtAprob->fetchColumn();

    echo json_encode([
        'success' => true,
        'comentarios' => array_map(function ($c) {
            return [
                'id' => (int)$c['id'],
                'comentario' => $c['comentario'],
                'puntuacion' => $c['puntuacion'] ? (int)$c['puntuacion'] : null,
                'aprobado' => (bool)$c['aprobado'],
                'usuario' => $c['usuario_nombre'],
                'usuario_email' => $c['usuario_email'],
                'escort' => $c['escort_nombre'],
                'escort_id' => (int)$c['escort_id'],
                'created_at' => $c['created_at'],
            ];
        }, $comentarios),
        'stats' => [
            'pendientes' => $pendientes,
            'aprobados' => $aprobados,
            'total' => $total,
        ],
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => max(1, ceil($total / $perPage)),
        ],
    ]);
} catch (Throwable $e) {
    error_log("Error admin/comentarios.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
