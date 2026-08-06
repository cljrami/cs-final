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

    requireAdminRole($tokenData);
    $adminId = $tokenData['id'] ?? $tokenData['admin_id'] ?? 0;
    if ($adminId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token invíƒÂ¡lido']);
        exit;
    }

    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // ============================================================
    // GET - Listar pagos (con filtros)
    // ============================================================
    if ($method === 'GET') {
        $estado = isset($_GET['estado']) ? trim($_GET['estado']) : 'todos';
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        $searchWhere = '';
        $searchParams = [];
        if ($search !== '') {
            $escapedSearch = str_replace(['%', '_'], ['\\%', '\\_'], $search);
            $likeParam = '%' . $escapedSearch . '%';
            $searchWhere = " AND (pago_id LIKE :searchId OR escort_id LIKE :searchEscortId OR escort_nombre LIKE :search1 OR escort_email LIKE :search2 OR escort_telefono LIKE :search3 OR plan_nombre LIKE :search4 OR concepto LIKE :search5)";
            $searchParams = [
                ':searchId' => $likeParam,
                ':searchEscortId' => $likeParam,
                ':search1' => $likeParam,
                ':search2' => $likeParam,
                ':search3' => $likeParam,
                ':search4' => $likeParam,
                ':search5' => $likeParam,
            ];
        }

        $estadoWhere = '';
        $estadoParams = [];
        if ($estado !== 'todos') {
            $estadoWhere = " AND estado_pago = :estado";
            $estadoParams = [':estado' => $estado];
        }

        // Data con UNION de todas las fuentes
        $sql = "
            SELECT * FROM (
                -- 1. Pagos reales
                SELECT 
                    p.id AS pago_id,
                    p.escort_id,
                    e.nombre AS escort_nombre,
                    e.email AS escort_email,
                    e.telefono AS escort_telefono,
                    e.activa AS escort_activa,
                    e.foto_principal AS escort_foto,
                    p.suscripcion_id,
                    p.plan_id,
                    COALESCE(pl.nombre, '(plan eliminado)') AS plan_nombre,
                    COALESCE(pl.tipo, 'pago') AS plan_tipo,
                    COALESCE(pl.duracion_dias, 0) AS duracion_dias,
                    COALESCE(pl.uso_unico, 0) AS uso_unico,
                    p.concepto,
                    p.monto,
                    p.moneda,
                    p.metodo_pago,
                    p.estado_pago,
                    p.comprobante_url,
                    COALESCE(p.notas, '') AS notas,
                    p.creado_en,
                    p.pagado_en,
                    'pago' AS origen
                FROM pagos p
                JOIN escorts e ON e.id = p.escort_id
                LEFT JOIN planes pl ON pl.id = p.plan_id

                UNION ALL

                -- 2. Suscripciones (base + extra) sin pago vinculado
                SELECT 
                    -(100000 + s.id) AS pago_id,
                    s.escort_id,
                    e.nombre AS escort_nombre,
                    e.email AS escort_email,
                    e.telefono AS escort_telefono,
                    e.activa AS escort_activa,
                    e.foto_principal AS escort_foto,
                    s.id AS suscripcion_id,
                    pl.id AS plan_id,
                    pl.nombre AS plan_nombre,
                    pl.tipo AS plan_tipo,
                    pl.duracion_dias,
                    COALESCE(pl.uso_unico, 0) AS uso_unico,
                    CASE WHEN pl.extra_tipo IS NOT NULL THEN pl.extra_tipo ELSE 'plan' END AS concepto,
                    s.precio_pagado AS monto,
                    COALESCE(s.moneda, 'CLP') AS moneda,
                    NULL AS metodo_pago,
                    CASE WHEN s.estado = 'activa' THEN 'completado' WHEN s.estado = 'rechazada' THEN 'rechazado' ELSE 'pendiente' END AS estado_pago,
                    s.comprobante_pago AS comprobante_url,
                    COALESCE(CONCAT(pl.tipo, ': ', pl.nombre), '') AS notas,
                    s.creado_en,
                    s.fecha_aprobacion AS pagado_en,
                    'suscripcion' AS origen
                FROM suscripciones s
                JOIN escorts e ON e.id = s.escort_id
                JOIN planes pl ON pl.id = s.plan_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM pagos p 
                    WHERE p.suscripcion_id = s.id 
                       OR (p.escort_id = s.escort_id AND p.plan_id = s.plan_id AND p.estado_pago != 'rechazado')
                )
                AND s.eliminada = 0

                UNION ALL

                -- 3. Solicitudes VIP
                SELECT 
                    (300000 + vs.id) AS pago_id,
                    vs.escort_id,
                    e.nombre AS escort_nombre,
                    e.email AS escort_email,
                    e.telefono AS escort_telefono,
                    e.activa AS escort_activa,
                    e.foto_principal AS escort_foto,
                    NULL AS suscripcion_id,
                    NULL AS plan_id,
                    CONCAT('VIP ', UCASE(vs.plan)) AS plan_nombre,
                    'vip' AS plan_tipo,
                    0 AS duracion_dias,
                    0 AS uso_unico,
                    'vip' AS concepto,
                    vs.precio_vip AS monto,
                    'CLP' AS moneda,
                    vs.metodo_pago,
                    CASE 
                        WHEN vs.estado = 'aprobado' THEN 'completado'
                        WHEN vs.estado = 'rechazado' THEN 'rechazado'
                        ELSE 'pendiente'
                    END AS estado_pago,
                    vs.comprobante_pago AS comprobante_url,
                    COALESCE(vs.admin_notas, '') AS notas,
                    vs.created_at AS creado_en,
                    vs.fecha_respuesta AS pagado_en,
                    'vip' AS origen
                FROM escort_vip_solicitudes vs
                JOIN escorts e ON e.id = vs.escort_id
            ) sub
            WHERE 1=1 $estadoWhere $searchWhere
            ORDER BY 
                CASE estado_pago 
                    WHEN 'pendiente' THEN 1 
                    WHEN 'completado' THEN 2 
                    ELSE 3 
                END,
                creado_en DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $pdo->prepare($sql);
        $allParams = array_merge($estadoParams, $searchParams);
        foreach ($allParams as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $pagos = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Normalizar comprobante URLs y foto
        foreach ($pagos as &$p) {
            $url = $p['comprobante_url'] ?? '';
            if (empty($url) || preg_match('/^(pendiente|sin_comprobante|none|null|sistema_reparacion)$/i', trim($url))) {
                $p['comprobante_url'] = null;
            } else {
                $p['comprobante_url'] = '/api/serve-upload.php?path=/' . ltrim($url, '/');
            }
            $foto = $p['escort_foto'] ?? '';
            $p['escort_foto'] = empty($foto) ? null : '/api/serve-upload.php?path=/' . ltrim($foto, '/');
        }
        unset($p);

        $totalFiltered = count($pagos);

        echo json_encode([
            'success' => true,
            'stats' => ['total' => $totalFiltered],
            'pagos' => $pagos,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltered,
                'pages' => 1,
                'hasMore' => false
            ]
        ]);
        exit;
    }

    // ============================================================
    // PUT - Aprobar o Rechazar pago
    // ============================================================
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        $estado = isset($input['estado']) && in_array($input['estado'], ['completado', 'rechazado'])
            ? $input['estado']
            : '';
        $notas = isset($input['notas']) ? trim($input['notas']) : '';

        if ($id <= 0 || empty($estado)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos invíƒÂ¡lidos']);
            exit;
        }

        // Obtener info del pago
        $checkStmt = $pdo->prepare("
            SELECT p.*, e.email AS escort_email, e.nombre AS escort_nombre, 
                   pl.duracion_dias, pl.tipo AS plan_tipo, pl.uso_unico, pl.nombre AS plan_nombre
            FROM pagos p
            JOIN escorts e ON e.id = p.escort_id
            LEFT JOIN planes pl ON pl.id = p.plan_id
            WHERE p.id = ?
        ");
        $checkStmt->execute([$id]);
        $pago = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$pago) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Pago no encontrado']);
            exit;
        }

        if ($pago['estado_pago'] !== 'pendiente') {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Este pago ya fue procesado']);
            exit;
        }

        $pdo->beginTransaction();

        try {
            // 1. Actualizar estado del pago
            $updatePago = $pdo->prepare("
                UPDATE pagos
                SET estado_pago = ?, notas = ?, pagado_en = NOW()
                WHERE id = ?
            ");
            $updatePago->execute([$estado, $notas, $id]);

            // 2. Si es APROBADO (completado), activar TODO
            if ($estado === 'completado') {
                $hoy = date('Y-m-d');
                $fechaFin = date('Y-m-d', strtotime("+{$pago['duracion_dias']} days"));

                // 2a. Aprobar suscripciíƒÂ³n
                if ($pago['suscripcion_id']) {
                    $updSus = $pdo->prepare("
                        UPDATE suscripciones
                        SET fecha_aprobacion = ?,
                            fecha_inicio = ?,
                            fecha_fin = ?,
                            estado = 'activa',
                            aprobado_por = ?
                        WHERE id = ?
                    ");
                    $updSus->execute([
                        $hoy,
                        $hoy,
                        $fechaFin,
                        $adminId,
                        $pago['suscripcion_id']
                    ]);
                }

                // 2b. Si es plan gratis de uso íƒÂºnico, registrar
                if ($pago['plan_tipo'] === 'base' && $pago['monto'] == 0 && $pago['uso_unico'] == 1) {
                    $usoStmt = $pdo->prepare("
                        INSERT INTO planes_usados (plan_id, email, escort_id, usado_en)
                        VALUES (?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE usado_en = NOW()
                    ");
                    $usoStmt->execute([
                        $pago['plan_id'],
                        $pago['escort_email'],
                        $pago['escort_id']
                    ]);
                }

                // 2c. Marcar como aprobada pero no activar (solo escort-aprobar.php activa)
                $updEscort = $pdo->prepare("
                    UPDATE escorts 
                    SET aprobada = 1,
                        estado = 'aprobada',
                        updated_at = NOW()
                    WHERE id = ?
                ");
                $updEscort->execute([$pago['escort_id']]);

                // 2d. Crear notificaciíƒÂ³n para la escort
                $notifStmt = $pdo->prepare("
                    INSERT INTO notificaciones 
                    (escort_id, tipo, titulo, mensaje, url, created_at)
                    VALUES (?, 'sistema', ?, ?, ?, NOW())
                ");
                $notifStmt->execute([
                    $pago['escort_id'],
                    'í‚Â¡Tu publicaciíƒÂ³n estíƒÂ¡ activa!',
                    'Tu pago fue aprobado. Tu anuncio ya es visible en el sitio.',
                    '/micuenta'
                ]);

                // 2e. Log de auditoríƒÂ­a
                $logStmt = $pdo->prepare("
                    INSERT INTO logs_auditoria 
                    (escort_id, accion, tabla_afectada, registro_id, datos_nuevos, created_at)
                    VALUES (?, 'pago_aprobado', 'pagos', ?, ?, NOW())
                ");
                $logStmt->execute([
                    $pago['escort_id'],
                    $id,
                    json_encode([
                        'estado_pago' => 'completado',
                        'suscripcion_aprobada' => true,
                        'escort_activada' => true,
                        'fecha_inicio' => $hoy,
                        'fecha_fin' => $fechaFin
                    ])
                ]);

                $mensaje = 'Pago aprobado. La escort ahora estíƒÂ¡ activa y visible.';
                $escortActivada = true;
            } else {
                // RECHAZADO
                // Si hay suscripciíƒÂ³n, marcarla como cancelada
                if ($pago['suscripcion_id']) {
                    $updSus = $pdo->prepare("
                        UPDATE suscripciones
                        SET estado = 'cancelada'
                        WHERE id = ?
                    ");
                    $updSus->execute([$pago['suscripcion_id']]);
                }

                // NotificaciíƒÂ³n de rechazo
                $notifStmt = $pdo->prepare("
                    INSERT INTO notificaciones 
                    (escort_id, tipo, titulo, mensaje, url, created_at)
                    VALUES (?, 'sistema', ?, ?, ?, NOW())
                ");
                $notifStmt->execute([
                    $pago['escort_id'],
                    'Pago rechazado',
                    'Tu pago fue rechazado. Motivo: ' . ($notas ?: 'Sin especificar') . '. Por favor contacta al administrador.',
                    '/micuenta/planes'
                ]);

                $mensaje = 'Pago rechazado.';
                $escortActivada = false;
            }

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => $mensaje,
                'escort_activada' => $escortActivada,
                'pago' => [
                    'id' => $id,
                    'estado' => $estado,
                    'escort_id' => $pago['escort_id'],
                    'escort_nombre' => $pago['escort_nombre']
                ]
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        exit;
    }

    // ============================================================
    // POST - Crear pago manual
    // ============================================================
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $escortId = intval($input['escort_id'] ?? 0);
        $planId = !empty($input['plan_id']) ? intval($input['plan_id']) : null;
        $concepto = trim($input['concepto'] ?? '');
        $monto = floatval($input['monto'] ?? 0);
        $moneda = trim($input['moneda'] ?? 'CLP');
        $metodoPago = trim($input['metodo_pago'] ?? 'transferencia');
        $notas = trim($input['notas'] ?? '');
        $estadoPago = in_array($input['estado_pago'] ?? '', ['pendiente', 'completado', 'rechazado']) ? $input['estado_pago'] : 'pendiente';

        if ($escortId <= 0 || $monto <= 0 || empty($concepto)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos invíƒÂ¡lidos: escort, monto y concepto requeridos']);
            exit;
        }

        // Verificar que la escort existe
        $check = $pdo->prepare("SELECT id, nombre, email FROM escorts WHERE id = ? AND eliminada = 0");
        $check->execute([$escortId]);
        $escort = $check->fetch();
        if (!$escort) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
            exit;
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("
                INSERT INTO pagos (escort_id, plan_id, concepto, monto, moneda, metodo_pago, estado_pago, notas, creado_en, pagado_en)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
            ");
            $pagadoEn = $estadoPago === 'completado' ? date('Y-m-d H:i:s') : null;
            $stmt->execute([$escortId, $planId, $concepto, $monto, $moneda, $metodoPago, $estadoPago, $notas, $pagadoEn]);
            $pagoId = (int)$pdo->lastInsertId();

            // Si el pago se crea como completado, marcar aprobada pero no activar
            if ($estadoPago === 'completado') {
                $upd = $pdo->prepare("UPDATE escorts SET aprobada = 1, estado = 'aprobada', updated_at = NOW() WHERE id = ?");
                $upd->execute([$escortId]);

                $notifStmt = $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) VALUES (?, 'sistema', 'Pago registrado', ?, '/micuenta')");
                $notifStmt->execute([$escortId, 'Se ha registrado un pago manual. Tu anuncio estíƒÂ¡ activo.']);
            }

            $logStmt = $pdo->prepare("INSERT INTO logs_auditoria (escort_id, accion, tabla_afectada, registro_id, datos_nuevos, created_at) VALUES (?, 'pago_creado', 'pagos', ?, ?, NOW())");
            $logStmt->execute([$escortId, $pagoId, json_encode($input)]);

            $pdo->commit();

            echo json_encode(['success' => true, 'message' => 'Pago creado correctamente', 'pago_id' => $pagoId]);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        exit;
    }

    // ============================================================
    // DELETE - Eliminar pago (o suscripciíƒÂ³n extra si id < 0)
    // ============================================================
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if ($id === 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID invíƒÂ¡lido']);
            exit;
        }

        $pdo->beginTransaction();
        try {
            if ($id < 0) {
                // Extra subscription (suscripciones table)
                $subId = -$id;
                $sub = $pdo->prepare("
                    SELECT s.*, p.extra_tipo, p.uso_unico, p.nombre as plan_nombre, p.tipo as plan_tipo,
                           e.nombre as escort_nombre, e.email as escort_email
                    FROM suscripciones s
                    JOIN planes p ON p.id = s.plan_id
                    JOIN escorts e ON e.id = s.escort_id
                    WHERE s.id = ?
                ");
                $sub->execute([$subId]);
                $suscripcion = $sub->fetch();
                if (!$suscripcion) {
                    $pdo->rollBack();
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'SuscripciíƒÂ³n extra no encontrada']);
                    exit;
                }

                $pdo->prepare("INSERT INTO suscripciones_historial (suscripcion_id, escort_id, plan_id, fecha_inicio, fecha_fin, precio_pagado, moneda, estado_anterior, notas_eliminacion, eliminado_por, eliminado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())")
                    ->execute([$subId, $suscripcion['escort_id'], $suscripcion['plan_id'], $suscripcion['fecha_inicio'], $suscripcion['fecha_fin'], $suscripcion['precio_pagado'], $suscripcion['moneda'], $suscripcion['estado'], 'Eliminado desde pagos', $tokenData['id']]);

                $extraClean = '';
                if ($suscripcion['extra_tipo'] === 'sticky') $extraClean = 'sticky = 0, sticky_orden = 0, sticky_expira = NULL, ';
                elseif ($suscripcion['extra_tipo'] === 'destacado') $extraClean = 'destacado = 0, fecha_destacado_expira = NULL, ';
                $pdo->prepare("UPDATE escorts SET {$extraClean}updated_at = NOW() WHERE id = ?")->execute([$suscripcion['escort_id']]);
                if ($suscripcion['extra_tipo'] === 'sticky') {
                    $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$suscripcion['escort_id']]);
                }

                $pdo->prepare("DELETE FROM suscripciones WHERE id = ?")->execute([$subId]);
                if ($suscripcion['uso_unico']) {
                    $pdo->prepare("DELETE FROM planes_usados WHERE plan_id = ? AND email = ?")->execute([$suscripcion['plan_id'], $suscripcion['escort_email']]);
                }

                $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address) VALUES (?, ?, 'eliminar_suscripcion', 'suscripciones', ?, ?, ?)")
                    ->execute([$tokenData['id'], $suscripcion['escort_id'], $subId, json_encode(['notas' => 'Eliminado desde pagos']), $_SERVER['REMOTE_ADDR'] ?? null]);
            } else {
                // Real pago (pagos table)
                $check = $pdo->prepare("SELECT p.*, e.nombre as escort_nombre FROM pagos p JOIN escorts e ON e.id = p.escort_id WHERE p.id = ?");
                $check->execute([$id]);
                $pago = $check->fetch();
                if (!$pago) {
                    $pdo->rollBack();
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Pago no encontrado']);
                    exit;
                }

                $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address) VALUES (?, ?, 'pago_eliminado', 'pagos', ?, ?, ?)")
                    ->execute([$tokenData['id'], $pago['escort_id'], $id, json_encode(['pago_eliminado' => $pago]), $_SERVER['REMOTE_ADDR'] ?? null]);

                $pdo->prepare("DELETE FROM pagos WHERE id = ?")->execute([$id]);
            }

            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Eliminado correctamente']);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);
} catch (PDOException $e) {
    error_log("Error admin/pagos.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error admin/pagos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

