<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

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
    $pdo = getDBConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    $escortId = isset($input['escort_id']) ? intval($input['escort_id']) : 0;
    $tipo = isset($input['tipo']) ? $input['tipo'] : 'whatsapp';

    if ($escortId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'escort_id requerido']);
        exit;
    }

    if (!in_array($tipo, ['whatsapp', 'llamar'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'tipo debe ser whatsapp o llamar']);
        exit;
    }

    // Rate limiting: max 5 per escort per minute, max 50 per IP per hour
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    try {
        // Check per-escort rate limit (5 per minute)
        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM rate_limits
            WHERE ip = ? AND endpoint = CONCAT('escort_', ?) AND contador >= 5
            AND ventana_inicio >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        ");
        $stmt->execute([$ip, $escortId]);
        if ($stmt->fetchColumn() > 0) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Demasiadas solicitudes. Inténtalo más tarde.']);
            exit;
        }

        // Check per-IP rate limit (50 per hour)
        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM rate_limits
            WHERE ip = ? AND endpoint = 'contacto_ip'
            AND ventana_inicio >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ");
        $stmt->execute([$ip]);
        if ($stmt->fetchColumn() >= 50) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Límite de contactos alcanzado. Inténtalo más tarde.']);
            exit;
        }

        // Record the request
        $stmt = $pdo->prepare("
            INSERT INTO rate_limits (ip, endpoint, contador, ventana_inicio)
            VALUES (?, CONCAT('escort_', ?), 1, NOW())
            ON DUPLICATE KEY UPDATE
                contador = contador + 1,
                ventana_inicio = IF(ventana_inicio < DATE_SUB(NOW(), INTERVAL 1 MINUTE), NOW(), ventana_inicio)
        ");
        $stmt->execute([$ip, $escortId]);

        $stmt = $pdo->prepare("
            INSERT INTO rate_limits (ip, endpoint, contador, ventana_inicio)
            VALUES (?, 'contacto_ip', 1, NOW())
            ON DUPLICATE KEY UPDATE contador = contador + 1
        ");
        $stmt->execute([$ip]);
    } catch (Throwable $e) {
        // Rate limiting is not critical, continue
    }

    $check = $pdo->prepare("SELECT id FROM escorts WHERE id = ? AND activa = 1");
    $check->execute([$escortId]);
    if (!$check->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    // Incrementar contador específico en escorts
    $col = $tipo === 'whatsapp' ? 'contactos_whatsapp' : 'contactos_llamar';
    try {
        $stmt = $pdo->prepare("UPDATE escorts SET {$col} = {$col} + 1 WHERE id = ?");
        $stmt->execute([$escortId]);
    } catch (Throwable $e) {
        // columna no existe - ignorar
    }

    // Actualizar estadisticas_diarias
    try {
        $colDiaria = $tipo === 'whatsapp' ? 'contactos_whatsapp' : 'contactos_llamar';
        $pdo->prepare("
            INSERT INTO estadisticas_diarias (escort_id, fecha, {$colDiaria})
            VALUES (?, CURDATE(), 1)
            ON DUPLICATE KEY UPDATE {$colDiaria} = {$colDiaria} + 1
        ")->execute([$escortId]);
    } catch (Throwable $e) {
        // columna no existe - ignorar
    }

    echo json_encode(['success' => true]);
    exit;
} catch (Throwable $e) {
    error_log("Error tracking/contacto.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
