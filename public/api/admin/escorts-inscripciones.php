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
    $pdo = getDBConnection();

    // Contar escorts inscritas por díƒÂ­a en los íƒÂºltimos 7 díƒÂ­as
    $stmt = $pdo->prepare("
        SELECT 
            DATE(created_at) as fecha,
            COUNT(*) as cantidad
        FROM escorts 
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND eliminada = 0
        GROUP BY DATE(created_at)
        ORDER BY fecha ASC
    ");
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Crear array con los 7 díƒÂ­as (incluyendo los que tienen 0 inscripciones)
    $data = [];
    $diasSemana = ['Dom', 'Lun', 'Mar', 'MiíƒÂ©', 'Jue', 'Vie', 'SíƒÂ¡b'];

    for ($i = 6; $i >= 0; $i--) {
        $fecha = date('Y-m-d', strtotime("-$i days"));
        $diaNombre = $diasSemana[date('w', strtotime($fecha))];

        $cantidad = 0;
        foreach ($results as $row) {
            if ($row['fecha'] === $fecha) {
                $cantidad = (int)$row['cantidad'];
                break;
            }
        }

        $data[] = [
            'fecha' => $fecha,
            'dia' => $diaNombre,
            'cantidad' => $cantidad
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => $data
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error de base de datos']);
}

