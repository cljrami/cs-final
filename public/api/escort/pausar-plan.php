<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/pausar-plan.php
// POST - Pausar plan base activo

header('Content-Type: application/json');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

try {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || !isset($tokenData['exp']) || $tokenData['exp'] < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = isset($tokenData['id']) ? intval($tokenData['id']) : 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    require_once __DIR__ . '/../bootstrap.php';
    require_once __DIR__ . '/../lib/plan_pausas.php';

    $pdo = getDBConnection();
    // Obtener suscripción activa
    $stmt = $pdo->prepare("
        SELECT s.id, s.estado, p.max_pausas_permitidas, p.duracion_dias
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND p.tipo = 'base' AND s.estado = 'activa' AND s.fecha_aprobacion IS NOT NULL
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        echo json_encode(['success' => false, 'error' => 'No tienes un plan activo para pausar']);
        exit;
    }

    // Verificar pausas usadas
    $pausasUsadas = plan_pausas_usadas($pdo, $suscripcion['id']);

    if ($pausasUsadas >= (int)$suscripcion['max_pausas_permitidas']) {
        echo json_encode(['success' => false, 'error' => 'Límite de pausas alcanzado']);
        exit;
    }

    // Plazo para usar pausas (desde la primera pausa, calendario real)
    $plazo = plan_plazo_pausas($pdo, $suscripcion['id'], (int)$suscripcion['duracion_dias']);
    if ($plazo['vencido']) {
        echo json_encode(['success' => false, 'error' => 'Tu plazo para usar pausas venció el ' . date('d/m/Y', strtotime($plazo['limite']))]);
        exit;
    }

    // Pausar suscripción (reloj congelado: fecha_fin no cambia, se fija fecha_pausa)
    $update = $pdo->prepare("UPDATE suscripciones SET estado = 'pausada', fecha_pausa = CURDATE() WHERE id = ?");
    $update->execute([$suscripcion['id']]);

    // Ocultar escort en listados públicos
    $pdo->prepare("UPDATE escorts SET activa = 0 WHERE id = ?")->execute([$escortId]);

    // Limpiar sticky al pausar
    $pdo->prepare("UPDATE escorts SET sticky = 0, sticky_orden = 0, sticky_expira = NULL WHERE id = ?")->execute([$escortId]);
    $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$escortId]);

    // Registrar en historial
    $insert = $pdo->prepare("
        INSERT INTO historial_pausas (suscripcion_id, escort_id, accion, dias_acumulados_pausa, notas)
        VALUES (?, ?, 'pausa', 0, 'Pausado desde panel escort')
    ");
    $insert->execute([$suscripcion['id'], $escortId]);

    $af = $pdo->prepare("SELECT foto_principal, nombre FROM escorts WHERE id = ?");
    $af->execute([$escortId]);
    $actor = $af->fetch(PDO::FETCH_ASSOC);

    $notif = $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url) VALUES (?, 'sistema', 'Plan pausado', ?, '/mi-cuenta/mi-plan')");
    $notif->execute([$escortId, "Tu plan ha sido pausado desde el panel de control."]);

    $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id) VALUES (NULL, 'sistema', 'Pausó su plan', ?, '/admin/escorts', ?)")
        ->execute(["La escort {$actor['nombre']} ha pausado su plan.", $escortId]);

    echo json_encode([
        'success' => true,
        'message' => 'Plan pausado correctamente'
    ]);
} catch (PDOException $e) {
    error_log("Error pausar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error pausar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
