<?php
require_once __DIR__.'/../bootstrap.php';
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
                    c.id,
                    c.puntuacion as general,
                    c.comentario,
                    c.usuario_id,
                    c.aprobado,
                    c.cita_verificada,
                    c.created_at as fecha,
                    COALESCE(u.nombre, 'Anónimo') as usuario_nombre
                FROM comentarios c
                LEFT JOIN usuarios u ON u.id = c.usuario_id
                WHERE c.escort_id = ? AND c.aprobado = 1
                ORDER BY c.created_at DESC
            ");
            $stmt->execute([$escortId]);
            $valoraciones = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $stmtPromedio = $pdo->prepare("SELECT AVG(puntuacion) as promedio, COUNT(*) as total FROM comentarios WHERE escort_id = ? AND aprobado = 1");
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
                    c.id,
                    c.puntuacion as general,
                    c.comentario,
                    c.created_at as fecha,
                    COALESCE(e.nombre, 'Escort') as escort_nombre,
                    COALESCE(NULLIF(e.foto_principal, ''), pf.url) as escort_foto
                FROM comentarios c
                JOIN escorts e ON e.id = c.escort_id
                LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
                WHERE c.usuario_id = ?
                ORDER BY c.created_at DESC
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
        $codigoVerificacion = trim(strtoupper($input['codigo_verificacion'] ?? ''));

        if ($escortId <= 0 || $general < 0 || $general > 5) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
            exit;
        }

        $check = $pdo->prepare("SELECT id FROM escorts WHERE id = ? AND activa = 1");
        $check->execute([$escortId]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
            exit;
        }

        if ($general === 0 && empty($comentario)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Debes agregar una calificación y/o un comentario']);
            exit;
        }

        if (empty($codigoVerificacion)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Se requiere el código de verificación entregado por la escort']);
            exit;
        }

        $codeStmt = $pdo->prepare("
            SELECT id FROM codigos_verificacion
            WHERE escort_id = ? AND codigo = ? AND usado = 0 AND expira_en >= NOW()
        ");
        $codeStmt->execute([$escortId, $codigoVerificacion]);
        $codeRow = $codeStmt->fetch();
        if (!$codeRow) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Código de verificación inválido o expirado. Pídelo a la escort.']);
            exit;
        }

        $pdo->prepare("UPDATE codigos_verificacion SET usado = 1, usado_por = ?, usado_en = NOW() WHERE id = ?")
            ->execute([$usuarioId, $codeRow['id']]);

        $aprobado = 0;
        $citaVerificada = 1;

        $stmt = $pdo->prepare("INSERT INTO comentarios (escort_id, usuario_id, puntuacion, comentario, aprobado, cita_verificada) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$escortId, $usuarioId, $general > 0 ? $general : null, $comentario, $aprobado, $citaVerificada]);

        $escortStmt = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
        $escortStmt->execute([$escortId]);
        $nombreEscort = $escortStmt->fetchColumn() ?: 'Escort';

        require_once __DIR__ . '/../mail.php';
        notificarAccionUsuario('comentarios', $usuarioId, 'Nueva valoración para ' . $nombreEscort, [
            'Escort' => $nombreEscort . ' (ID ' . $escortId . ')',
            'Puntuación' => $general > 0 ? str_repeat('★', $general) : 'Sin puntuación',
            'Comentario' => $comentario ?: '—',
        ]);

        $msg = 'Valoración enviada. Será revisada por un administrador antes de publicarse.';

        echo json_encode([
            'success' => true,
            'message' => $msg,
            'cita_verificada' => $citaVerificada,
        ]);
        exit;
    }
    
    if ($method === 'DELETE') {
        $auth = requireAuth();
        // Allow both regular users and escorts to delete
        if ($auth['tipo'] !== 'usuario' && $auth['tipo'] !== 'escort') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Solo usuarios o escorts pueden eliminar valoraciones']);
            exit;
        }
        $usuarioId = (int)$auth['id'];
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }
        // For escorts, check that comment belongs to their profile
        // For regular users, check that comment belongs to them
        $check = $pdo->prepare("SELECT id FROM comentarios WHERE id = ? AND (usuario_id = ? OR escort_id = ?)");
        $check->execute([$id, $usuarioId, $usuarioId]);
        if (!$check->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Valoración no encontrada o no pertenece al usuario']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM comentarios WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Valoración eliminada']);
        exit;
    }
    
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error valorar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
