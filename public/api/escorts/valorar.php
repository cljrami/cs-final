<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $escortId = isset($_GET['escort_id']) ? intval($_GET['escort_id']) : 0;
        $usuarioId = isset($_GET['usuario_id']) ? intval($_GET['usuario_id']) : 0;

        if ($escortId > 0) {
            $stmt = $pdo->prepare("
                SELECT
                    v.id,
                    v.general,
                    v.comentario,
                    v.anonimo,
                    v.created_at as fecha,
                    COALESCE(u.nombre, 'Anónimo') as usuario_nombre
                FROM valoraciones v
                LEFT JOIN usuarios u ON u.id = v.usuario_id AND v.anonimo = 0
                WHERE v.escort_id = ? AND v.aprobado = 1
                ORDER BY v.created_at DESC
            ");
            $stmt->execute([$escortId]);
            $valoraciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $stmtPromedio = $pdo->prepare("SELECT AVG(general) as promedio, COUNT(*) as total FROM valoraciones WHERE escort_id = ? AND aprobado = 1");
            $stmtPromedio->execute([$escortId]);
            $stats = $stmtPromedio->fetch(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'valoraciones' => $valoraciones,
                'promedio' => $stats['promedio'] ? round((float)$stats['promedio'], 1) : 0,
                'total' => (int)$stats['total'],
            ]);
        } elseif ($usuarioId > 0) {
            $stmt = $pdo->prepare("
                SELECT
                    v.id,
                    v.general,
                    v.comentario,
                    v.created_at as fecha,
                    COALESCE(e.nombre, 'Escort') as escort_nombre
                FROM valoraciones v
                JOIN escorts e ON e.id = v.escort_id
                WHERE v.usuario_id = ?
                ORDER BY v.created_at DESC
            ");
            $stmt->execute([$usuarioId]);
            $valoraciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'valoraciones' => $valoraciones,
            ]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'escort_id o usuario_id requerido']);
        }
        exit;
    }

    if ($method === 'POST') {
        $auth = requireAuth();
        if ($auth['tipo'] !== 'usuario') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Solo usuarios pueden valorar']);
            exit;
        }
        $usuarioId = (int)$auth['id'];

        $input = json_decode(file_get_contents('php://input'), true);
        $escortId = isset($input['escort_id']) ? intval($input['escort_id']) : 0;
        $general = isset($input['general']) ? intval($input['general']) : 0;
        $comentario = trim($input['comentario'] ?? '');
        $anonimo = !empty($input['anonimo']) ? 1 : 0;

        if ($escortId <= 0 || $general < 1 || $general > 5) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos. general debe ser 1-5']);
            exit;
        }

        $check = $pdo->prepare("SELECT id FROM escorts WHERE id = ? AND activa = 1");
        $check->execute([$escortId]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
            exit;
        }

        // Upsert: una valoración por usuario por escort
        $existing = $pdo->prepare("SELECT id FROM valoraciones WHERE usuario_id = ? AND escort_id = ?");
        $existing->execute([$usuarioId, $escortId]);
        $row = $existing->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $stmt = $pdo->prepare("UPDATE valoraciones SET general = ?, comentario = ?, anonimo = ?, aprobado = 0 WHERE id = ?");
            $stmt->execute([$general, $comentario, $anonimo, $row['id']]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO valoraciones (escort_id, usuario_id, general, comentario, anonimo) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$escortId, $usuarioId, $general, $comentario, $anonimo]);
        }

        // Recalcular rating del escort
        $stats = $pdo->prepare("SELECT AVG(general) as promedio, COUNT(*) as total FROM valoraciones WHERE escort_id = ? AND aprobado = 1");
        $stats->execute([$escortId]);
        $s = $stats->fetch(PDO::FETCH_ASSOC);

        $update = $pdo->prepare("UPDATE escorts SET rating = ?, total_valoraciones = ? WHERE id = ?");
        $update->execute([$s['promedio'] ?? 5.0, (int)$s['total'], $escortId]);

        echo json_encode([
            'success' => true,
            'message' => $row ? 'Valoración actualizada' : 'Valoración creada',
            'rating' => $s['promedio'] ? round((float)$s['promedio'], 1) : 5.0,
            'total_valoraciones' => (int)$s['total'],
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error valorar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
