<?php
// public/api/escort/gira-conflictos.php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    require_once __DIR__ . '/../lib/gira.php';

    $tokenData = requireEscortAuth();
    $escortId = intval($tokenData['id'] ?? 0);
    if ($escortId <= 0) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }

    $inicio = $_GET['inicio'] ?? '';
    $fin = $_GET['fin'] ?? '';

    if (!$inicio || !$fin) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Fechas requeridas']);
        exit;
    }

    $pdo = getDBConnection();

    // Buscar giras previas (activas, vencidas recientemente, o pendientes)
    // que solapen con el rango solicitado
    $conflictos = $pdo->prepare("
        SELECT
            e.id,
            e.nombre,
            gc.nombre AS ciudad_destino,
            e.gira_fecha_inicio,
            e.gira_fecha_fin,
            e.gira_fecha_inicio AS fecha_inicio,
            e.gira_fecha_fin AS fecha_fin
        FROM escorts e
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE e.id = ?
          AND e.en_gira = 1
          AND e.eliminada = 0
          -- Solapamiento: [inicio, fin] vs [gira_inicio, gira_fin]
          AND (
            (e.gira_fecha_inicio <= ? AND e.gira_fecha_fin >= ?)
            OR (e.gira_fecha_inicio <= ? AND e.gira_fecha_fin >= ?)
            OR (e.gira_fecha_inicio >= ? AND e.gira_fecha_fin <= ?)
          )
        ORDER BY e.gira_fecha_inicio ASC
    ");
    $conflictos->execute([
        $escortId,
        $fin, $inicio,  // caso: nueva gira dentro de gira existente
        $inicio, $fin,  // caso: gira existente dentro de nueva gira
        $inicio, $fin   // caso: nueva gira totalmente dentro
    ]);
    $rows = $conflictos->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($rows)) {
        $conflictosData = array_map(function($r) {
            return [
                'ciudad' => $r['ciudad_destino'],
                'fecha_inicio' => $r['fecha_inicio'],
                'fecha_fin' => $r['fecha_fin'],
                'dias' => max(1, (strtotime($r['fecha_fin']) - strtotime($r['fecha_inicio'])) / 86400 + 1),
            ];
        }, $rows);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'tiene_conflictos' => true,
            'conflictos' => $conflictosData
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'tiene_conflictos' => false
        ]);
    }

} catch (Throwable $e) {
    error_log("Error gira-conflictos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
