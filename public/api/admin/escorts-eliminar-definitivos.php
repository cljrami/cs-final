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
$ids = $input['ids'] ?? [];
if (!is_array($ids) || empty($ids)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'IDs requeridos']);
    exit;
}

$ids = array_values(array_unique(array_map('intval', $ids)));
$ids = array_filter($ids, fn($i) => $i > 0);
if (empty($ids)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'IDs inválidos']);
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

    // Verificar que todas estén en papelera
    $in = implode(',', array_fill(0, count($ids), '?'));
    $checkStmt = $pdo->prepare("SELECT id, nombre, email, eliminada FROM escorts WHERE id IN ($in)");
    $checkStmt->execute($ids);
    $rows = $checkStmt->fetchAll(PDO::FETCH_ASSOC);
    $foundIds = array_column($rows, 'id');
    $missing = array_diff($ids, $foundIds);
    if (!empty($missing)) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Algunas escorts no existen']);
        exit;
    }
    foreach ($rows as $r) {
        if ((int)$r['eliminada'] !== 1) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => 'Todas las escorts deben estar en la papelera']);
            exit;
        }
    }

    // Borrar relaciones sin CASCADE
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $tables = ['reportes','planes_usados','historial_pausas','suscripciones_historial','estadisticas_diarias'];
    foreach ($tables as $t) {
        $stmt = $pdo->prepare("DELETE FROM `$t` WHERE escort_id IN ($placeholders)");
        $stmt->execute($ids);
    }

    // Log de auditoría
    $auditStmt = $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address) VALUES (?, ?, 'eliminar_escort_definitivo', 'escorts', ?, ?, ?)");
    foreach ($rows as $r) {
        $auditStmt->execute([
            $tokenData['id'],
            $r['id'],
            $r['id'],
            json_encode(['id'=>$r['id'],'nombre'=>$r['nombre'],'email'=>$r['email']]),
            $_SERVER['REMOTE_ADDR'] ?? null
        ]);
    }

    // Notificación
    $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id) VALUES (NULL, 'sistema', 'Escorts eliminadas definitivamente', ?, '/admin/escorts', NULL)")
        ->execute([count($ids) . ' escorts fueron eliminadas permanentemente desde la papelera.']);

    // Borrado definitivo con CASCADE
    $delStmt = $pdo->prepare("DELETE FROM escorts WHERE id IN ($placeholders)");
    $delStmt->execute($ids);

    $pdo->commit();

    // Borrar archivos fuera de transacción
    $uploadBase = __DIR__ . '/../../uploads';
    foreach ($ids as $id) {
        foreach ([
            $uploadBase . '/escorts/fotos/' . $id,
            $uploadBase . '/escorts/historias/' . $id,
            $uploadBase . '/comprobantes/' . $id,
            $uploadBase . '/verificaciones/' . $id,
        ] as $carpeta) {
            eliminarDirectorioRecursivo($carpeta);
        }
    }

    echo json_encode(['success' => true, 'deleted' => count($ids)]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('escorts-eliminar-definitivos.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
