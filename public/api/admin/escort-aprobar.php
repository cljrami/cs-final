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

if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID requerido']);
    exit;
}

try {
    $pdo = getDBConnection();

    // Verificar si la columna aprobada existe (migraciíƒÂ³n pendiente)
    $colCheck = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'aprobada'
    ");
    $colCheck->execute();
    $setAprobada = (int)$colCheck->fetchColumn() > 0 ? ', aprobada = 1' : '';

    $stmt = $pdo->prepare("UPDATE escorts SET activa = 1, estado = 'aprobada'{$setAprobada} WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    // Notificar a la escort que su cuenta fue aprobada
    $pdo->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at)
        VALUES (?, 'cuenta_aprobada', 'Cuenta aprobada', 'Tu cuenta ha sido aprobada por el administrador. Ya puedes completar tu perfil y publicar tu anuncio.', '/micuenta/perfil', NOW())
    ")->execute([$id]);

    // Notificar a administradores
    $datos = $pdo->prepare("SELECT nombre, foto_principal FROM escorts WHERE id = ?");
    $datos->execute([$id]);
    $fila = $datos->fetch(PDO::FETCH_ASSOC);
    $nombre = $fila['nombre'];
    $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, actor_foto, escort_id) VALUES (NULL, 'cuenta_aprobada', 'Cuenta aprobada', ?, '/admin/escorts', ?, ?)")
        ->execute(["{$nombre} (ID {$id}) ha sido aprobada.", $fila['foto_principal'], $id]);

    // Enviar email de cuenta aprobada
    sendCuentaAprobada($id);

    // Auto-crear pago para que aparezca en admin pagos
    // Usa el plan que la escort seleccioníƒÂ³ (de su suscripciíƒÂ³n), o fallback al míƒÂ¡s barato
    $planStmt = $pdo->prepare("
        SELECT pl.id, pl.nombre, pl.precio 
        FROM suscripciones s 
        JOIN planes pl ON pl.id = s.plan_id 
        WHERE s.escort_id = ? AND pl.tipo = 'base' 
        ORDER BY s.fecha_inicio DESC LIMIT 1
    ");
    $planStmt->execute([$id]);
    $plan = $planStmt->fetch(PDO::FETCH_ASSOC);

    // Fallback si no tiene suscripciíƒÂ³n: el plan base activo míƒÂ¡s barato
    if (!$plan) {
        $planStmt = $pdo->prepare("SELECT id, nombre, precio FROM planes WHERE activo = 1 AND precio > 0 AND tipo = 'base' ORDER BY precio ASC LIMIT 1");
        $planStmt->execute();
        $plan = $planStmt->fetch(PDO::FETCH_ASSOC);
    }

    $pagoCheck = $pdo->prepare("SELECT COUNT(*) FROM pagos WHERE escort_id = ?");
    $pagoCheck->execute([$id]);
    if ((int)$pagoCheck->fetchColumn() === 0) {
        $pdo->prepare("
            INSERT INTO pagos (escort_id, plan_id, concepto, monto, moneda, metodo_pago, estado_pago, notas, creado_en, pagado_en)
            VALUES (?, ?, 'plan', ?, 'CLP', 'transferencia', 'completado', 'AprobaciíƒÂ³n automíƒÂ¡tica por admin', NOW(), NOW())
        ")->execute([
            $id,
            $plan ? $plan['id'] : null,
            $plan ? $plan['precio'] : 0,
        ]);
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
}

