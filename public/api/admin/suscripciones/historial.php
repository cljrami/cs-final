<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../bootstrap.php';

$tokenData = requireAuth();


requireAdminRole($tokenData);

try {
    $db = getDBConnection();

    $pagina = max(1, intval($_GET['pagina'] ?? 1));
    $porPagina = 20;
    $offset = ($pagina - 1) * $porPagina;

    // Count
    $countStmt = $db->query("SELECT COUNT(*) as total FROM suscripciones_historial");
    $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Obtener historial
    $stmt = $db->prepare("
        SELECT 
            h.*,
            a.nombre as eliminado_por_nombre,
            ap.nombre as aprobado_por_nombre,
            r.nombre as rechazado_por_nombre
        FROM suscripciones_historial h
        LEFT JOIN admins a ON a.id = h.eliminado_por
        LEFT JOIN admins ap ON ap.id = h.aprobado_por
        LEFT JOIN admins r ON r.id = h.rechazado_por
        ORDER BY h.eliminado_en DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([$porPagina, $offset]);
    $historial = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'historial' => $historial,
        'paginacion' => [
            'pagina' => $pagina,
            'por_pagina' => $porPagina,
            'total' => $total,
            'total_paginas' => ceil($total / $porPagina)
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error del servidor']);
}
