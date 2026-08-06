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

    // Verificar que la escort está en la papelera
    $check = $pdo->prepare("SELECT id, nombre, email, activa, estado, eliminada FROM escorts WHERE id = ?");
    $check->execute([$id]);
    $escort = $check->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    if ((int)$escort['eliminada'] !== 1) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'La escort no está en la papelera']);
        exit;
    }

    // Restaurar: sacar de la papelera conservando todos sus datos
    $stmt = $pdo->prepare("UPDATE escorts SET eliminada = 0, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);

    // Log de auditoria
    $pdo->prepare("
        INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
        VALUES (?, ?, 'restaurar_escort', 'escorts', ?, ?, ?)
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
        VALUES (NULL, 'sistema', 'Escort restaurada', ?, '/admin/escorts', ?)
    ")->execute([
        "{$escort['nombre']} (ID {$id}) fue restaurada desde la papelera.",
        $id
    ]);

    $pdo->commit();

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error escort-restaurar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
}
