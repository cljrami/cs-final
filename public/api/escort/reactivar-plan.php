<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/reactivar-plan.php
// POST - Reactivar plan pausado

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
    // Obtener suscripción pausada
    $stmt = $pdo->prepare("
        SELECT s.id, s.fecha_fin, s.fecha_aprobacion, s.fecha_pausa, s.dias_pausados, p.duracion_dias
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND p.tipo = 'base' AND s.estado = 'pausada'
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        echo json_encode(['success' => false, 'error' => 'No tienes un plan pausado']);
        exit;
    }

    // Modelo unificado: sumar la duración real de la pausa y recalcular fecha_fin desde la base
    $diasEstaPausa = plan_dias_esta_pausa($suscripcion['fecha_pausa']);
    $diasPausadosTotal = (int)($suscripcion['dias_pausados'] ?? 0) + $diasEstaPausa;

    // Reactivar
    $update = $pdo->prepare("
        UPDATE suscripciones 
        SET estado = 'activa', fecha_pausa = NULL, fecha_reactivacion = CURDATE(), dias_pausados = ?
        WHERE id = ?
    ");
    $update->execute([$diasPausadosTotal, $suscripcion['id']]);
    $nuevaFechaFin = plan_recalcular_fecha_fin($pdo, $suscripcion['id']);

    // Mostrar escort en el directorio
    $pdo->prepare("UPDATE escorts SET activa = 1 WHERE id = ?")->execute([$escortId]);

    // Restaurar sticky si tiene un extra sticky activo
    $stickyExtra = $pdo->prepare("
        SELECT s.fecha_fin FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND p.extra_tipo = 'sticky' AND s.estado = 'activa' AND s.fecha_aprobacion IS NOT NULL AND s.fecha_fin >= CURDATE()
        LIMIT 1
    ");
    $stickyExtra->execute([$escortId]);
    if ($stickyExtra->fetch()) {
        $pdo->prepare("UPDATE escorts SET sticky = 1 WHERE id = ? AND sticky = 0")->execute([$escortId]);
    }

    // Registrar reactivación
    $insert = $pdo->prepare("
        INSERT INTO historial_pausas (suscripcion_id, escort_id, accion, dias_acumulados_pausa, notas)
        VALUES (?, ?, 'reactivacion', ?, 'Reactivado desde panel escort')
    ");
    $insert->execute([$suscripcion['id'], $escortId, $diasEstaPausa]);

    $af = $pdo->prepare("SELECT foto_principal, nombre FROM escorts WHERE id = ?");
    $af->execute([$escortId]);
    $actor = $af->fetch(PDO::FETCH_ASSOC);

    $notif = $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url) VALUES (?, 'sistema', 'Plan reactivado', ?, '/mi-cuenta/mi-plan')");
    $notif->execute([$escortId, "Tu plan ha sido reactivado desde el panel de control. Vence el " . ($nuevaFechaFin ? date('d/m/Y', strtotime($nuevaFechaFin)) : '—') . "."]);

    $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id) VALUES (NULL, 'sistema', 'Reactivó su plan', ?, '/admin/escorts', ?)")
        ->execute(["La escort {$actor['nombre']} ha reactivado su plan.", $escortId]);

    echo json_encode([
        'success' => true,
        'message' => 'Plan reactivado correctamente',
        'nueva_fecha_fin' => $nuevaFechaFin
    ]);
} catch (PDOException $e) {
    error_log("Error reactivar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error reactivar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
