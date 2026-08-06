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
    $escortId = isset($_GET['escort_id']) ? intval($_GET['escort_id']) : 0;
    $usuarioId = isset($_GET['usuario_id']) ? intval($_GET['usuario_id']) : ($tokenData['id'] ?? 0);

    if ($escortId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Escort ID requerido']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT id, general, aprobado
        FROM valoraciones
        WHERE escort_id = ? AND usuario_id = ?
        LIMIT 1
    ");
    $stmt->execute([$escortId, $usuarioId]);
    $rating = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($rating) {
        echo json_encode([
            'success' => true,
            'hasRated' => true,
            'rating' => (int)$rating['general'],
            'aprobado' => (int)$rating['aprobado']
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'hasRated' => false,
            'rating' => 0
        ]);
    }
} catch (Throwable $e) {
    error_log("Error rating-check.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}