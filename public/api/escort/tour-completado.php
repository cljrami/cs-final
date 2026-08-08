<?php
// public_html/api/escort/tour-completado.php
// Marca el tour guiado del panel como visto (primer_login ya se usa para el onboarding de plan).

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (substr($authHeader, 0, 7) !== 'Bearer ') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    // Guard compatible si la columna aún no existe
    $colStmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'tour_completado'
    ");
    $colStmt->execute();
    $tieneColumna = (int)$colStmt->fetchColumn() > 0;

    if ($tieneColumna) {
        $stmt = $pdo->prepare("UPDATE escorts SET tour_completado = 1 WHERE id = ?");
        $stmt->execute([$tokenData['id']]);
    }

    echo json_encode(['success' => true, 'tour_completado' => $tieneColumna ? 1 : 0]);
} catch (Throwable $e) {
    error_log("Error tour-completado.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
