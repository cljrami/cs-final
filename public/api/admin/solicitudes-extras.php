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
    $adminId = intval($tokenData['id'] ?? 0);
    $adminRol = $tokenData['rol'] ?? '';

    if ($adminId <= 0 || !in_array($adminRol, ['superadmin', 'admin', 'moderador'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
        exit;
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $estado = isset($_GET['estado']) ? $_GET['estado'] : 'todos';
        $search = trim($_GET['search'] ?? '');
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $perPage = isset($_GET['per_page']) ? max(10, min(100, intval($_GET['per_page']))) : 20;
        $offset = ($page - 1) * $perPage;

        $params = [];
        $where = "WHERE e.eliminada = 0 AND p.tipo = 'extra'";

        if ($estado !== 'todos') {
            $estadosValidos = ['activa', 'expirada', 'cancelada', 'rechazada', 'pendiente_aprobacion', 'pausada'];
            if ($estado === 'vencen_hoy') {
                $where .= " AND s.estado = 'activa' AND s.fecha_fin = CURDATE()";
            } elseif (in_array($estado, $estadosValidos)) {
                if ($estado === 'pendiente_aprobacion') {
                    $where .= " AND s.fecha_aprobacion IS NULL AND (s.estado IS NULL OR s.estado = '' OR s.estado = 'pendiente_aprobacion')";
                } elseif ($estado === 'rechazada') {
                    $where .= " AND s.estado IN ('rechazada', 'cancelada')";
                } else {
                    $where .= " AND s.estado = ?";
                    $params[] = $estado;
                }
            }
        }

        if ($search !== '') {
            $escapedSearch = str_replace(['%', '_'], ['\\%', '\\_'], $search);
            $s = "%{$escapedSearch}%";
            $where .= " AND (s.id LIKE ? OR e.id LIKE ? OR e.nombre LIKE ? OR e.email LIKE ? OR e.telefono LIKE ? OR e.ciudad LIKE ? OR p.nombre LIKE ?)";
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
        }

        $stmtCount = $pdo->prepare("
            SELECT COUNT(*) as total 
            FROM suscripciones s
            JOIN escorts e ON e.id = s.escort_id
            JOIN planes p ON p.id = s.plan_id
            $where
        ");
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        $sql = "
            SELECT 
                s.id as suscripcion_id,
                s.escort_id,
                s.plan_id,
                s.fecha_inicio,
                s.fecha_aprobacion,
                s.fecha_rechazo,
                s.fecha_fin,
                s.precio_pagado,
                s.moneda,
                s.estado,

                s.comprobante_pago,
                s.creado_en,
                s.aprobado_por,
                s.rechazado_por,
                e.nombre as escort_nombre,
                e.email as escort_email,
                e.telefono,
                e.ciudad,
                COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
                e.verificado,
                e.vip,
                p.nombre as plan_nombre,
                p.slug as plan_slug,
                p.tipo as plan_tipo,
                p.extra_tipo,
                p.duracion_dias,
                p.precio as plan_precio,
                p.badge as plan_badge,
                p.color_badge,
                p.max_pausas_permitidas,
                a.nombre as aprobado_por_nombre,
                ar.nombre as rechazado_por_nombre,
                CASE 
                    WHEN s.fecha_aprobacion IS NULL THEN 'pendiente_aprobacion'
                    WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 'activa'
                    WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'expirada'
                    WHEN s.estado = 'expirada' THEN 'expirada'
                    WHEN s.estado = 'cancelada' THEN 'cancelada'
                    WHEN s.estado = 'rechazada' THEN 'rechazada'
                    ELSE s.estado
                END as estado_calculado,
                GREATEST(0, DATEDIFF(s.fecha_fin, CURDATE())) as dias_restantes,
                (SELECT COUNT(*) FROM historial_pausas hp WHERE hp.suscripcion_id = s.id AND hp.accion = 'pausa') as contador_pausas
            FROM suscripciones s
            JOIN escorts e ON e.id = s.escort_id
            JOIN planes p ON p.id = s.plan_id
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            LEFT JOIN admins a ON a.id = s.aprobado_por
            LEFT JOIN admins ar ON ar.id = s.rechazado_por
            $where
            ORDER BY 
                CASE 
                    WHEN s.fecha_aprobacion IS NULL THEN 1
                    WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 2
                    WHEN s.estado = 'pausada' THEN 3
                    ELSE 4
                END,
                s.creado_en DESC
            LIMIT $perPage OFFSET $offset
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $suscripciones = $stmt->fetchAll();

        $result = [];
        foreach ($suscripciones as $s) {
            $result[] = [
                'suscripcion_id' => (int)$s['suscripcion_id'],
                'escort' => [
                    'id' => (int)$s['escort_id'],
                    'nombre' => $s['escort_nombre'],
                    'email' => $s['escort_email'],
                    'telefono' => $s['telefono'],
                    'ciudad' => $s['ciudad'],
                    'foto_principal' => !empty($s['foto_principal'])
                        ? '/api/serve-upload.php?path=/' . ltrim($s['foto_principal'], '/')
                        : null,
                    'verificado' => (bool)$s['verificado'],
                    'vip' => (bool)$s['vip']
                ],
                'plan' => [
                    'id' => (int)$s['plan_id'],
                    'nombre' => $s['plan_nombre'],
                    'slug' => $s['plan_slug'],
                    'tipo' => $s['plan_tipo'],
                    'extra_tipo' => $s['extra_tipo'],
                    'duracion_dias' => (int)$s['duracion_dias'],
                    'precio' => (float)$s['plan_precio'],
                    'badge' => $s['plan_badge'],
                    'color' => $s['color_badge'],
                    'max_pausas_permitidas' => (int)$s['max_pausas_permitidas']
                ],
                'suscripcion' => [
                    'fecha_inicio' => $s['fecha_inicio'],
                    'fecha_aprobacion' => $s['fecha_aprobacion'],
                    'fecha_rechazo' => $s['fecha_rechazo'],
                    'fecha_fin' => $s['fecha_fin'],
                    'precio_pagado' => (float)$s['precio_pagado'],
                    'moneda' => $s['moneda'],
                    'estado' => $s['estado_calculado'],
                    'estado_raw' => $s['estado'],
                    'dias_restantes' => (int)$s['dias_restantes'],

                    'comprobante_pago' => !empty($s['comprobante_pago'])
                        ? '/api/serve-upload.php?path=/uploads/comprobantes/' . ltrim($s['comprobante_pago'], '/')
                        : null,
                    'creado_en' => $s['creado_en'],
                    'contador_pausas' => (int)$s['contador_pausas'],
                    'aprobado_por' => $s['aprobado_por_nombre'],
                    'rechazado_por' => $s['rechazado_por_nombre']
                ]
            ];
        }

        $stmtCounts = $pdo->query("
            SELECT 
                SUM(CASE WHEN s.fecha_aprobacion IS NULL AND (s.estado IS NULL OR s.estado = '' OR s.estado = 'pendiente_aprobacion') THEN 1 ELSE 0 END) as pendientes,
                SUM(CASE WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 1 ELSE 0 END) as activas,
                SUM(CASE WHEN s.estado = 'pausada' THEN 1 ELSE 0 END) as pausadas,
                SUM(CASE WHEN s.estado = 'expirada' OR (s.estado = 'activa' AND s.fecha_fin < CURDATE()) THEN 1 ELSE 0 END) as expiradas,
                SUM(CASE WHEN s.estado = 'rechazada' OR s.estado = 'cancelada' THEN 1 ELSE 0 END) as rechazadas,
                SUM(CASE WHEN s.estado = 'activa' AND s.fecha_fin = CURDATE() THEN 1 ELSE 0 END) as vencen_hoy,
                SUM(CASE WHEN s.estado = 'activa' AND s.fecha_fin > CURDATE() AND s.fecha_fin <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as por_vencer,
                SUM(CASE WHEN s.estado = 'activa' AND s.precio_pagado > 0 THEN s.precio_pagado ELSE 0 END) as recaudo
            FROM suscripciones s
            JOIN escorts e ON e.id = s.escort_id
            JOIN planes p ON p.id = s.plan_id
            WHERE e.eliminada = 0 AND p.tipo = 'extra'
        ");
        $counts = $stmtCounts->fetch();

        echo json_encode([
            'success' => true,
            'suscripciones' => $result,
            'pagination' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'total_pages' => ceil($total / $perPage)
            ],
            'counts' => [
                'todos' => $total,
                'pendientes' => (int)$counts['pendientes'],
                'activas' => (int)$counts['activas'],
                'pausadas' => (int)$counts['pausadas'],
                'expiradas' => (int)$counts['expiradas'],
                'rechazadas' => (int)$counts['rechazadas'],
                'vencen_hoy' => (int)$counts['vencen_hoy'],
                'por_vencer' => (int)$counts['por_vencer'],
                'recaudo' => (float)$counts['recaudo']
            ]
        ]);
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';
        $suscripcionId = intval($input['suscripcion_id'] ?? 0);
        $notas = trim($input['notas'] ?? '');
        $motivo = trim($input['motivo'] ?? '');

        if (!$suscripcionId || !in_array($action, ['aprobar', 'rechazar', 'cancelar', 'eliminar'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción o ID inválidos']);
            exit;
        }

        // Obtener datos de la suscripción
        $stmt = $pdo->prepare("
            SELECT s.*, e.nombre as escort_nombre, e.email as escort_email,
                   p.nombre as plan_nombre, p.duracion_dias, p.uso_unico, p.id as plan_id,
                   p.extra_tipo, p.tipo as plan_tipo
            FROM suscripciones s
            JOIN escorts e ON e.id = s.escort_id
            JOIN planes p ON p.id = s.plan_id
            WHERE s.id = ? AND e.eliminada = 0
        ");
        $stmt->execute([$suscripcionId]);
        $sub = $stmt->fetch();
        if (!$sub) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Suscripción no encontrada']);
            exit;
        }

        $pdo->beginTransaction();

        try {
            if ($action === 'aprobar') {
                if ($sub['fecha_aprobacion'] !== null) {
                    $pdo->rollBack();
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Esta suscripción ya fue aprobada']);
                    exit;
                }

                $fechaInicio = date('Y-m-d');
                $fechaFin = date('Y-m-d', strtotime("+{$sub['duracion_dias']} days"));

                // El extra no puede exceder el plan base activo de la escort
                $baseFinStmt = $pdo->prepare("
                    SELECT s.fecha_fin
                    FROM suscripciones s
                    JOIN planes p ON p.id = s.plan_id
                    WHERE s.escort_id = ? AND s.estado = 'activa' AND s.fecha_fin >= CURDATE() AND p.tipo = 'base'
                    ORDER BY s.fecha_fin DESC
                    LIMIT 1
                ");
                $baseFinStmt->execute([$sub['escort_id']]);
                $baseFin = $baseFinStmt->fetchColumn();
                if ($baseFin && $fechaFin > $baseFin) {
                    $fechaFin = $baseFin;
                }

                $upd = $pdo->prepare("UPDATE suscripciones SET estado = 'activa', fecha_aprobacion = ?, fecha_inicio = ?, fecha_fin = ?, aprobado_por = ?, actualizado_en = NOW() WHERE id = ?");
                $upd->execute([$fechaInicio, $fechaInicio, $fechaFin, $tokenData['id'], $suscripcionId]);

                if ($sub['uso_unico']) {
                    $pdo->prepare("INSERT IGNORE INTO planes_usados (plan_id, email, escort_id) VALUES (?, ?, ?)")->execute([$sub['plan_id'], $sub['escort_email'], $sub['escort_id']]);
                }

                $extraSets = '';
                $extraParams = [];
                if ($sub['extra_tipo'] === 'sticky') {
                    $extraSets = ', sticky = 1, sticky_expira = ?';
                    $extraParams[] = $fechaFin;
                } elseif ($sub['extra_tipo'] === 'destacado') {
                    $extraSets = ', destacado = 1, fecha_destacado_expira = ?';
                    $extraParams[] = $fechaFin;
                }

                $pdo->prepare("UPDATE escorts SET estado = 'aprobada'{$extraSets}, updated_at = NOW() WHERE id = ?")
                    ->execute(array_merge($extraParams, [$sub['escort_id']]));

                if ($sub['extra_tipo'] === 'sticky') {
                    $ciudadSticky = $pdo->prepare("SELECT c.id FROM ciudades c JOIN escorts e ON e.ciudad = c.nombre WHERE e.id = ?");
                    $ciudadSticky->execute([$sub['escort_id']]);
                    $ciudadIdSticky = (int)$ciudadSticky->fetchColumn();
                    if ($ciudadIdSticky > 0) {
                        $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ? AND ciudad_id = ?")
                            ->execute([$sub['escort_id'], $ciudadIdSticky]);
                        $maxOrdenSticky = $pdo->prepare("SELECT COALESCE(MAX(orden), 0) FROM sticky_posiciones WHERE ciudad_id = ?");
                        $maxOrdenSticky->execute([$ciudadIdSticky]);
                        $pdo->prepare("INSERT INTO sticky_posiciones (escort_id, ciudad_id, orden) VALUES (?, ?, ?)")
                            ->execute([$sub['escort_id'], $ciudadIdSticky, (int)$maxOrdenSticky->fetchColumn() + 1]);
                    }
                }

                $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address) VALUES (?, ?, 'aprobar_suscripcion', 'suscripciones', ?, ?, ?)")
                    ->execute([$tokenData['id'], $sub['escort_id'], $suscripcionId, json_encode(['suscripcion_id' => $suscripcionId, 'fecha_aprobacion' => $fechaInicio, 'fecha_fin' => $fechaFin]), $_SERVER['REMOTE_ADDR'] ?? null]);

                $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url) VALUES (?, 'sistema', 'Extra aprobado', ?, '/micuenta/mi-plan')")
                    ->execute([$sub['escort_id'], "Tu extra '{$sub['plan_nombre']}' ha sido aprobado. Válido hasta {$fechaFin}."]);

                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Extra aprobado correctamente', 'fecha_fin' => $fechaFin]);
                exit;
            }

            if ($action === 'rechazar') {
                if ($sub['fecha_aprobacion'] !== null && $sub['estado'] !== 'pendiente_aprobacion') {
                    $pdo->rollBack();
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Esta suscripción no puede ser rechazada']);
                    exit;
                }
                if (empty($motivo)) {
                    $pdo->rollBack();
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Motivo de rechazo requerido']);
                    exit;
                }

                $pdo->prepare("UPDATE suscripciones SET estado = 'rechazada', fecha_rechazo = NOW(), rechazado_por = ? WHERE id = ?")->execute([$tokenData['id'], $suscripcionId]);
                // Limpiar flags extra residuales en escorts (bug bloqueo de duplicado)
                $extraClean = '';
                if ($sub['extra_tipo'] === 'sticky') $extraClean = 'sticky = 0, sticky_orden = 0, sticky_expira = NULL, ';
                elseif ($sub['extra_tipo'] === 'destacado') $extraClean = 'destacado = 0, fecha_destacado_expira = NULL, ';
                if ($extraClean) {
                    $pdo->prepare("UPDATE escorts SET {$extraClean} updated_at = NOW() WHERE id = ?")->execute([$sub['escort_id']]);
                    if ($sub['extra_tipo'] === 'sticky') {
                        $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$sub['escort_id']]);
                    }
                }
                $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos) VALUES (?, ?, 'rechazar_suscripcion', 'suscripciones', ?, ?)")
                    ->execute([$tokenData['id'], $sub['escort_id'], $suscripcionId, json_encode(['motivo' => $motivo])]);
                $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url) VALUES (?, 'sistema', 'Extra rechazado', ?, '/micuenta/mi-plan')")
                    ->execute([$sub['escort_id'], "Tu extra '{$sub['plan_nombre']}' ha sido rechazado. Motivo: {$motivo}."]);

                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Extra rechazado']);
                exit;
            }

            if ($action === 'cancelar') {
                if (!in_array($sub['estado'], ['activa', 'pausada'])) {
                    $pdo->rollBack();
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Solo se pueden cancelar suscripciones activas o pausadas']);
                    exit;
                }

                $pdo->prepare("UPDATE suscripciones SET estado = 'cancelada', actualizado_en = NOW() WHERE id = ?")->execute([$suscripcionId]);
                // Limpiar flags extra en escorts
                $extraClean = '';
                if ($sub['extra_tipo'] === 'sticky') $extraClean = 'sticky = 0, sticky_orden = 0, sticky_expira = NULL, ';
                elseif ($sub['extra_tipo'] === 'destacado') $extraClean = 'destacado = 0, fecha_destacado_expira = NULL, ';
                $pdo->prepare("UPDATE escorts SET {$extraClean}updated_at = NOW() WHERE id = ?")->execute([$sub['escort_id']]);
                if ($sub['extra_tipo'] === 'sticky') {
                    $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$sub['escort_id']]);
                }

                $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id) VALUES (?, ?, 'cancelar_suscripcion', 'suscripciones', ?)")
                    ->execute([$tokenData['id'], $sub['escort_id'], $suscripcionId]);
                $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url) VALUES (?, 'sistema', 'Suscripción extra cancelada', ?, '/micuenta/mi-plan')")
                    ->execute([$sub['escort_id'], "Tu extra '{$sub['plan_nombre']}' ha sido cancelado."]);

                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Suscripción extra cancelada']);
                exit;
            }

            if ($action === 'eliminar') {
                // Backup a historial
                $estadoAnterior = in_array($sub['estado'], ['activa', 'expirada', 'cancelada', 'pausada', 'rechazada']) ? $sub['estado'] : null;
                $hist = $pdo->prepare("INSERT INTO suscripciones_historial (suscripcion_id, escort_id, plan_id, fecha_inicio, fecha_fin, precio_pagado, moneda, estado_anterior, notas_eliminacion, eliminado_por, eliminado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
                $hist->execute([$suscripcionId, $sub['escort_id'], $sub['plan_id'], $sub['fecha_inicio'], $sub['fecha_fin'], $sub['precio_pagado'], $sub['moneda'], $estadoAnterior, $notas, $tokenData['id']]);

                $extraClean = '';
                if ($sub['extra_tipo'] === 'sticky') $extraClean = 'sticky = 0, sticky_orden = 0, sticky_expira = NULL, ';
                elseif ($sub['extra_tipo'] === 'destacado') $extraClean = 'destacado = 0, fecha_destacado_expira = NULL, ';
                $pdo->prepare("UPDATE escorts SET {$extraClean}updated_at = NOW() WHERE id = ?")->execute([$sub['escort_id']]);
                if ($sub['extra_tipo'] === 'sticky') {
                    $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$sub['escort_id']]);
                }

                $pdo->prepare("DELETE FROM suscripciones WHERE id = ?")->execute([$suscripcionId]);
                if ($sub['uso_unico']) {
                    $pdo->prepare("DELETE FROM planes_usados WHERE plan_id = ? AND email = ?")->execute([$sub['plan_id'], $sub['escort_email']]);
                }

                $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos) VALUES (?, ?, 'eliminar_suscripcion', 'suscripciones', ?, ?)")
                    ->execute([$tokenData['id'], $sub['escort_id'], $suscripcionId, json_encode(['notas' => $notas])]);

                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Suscripción extra eliminada']);
                exit;
            }

            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción no válida']);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error solicitudes-extras.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error solicitudes-extras.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
