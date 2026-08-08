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

function eliminarDirectorioRecursivo(string $ruta): void {
    if (!is_dir($ruta)) return;
    $items = scandir($ruta);
    if ($items === false) return;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $rutaItem = $ruta . DIRECTORY_SEPARATOR . $item;
        if (is_dir($rutaItem)) {
            eliminarDirectorioRecursivo($rutaItem);
        } else {
            @unlink($rutaItem);
        }
    }
    @rmdir($ruta);
}

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();

    // Verificar que la escort existe y está en la papelera
    $check = $pdo->prepare("SELECT id, nombre, email, activa, estado, eliminada, usuario, foto_principal FROM escorts WHERE id = ?");
    $check->execute([$id]);
    $escort = $check->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    if ((int)$escort['eliminada'] !== 1) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'La escort debe estar en la papelera para eliminarla definitivamente']);
        exit;
    }

    // Borrar filas de tablas que NO tienen CASCADE hacia escorts (para no dejar huérfanos)
    $pdo->prepare("DELETE FROM reportes WHERE escort_id = ?")->execute([$id]);
    $pdo->prepare("DELETE FROM planes_usados WHERE escort_id = ?")->execute([$id]);
    $pdo->prepare("DELETE FROM historial_pausas WHERE escort_id = ?")->execute([$id]);
    $pdo->prepare("DELETE FROM suscripciones_historial WHERE escort_id = ?")->execute([$id]);
    $pdo->prepare("DELETE FROM estadisticas_diarias WHERE escort_id = ?")->execute([$id]);

    // Log de auditoria (se conserva aunque la escort se borre: logs_auditoria no tiene FK)
    $pdo->prepare("
        INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address)
        VALUES (?, ?, 'eliminar_escort_definitivo', 'escorts', ?, ?, ?)
    ")->execute([
        $tokenData['id'],
        $id,
        $id,
        json_encode($escort),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    // Notificar a administradores (escort_id = NULL para que persista, ya que el DELETE
    // de escorts usa ON DELETE CASCADE y borraria la notificacion si referenciara a la escort)
    $pdo->prepare("
        INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id)
        VALUES (NULL, 'sistema', 'Escort eliminada definitivamente', ?, '/admin/escorts', NULL)
    ")->execute([
        "{$escort['nombre']} (ID {$id}) fue eliminada permanentemente. Sus datos, fotos e historial fueron borrados."
    ]);

    // Borrado definitivo: ON DELETE CASCADE elimina comentarios, fotos, historias, idiomas,
    // servicios, vip_solicitudes, favoritos, pagos, sticky_posiciones, suscripciones,
    // valoraciones y verificaciones asociadas.
    $pdo->prepare("DELETE FROM escorts WHERE id = ?")->execute([$id]);

    $pdo->commit();
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error escort-eliminar-definitivo.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
    exit;
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error escort-eliminar-definitivo.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
    exit;
}

// Borrar archivos del servidor (fuera de la transaccion: no debe revertirse si el disco falla)
$uploadBase = __DIR__ . '/../../uploads';
$carpetas = [
    $uploadBase . '/escorts/fotos/' . $id,
    $uploadBase . '/escorts/historias/' . $id,
    $uploadBase . '/comprobantes/' . $id,
];
foreach ($carpetas as $carpeta) {
    eliminarDirectorioRecursivo($carpeta);
}

echo json_encode(['success' => true]);
