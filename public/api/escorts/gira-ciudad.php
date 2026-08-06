<?php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/gira.php';

try {
    $ciudad = trim($_GET['ciudad'] ?? '');
    if (!$ciudad) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parámetro ciudad requerido']);
        exit;
    }

    $pdo = getDBConnection();
    limpiar_gira_vencida($pdo);

    // Giras activas O próximas (inicio dentro de los próximos 3 días) hacia esta ciudad
    $stmt = $pdo->prepare("
        SELECT e.id, e.nombre, e.slug, e.edad,
               COALESCE(NULLIF(e.foto_principal, ''), pf.url) AS foto_principal,
               e.vip, e.verificado,
               gc.nombre AS gira_ciudad,
               e.gira_fecha_inicio, e.gira_fecha_fin,
               " . gira_activa() . " AS gira_activa
        FROM escorts e
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE e.en_gira = 1
          AND e.eliminada = 0
          AND gc.nombre = ?
          AND (e.gira_fecha_fin IS NULL OR e.gira_fecha_fin >= CURDATE())
          AND (e.gira_fecha_inicio IS NULL OR e.gira_fecha_inicio <= DATE_ADD(CURDATE(), INTERVAL 3 DAY))
        ORDER BY " . gira_activa() . " DESC, e.vip DESC, e.verificado DESC, e.gira_fecha_inicio ASC
    ");
    $stmt->execute([$ciudad]);
    $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'ciudad' => $ciudad,
        'data' => $escorts
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log("Error escorts/gira-ciudad.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
