<?php
require_once __DIR__ . '/../../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/mi-plan/pausar.php

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

try {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = $tokenData['id'] ?? 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    require_once __DIR__ . '/../../bootstrap.php';
    require_once __DIR__ . '/../../lib/plan_pausas.php';

    $pdo = getDBConnection();
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        SELECT s.id, s.estado, p.max_pausas_permitidas, p.duracion_dias
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND p.tipo = 'base' AND s.estado = 'activa'
        LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'No tienes un plan activo para pausar']);
        exit;
    }

    if (plan_pausas_usadas($pdo, $suscripcion['id']) >= (int)$suscripcion['max_pausas_permitidas']) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Límite de pausas alcanzado']);
        exit;
    }

    // Plazo para usar pausas (desde la primera pausa, calendario real)
    $plazo = plan_plazo_pausas($pdo, $suscripcion['id'], (int)$suscripcion['duracion_dias']);
    if ($plazo['vencido']) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Tu plazo para usar pausas venció el ' . date('d/m/Y', strtotime($plazo['limite']))]);
        exit;
    }

    // Pausar (reloj congelado: fecha_fin no cambia, se fija fecha_pausa)
    $stmt = $pdo->prepare("
        UPDATE suscripciones
        SET estado = 'pausada',
            fecha_pausa = CURDATE(),
            dias_restantes = NULL,
            updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$suscripcion['id']]);

    $pdo->prepare("UPDATE escorts SET activa = 0 WHERE id = ?")->execute([$escortId]);

    $af = $pdo->prepare("SELECT foto_principal, nombre FROM escorts WHERE id = ?");
    $af->execute([$escortId]);
    $actor = $af->fetch(PDO::FETCH_ASSOC);

    $notif = $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url) VALUES (?, 'sistema', 'Plan pausado', ?, '/mi-cuenta/mi-plan')");
    $notif->execute([$escortId, "Tu plan ha sido pausado. Mientras esté pausado, el tiempo de tu plan no corre."]);

    $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id) VALUES (NULL, 'sistema', 'Pausó su plan', ?, '/admin/escorts', ?)")
        ->execute(["La escort {$actor['nombre']} ha pausado su plan.", $escortId]);

    $pdo->commit();

    require_once __DIR__ . '/../../mail.php';
    notificarAccionEscort('planes', $escortId, $actor['nombre'] . ' pausó su plan');

    echo json_encode([
        'success' => true,
        'mensaje' => 'Plan pausado correctamente'
    ]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error pausar.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error pausar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
