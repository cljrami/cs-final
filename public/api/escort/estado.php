<?php
// public/api/escort/estado.php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

$pdo = getDBConnection();
// ─── AUTH ───────────────────────────────────────────────
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? '';
$token = str_replace('Bearer ', '', $authHeader);

if (empty($token)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Token no proporcionado']);
    exit;
}

// Decodificar token (mismo formato que en escortAuth.ts)
$escort_id = null;
try {
    $tokenData = verifyToken($token);
    if (!$tokenData || !isset($tokenData['id']) || !isset($tokenData['exp'])) {
        throw new Exception('Token inválido');
    }
    if ($tokenData['exp'] < time()) {
        throw new Exception('Token expirado');
    }
    $escort_id = (int)$tokenData['id'];
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Token inválido: ' . $e->getMessage()]);
    exit;
}

// ─── DB ─────────────────────────────────────────────────
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de conexión']);
    exit;
}

// ════════════════════════════════════════════════════════
// GET  → Obtener estado actual
// ════════════════════════════════════════════════════════
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $pdo->prepare("
            SELECT 
                e.estado as estado,
                e.activa as escort_activa,
                s.estado as suscripcion_estado,
                v.dias_restantes_calculados,
                v.puede_pausar,
                v.puede_reactivar,
                v.motivo_no_pausar,
                v.plan_vigente,
                v.estado_texto
            FROM escorts e
            LEFT JOIN suscripciones s ON s.escort_id = e.id 
                AND s.estado IN ('activa','pausada')
                AND s.eliminada = 0
            LEFT JOIN v_escort_plan_activo v ON v.escort_id = e.id
            WHERE e.id = ? AND e.eliminada = 0
            LIMIT 1
        ");
        $stmt->execute([$escort_id]);
        $data = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$data) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
            exit;
        }

        // Normalizar tipos
        $data['puede_pausar'] = (int)$data['puede_pausar'];
        $data['puede_reactivar'] = (int)$data['puede_reactivar'];
        $data['plan_vigente'] = (int)$data['plan_vigente'];
        $data['dias_restantes_calculados'] = $data['dias_restantes_calculados'] !== null
            ? (int)$data['dias_restantes_calculados']
            : null;

        echo json_encode(['success' => true, 'data' => $data]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
    }
    exit;
}

// ════════════════════════════════════════════════════════
// POST → Cambiar estado
// ════════════════════════════════════════════════════════
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $nuevo_estado = $input['estado'] ?? null;

    $estados_permitidos = [
        'activa',
        'pausada',
        ];

    if (!in_array($nuevo_estado, $estados_permitidos, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Estado no válido']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // ── Validar que la escort existe ──
        $stmt = $pdo->prepare("SELECT id, nombre, email FROM escorts WHERE id = ? AND eliminada = 0");
        $stmt->execute([$escort_id]);
        $escort = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$escort) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
            exit;
        }

        // ── Si es activa/pausada: validar contra la vista del plan ──
        if (in_array($nuevo_estado, ['activa', 'pausada'], true)) {
            $stmt = $pdo->prepare("
                SELECT puede_pausar, puede_reactivar, motivo_no_pausar, plan_vigente
                FROM v_escort_plan_activo 
                WHERE escort_id = ?
            ");
            $stmt->execute([$escort_id]);
            $planInfo = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($nuevo_estado === 'pausada' && (!$planInfo || !$planInfo['puede_pausar'])) {
                $pdo->rollBack();
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error' => $planInfo['motivo_no_pausar'] ?? 'No puedes pausar en este momento'
                ]);
                exit;
            }

            if ($nuevo_estado === 'activa' && (!$planInfo || !$planInfo['puede_reactivar'] && $planInfo['plan_vigente'] == 0)) {
                // Si no puede reactivar porque no está pausada, permitir igual (cambio de offline a activa)
                // Solo bloquear si está expirada
                if ($planInfo && $planInfo['plan_vigente'] == 0 && $planInfo['puede_reactivar'] == 0) {
                    // Verificar si tiene suscripción pausada o activa
                    $stmt = $pdo->prepare("
                        SELECT id FROM suscripciones 
                        WHERE escort_id = ? AND estado IN ('activa','pausada') AND eliminada = 0
                    ");
                    $stmt->execute([$escort_id]);
                    if (!$stmt->fetch()) {
                        $pdo->rollBack();
                        http_response_code(403);
                        echo json_encode([
                            'success' => false,
                            'error' => 'No tienes un plan vigente. Renueva tu plan para activar tu anuncio.'
                        ]);
                        exit;
                    }
                }
            }

            // Actualizar suscripción
            $nuevoEstadoSuscripcion = $nuevo_estado === 'activa' ? 'activa' : 'pausada';
            $stmt = $pdo->prepare("
                UPDATE suscripciones 
                SET estado = ?, 
                    fecha_reactivacion = CASE WHEN ? = 'activa' AND estado = 'pausada' THEN CURDATE() ELSE fecha_reactivacion END,
                    actualizado_en = NOW() 
                WHERE escort_id = ? 
                AND estado IN ('activa', 'pausada') 
                AND eliminada = 0
                ORDER BY id DESC 
                LIMIT 1
            ");
            $stmt->execute([$nuevoEstadoSuscripcion, $nuevoEstadoSuscripcion, $escort_id]);

            // Si hay historial de pausas, registrar
            if ($nuevo_estado === 'pausada' && $stmt->rowCount() > 0) {
                $stmt = $pdo->prepare("
                    SELECT id FROM suscripciones 
                    WHERE escort_id = ? AND estado = 'pausada' AND eliminada = 0
                    ORDER BY id DESC LIMIT 1
                ");
                $stmt->execute([$escort_id]);
                $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($suscripcion) {
                    $stmt = $pdo->prepare("
                        INSERT INTO historial_pausas 
                        (suscripcion_id, escort_id, accion, dias_acumulados_pausa, notas, realizado_por) 
                        VALUES (?, ?, 'pausa', 0, 'Pausa desde panel de escort', NULL)
                    ");
                    $stmt->execute([$suscripcion['id'], $escort_id]);
                }
            }

            if ($nuevo_estado === 'activa' && $stmt->rowCount() > 0) {
                $stmt = $pdo->prepare("
                    SELECT id FROM suscripciones 
                    WHERE escort_id = ? AND estado = 'activa' AND eliminada = 0
                    ORDER BY id DESC LIMIT 1
                ");
                $stmt->execute([$escort_id]);
                $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($suscripcion) {
                    $stmt = $pdo->prepare("
                        INSERT INTO historial_pausas 
                        (suscripcion_id, escort_id, accion, dias_acumulados_pausa, notas, realizado_por) 
                        VALUES (?, ?, 'reactivacion', 0, 'Reactivación desde panel de escort', NULL)
                    ");
                    $stmt->execute([$suscripcion['id'], $escort_id]);
                }
            }
        }

        // ── Actualizar campo estado en escorts ──
        $stmt = $pdo->prepare("UPDATE escorts SET estado = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$nuevo_estado, $escort_id]);

        // ── Log de auditoría ──
        $stmt = $pdo->prepare("
            INSERT INTO logs_auditoria 
            (escort_id, accion, tabla_afectada, datos_nuevos, ip_address, user_agent, created_at) 
            VALUES (?, 'cambio_estado', 'escorts', ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $escort_id,
            json_encode([
                'estado_anterior' => $input['estado_anterior'] ?? 'desconocido',
                'estado_nuevo' => $nuevo_estado
            ]),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

        // ── Crear notificación ──
        $stmt = $pdo->prepare("
            INSERT INTO notificaciones 
            (escort_id, tipo, titulo, mensaje, leida, created_at) 
            VALUES (?, 'sistema', ?, ?, 0, NOW())
        ");
        $titulo = 'Estado actualizado';
        $mensaje = 'Tu estado ha cambiado a: ' . ucfirst(str_replace('_', ' ', $nuevo_estado));
        $stmt->execute([$escort_id, $titulo, $mensaje]);

        $pdo->commit();

        // ── Retornar datos actualizados ──
        $stmt = $pdo->prepare("
            SELECT 
                e.estado as estado,
                e.activa as escort_activa,
                s.estado as suscripcion_estado,
                v.dias_restantes_calculados,
                v.puede_pausar,
                v.puede_reactivar,
                v.motivo_no_pausar,
                v.plan_vigente,
                v.estado_texto
            FROM escorts e
            LEFT JOIN suscripciones s ON s.escort_id = e.id 
                AND s.estado IN ('activa','pausada')
                AND s.eliminada = 0
            LEFT JOIN v_escort_plan_activo v ON v.escort_id = e.id
            WHERE e.id = ?
            LIMIT 1
        ");
        $stmt->execute([$escort_id]);
        $data = $stmt->fetch(PDO::FETCH_ASSOC);

        $data['puede_pausar'] = (int)$data['puede_pausar'];
        $data['puede_reactivar'] = (int)$data['puede_reactivar'];
        $data['plan_vigente'] = (int)$data['plan_vigente'];
        $data['dias_restantes_calculados'] = $data['dias_restantes_calculados'] !== null
            ? (int)$data['dias_restantes_calculados']
            : null;

        echo json_encode(['success' => true, 'data' => $data]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error inesperado: ' . $e->getMessage()]);
    }
    exit;
}

// Método no permitido
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido']);
