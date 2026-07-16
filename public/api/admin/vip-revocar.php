<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    $adminId = intval($tokenData['id'] ?? 0);
    $adminRol = $tokenData['rol'] ?? '';
    if ($adminId <= 0 || !in_array($adminRol, ['superadmin', 'admin', 'moderador'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }

    $pdo = getDBConnection();

    $input = json_decode(file_get_contents('php://input'), true);
    $escortId = intval($input['escort_id'] ?? 0);

    if ($escortId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID de escort inválido']);
        exit;
    }

    // Verificar que la escort tenga VIP activo
    $check = $pdo->prepare("SELECT id, nombre, vip, fecha_vip_expira FROM escorts WHERE id = ?");
    $check->execute([$escortId]);
    $escort = $check->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    if (!$escort['vip']) {
        echo json_encode(['success' => true, 'message' => 'La escort ya no tiene VIP activo']);
        exit;
    }

    $pdo->beginTransaction();

    // Revocar VIP
    $pdo->prepare("UPDATE escorts SET vip = 0, fecha_vip_expira = NULL WHERE id = ?")
        ->execute([$escortId]);

    // Marcar como rechazadas las solicitudes pendientes/aprobadas
    $pdo->prepare("
        UPDATE escort_vip_solicitudes 
        SET estado = 'rechazado', 
            admin_notas = 'VIP revocado por administrador', 
            fecha_respuesta = NOW(), 
            revisado_por = ?
        WHERE escort_id = ? AND estado IN ('enviado', 'en_revision', 'aprobado')
    ")->execute([$adminId, $escortId]);

    // Notificar a la escort
    $pdo->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) 
        VALUES (?, 'sistema', 'VIP Revocado', 'Tu badge VIP ha sido revocado por un administrador.', '/micuenta/vip', NOW())
    ")->execute([$escortId]);

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'VIP revocado correctamente']);
} catch (PDOException $e) {
    error_log("Error vip-revocar.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Error vip-revocar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno del servidor']);
}
