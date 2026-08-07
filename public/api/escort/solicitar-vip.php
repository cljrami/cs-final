<?php
header('Content-Type: application/json');
if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

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
    $escortId = intval($tokenData['id'] ?? 0);

    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    $pdo = getDBConnection();

    // Obtener datos de la escort
    $stmtEscort = $pdo->prepare("
        SELECT id, nombre, email, vip, eliminada 
        FROM escorts 
        WHERE id = ?
    ");
    $stmtEscort->execute([$escortId]);
    $escort = $stmtEscort->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    if ($escort['eliminada'] == 1) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Cuenta eliminada']);
        exit;
    }

    if ($escort['vip'] == 1) {
        echo json_encode(['success' => false, 'error' => 'Ya eres VIP. No puedes solicitar VIP nuevamente.']);
        exit;
    }

    // Verificar plan base activo
    $stmtBase = $pdo->prepare("
        SELECT 
            s.id, 
            s.plan_id, 
            s.fecha_fin, 
            s.fecha_aprobacion,
            p.nombre as plan_nombre,
            p.permite_vip,
            p.uso_unico,
            DATEDIFF(s.fecha_fin, CURDATE()) as dias_restantes
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? 
          AND p.tipo = 'base'
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $stmtBase->execute([$escortId]);
    $planBase = $stmtBase->fetch(PDO::FETCH_ASSOC);

    if (!$planBase) {
        echo json_encode(['success' => false, 'error' => 'No tienes un plan base activo. Contrata un plan primero.']);
        exit;
    }

    if ($planBase['fecha_aprobacion'] === null) {
        echo json_encode(['success' => false, 'error' => 'Tu plan base está pendiente de aprobación. Espera la aprobación antes de solicitar VIP.']);
        exit;
    }

    if ($planBase['fecha_fin'] < date('Y-m-d')) {
        echo json_encode(['success' => false, 'error' => 'Tu plan base ha expirado. Renueva tu plan para solicitar VIP.']);
        exit;
    }

    if ($planBase['plan_id'] == 1) {
        echo json_encode(['success' => false, 'error' => 'El plan gratuito no incluye VIP. Actualiza a un plan de pago para acceder a VIP.']);
        exit;
    }

    if (!$planBase['permite_vip']) {
        echo json_encode(['success' => false, 'error' => 'Tu plan actual no permite solicitar VIP.']);
        exit;
    }

    // Verificar si ya tiene solicitud VIP pendiente
    $stmtPendiente = $pdo->prepare("
        SELECT id FROM escort_vip_solicitudes 
        WHERE escort_id = ? AND estado = 'enviado'
        LIMIT 1
    ");
    $stmtPendiente->execute([$escortId]);
    if ($stmtPendiente->fetch()) {
        echo json_encode(['success' => false, 'error' => 'Ya tienes una solicitud VIP en revisión. Espera la respuesta del administrador.']);
        exit;
    }

    // Procesar comprobante
    $planVip = isset($_POST['plan']) ? $_POST['plan'] : 'mensual';
    $planesValidos = ['mensual', 'trimestral', 'anual'];
    if (!in_array($planVip, $planesValidos)) {
        $planVip = 'mensual';
    }

    $comprobante = '';

    if (isset($_FILES['comprobante']) && $_FILES['comprobante']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['comprobante'];
        $tiposPermitidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        $extPermitidas = ['jpg' => 'jpg', 'jpeg' => 'jpg', 'png' => 'png', 'gif' => 'gif', 'webp' => 'webp', 'pdf' => 'pdf'];
        $ext = $extPermitidas[strtolower(pathinfo($file['name'], PATHINFO_EXTENSION))] ?? '';

        if (!validarMIME($file['tmp_name'], $tiposPermitidos)) {
            echo json_encode(['success' => false, 'error' => 'Solo se permiten imágenes (JPG, PNG) o PDF']);
            exit;
        }

        if ($file['size'] > 5 * 1024 * 1024) {
            echo json_encode(['success' => false, 'error' => 'El comprobante no puede superar los 5MB']);
            exit;
        }

        if ($ext === '') {
            echo json_encode(['success' => false, 'error' => 'Extensión no permitida']);
            exit;
        }

        $uploadDir = __DIR__ . '/../../uploads/comprobantes/' . $escortId . '/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $filename = date('Ymd_His') . '_vip_' . uniqid() . '.' . $ext;
        $filepath = $uploadDir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            throw new Exception('Error al guardar el comprobante');
        }

        $comprobante = 'uploads/comprobantes/' . $escortId . '/' . $filename;
    }

    // Obtener precio VIP desde configuración
    $stmtConfig = $pdo->prepare("SELECT valor FROM configuracion WHERE clave = 'precio_vip'");
    $stmtConfig->execute();
    $configPrecio = $stmtConfig->fetch(PDO::FETCH_ASSOC);
    $precioVip = $configPrecio ? intval($configPrecio['valor']) : 20000;

    // Crear solicitud VIP
    $stmtInsert = $pdo->prepare("
        INSERT INTO escort_vip_solicitudes (
            escort_id, 
            plan, 
            estado, 
            comprobante_pago,
            precio_vip,
            created_at
        ) VALUES (?, ?, 'enviado', ?, ?, NOW())
    ");
    $stmtInsert->execute([$escortId, $planVip, $comprobante, $precioVip]);

    $solicitudId = $pdo->lastInsertId();

    // Notificación para admin
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
        $escortId,
        'Nueva solicitud VIP',
        $escort['nombre'] . ' solicitó VIP (' . $planVip . ') - $' . number_format($precioVip, 0) . ' CLP',
        '/admin/solicitudes-vip'
    ]);

    require_once __DIR__ . '/../mail.php';
    try {
        $body = '<p>Se ha recibido una nueva <strong style="color:#ffffff">solicitud VIP</strong>:</p>';
        $body .= '<table class="info">';
        $body .= '<tr><td>Escort:</td><td>' . htmlspecialchars($escort['nombre'], ENT_QUOTES, 'UTF-8') . '</td></tr>';
        $body .= '<tr><td>Plan:</td><td>' . htmlspecialchars($planVip, ENT_QUOTES, 'UTF-8') . '</td></tr>';
        $body .= '<tr><td>Monto:</td><td>$' . number_format($precioVip, 0) . ' CLP</td></tr>';
        $body .= '</table>';
        $body .= '<p>Revisa el comprobante de pago y aprueba la solicitud.</p>';
        $body .= '<p style="text-align:center;margin-top:24px"><a class="btn" href="' . SITE_URL . '/admin/solicitudes-vip">Revisar solicitud</a></p>';
        sendAdminNotification('pagos', 'Nueva solicitud VIP - Kimi', $body);
    } catch (\Throwable $e2) {
        error_log("solicitar-vip notify error: " . $e2->getMessage());
    }

    $pdo->prepare("INSERT INTO logs_auditoria (escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address, user_agent, created_at) VALUES (?, 'solicitar_vip', 'vip_solicitudes', ?, ?, ?, ?, NOW())")
        ->execute([
            $escortId,
            $solicitudId,
            json_encode(['plan_vip' => $planVip, 'precio' => $precioVip, 'moneda' => 'CLP']),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

    echo json_encode([
        'success' => true,
        'message' => 'Solicitud VIP enviada correctamente. Será revisada por un administrador.',
        'solicitud_id' => (int)$solicitudId,
        'plan_vip' => $planVip,
        'precio' => $precioVip,
        'moneda' => 'CLP',
        'dias_vip' => $planBase['dias_restantes']
    ]);
} catch (PDOException $e) {
    error_log("Error solicitar-vip.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error solicitar-vip.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
