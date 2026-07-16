<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    $tokenData = requireAuth();
    $usuarioId = (int)$tokenData['id'];

    $pdo = getDBConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $escortId = isset($input['escort_id']) ? intval($input['escort_id']) : 0;
        if ($escortId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de escort requerido']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM favoritos WHERE usuario_id = ? AND escort_id = ?");
        $stmt->execute([$usuarioId, $escortId]);
        echo json_encode(['success' => true]);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT 
            e.id, e.nombre, e.foto_principal, e.ciudad, e.edad, e.vip, e.verificado,
            e.rating, e.total_valoraciones,
            (SELECT COUNT(*) FROM favoritos f2 WHERE f2.escort_id = e.id) as likes
        FROM favoritos f
        JOIN escorts e ON e.id = f.escort_id
        WHERE f.usuario_id = ? AND e.eliminada = 0
        ORDER BY f.created_at DESC
    ");
    $stmt->execute([$usuarioId]);
    $favoritos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $resultado = array_map(function ($e) {
        return [
            'id' => (int)$e['id'],
            'nombre' => $e['nombre'],
            'foto_principal' => $e['foto_principal']
                ? '/api/serve-upload.php?path=/' . ltrim($e['foto_principal'], '/')
                : null,
            'ciudad' => $e['ciudad'],
            'edad' => (int)$e['edad'],
            'vip' => (int)$e['vip'],
            'verificado' => (bool)$e['verificado'],
            'rating' => $e['rating'],
            'total_valoraciones' => (int)$e['total_valoraciones'],
            'likes' => (int)$e['likes'],
        ];
    }, $favoritos);

    echo json_encode(['success' => true, 'favoritos' => $resultado]);
} catch (Throwable $e) {
    error_log("Error favoritos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
