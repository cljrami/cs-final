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
    $adminId = $tokenData['id'] ?? 0;
    if ($adminId <= 0) {
        throw new Exception('Token inválido');
    }

    $pdo = getDBConnection();
    if (!$pdo) {
        throw new Exception('Error de conexión a la base de datos');
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $solicitudId = (int)($input['solicitud_id'] ?? 0);
    $escortId = (int)($input['escort_id'] ?? 0);
    $accion = $input['accion'] ?? '';
    $notas = trim($input['notas'] ?? '');

    if (!$solicitudId || !$escortId || !in_array($accion, ['aprobar', 'rechazar', 'borrar'])) {
        throw new Exception('Datos inválidos');
    }

    if ($accion === 'rechazar' && empty($notas)) {
        throw new Exception('Debes indicar el motivo del rechazo');
    }

    $pdo->beginTransaction();

    if ($accion === 'borrar') {
        // Verificar estado de la solicitud antes de borrar
        $stmtCheck = $pdo->prepare("SELECT estado FROM escort_vip_solicitudes WHERE id = ?");
        $stmtCheck->execute([$solicitudId]);
        $estadoSolicitud = $stmtCheck->fetchColumn();

        // Eliminar físicamente la solicitud
        $stmt = $pdo->prepare("DELETE FROM escort_vip_solicitudes WHERE id = ?");
        $stmt->execute([$solicitudId]);

        // Si la solicitud estaba aprobada, revocar VIP del escort
        if ($estadoSolicitud === 'aprobado') {
            $stmt = $pdo->prepare("
                UPDATE escorts 
                SET vip = 0, 
                    fecha_vip_expira = NULL
                WHERE id = ?
            ");
            $stmt->execute([$escortId]);

            // Notificar a la escort
            $stmt = $pdo->prepare("
                INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) 
                VALUES (?, 'sistema', 'VIP Revocado', 'Tu badge VIP ha sido removido por un administrador.', '/micuenta/vip', NOW())
            ");
            $stmt->execute([$escortId]);
        }
    } else {
        // Actualizar estado de la solicitud
        $nuevoEstado = $accion === 'aprobar' ? 'aprobado' : 'rechazado';

        $stmt = $pdo->prepare("
            UPDATE escort_vip_solicitudes 
            SET estado = ?, 
                admin_notas = ?, 
                fecha_respuesta = NOW(),
                revisado_por = ?
            WHERE id = ?
        ");
        $stmt->execute([$nuevoEstado, $notas, $adminId, $solicitudId]);

        // Si se aprueba, activar VIP en escorts
        if ($accion === 'aprobar') {
            // Obtener duración del plan VIP
            $stmtPlan = $pdo->prepare("SELECT plan FROM escort_vip_solicitudes WHERE id = ?");
            $stmtPlan->execute([$solicitudId]);
            $plan = $stmtPlan->fetchColumn();

            // PHP 7.4 compatible (sin match)
            $dias = 30;
            if ($plan === 'trimestral') {
                $dias = 90;
            } elseif ($plan === 'anual') {
                $dias = 365;
            }

            $fechaExpira = date('Y-m-d H:i:s', strtotime("+{$dias} days"));

            $stmt = $pdo->prepare("
                UPDATE escorts 
                SET vip = 1, 
                    fecha_vip_expira = ?
                WHERE id = ?
            ");
            $stmt->execute([$fechaExpira, $escortId]);

            // Crear notificación para la escort
            $stmt = $pdo->prepare("
                INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) 
                VALUES (?, 'vip_aprobado', 'Â¡VIP Aprobado!', 'Tu solicitud VIP ha sido aprobada.', '/micuenta/vip', NOW())
            ");
            $stmt->execute([$escortId]);
        } else {
            // Si se rechaza, notificar
            $stmt = $pdo->prepare("
                INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) 
                VALUES (?, 'sistema', 'Solicitud VIP rechazada', ?, '/micuenta/vip', NOW())
            ");
            $stmt->execute([$escortId, "Tu solicitud VIP fue rechazada. Motivo: " . $notas]);
        }
    }

    $pdo->commit();

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
