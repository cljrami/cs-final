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
    // Eliminación definitiva completa con datos relacionados
    $tables = [
        'pagos', 'suscripciones', 'escort_vip_solicitudes', 'verificaciones',
        'reportes', 'planes_usados', 'historial_pausas', 'suscripciones_historial',
        'estadisticas_diarias', 'servicios', 'valoraciones',
        'escort_fotos', 'escort_historias', 'escort_idiomas', 'escort_servicios',
        'favoritos', 'comentarios', 'notificaciones', 'codigos_verificacion',
        'sticky_posiciones', 'banners'
    ];
    foreach ($tables as $t) {
        try { $pdo->prepare("DELETE FROM `{$t}` WHERE escort_id = ?")->execute([$id]); } catch (PDOException $e) { error_log("desactivar table {$t}: " . $e->getMessage()); }
    }
    $stmt = $pdo->prepare("DELETE FROM escorts WHERE id = ?");
    $stmt->execute([$id]);
    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Escort eliminada definitivamente']);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error escort-desactivar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
}
