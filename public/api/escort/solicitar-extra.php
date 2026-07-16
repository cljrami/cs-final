<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/solicitar-extra.php
// Crea una solicitud de extra en escort_extras

header('Content-Type: application/json');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
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
        echo json_encode(['success' => false, 'error' => 'Token invalido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $planId = isset($input['plan_id']) ? intval($input['plan_id']) : 0;

    if ($planId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Plan ID requerido']);
        exit;
    }

    require __DIR__ . '/../../config/database.php';
    $pdo = getDBConnection();

    // Verificar que el plan existe y es extra
    $stmtPlan = $pdo->prepare("SELECT * FROM planes WHERE id = ? AND tipo = 'extra' AND activo = 1");
    $stmtPlan->execute([$planId]);
    $plan = $stmtPlan->fetch(PDO::FETCH_ASSOC);

    if (!$plan) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Plan extra no encontrado']);
        exit;
    }

    // Verificar si es uso unico y ya fue contratado
    if ((bool)$plan['uso_unico']) {
        $stmtCheck = $pdo->prepare("
            SELECT id FROM suscripciones 
            WHERE escort_id = ? AND plan_id = ? AND estado IN ('activa', 'pendiente_aprobacion')
        ");
        $stmtCheck->execute([$escortId, $planId]);
        if ($stmtCheck->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Este extra ya fue contratado y solo permite un uso']);
            exit;
        }
    }

    // Verificar plan base activo
    $stmtBase = $pdo->prepare("
        SELECT s.*, p.nombre as plan_nombre, p.duracion_dias
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND s.estado = 'activa' AND p.tipo = 'base'
        ORDER BY s.fecha_fin DESC
        LIMIT 1
    ");
    $stmtBase->execute([$escortId]);
    $planBase = $stmtBase->fetch(PDO::FETCH_ASSOC);

    if (!$planBase) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Necesitas un plan base activo para contratar extras']);
        exit;
    }

    // Verificar que el extra no dure mas que el plan base
    $diasBaseRestantes = max(0, (int)((new DateTime($planBase['fecha_fin']))->diff(new DateTime())->days));
    if ((int)$plan['duracion_dias'] > $diasBaseRestantes) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => "El extra dura {$plan['duracion_dias']} días pero tu plan base solo tiene {$diasBaseRestantes} días restantes"
        ]);
        exit;
    }

    // Crear la solicitud de extra como suscripcion
    $stmtInsert = $pdo->prepare("
        INSERT INTO suscripciones 
        (escort_id, plan_id, estado, precio_pagado, moneda, creado_en, actualizado_en)
        VALUES (?, ?, 'pendiente_aprobacion', ?, ?, NOW(), NOW())
    ");
    $stmtInsert->execute([
        $escortId,
        $planId,
        $plan['precio'],
        $plan['moneda']
    ]);

    $extraId = $pdo->lastInsertId();

    // Crear notificacion para admin
    $stmtNotif = $pdo->prepare("
        INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at)
        VALUES (?, 'sistema', ?, ?, ?)
    ");
    $escortStmt = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
    $escortStmt->execute([$escortId]);
    $escortData = $escortStmt->fetch(PDO::FETCH_ASSOC);
    $escortNombre = $escortData['nombre'] ?? 'Escort';

    $stmtNotif->execute([
        $escortId,
        'Nueva solicitud de extra',
        $escortNombre . ' solicito ' . $plan['nombre'] . ' ($' . number_format($plan['precio'], 0) . ' ' . $plan['moneda'] . ')',
        '/admin/extras'
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Solicitud de extra enviada correctamente',
        'extra_id' => (int)$extraId,
        'plan_nombre' => $plan['nombre'],
        'precio' => (float)$plan['precio'],
        'moneda' => $plan['moneda']
    ]);
} catch (PDOException $e) {
    error_log("Error solicitar-extra.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error solicitar-extra.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
