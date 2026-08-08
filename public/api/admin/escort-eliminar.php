<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

$tokenData = requireAuth();


requireAdminRole($tokenData);

$input = json_decode(file_get_contents('php://input'), true);
$id = intval($input['id'] ?? 0);

if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID requerido']);
    exit;
}

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();

    // Verificar que la escort existe
    $check = $pdo->prepare("SELECT id, nombre, email, activa, estado FROM escorts WHERE id = ?");
    $check->execute([$id]);
    $escort = $check->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    // Soft delete: la escort pasa a la papelera conservando todos sus datos
    $stmt = $pdo->prepare("UPDATE escorts SET eliminada = 1, activa = 0, estado = 'eliminada', updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);

    // Cancelar suscripciones activas o pendientes: la escort eliminada no puede
    // mantener planes vigentes (al reactivar deberá contratar un plan base nuevo)
    $pdo->prepare("UPDATE suscripciones SET estado = 'cancelada', actualizado_en = NOW() WHERE escort_id = ? AND estado IN ('activa', 'pendiente_aprobacion')")->execute([$id]);

    // Limpiar posiciones sticky de la escort eliminada
    $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$id]);

    // Log de auditoria
    $pdo->prepare("
        INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address)
        VALUES (?, ?, 'eliminar_escort', 'escorts', ?, ?, ?)
    ")->execute([
        $tokenData['id'],
        $id,
        $id,
        json_encode($escort),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    // Notificar a administradores
    $pdo->prepare("
        INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id)
        VALUES (NULL, 'sistema', 'Escort eliminada', ?, '/admin/escorts?estado=papelera', ?)
    ")->execute([
        "{$escort['nombre']} (ID {$id}) fue enviada a la papelera.",
        $id
    ]);

    $pdo->commit();

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error escort-eliminar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
}
