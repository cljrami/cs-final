<?php
// public/api/escort/estado.php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/plan_pausas.php';

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
    echo json_encode(['success' => false, 'error' => 'Token inválido']);
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
                e.disponible_ahora,
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
// POST → Cambiar estado (pausar / reactivar)
// ════════════════════════════════════════════════════════
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $nuevo_estado = $input['estado'] ?? null;

    if (!in_array($nuevo_estado, ['activa', 'pausada'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Estado no válido']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        $act = $pdo->prepare("SELECT id, nombre, foto_principal FROM escorts WHERE id = ? AND eliminada = 0");
        $act->execute([$escort_id]);
        $escort = $act->fetch(PDO::FETCH_ASSOC);
        if (!$escort) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
            exit;
        }

        // ─── PAUSAR ─────────────────────────────────────────────
        if ($nuevo_estado === 'pausada') {
            $stmt = $pdo->prepare("
                SELECT s.id, s.estado, p.max_pausas_permitidas, p.duracion_dias
                FROM suscripciones s
                JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL AND p.tipo = 'base'
                WHERE s.escort_id = ? AND s.estado = 'activa' AND s.eliminada = 0
                ORDER BY s.id DESC LIMIT 1
            ");
            $stmt->execute([$escort_id]);
            $sub = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$sub) {
                $pdo->rollBack();
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'No tienes un plan activo para pausar']);
                exit;
            }

            if (!(int)$sub['max_pausas_permitidas']) {
                $pdo->rollBack();
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Tu plan no permite pausas']);
                exit;
            }

            // Contar pausas usadas
            $cp = $pdo->prepare("SELECT COUNT(*) FROM historial_pausas WHERE suscripcion_id = ? AND accion = 'pausa'");
            $cp->execute([$sub['id']]);
            $pausasUsadas = (int)$cp->fetchColumn();

            if ($pausasUsadas >= (int)$sub['max_pausas_permitidas']) {
                $pdo->rollBack();
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Límite de ' . $sub['max_pausas_permitidas'] . ' pausas alcanzado']);
                exit;
            }

            // Plazo para usar pausas (desde la primera pausa, calendario real)
            $plazo = plan_plazo_pausas($pdo, $sub['id'], (int)$sub['duracion_dias']);
            if ($plazo['vencido']) {
                $pdo->rollBack();
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Tu plazo para usar pausas venció el ' . date('d/m/Y', strtotime($plazo['limite']))]);
                exit;
            }

            // Pausar plan base (reloj congelado: fecha_fin no cambia, se fija fecha_pausa)
            $pdo->prepare("
                UPDATE suscripciones SET estado = 'pausada', fecha_pausa = CURDATE(),
                    dias_restantes = NULL, actualizado_en = NOW()
                WHERE id = ?
            ")->execute([$sub['id']]);

            // Pausar todos los extras activos (misma escort, plan con extra_tipo, estado = 'activa')
            $extras = $pdo->prepare("
                SELECT s.id, s.creado_en, s.fecha_fin, s.dias_pausados, p.duracion_dias
                FROM suscripciones s
                JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NOT NULL
                WHERE s.escort_id = ? AND s.estado = 'activa' AND s.eliminada = 0
            ");
            $extras->execute([$escort_id]);
            foreach ($extras->fetchAll(PDO::FETCH_ASSOC) as $extra) {
                $fechaEspExtra = (new DateTime($extra['creado_en']))->modify("+{$extra['duracion_dias']} days");
                $diasPausExtra = (int)($extra['dias_pausados'] ?? 0);
                if ($diasPausExtra > 0) {
                    $fechaEspExtra->modify("+{$diasPausExtra} days");
                }
                $restExtra = max(0, (int)(new DateTime())->diff($fechaEspExtra)->days);
                $pdo->prepare("
                    UPDATE suscripciones SET estado = 'pausada', fecha_pausa = CURDATE(),
                        dias_restantes = ?, actualizado_en = NOW()
                    WHERE id = ?
                ")->execute([$restExtra, $extra['id']]);
            }

            // Ocultar escort + limpiar sticky
            $pdo->prepare("UPDATE escorts SET activa = 0, sticky = 0, sticky_orden = 0, sticky_expira = NULL, updated_at = NOW() WHERE id = ?")->execute([$escort_id]);
            $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$escort_id]);

            // Historial
            $pdo->prepare("INSERT INTO historial_pausas (suscripcion_id, escort_id, accion, notas) VALUES (?, ?, 'pausa', 'Pausa desde panel de escort')")
                ->execute([$sub['id'], $escort_id]);

            // Notificaciones
            $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) VALUES (?, 'sistema', 'Plan pausado', ?, '/mi-cuenta/mi-plan', NOW())")
                ->execute([$escort_id, "Tu plan ha sido pausado. Mientras esté pausado, el tiempo de tu plan no corre."]);
            $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id, created_at) VALUES (NULL, 'sistema', 'Pausó su plan', ?, '/admin/escorts', ?, NOW())")
                ->execute(["La escort {$escort['nombre']} ha pausado su plan.", $escort_id]);
        }

        // ─── REACTIVAR ─────────────────────────────────────────
        if ($nuevo_estado === 'activa') {
            $stmt = $pdo->prepare("
                SELECT s.id, s.creado_en, s.fecha_fin, s.fecha_pausa, s.dias_pausados,
                       p.duracion_dias
                FROM suscripciones s
                JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NULL AND p.tipo = 'base'
                WHERE s.escort_id = ? AND s.estado = 'pausada' AND s.eliminada = 0
                ORDER BY s.id DESC LIMIT 1
            ");
            $stmt->execute([$escort_id]);
            $sub = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$sub) {
                $pdo->rollBack();
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'No tienes un plan pausado para reactivar']);
                exit;
            }

            // Modelo unificado: sumar la duración real de la pausa y recalcular fecha_fin desde la base
            $diasEstaPausa = plan_dias_esta_pausa($sub['fecha_pausa']);
            $diasPausadosTotal = (int)($sub['dias_pausados'] ?? 0) + $diasEstaPausa;

            // Reactivar plan base
            $pdo->prepare("
                UPDATE suscripciones SET estado = 'activa',
                    fecha_pausa = NULL, dias_restantes = NULL,
                    dias_pausados = ?, fecha_reactivacion = CURDATE(), actualizado_en = NOW()
                WHERE id = ?
            ")->execute([$diasPausadosTotal, $sub['id']]);
            $nuevaFechaFin = plan_recalcular_fecha_fin($pdo, $sub['id']);

            // Reactivar extras pausados
            $extras = $pdo->prepare("
                SELECT s.id, s.creado_en, s.dias_restantes, s.dias_pausados, p.duracion_dias
                FROM suscripciones s
                JOIN planes p ON p.id = s.plan_id AND p.extra_tipo IS NOT NULL
                WHERE s.escort_id = ? AND s.estado = 'pausada' AND s.eliminada = 0
            ");
            $extras->execute([$escort_id]);
            foreach ($extras->fetchAll(PDO::FETCH_ASSOC) as $extra) {
                $fechaEspExtra = (new DateTime($extra['creado_en']))->modify("+{$extra['duracion_dias']} days");
                $diasPausExtra = (int)($extra['dias_pausados'] ?? 0);
                if ($diasPausExtra > 0) {
                    $fechaEspExtra->modify("+{$diasPausExtra} days");
                }
                $restExtra = max(0, (int)(new DateTime())->diff($fechaEspExtra)->days);
                if ($restExtra > 0) {
                    $nuevaFinExtra = (new DateTime())->modify("+{$restExtra} days");
                    $pdo->prepare("UPDATE suscripciones SET estado = 'activa', fecha_fin = ?, fecha_pausa = NULL, dias_restantes = NULL, actualizado_en = NOW() WHERE id = ?")
                        ->execute([$nuevaFinExtra->format('Y-m-d'), $extra['id']]);
                }
            }

            // Mostrar escort en el directorio
            $pdo->prepare("UPDATE escorts SET activa = 1, updated_at = NOW() WHERE id = ?")->execute([$escort_id]);

            // Restaurar sticky si hay extra sticky activo
            $stChk = $pdo->prepare("
                SELECT s.id FROM suscripciones s
                JOIN planes p ON p.id = s.plan_id AND p.extra_tipo = 'sticky'
                WHERE s.escort_id = ? AND s.estado = 'activa' AND s.fecha_fin >= CURDATE() AND s.eliminada = 0
                LIMIT 1
            ");
            $stChk->execute([$escort_id]);
            if ($stChk->fetch()) {
                $pdo->prepare("UPDATE escorts SET sticky = 1 WHERE id = ?")->execute([$escort_id]);
            }

            // Historial
            $pdo->prepare("INSERT INTO historial_pausas (suscripcion_id, escort_id, accion, notas) VALUES (?, ?, 'reactivacion', 'Reactivación desde panel de escort')")
                ->execute([$sub['id'], $escort_id]);

            // Notificaciones
            $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) VALUES (?, 'sistema', 'Plan reactivado', ?, '/mi-cuenta/mi-plan', NOW())")
                ->execute([$escort_id, "Tu plan ha sido reactivado. Vence el " . ($nuevaFechaFin ? date('d/m/Y', strtotime($nuevaFechaFin)) : '—') . "."]);
            $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id, created_at) VALUES (NULL, 'sistema', 'Reactivó su plan', ?, '/admin/escorts', ?, NOW())")
                ->execute(["La escort {$escort['nombre']} ha reactivado su plan.", $escort_id]);
        }

        // ─── LOG DE AUDITORIA ──────────────────────────────────
        $pdo->prepare("INSERT INTO logs_auditoria (escort_id, accion, tabla_afectada, datos_nuevos, ip_address, user_agent, created_at) VALUES (?, 'cambio_estado', 'escorts', ?, ?, ?, NOW())")
            ->execute([
                $escort_id,
                json_encode(['estado_nuevo' => $nuevo_estado]),
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null
            ]);

        $pdo->commit();

        // ─── NOTIFICAR POR EMAIL ──────────────────────────────
        require_once __DIR__ . '/../mail.php';
        $accionTexto = $nuevo_estado === 'pausada' ? 'pausó su plan' : 'reactivó su plan';
        notificarAccionEscort('planes', $escort_id, $escort['nombre'] . ' ' . $accionTexto, [
            'Estado' => $nuevo_estado === 'pausada' ? 'Pausada' : 'Activa',
        ]);

        // ─── RETORNAR DATOS ACTUALIZADOS ──────────────────────
        $stmt = $pdo->prepare("
            SELECT e.estado, e.activa as escort_activa, e.disponible_ahora, s.estado as suscripcion_estado,
                   v.dias_restantes_calculados, v.puede_pausar, v.puede_reactivar,
                   v.motivo_no_pausar, v.plan_vigente, v.estado_texto
            FROM escorts e
            LEFT JOIN suscripciones s ON s.escort_id = e.id
                AND s.estado IN ('activa','pausada') AND s.eliminada = 0
            LEFT JOIN v_escort_plan_activo v ON v.escort_id = e.id
            WHERE e.id = ? LIMIT 1
        ");
        $stmt->execute([$escort_id]);
        $data = $stmt->fetch(PDO::FETCH_ASSOC);
        $data['puede_pausar'] = (int)$data['puede_pausar'];
        $data['puede_reactivar'] = (int)$data['puede_reactivar'];
        $data['plan_vigente'] = (int)$data['plan_vigente'];
        $data['dias_restantes_calculados'] = $data['dias_restantes_calculados'] !== null ? (int)$data['dias_restantes_calculados'] : null;

        echo json_encode(['success' => true, 'data' => $data]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error del servidor']);
    }
    exit;
}

// Método no permitido
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido']);
