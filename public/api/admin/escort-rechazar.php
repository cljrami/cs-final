<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../mail.php';

$tokenData = requireAuth();


requireAdminRole($tokenData);

$input = json_decode(file_get_contents('php://input'), true);
$id = intval($input['id'] ?? 0);
$motivo = trim($input['motivo'] ?? '');

if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID requerido']);
    exit;
}

try {
    $pdo = getDBConnection();

    $stmt = $pdo->prepare("UPDATE escorts SET activa = -1, estado = 'rechazada' WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    // Notificar a la escort
    $pdo->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at)
        VALUES (?, 'cuenta_rechazada', 'Cuenta Rechazada', ?, '/micuenta/perfil', NOW())
    ")->execute([$id, $motivo]);

    // Notificar a administradores
    $datos = $pdo->prepare("SELECT nombre, foto_principal FROM escorts WHERE id = ?");
    $datos->execute([$id]);
    $fila = $datos->fetch(PDO::FETCH_ASSOC);
    $nombre = $fila['nombre'] ?? "ID {$id}";
    $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, actor_foto, escort_id) VALUES (NULL, 'cuenta_rechazada', 'Cuenta Rechazada', ?, '/admin/escorts', ?, ?)")
        ->execute(["{$nombre} (ID {$id}) ha sido rechazada. Motivo: {$motivo}", $fila['foto_principal'] ?? null, $id]);

    // Enviar email
    sendCuentaRechazada($id, $motivo);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    error_log("escort-rechazar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
}
