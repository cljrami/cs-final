<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/pagos.php
// API para que escorts creen pagos de planes/VIP/destacados

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

    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Mis pagos (incluye extras sin pago) ===
    if ($method === 'GET') {
        $stmt = $pdo->prepare("
            SELECT * FROM (
                SELECT 
                    p.id,
                    p.monto,
                    p.moneda,
                    p.concepto,
                    p.metodo_pago,
                    p.estado_pago,
                    p.comprobante_url,
                    p.creado_en,
                    p.pagado_en,
                    pl.nombre as plan_nombre,
                    s.fecha_fin as vencimiento
                FROM pagos p
                LEFT JOIN planes pl ON pl.id = p.plan_id
                LEFT JOIN suscripciones s ON s.id = p.suscripcion_id
                WHERE p.escort_id = ?

                UNION ALL

                SELECT 
                    s.id + 1000000 as id,
                    s.precio_pagado as monto,
                    s.moneda,
                    'destacado' as concepto,
                    NULL as metodo_pago,
                    CASE 
                        WHEN s.estado = 'activa' OR s.fecha_aprobacion IS NOT NULL THEN 'completado'
                        WHEN s.estado = 'rechazada' OR s.estado_pago = 'rechazado' THEN 'rechazado'
                        ELSE 'pendiente'
                    END as estado_pago,
                    NULL as comprobante_url,
                    s.creado_en,
                    NULL as pagado_en,
                    pl.nombre as plan_nombre,
                    s.fecha_fin as vencimiento
                FROM suscripciones s
                JOIN planes pl ON pl.id = s.plan_id AND pl.tipo = 'extra'
                WHERE s.escort_id = ?
                AND NOT EXISTS (SELECT 1 FROM pagos p2 WHERE p2.suscripcion_id = s.id)
            ) combined
            ORDER BY creado_en DESC
        ");
        $stmt->execute([$escortId, $escortId]);
        $pagos = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'pagos' => $pagos]);
        exit;
    }

    // === POST - Crear pago (comprar plan/VIP/destacado) ===
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $planId = isset($input['plan_id']) ? intval($input['plan_id']) : 0;
        $concepto = isset($input['concepto']) && in_array($input['concepto'], ['plan', 'vip', 'destacado']) ? $input['concepto'] : '';
        $monto = isset($input['monto']) ? floatval($input['monto']) : 0;
        $moneda = isset($input['moneda']) ? trim($input['moneda']) : 'CLP';
        $metodoPago = isset($input['metodo_pago']) ? $input['metodo_pago'] : 'transferencia';
        $comprobanteUrl = isset($input['comprobante_url']) ? trim($input['comprobante_url']) : null;

        // Validaciones
        if ($planId <= 0 && $concepto !== 'vip') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Plan no válido']);
            exit;
        }

        if (empty($concepto)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Concepto requerido']);
            exit;
        }

        if ($monto <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Monto debe ser mayor a 0']);
            exit;
        }

        // Si es plan, verificar que existe y obtener precio real
        $planNombre = null;
        if ($planId > 0) {
            $planStmt = $pdo->prepare("SELECT nombre, precio, activo FROM planes WHERE id = ?");
            $planStmt->execute([$planId]);
            $plan = $planStmt->fetch(PDO::FETCH_ASSOC);

            if (!$plan) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Plan no encontrado']);
                exit;
            }

            if (!$plan['activo']) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Plan no disponible']);
                exit;
            }

            // Validar que el monto coincida con el precio del plan
            if (floatval($plan['precio']) != $monto) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'El monto no coincide con el precio del plan']);
                exit;
            }

            $planNombre = $plan['nombre'];
        }

        // Si es VIP, obtener precio desde configuración
        if ($concepto === 'vip') {
            $configStmt = $pdo->prepare("SELECT valor FROM configuracion WHERE clave = 'precio_vip'");
            $configStmt->execute();
            $precioVip = $configStmt->fetchColumn();

            if (floatval($precioVip) != $monto) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'El monto no coincide con el precio VIP']);
                exit;
            }
        }

        // Crear el pago
        $stmt = $pdo->prepare("
            INSERT INTO pagos 
            (escort_id, plan_id, concepto, monto, moneda, metodo_pago, estado_pago, comprobante_url, creado_en) 
            VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, NOW())
        ");
        $stmt->execute([
            $escortId,
            $planId > 0 ? $planId : null,
            $concepto,
            $monto,
            $moneda,
            $metodoPago,
            $comprobanteUrl
        ]);
        $pagoId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'message' => 'Pago registrado correctamente. Esperando aprobación del administrador.',
            'pago' => [
                'id' => (int)$pagoId,
                'concepto' => $concepto,
                'monto' => $monto,
                'moneda' => $moneda,
                'estado_pago' => 'pendiente',
                'plan_nombre' => $planNombre
            ]
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error escort/pagos.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Error escort/pagos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
