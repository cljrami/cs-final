<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['success' => false, 'error' => 'Método no permitido']); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $escortId = isset($_GET['escort_id']) ? intval($_GET['escort_id']) : 0;
    $usuarioId = isset($_GET['usuario_id']) ? intval($_GET['usuario_id']) : 0;

    $pdo = getDBConnection();

    if ($escortId > 0) {
        $stmt = $pdo->prepare("
            SELECT c.id, c.comentario, c.puntuacion, c.cita_verificada, c.created_at, u.nombre as usuario_nombre
            FROM comentarios c
            JOIN usuarios u ON u.id = c.usuario_id
            WHERE c.escort_id = ? AND c.aprobado = 1
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$escortId]);
        $comentarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $promedio = 0;
        $total = count($comentarios);
        if ($total > 0) {
            $sum = array_sum(array_column($comentarios, 'puntuacion'));
            $promedio = round($sum / $total, 1);
        }

        echo json_encode([
            'success' => true,
            'comentarios' => array_map(function ($c) {
                return [
                    'id' => (int)$c['id'],
                    'comentario' => $c['comentario'],
                    'puntuacion' => $c['puntuacion'] ? (int)$c['puntuacion'] : null,
                    'cita_verificada' => (int)($c['cita_verificada'] ?? 0),
                    'usuario' => $c['usuario_nombre'],
                    'created_at' => $c['created_at'],
                ];
            }, $comentarios),
            'promedio' => $promedio,
            'total' => $total,
        ]);
    } elseif ($usuarioId > 0) {
        $stmt = $pdo->prepare("
            SELECT c.id, c.comentario, c.puntuacion, c.created_at,
                   COALESCE(e.nombre, 'Escort') as escort_nombre
            FROM comentarios c
            JOIN escorts e ON e.id = c.escort_id
            WHERE c.usuario_id = ?
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([$usuarioId]);
        $comentarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'comentarios' => $comentarios,
            'total' => count($comentarios),
        ]);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'escort_id o usuario_id requerido']);
    }
} catch (Throwable $e) {
    error_log("Error comentarios/listar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

