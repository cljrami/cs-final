<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['success' => false, 'error' => 'Método no permitido']); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    $usuarioId = intval($tokenData['id'] ?? 0);
    if ($usuarioId <= 0) { http_response_code(401); echo json_encode(['success' => false, 'error' => 'No autorizado']); exit; }

    $input = json_decode(file_get_contents('php://input'), true);
    $escortId = intval($input['escort_id'] ?? 0);
    $comentario = trim($input['comentario'] ?? '');
    $puntuacion = isset($input['puntuacion']) ? intval($input['puntuacion']) : null;

    $errors = [];
    if ($escortId <= 0) $errors['escort_id'] = 'Escort requerida';
    if (empty($comentario)) $errors['comentario'] = 'El comentario no puede estar vacío';
    if (strlen($comentario) < 10) $errors['comentario'] = 'El comentario debe tener al menos 10 caracteres';
    if (strlen($comentario) > 2000) $errors['comentario'] = 'El comentario no puede exceder 2000 caracteres';
    if ($puntuacion !== null && ($puntuacion < 1 || $puntuacion > 5)) $errors['puntuacion'] = 'Puntuación debe ser entre 1 y 5';

    if (!empty($errors)) { http_response_code(422); echo json_encode(['success' => false, 'fieldErrors' => $errors]); exit; }

    $pdo = getDBConnection();

    $stmt = $pdo->prepare("SELECT id FROM escorts WHERE id = ? AND activa = 1");
    $stmt->execute([$escortId]);
    if (!$stmt->fetch()) { http_response_code(404); echo json_encode(['success' => false, 'error' => 'Escort no encontrada']); exit; }

    $stmt = $pdo->prepare("SELECT id FROM comentarios WHERE escort_id = ? AND usuario_id = ?");
    $stmt->execute([$escortId, $usuarioId]);
    if ($stmt->fetch()) { http_response_code(409); echo json_encode(['success' => false, 'error' => 'Ya has comentado en esta escort']); exit; }

    $stmt = $pdo->prepare("INSERT INTO comentarios (escort_id, usuario_id, comentario, puntuacion, aprobado, created_at) VALUES (?, ?, ?, ?, 0, NOW())");
    $stmt->execute([$escortId, $usuarioId, $comentario, $puntuacion]);
    $id = $pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'comentario' => [
            'id' => (int)$id,
            'mensaje' => 'Comentario enviado. Será revisado antes de publicarse.'
        ]
    ]);
} catch (Throwable $e) {
    error_log("Error comentarios/crear.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
