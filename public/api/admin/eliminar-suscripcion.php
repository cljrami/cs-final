<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
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
    $suscripcionId = isset($input['suscripcion_id']) ? intval($input['suscripcion_id']) : 0;

    if ($suscripcionId <= 0) {
        echo json_encode(['success' => false, 'error' => 'ID de suscripción no válido']);
        exit;
    }

    // Obtener la suscripción
    $stmt = $pdo->prepare("
        SELECT s.*, p.tipo as plan_tipo, p.nombre as plan_nombre, e.nombre as escort_nombre
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        JOIN escorts e ON e.id = s.escort_id
        WHERE s.id = ?
    ");
    $stmt->execute([$suscripcionId]);
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        echo json_encode(['success' => false, 'error' => 'Suscripción no encontrada']);
        exit;
    }

    if ($suscripcion['plan_tipo'] === 'extra') {
        echo json_encode(['success' => false, 'error' => 'Las solicitudes de planes extra se gestionan desde el panel de Solicitudes Extras']);
        exit;
    }

    $pdo->beginTransaction();

    try {
        // Eliminar la suscripción
        $stmtDelete = $pdo->prepare("DELETE FROM suscripciones WHERE id = ?");
        $stmtDelete->execute([$suscripcionId]);

        // Limpiar planes_usados si existe (para planes de uso único)
        $stmtUsados = $pdo->prepare("DELETE FROM planes_usados WHERE plan_id = ? AND escort_id = ?");
        $stmtUsados->execute([$suscripcion['plan_id'], $suscripcion['escort_id']]);

        // Si era plan base, quitar VIP/destacado
        if ($suscripcion['plan_tipo'] === 'base') {
            $stmtEscort = $pdo->prepare("
                UPDATE escorts 
                SET vip = 0,
                    fecha_vip_expira = NULL,
                    destacado = 0,
                    fecha_destacado_expira = NULL
                WHERE id = ?
            ");
            $stmtEscort->execute([$suscripcion['escort_id']]);
        }

        // Si era extra, verificar si quedan otros extras activos
        if ($suscripcion['plan_tipo'] === 'extra') {
            $stmtExtras = $pdo->prepare("
                SELECT 1 FROM suscripciones s
                JOIN planes p ON p.id = s.plan_id
                WHERE s.escort_id = ? 
                  AND p.tipo = 'extra'
                  AND s.estado = 'activa'
                  AND s.fecha_aprobacion IS NOT NULL
                  AND s.fecha_fin >= CURDATE()
                LIMIT 1
            ");
            $stmtExtras->execute([$suscripcion['escort_id']]);
            $tieneExtras = $stmtExtras->fetch();

            // Si no quedan extras, quitar destacado
            if (!$tieneExtras) {
                $stmtEscort = $pdo->prepare("
                    UPDATE escorts 
                    SET destacado = 0,
                        fecha_destacado_expira = NULL
                    WHERE id = ?
                ");
                $stmtEscort->execute([$suscripcion['escort_id']]);
            }
        }

        // Notificación para escort
        $stmtNotif = $pdo->prepare("
            INSERT INTO notificaciones (
                escort_id, 
                tipo, 
                titulo, 
                mensaje, 
                url
            ) VALUES (?, 'sistema', ?, ?, ?)
        ");
        $stmtNotif->execute([
            $suscripcion['escort_id'],
            'Suscripción cancelada',
            'Tu suscripción de ' . $suscripcion['plan_nombre'] . ' fue cancelada por un administrador.',
            '/panel/mi-plan'
        ]);

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Suscripción cancelada y eliminada correctamente',
            'suscripcion_id' => $suscripcionId,
            'escort_id' => (int)$suscripcion['escort_id'],
            'plan_tipo' => $suscripcion['plan_tipo']
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
} catch (PDOException $e) {
    error_log("Error eliminar-suscripcion.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error eliminar-suscripcion.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
