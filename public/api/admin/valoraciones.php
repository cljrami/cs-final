<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    $rol = $tokenData['rol'] ?? '';
    if (!in_array($rol, ['superadmin', 'admin', 'moderador'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $stmt = $pdo->prepare("
            SELECT v.id, v.general, v.comentario, v.aprobado, v.created_at,
                   e.nombre as escort_nombre, u.nombre as usuario_nombre
            FROM valoraciones v
            JOIN escorts e ON e.id = v.escort_id
            JOIN usuarios u ON u.id = v.usuario_id
            ORDER BY v.created_at DESC
        ");
        $stmt->execute();
        $valoraciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $valoraciones,
            'total' => count($valoraciones),
        ]);
        exit;
    }

    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if ($id <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID requerido']); exit; }

        $stmt = $pdo->prepare("DELETE FROM valoraciones WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Valoración eliminada']);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);
        $aprobado = isset($input['aprobado']) ? intval($input['aprobado']) : null;

        if ($id <= 0) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'ID requerido']); exit; }

        if ($aprobado !== null) {
            $stmt = $pdo->prepare("UPDATE valoraciones SET aprobado = ? WHERE id = ?");
            $stmt->execute([$aprobado, $id]);
        }

        echo json_encode(['success' => true, 'message' => 'Valoración actualizada']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error admin/valoraciones.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
