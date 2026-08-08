<?php
ini_set('display_errors', 0);
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $tokenData = requireEscortAuth();

    $pdo = getDBConnection();
    $colStmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'tour_completado'
    ");
    $colStmt->execute();
    $tieneColumna = (int)$colStmt->fetchColumn() > 0;

    $tourCompletado = 0;
    if ($tieneColumna) {
        $tourStmt = $pdo->prepare("SELECT tour_completado FROM escorts WHERE id = ?");
        $tourStmt->execute([$tokenData['id']]);
        $tourCompletado = (int)$tourStmt->fetchColumn();
    }

    echo json_encode([
        'success' => true,
        'id' => $tokenData['id'],
        'usuario' => $tokenData['usuario'],
        'primer_login' => $tokenData['primer_login'] ?? 0,
        'tour_completado' => $tourCompletado
    ]);
} catch (Throwable $e) {
    error_log("Error verificar-sesion.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
