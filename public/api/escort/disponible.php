<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();
    $auth = requireEscortAuth();
    $escortId = (int)$auth['id'];

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare("SELECT disponible_ahora FROM escorts WHERE id = ?");
        $stmt->execute([$escortId]);
        $val = (int)$stmt->fetchColumn();
        echo json_encode(['success' => true, 'disponible_ahora' => $val]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $nuevo = !empty($input['disponible_ahora']) ? 1 : 0;

        $stmt = $pdo->prepare("UPDATE escorts SET disponible_ahora = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$nuevo, $escortId]);

        require_once __DIR__ . '/../mail.php';
        notificarAccionEscort('disponibilidad', $escortId, $nuevo ? 'Escort se marcó disponible ahora' : 'Escort se marcó no disponible', [
            'Disponible ahora' => $nuevo ? 'Sí' : 'No',
        ]);

        $pdo->prepare("INSERT INTO logs_auditoria (escort_id, accion, tabla_afectada, datos_nuevos, ip_address, user_agent, created_at) VALUES (?, 'disponibilidad', 'escorts', ?, ?, ?, NOW())")
            ->execute([
                $escortId,
                json_encode(['disponible' => $nuevo]),
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null
            ]);

        echo json_encode(['success' => true, 'disponible_ahora' => $nuevo]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error disponible.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
