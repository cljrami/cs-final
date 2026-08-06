<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/gira.php';

try {
    $db = getDBConnection();

    limpiar_gira_vencida($db);

    $stmt = $db->prepare("
        SELECT e.id, e.nombre, e.slug, e.edad,
               COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
               e.vip, e.verificado,
               gc.nombre AS gira_ciudad,
               e.gira_fecha_inicio, e.gira_fecha_fin
        FROM escorts e
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE e.en_gira = 1
          AND (e.gira_fecha_inicio IS NULL OR e.gira_fecha_inicio <= CURDATE())
          AND (e.gira_fecha_fin IS NULL OR e.gira_fecha_fin >= CURDATE())
          AND e.eliminada = 0
        ORDER BY e.vip DESC, e.verificado DESC, e.nombre ASC
    ");
    $stmt->execute();
    $escorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalConGira = 0;
    $activaStatus = [];
    try {
        $cnt = $db->query("SELECT COUNT(*) FROM escorts WHERE en_gira = 1 AND (gira_fecha_fin IS NULL OR gira_fecha_fin >= CURDATE()) AND eliminada = 0");
        $totalConGira = (int)$cnt->fetchColumn();
        $act = $db->query("SELECT activa, COUNT(*) as c FROM escorts WHERE en_gira = 1 AND (gira_fecha_fin IS NULL OR gira_fecha_fin >= CURDATE()) AND eliminada = 0 GROUP BY activa");
        while ($row = $act->fetch(PDO::FETCH_ASSOC)) {
            $activaStatus[] = 'activa=' . $row['activa'] . ': ' . $row['c'];
        }
    } catch (Throwable $ignore) {}

    echo json_encode([
        'success' => true,
        'escorts' => $escorts,
        'debug' => [
            'total_con_gira' => $totalConGira,
            'activa_status' => implode(', ', $activaStatus)
        ]
    ]);
} catch (Throwable $e) {
    error_log("Error escorts/gira-activas.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
