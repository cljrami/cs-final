<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

try {
    requireAdminAuth();

    $pdo = getDBConnection();
    $summary = [
        'cache_files_removed' => 0,
        'stats_rows_pruned' => 0,
        'errors' => []
    ];

    // Clean cache files older than 7 days
    $cacheDir = __DIR__ . '/../../cache';
    if (is_dir($cacheDir)) {
        $cacheFiles = glob($cacheDir . '/*');
        $cutoff = time() - (7 * 24 * 60 * 60);
        foreach ($cacheFiles as $file) {
            if (is_file($file) && filemtime($file) < $cutoff) {
                if (unlink($file)) {
                    $summary['cache_files_removed']++;
                }
            }
        }
    }

    // Prune estadisticas_diarias older than 90 days
    try {
        $stmt = $pdo->prepare("DELETE FROM estadisticas_diarias WHERE fecha < DATE_SUB(CURDATE(), INTERVAL 90 DAY)");
        $stmt->execute();
        $summary['stats_rows_pruned'] = $stmt->rowCount();
    } catch (Throwable $e) {
        $summary['errors'][] = 'stats prune: ' . $e->getMessage();
    }

    echo json_encode(['success' => true, 'data' => $summary]);
} catch (Throwable $e) {
    error_log("Error cleanup.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
