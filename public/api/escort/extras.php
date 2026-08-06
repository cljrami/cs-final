<?php
// public_html/api/escort/extras.php

header('Content-Type: application/json');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

try {
    require_once __DIR__ . '/../bootstrap.php';
    $pdo = getDBConnection();

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

    $escortId = (int) ($tokenData['id'] ?? 0);
    if (!$escortId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID no válido en token']);
        exit;
    }

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Listar extras disponibles y mis extras ===
    if ($method === 'GET') {
        $escortStmt = $pdo->prepare("SELECT id, activa FROM escorts WHERE id = ?");
        $escortStmt->execute([$escortId]);
        $escort = $escortStmt->fetch(PDO::FETCH_ASSOC);

        if (!$escort) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
            exit;
        }

        // Buscar plan BASE activo por escort_id (los extras se rigen por los días del plan base)
        $planStmt = $pdo->prepare("
            SELECT s.id, s.plan_id, s.fecha_fin, p.nombre as plan_nombre, p.duracion_dias as plan_duracion_dias
            FROM suscripciones s
            LEFT JOIN planes p ON s.plan_id = p.id
            WHERE s.escort_id = ? AND s.estado = 'activa' AND s.fecha_fin >= CURDATE() AND p.tipo = 'base'
            ORDER BY s.fecha_fin DESC
            LIMIT 1
        ");
        $planStmt->execute([$escortId]);
        $planActivo = $planStmt->fetch(PDO::FETCH_ASSOC);

        $diasPlanRestantes = 0;
        $planVenceEnDias = null;
        if ($planActivo && $planActivo['fecha_fin']) {
            $diasPlanRestantes = max(0, ceil((strtotime($planActivo['fecha_fin']) - time()) / 86400));
            $planVenceEnDias = date('Y-m-d', strtotime($planActivo['fecha_fin']));
        }

        // Opciones disponibles para solicitar (solo las que cumplan los requisitos)
        $extrasStmt = $pdo->prepare("
            SELECT 
                p.id, p.nombre, p.slug, p.descripcion, p.extra_tipo as tipo, p.duracion_dias, p.precio, p.moneda, 
                p.color_badge, p.orden, p.activo, p.uso_unico
            FROM planes p
            WHERE p.tipo = 'extra' AND p.activo = 1
            ORDER BY p.extra_tipo ASC, p.orden ASC, p.id ASC
        ");
        $extrasStmt->execute();
        $extras = $extrasStmt->fetchAll(PDO::FETCH_ASSOC);

        // Mis extras (activos y pendientes desde suscripciones)
        $misExtrasStmt = $pdo->prepare("
            SELECT 
                s.id,
                s.escort_id,
                s.plan_id as extra_id,
                p.nombre as extra_nombre,
                p.slug as extra_slug,
                p.extra_tipo as extra_tipo,
                p.duracion_dias as extra_duracion_dias,
                p.precio as extra_precio,
                p.moneda as extra_moneda,
                p.color_badge as extra_color_badge,
                p.uso_unico,
                s.fecha_inicio,
                s.fecha_fin,
                s.estado,
                s.creado_en
            FROM suscripciones s
            LEFT JOIN planes p ON s.plan_id = p.id
            WHERE s.escort_id = ? AND p.tipo = 'extra' AND s.estado IN ('activa', 'pendiente_aprobacion')
            ORDER BY s.fecha_fin DESC
        ");
        $misExtrasStmt->execute([$escortId]);
        $misExtras = $misExtrasStmt->fetchAll(PDO::FETCH_ASSOC);

        // Determinar si la escort ya tiene un extra vigente que bloquea solicitar otro.
        // Se considera bloqueante: pendiente de aprobación, pausado o activo vigente.
        $tieneExtraVigente = false;
        $extraVigente = null;
        
        if ($misExtras) {
            foreach ($misExtras as $extra) {
                if ($extra['estado'] === 'pendiente_aprobacion') {
                    $tieneExtraVigente = true;
                    $extraVigente = $extra;
                    break;
                } elseif ($extra['estado'] === 'pausada') {
                    $tieneExtraVigente = true;
                    if (!$extraVigente) $extraVigente = $extra;
                } elseif ($extra['estado'] === 'activa' && $extra['fecha_fin'] >= CURDATE()) {
                    $tieneExtraVigente = true;
                    if (!$extraVigente || $extra['fecha_fin'] > $extraVigente['fecha_fin']) $extraVigente = $extra;
                }
            }
        }

        // Agregar flags a cada extra para el frontend.
        // Regla: se puede solicitar cualquier extra mientras quepa en los días
        // restantes del plan base activo, y solo si no existe ya un extra
        // pendiente/pausado/activo. Cuando el extra vigente venza, se permite volver a solicitar.
        $extrasConFlags = array_map(function ($extra) use ($diasPlanRestantes, $planActivo, $tieneExtraVigente, $extraVigente) {
            $duracionOk = (int)$extra['duracion_dias'] <= $diasPlanRestantes;

            $puedeSolicitar = $planActivo && $duracionOk && !$tieneExtraVigente;

            $motivo = null;
            if ($tieneExtraVigente) {
                $motivo = 'Ya tienes un extra pendiente, pausado o activo. Podrás solicitar otro una vez que este venza.';
                if ($extraVigente && !empty($extraVigente['fecha_fin'])) {
                    $motivo .= ' Vence el ' . date('d/m/Y', strtotime($extraVigente['fecha_fin'])) . '.';
                }
            } elseif (!$planActivo) {
                $motivo = 'Necesitas un plan base activo para contratar extras.';
            } elseif (!$duracionOk) {
                $motivo = 'Este extra no cabe en los días restantes de tu plan.';
            }

            return array_merge($extra, [
                '_duracion_ok' => $duracionOk,
                '_puede_solicitar' => $puedeSolicitar,
                '_motivo_no_disponible' => $motivo
            ]);
        }, $extras);

        echo json_encode([
            'success' => true,
            'plan_activo' => $planActivo ? [
                'id' => (int)$planActivo['id'],
                'nombre' => $planActivo['plan_nombre'],
                'fecha_fin' => $planActivo['fecha_fin'],
                'dias_restantes' => $diasPlanRestantes,
                'vence_en_dias' => $planVenceEnDias
            ] : null,
            'tiene_extra_vigente' => $tieneExtraVigente,
            'extra_vigente' => $extraVigente ? [
                'id' => (int)$extraVigente['id'],
                'extra_id' => (int)$extraVigente['extra_id'],
                'extra_nombre' => $extraVigente['extra_nombre'],
                'extra_tipo' => $extraVigente['extra_tipo'],
                'estado' => $extraVigente['estado'],
                'fecha_fin' => $extraVigente['fecha_fin']
            ] : null,
            'extras' => $extrasConFlags,
            'mis_extras' => $misExtras
        ]);
        exit;
    }

    // === POST - Contratar un extra ===
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $extraId = isset($input['extra_id']) ? intval($input['extra_id']) : 0;

        if ($extraId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de extra no válido']);
            exit;
        }

        // Verificar escort existe
        $escortStmt = $pdo->prepare("SELECT id FROM escorts WHERE id = ?");
        $escortStmt->execute([$escortId]);
        $escort = $escortStmt->fetch(PDO::FETCH_ASSOC);

        if (!$escort) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
            exit;
        }

        // Buscar plan BASE activo
        $planStmt = $pdo->prepare("
            SELECT s.id, s.fecha_fin, p.duracion_dias as plan_duracion_dias
            FROM suscripciones s
            LEFT JOIN planes p ON s.plan_id = p.id
            WHERE s.escort_id = ? AND s.estado = 'activa' AND s.fecha_fin >= CURDATE() AND p.tipo = 'base'
            ORDER BY s.fecha_fin DESC
            LIMIT 1
        ");
        $planStmt->execute([$escortId]);
        $planActivo = $planStmt->fetch(PDO::FETCH_ASSOC);

        if (!$planActivo || !$planActivo['fecha_fin']) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Necesitas un plan activo para contratar extras']);
            exit;
        }

        // Obtener extra desde planes
        $extraStmt = $pdo->prepare("SELECT * FROM planes WHERE id = ? AND tipo = 'extra' AND activo = 1");
        $extraStmt->execute([$extraId]);
        $extra = $extraStmt->fetch(PDO::FETCH_ASSOC);

        if (!$extra) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Extra no encontrado o inactivo']);
            exit;
        }

        // Validar duración vs días restantes del plan
        $diasPlanRestantes = max(0, ceil((strtotime($planActivo['fecha_fin']) - time()) / 86400));
        $duracionExtra = (int)$extra['duracion_dias'];

        if ($duracionExtra > $diasPlanRestantes) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => "Tu plan vence en $diasPlanRestantes días. Este extra requiere $duracionExtra días. No puedes solicitarlo."
            ]);
            exit;
        }

        // Validar: no puede solicitar un extra si ya tiene uno pendiente, pausado o activo.
        // Solo una vez que el extra vigente venza podrá solicitar otro.
        $extraBloqueanteStmt = $pdo->prepare("
            SELECT COUNT(*) FROM suscripciones s
            JOIN planes p ON s.plan_id = p.id
            WHERE s.escort_id = ? AND p.tipo = 'extra'
              AND (s.estado = 'pendiente_aprobacion'
                   OR s.estado = 'pausada'
                   OR (s.estado = 'activa' AND s.fecha_fin >= CURDATE()))
        ");
        $extraBloqueanteStmt->execute([$escortId]);
        if ((int)$extraBloqueanteStmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'error' => 'Ya tienes un extra pendiente, pausado o activo. Podrás solicitar otro una vez que este venza.'
            ]);
            exit;
        }

        // Calcular fechas
        $fechaInicio = date('Y-m-d');
        $fechaFin = date('Y-m-d', min(
            strtotime("+$duracionExtra days"),
            strtotime($planActivo['fecha_fin'])
        ));

        // Crear contratación como suscripcion pendiente
        $insertStmt = $pdo->prepare("
            INSERT INTO suscripciones 
            (escort_id, plan_id, fecha_inicio, fecha_fin, estado, precio_pagado, moneda, creado_en, actualizado_en)
            VALUES (?, ?, ?, ?, 'pendiente_aprobacion', ?, ?, NOW(), NOW())
        ");
        $insertStmt->execute([
            $escortId,
            $extraId,
            $fechaInicio,
            $fechaFin,
            $extra['precio'],
            $extra['moneda']
        ]);

        $contratacionId = $pdo->lastInsertId();

        // Notificar al admin
        $notifStmt = $pdo->prepare("
            INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url)
            VALUES (?, 'sistema', 'Nueva solicitud de extra', ?, '/admin/suscripciones?tipo=extra&estado=pendiente')
        ");
        $notifStmt->execute([
            $escortId,
            "Solicitud de extra: {$extra['nombre']} ({$extra['duracion_dias']} días) - " . number_format($extra['precio'], 0, ',', '.') . " {$extra['moneda']}"
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Extra solicitado correctamente. Pendiente de aprobación.',
            'contratacion_id' => (int)$contratacionId,
            'extra_nombre' => $extra['nombre'],
            'estado' => 'pendiente_aprobacion',
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error extras.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error extras.php: " . $e->getMessage() . " en " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno del servidor']);
}
