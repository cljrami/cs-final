<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $pdo = getDBConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (strpos($_SERVER['REQUEST_URI'], '/read') !== false) {
            $auth = requireEscortAuth();
            $escortId = intval($auth['id']);
            $id = isset($input['id']) ? intval($input['id']) : 0;

            $stmt = $pdo->prepare("UPDATE notificaciones SET leida = 1 WHERE id = ? AND escort_id = ?");
            $stmt->execute([$id, $escortId]);
            echo json_encode(['success' => true]);
            exit;
        }

        requireAdminAuth();
        $escortId = isset($input['escort_id']) ? intval($input['escort_id']) : 0;
        $mensaje = isset($input['mensaje']) ? trim($input['mensaje']) : '';
        $tipo = isset($input['tipo']) ? $input['tipo'] : 'info';

        if ($escortId <= 0 || empty($mensaje)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'escort_id y mensaje requeridos']);
            exit;
        }

        if (!in_array($tipo, ['warning', 'info', 'success'])) {
            $tipo = 'info';
        }

        $stmt = $pdo->prepare("INSERT INTO notificaciones (escort_id, mensaje, tipo) VALUES (?, ?, ?)");
        $stmt->execute([$escortId, $mensaje, $tipo]);

        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $auth = requireEscortAuth();
        $escortId = intval($auth['id']);

        $stmt = $pdo->prepare("
            SELECT id, mensaje, tipo, leida, created_at
            FROM notificaciones
            WHERE escort_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        ");
        $stmt->execute([$escortId]);
        $notificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $noLeidas = array_filter($notificaciones, fn($n) => !$n['leida']);

        echo json_encode([
            'success' => true,
            'data' => $notificaciones,
            'no_leidas' => count($noLeidas)
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error notificaciones.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
