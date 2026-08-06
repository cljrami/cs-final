<?php
// public/api/stats.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = getDBConnection();

    $activas = (int) $pdo->query("SELECT COUNT(*) FROM escorts WHERE activa = 1 AND eliminada = 0 AND estado = 'aprobada'")->fetchColumn();

    $ciudades = (int) $pdo->query("SELECT COUNT(DISTINCT ciudad) FROM escorts WHERE activa = 1 AND eliminada = 0 AND estado = 'aprobada' AND ciudad != ''")->fetchColumn();

    $verificadas = (int) $pdo->query("SELECT COUNT(*) FROM escorts WHERE activa = 1 AND eliminada = 0 AND estado = 'aprobada' AND verificado = 1")->fetchColumn();

    $valoraciones = (int) $pdo->query("SELECT COUNT(*) FROM comentarios WHERE aprobado = 1")->fetchColumn();

    echo json_encode([
        'success' => true,
        'data' => [
            'escorts' => $activas,
            'ciudades' => $ciudades,
            'verificadas' => $verificadas,
            'valoraciones' => $valoraciones,
        ],
    ]);
} catch (Throwable $e) {
    error_log("Error stats.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
