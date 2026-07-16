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
    $adminId = $tokenData['id'] ?? $tokenData['admin_id'] ?? 0;
    if ($adminId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
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

        // Stats (incluye suscripciones extra como filas virtuales)
        $statsTotal = (int)$pdo->query("
            SELECT COUNT(*) FROM (
                SELECT id FROM pagos
                UNION ALL
                SELECT s.id FROM suscripciones s
                JOIN planes pl ON pl.id = s.plan_id AND pl.tipo = 'extra'
                WHERE s.estado IN ('activa','pendiente_aprobacion')
                AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.suscripcion_id = s.id)
            ) t
        ")->fetchColumn();
        $stats = [
            'total' => $statsTotal,
            'pendientes' => $statsTotal,
            'completados' => $statsTotal,
            'rechazados' => 0,
        ];

        $searchWhere = '';
        $searchParams = [];
        if ($search !== '') {
            $searchWhere = " AND (e.nombre LIKE :search1 OR e.email LIKE :search2)";
            $searchParams = [':search1' => '%' . $search . '%', ':search2' => '%' . $search . '%'];
        }

        $estadoWhere = '';
        $estadoParams = [];
        if ($estado !== 'todos') {
            $estadoWhere = " AND p.estado_pago = :estado";
            $estadoParams = [':estado' => $estado];
        }

        // Count con UNION
        $countSql = "
            SELECT COUNT(*) FROM (
                SELECT p.id FROM pagos p
                JOIN escorts e ON e.id = p.escort_id
                LEFT JOIN planes pl ON pl.id = p.plan_id
                WHERE 1=1 $estadoWhere $searchWhere
                UNION ALL
                SELECT s.id FROM suscripciones s
                JOIN escorts e ON e.id = s.escort_id
                JOIN planes pl ON pl.id = s.plan_id AND pl.tipo = 'extra'
                WHERE s.estado IN ('activa','pendiente_aprobacion')
                AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.suscripcion_id = s.id)
                $searchWhere
            ) t
        ";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute(array_merge($estadoParams, $searchParams));
        $totalFiltered = (int)$countStmt->fetchColumn();

        // Data con UNION
        $sql = "
            SELECT * FROM (
                SELECT 
                    p.id AS pago_id,
                    p.escort_id,
                    e.nombre AS escort_nombre,
                    e.email AS escort_email,
                    e.telefono AS escort_telefono,
                    e.activa AS escort_activa,
                    p.suscripcion_id,
                    p.plan_id,
                    COALESCE(pl.nombre, '(plan eliminado)') AS plan_nombre,
                    pl.tipo AS plan_tipo,
                    pl.duracion_dias,
                    pl.uso_unico,
                    p.concepto,
                    p.monto,
                    p.moneda,
                    p.metodo_pago,
                    p.estado_pago,
                    p.comprobante_url,
                    p.notas,
                    p.creado_en,
                    p.pagado_en,
                    NULL AS suscripcion_aprobada,
                    NULL AS fecha_inicio,
                    NULL AS fecha_fin,
                    'pago' AS origen
                FROM pagos p
                JOIN escorts e ON e.id = p.escort_id
                LEFT JOIN planes pl ON pl.id = p.plan_id
                WHERE 1=1 $estadoWhere $searchWhere

                UNION ALL

                SELECT 
                    -(s.id) AS pago_id,
                    s.escort_id,
                    e.nombre AS escort_nombre,
                    e.email AS escort_email,
                    e.telefono AS escort_telefono,
                    e.activa AS escort_activa,
                    s.id AS suscripcion_id,
                    pl.id AS plan_id,
                    pl.nombre AS plan_nombre,
                    pl.tipo AS plan_tipo,
                    pl.duracion_dias,
                    pl.uso_unico,
                    'plan' AS concepto,
                    pl.precio AS monto,
                    pl.moneda,
                    NULL AS metodo_pago,
                    CASE WHEN s.estado = 'activa' THEN 'completado' ELSE 'pendiente' END AS estado_pago,
                    s.comprobante_pago AS comprobante_url,
                    CONCAT('Extra contratado: ', pl.nombre) AS notas,
                    s.creado_en,
                    NULL AS pagado_en,
                    s.fecha_aprobacion AS suscripcion_aprobada,
                    s.fecha_inicio,
                    s.fecha_fin,
                    'extra' AS origen
                FROM suscripciones s
                JOIN escorts e ON e.id = s.escort_id
                JOIN planes pl ON pl.id = s.plan_id AND pl.tipo = 'extra'
                WHERE s.estado IN ('activa','pendiente_aprobacion')
                AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.suscripcion_id = s.id)
                $searchWhere
            ) sub
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

        // Proxy comprobante URLs
        foreach ($pagos as &$p) {
            if (!empty($p['comprobante_url'])) {
                $p['comprobante_url'] = '/api/serve-upload.php?path=/' . ltrim($p['comprobante_url'], '/');
            }
        }
        unset($p);

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'pagos' => $pagos,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltered,
                'pages' => ceil($totalFiltered / $limit),
                'hasMore' => ($page * $limit) < $totalFiltered
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
            echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
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

                // 2a. Aprobar suscripción
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

                // 2b. Si es plan gratis de uso único, registrar
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

                // 2c. ACTIVAR LA ESCORT (activa = 1) - ESTO ES LO CLAVE
                // Recién ahora aparece en index y perfil público
                $updEscort = $pdo->prepare("
                    UPDATE escorts 
                    SET activa = 1, 
                        aprobada = 1,
                        estado = 'aprobada',
                        updated_at = NOW()
                    WHERE id = ?
                ");
                $updEscort->execute([$pago['escort_id']]);

                // 2d. Crear notificación para la escort
                $notifStmt = $pdo->prepare("
                    INSERT INTO notificaciones 
                    (escort_id, tipo, titulo, mensaje, url, created_at)
                    VALUES (?, 'sistema', ?, ?, ?, NOW())
                ");
                $notifStmt->execute([
                    $pago['escort_id'],
                    'Â¡Tu publicación está activa!',
                    'Tu pago fue aprobado. Tu anuncio ya es visible en el sitio.',
                    '/micuenta'
                ]);

                // 2e. Log de auditoría
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

                $mensaje = 'Pago aprobado. La escort ahora está activa y visible.';
                $escortActivada = true;
            } else {
                // RECHAZADO
                // Si hay suscripción, marcarla como cancelada
                if ($pago['suscripcion_id']) {
                    $updSus = $pdo->prepare("
                        UPDATE suscripciones
                        SET estado = 'cancelada'
                        WHERE id = ?
                    ");
                    $updSus->execute([$pago['suscripcion_id']]);
                }

                // Notificación de rechazo
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

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error admin/pagos.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Error admin/pagos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
