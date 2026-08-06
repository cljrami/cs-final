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

    // Leer datos
    $input = json_decode(file_get_contents('php://input'), true);
    $solicitudId = isset($input['solicitud_id']) ? intval($input['solicitud_id']) : 0;
    $accion = isset($input['accion']) ? $input['accion'] : ''; // 'aprobar' o 'rechazar'
    $notas = isset($input['notas']) ? trim($input['notas']) : '';

    if ($solicitudId <= 0) {
        echo json_encode(['success' => false, 'error' => 'ID de solicitud no válido']);
        exit;
    }

    if (!in_array($accion, ['aprobar', 'rechazar'])) {
        echo json_encode(['success' => false, 'error' => 'Acción no válida. Use "aprobar" o "rechazar"']);
        exit;
    }

    // Obtener la solicitud (con subquery para evitar duplicados por múltiples suscripciones)
    $stmtSol = $pdo->prepare("
        SELECT 
            vs.*,
            e.nombre as escort_nombre,
            e.email as escort_email,
            e.vip as escort_vip_actual,
            s.fecha_fin as plan_base_fin
        FROM escort_vip_solicitudes vs
        JOIN escorts e ON e.id = vs.escort_id
        LEFT JOIN suscripciones s ON s.id = (
            SELECT s2.id FROM suscripciones s2
            JOIN planes p2 ON p2.id = s2.plan_id AND p2.tipo = 'base'
            WHERE s2.escort_id = e.id
              AND s2.estado = 'activa'
              AND s2.fecha_aprobacion IS NOT NULL
            ORDER BY s2.creado_en DESC
            LIMIT 1
        )
        WHERE vs.id = ?
    ");
    $stmtSol->execute([$solicitudId]);
    $solicitud = $stmtSol->fetch(PDO::FETCH_ASSOC);

    if (!$solicitud) {
        echo json_encode(['success' => false, 'error' => 'Solicitud no encontrada']);
        exit;
    }

    // Verificar que no esté ya procesada
    if ($solicitud['estado'] !== 'enviado') {
        echo json_encode([
            'success' => false,
            'error' => 'Esta solicitud ya fue ' . ($solicitud['estado'] === 'aprobado' ? 'aprobada' : 'rechazada')
        ]);
        exit;
    }

    // Si ya es VIP, no puede aprobar de nuevo
    if ($accion === 'aprobar' && $solicitud['escort_vip_actual'] == 1) {
        echo json_encode(['success' => false, 'error' => 'Esta escort ya es VIP']);
        exit;
    }

    // Si no tiene plan base vigente, no se puede aprobar VIP
    if ($accion === 'aprobar' && (!$solicitud['plan_base_fin'] || $solicitud['plan_base_fin'] < date('Y-m-d'))) {
        echo json_encode([
            'success' => false,
            'error' => 'El plan base de esta escort ha expirado. No se puede aprobar VIP sin plan base activo.'
        ]);
        exit;
    }

    $pdo->beginTransaction();

    try {
        if ($accion === 'aprobar') {
            // Actualizar solicitud
            $stmtUpdate = $pdo->prepare("
                UPDATE escort_vip_solicitudes 
                SET estado = 'aprobado', 
                    admin_notas = ?, 
                    fecha_respuesta = NOW()
                WHERE id = ?
            ");
            $stmtUpdate->execute([$notas, $solicitudId]);

            // VIP dura hasta que venza el plan base
            $fechaVipExpira = $solicitud['plan_base_fin'];

            // Activar VIP en escort
            $stmtVip = $pdo->prepare("
                UPDATE escorts 
                SET vip = 1, 
                    fecha_vip_expira = ?
                WHERE id = ?
            ");
            $stmtVip->execute([$fechaVipExpira, $solicitud['escort_id']]);

            // Notificación para escort
            $stmtNotif = $pdo->prepare("
                INSERT INTO notificaciones (
                    escort_id, 
                    tipo, 
                    titulo, 
                    mensaje, 
                    url
                ) VALUES (?, 'vip_aprobado', ?, ?, ?)
            ");
            $stmtNotif->execute([
                $solicitud['escort_id'],
                '¡VIP Aprobado!',
                'Tu solicitud VIP fue aprobada. Eres VIP hasta el ' . date('d/m/Y', strtotime($fechaVipExpira)) . '.',
                '/panel/mi-plan'
            ]);

            $mensaje = 'Solicitud VIP aprobada. La escort es VIP hasta el ' . $fechaVipExpira;
        } else {
            // Rechazar
            $stmtUpdate = $pdo->prepare("
                UPDATE escort_vip_solicitudes 
                SET estado = 'rechazado', 
                    admin_notas = ?, 
                    fecha_respuesta = NOW()
                WHERE id = ?
            ");
            $stmtUpdate->execute([$notas, $solicitudId]);

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
                $solicitud['escort_id'],
                'Solicitud VIP rechazada',
                'Tu solicitud VIP fue rechazada. Motivo: ' . ($notas ? $notas : 'No cumple con los requisitos.'),
                '/panel/mi-plan'
            ]);

            $mensaje = 'Solicitud VIP rechazada';
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => $mensaje,
            'solicitud_id' => $solicitudId,
            'escort_id' => (int)$solicitud['escort_id'],
            'escort_nombre' => $solicitud['escort_nombre'],
            'nuevo_estado' => $accion === 'aprobar' ? 'aprobado' : 'rechazado',
            'fecha_vip_expira' => $accion === 'aprobar' ? $solicitud['plan_base_fin'] : null
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
} catch (PDOException $e) {
    error_log("Error aprobar-vip.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error aprobar-vip.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
