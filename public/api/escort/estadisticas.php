<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/plan_pausas.php';

try {
    $pdo = getDBConnection();
    $auth = requireEscortAuth();
    $escortId = (int)$auth['id'];

    $periodo = $_GET['periodo'] ?? '30d';
    $dias = $periodo === '7d' ? 7 : ($periodo === '90d' ? 90 : 30);

    // Detectar esquema (tolerante a migraciones parciales)
    $tieneTablaDiaria = false;
    $colDiarias = [];
    $colEscorts = [];
    $s = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estadisticas_diarias'");
    $s->execute();
    $tieneTablaDiaria = (int)$s->fetchColumn() > 0;
    if ($tieneTablaDiaria) {
        $s = $pdo->prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estadisticas_diarias'");
        $s->execute();
        $colDiarias = array_map('strval', $s->fetchAll(PDO::FETCH_COLUMN));
    }
    $s = $pdo->prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts'");
    $s->execute();
    $colEscorts = array_map('strval', $s->fetchAll(PDO::FETCH_COLUMN));

    $has = function (array $cols, string $name): bool {
        return in_array($name, $cols, true);
    };

    $dTieneContactos   = $has($colDiarias, 'contactos');
    $dTieneWhatsapp    = $has($colDiarias, 'contactos_whatsapp');
    $dTieneLlamar      = $has($colDiarias, 'contactos_llamar');
    $dTieneFavoritos   = $has($colDiarias, 'favoritos');

    $eTieneWhatsapp    = $has($colEscorts, 'contactos_whatsapp');
    $eTieneLlamar      = $has($colEscorts, 'contactos_llamar');

    // Expresión SQL que suma los contactos disponibles en estadisticas_diarias
    $sumasContacto = [];
    if ($dTieneContactos) { $sumasContacto[] = 'COALESCE(SUM(contactos), 0)'; }
    if ($dTieneWhatsapp)  { $sumasContacto[] = 'COALESCE(SUM(contactos_whatsapp), 0)'; }
    if ($dTieneLlamar)    { $sumasContacto[] = 'COALESCE(SUM(contactos_llamar), 0)'; }
    $contactosSumExpr = $sumasContacto ? implode(' + ', $sumasContacto) : '0';

    $contactosDiariaSelect = '0';
    $vals = [];
    if ($dTieneContactos) { $vals[] = 'contactos'; }
    if ($dTieneWhatsapp)  { $vals[] = 'contactos_whatsapp'; }
    if ($dTieneLlamar)    { $vals[] = 'contactos_llamar'; }
    if ($vals) {
        $contactosDiariaSelect = implode(' + ', array_map(function ($v) { return 'COALESCE(' . $v . ', 0)'; }, $vals));
    }

    $diarias = [];
    $totales = ['visitas' => 0, 'contactos' => 0, 'favoritos' => 0];
    $anterior = ['visitas' => 0, 'contactos' => 0];
    $hoy = ['visitas' => 0, 'contactos' => 0, 'favoritos' => 0];

    if ($tieneTablaDiaria) {
        // Stats diarias del período
        $stmt = $pdo->prepare("
            SELECT fecha, visitas, {$contactosDiariaSelect} as contactos
            FROM estadisticas_diarias
            WHERE escort_id = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ORDER BY fecha ASC
        ");
        $stmt->execute([$escortId, $dias]);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($filas as $fila) {
            $diarias[] = [
                'fecha' => $fila['fecha'],
                'visitas' => (int)$fila['visitas'],
                'contactos' => (int)$fila['contactos'],
            ];
        }

        // Totales del período actual
        $stmtTotal = $pdo->prepare("
            SELECT COALESCE(SUM(visitas), 0) as total_visitas,
                   {$contactosSumExpr} as total_contactos
            FROM estadisticas_diarias
            WHERE escort_id = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ");
        $stmtTotal->execute([$escortId, $dias]);
        $filaTotal = $stmtTotal->fetch(PDO::FETCH_ASSOC);
        $totales['visitas'] = (int)($filaTotal['total_visitas'] ?? 0);
        $totales['contactos'] = (int)($filaTotal['total_contactos'] ?? 0);

        // Comparativa con período anterior
        $stmtPrev = $pdo->prepare("
            SELECT COALESCE(SUM(visitas), 0) as visitas,
                   {$contactosSumExpr} as contactos
            FROM estadisticas_diarias
            WHERE escort_id = ? AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND fecha < DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ");
        $stmtPrev->execute([$escortId, $dias * 2, $dias]);
        $filaPrev = $stmtPrev->fetch(PDO::FETCH_ASSOC);
        $anterior['visitas'] = (int)($filaPrev['visitas'] ?? 0);
        $anterior['contactos'] = (int)($filaPrev['contactos'] ?? 0);

        // Datos de hoy
        $stmtHoy = $pdo->prepare("
            SELECT visitas, {$contactosDiariaSelect} as contactos
            FROM estadisticas_diarias
            WHERE escort_id = ? AND fecha = CURDATE()
            LIMIT 1
        ");
        $stmtHoy->execute([$escortId]);
        $filaHoy = $stmtHoy->fetch(PDO::FETCH_ASSOC);
        if ($filaHoy) {
            $hoy['visitas'] = (int)$filaHoy['visitas'];
            $hoy['contactos'] = (int)$filaHoy['contactos'];
        }
    }

    // Favoritos del período y de hoy desde la tabla favoritos (created_at)
    $fechaInicio = date('Y-m-d', strtotime("-{$dias} days"));
    $stmtFav = $pdo->prepare("SELECT COUNT(*) FROM favoritos WHERE escort_id = ? AND created_at >= ?");
    $stmtFav->execute([$escortId, $fechaInicio]);
    $totales['favoritos'] = (int)$stmtFav->fetchColumn();

    $stmtFavHoy = $pdo->prepare("SELECT COUNT(*) FROM favoritos WHERE escort_id = ? AND created_at >= CURDATE()");
    $stmtFavHoy->execute([$escortId]);
    $hoy['favoritos'] = (int)$stmtFavHoy->fetchColumn();

    // Totales de siempre
    $stmtAll = $pdo->prepare("
        SELECT visitas_perfil, created_at,
               COALESCE((SELECT COUNT(*) FROM favoritos WHERE escort_id = ?), 0) as total_favoritos,
               (SELECT COUNT(*) FROM comentarios WHERE escort_id = ? AND aprobado = 1) as total_comentarios
        FROM escorts WHERE id = ?
    ");
    $stmtAll->execute([$escortId, $escortId, $escortId]);
    $allTimeRow = $stmtAll->fetch(PDO::FETCH_ASSOC);

    $contactosTotales = 0;
    if ($eTieneWhatsapp) {
        $s = $pdo->prepare("SELECT COALESCE(contactos_whatsapp, 0) FROM escorts WHERE id = ?");
        $s->execute([$escortId]);
        $contactosTotales += (int)$s->fetchColumn();
    }
    if ($eTieneLlamar) {
        $s = $pdo->prepare("SELECT COALESCE(contactos_llamar, 0) FROM escorts WHERE id = ?");
        $s->execute([$escortId]);
        $contactosTotales += (int)$s->fetchColumn();
    }

    $publicadaDesde = $allTimeRow['created_at'] ?? null;
    $diasActiva = 0;
    if ($publicadaDesde) {
        $diasActiva = max(0, (int)((time() - strtotime($publicadaDesde)) / 86400));
    }

    // ─── Plan / publicación actual ───
    $plan = null;
    $stmtSus = $pdo->prepare("
        SELECT s.*, p.nombre as plan_nombre, p.duracion_dias, p.badge, p.color_badge, p.max_pausas_permitidas
        FROM suscripciones s
        LEFT JOIN planes p ON s.plan_id = p.id
        WHERE s.escort_id = ? AND s.eliminada = 0
          AND (p.tipo = 'base' OR p.tipo IS NULL)
        ORDER BY (s.estado IN ('activa','pausada')) DESC, s.fecha_aprobacion DESC, s.id DESC
        LIMIT 1
    ");
    $stmtSus->execute([$escortId]);
    $susc = $stmtSus->fetch(PDO::FETCH_ASSOC);

    if ($susc) {
        $fechaInicioPlan = null;
        foreach (['fecha_aprobacion', 'fecha_inicio'] as $campo) {
            if (!empty($susc[$campo])) {
                $fechaInicioPlan = $susc[$campo];
                break;
            }
        }
        if (!$fechaInicioPlan) {
            $fechaInicioPlan = date('Y-m-d', strtotime($susc['creado_en']));
        }

        $duracion = (int)$susc['duracion_dias'];
        if ($duracion <= 0) {
            $duracion = 30;
        }

        // Fin de la ventana (cap a hoy o fecha_fin)
        $hasta = date('Y-m-d');
        if (!empty($susc['fecha_fin']) && $susc['fecha_fin'] < $hasta) {
            $hasta = $susc['fecha_fin'];
        }

        $visitasPlan = 0;
        $contactosPlan = 0;
        if ($tieneTablaDiaria) {
            $stmtWin = $pdo->prepare("
                SELECT COALESCE(SUM(visitas), 0) as visitas,
                       {$contactosSumExpr} as contactos
                FROM estadisticas_diarias
                WHERE escort_id = ? AND fecha >= ? AND fecha <= ?
            ");
            $stmtWin->execute([$escortId, $fechaInicioPlan, $hasta]);
            $win = $stmtWin->fetch(PDO::FETCH_ASSOC);
            $visitasPlan = (int)($win['visitas'] ?? 0);
            $contactosPlan = (int)($win['contactos'] ?? 0);
        }

        $stmtFavWin = $pdo->prepare("
            SELECT COUNT(*) FROM favoritos
            WHERE escort_id = ? AND created_at >= ? AND created_at < ?
        ");
        $stmtFavWin->execute([$escortId, $fechaInicioPlan . ' 00:00:00', date('Y-m-d', strtotime($hasta . ' +1 day')) . ' 00:00:00']);
        $favoritosPlan = (int)$stmtFavWin->fetchColumn();

        $diasPausados = (int)($susc['dias_pausados'] ?? 0);
        $transcurridos = max(0, (int)((strtotime(date('Y-m-d')) - strtotime($fechaInicioPlan)) / 86400));
        $diaPublicado = max(0, min($duracion, $transcurridos + 1 - $diasPausados));
        $diasRestantes = max(0, $duracion - $diaPublicado);

        $pausasPermitidas = (int)($susc['max_pausas_permitidas'] ?? 0);
        $pausasUsadas = 0;
        if (!empty($susc['id'])) {
            $stmtPausas = $pdo->prepare("SELECT COUNT(*) FROM historial_pausas WHERE suscripcion_id = ? AND accion = 'pausa'");
            $stmtPausas->execute([(int)$susc['id']]);
            $pausasUsadas = (int)$stmtPausas->fetchColumn();
        }
        $pausasRestantes = max(0, $pausasPermitidas - $pausasUsadas);

        // Plazo para usar pausas (desde la primera pausa + duracion_dias)
        $plazoPausas = plan_plazo_pausas($pdo, (int)$susc['id'], $duracion);
        $fechaLimitePausas = !empty($plazoPausas['limite']) ? date('d/m/Y', strtotime($plazoPausas['limite'])) : null;
        $plazoDiasRestantes = $plazoPausas['dias_restantes'];
        $plazoVencido = (bool)$plazoPausas['vencido'];

        // Historial de pausas emparejado (pausa → reactivación) con días guardados
        $pausasDetalle = [];
        if (!empty($susc['id'])) {
            $stmtHP = $pdo->prepare("
                SELECT accion, fecha_accion, COALESCE(dias_acumulados_pausa, 0) as dias_acumulados_pausa
                FROM historial_pausas
                WHERE suscripcion_id = ?
                ORDER BY fecha_accion ASC, id ASC
            ");
            $stmtHP->execute([(int)$susc['id']]);
            $eventos = $stmtHP->fetchAll(PDO::FETCH_ASSOC);

            $pendiente = null;
            foreach ($eventos as $ev) {
                if ($ev['accion'] === 'pausa') {
                    $pendiente = $ev;
                } elseif ($ev['accion'] === 'reactivacion' && $pendiente) {
                    $inicio = new DateTime(date('Y-m-d', strtotime($pendiente['fecha_accion'])));
                    $fin = new DateTime(date('Y-m-d', strtotime($ev['fecha_accion'])));
                    $dias = (int)$inicio->diff($fin)->days;
                    if ($dias <= 0) {
                        $dias = (int)$pendiente['dias_acumulados_pausa'];
                    }
                    $pausasDetalle[] = [
                        'inicio' => date('d/m/Y', strtotime($pendiente['fecha_accion'])),
                        'fin' => date('d/m/Y', strtotime($ev['fecha_accion'])),
                        'dias' => $dias,
                        'vigente' => false,
                    ];
                    $pendiente = null;
                }
            }
            if ($pendiente) {
                $inicio = new DateTime(date('Y-m-d', strtotime($pendiente['fecha_accion'])));
                $dias = max(0, (int)((strtotime(date('Y-m-d')) - strtotime(date('Y-m-d', strtotime($pendiente['fecha_accion'])))) / 86400));
                if ($dias <= 0) {
                    $dias = (int)$pendiente['dias_acumulados_pausa'];
                }
                $pausasDetalle[] = [
                    'inicio' => date('d/m/Y', strtotime($pendiente['fecha_accion'])),
                    'fin' => null,
                    'dias' => $dias,
                    'vigente' => true,
                ];
            }
        }
        $diasGuardadosPausas = array_sum(array_column($pausasDetalle, 'dias'));

        // Vencimiento proyectado si está pausada (fecha_fin + días en pausa)
        $fechaPausa = null;
        $fechaFinProyectada = null;
        if ($susc['estado'] === 'pausada') {
            if (!empty($susc['fecha_pausa'])) {
                $fechaPausa = date('d/m/Y', strtotime($susc['fecha_pausa']));
            }
            if (!empty($susc['fecha_fin'])) {
                $diasEnPausa = max(0, (int)((strtotime(date('Y-m-d')) - strtotime($susc['fecha_pausa'] ?? date('Y-m-d'))) / 86400));
                $fechaFinProyectada = date('d/m/Y', strtotime($susc['fecha_fin'] . " +{$diasEnPausa} days"));
            }
        }

        $promedioDia = $diaPublicado > 0 ? round($visitasPlan / $diaPublicado, 1) : 0;
        $proyeccionTotal = $promedioDia > 0 ? (int)round($promedioDia * $duracion) : 0;

        $plan = [
            'estado' => $susc['estado'],
            'plan_nombre' => $susc['plan_nombre'],
            'badge' => $susc['badge'],
            'color_badge' => $susc['color_badge'],
            'duracion_dias' => $duracion,
            'fecha_inicio' => $fechaInicioPlan,
            'fecha_fin' => $susc['fecha_fin'] ?? null,
            'dias_pausados' => $diasPausados,
            'dia_publicado' => $diaPublicado,
            'dias_restantes' => $diasRestantes,
            'visitas' => $visitasPlan,
            'contactos' => $contactosPlan,
            'favoritos' => $favoritosPlan,
            'promedio_dia' => $promedioDia,
            'proyeccion_total' => $proyeccionTotal,
            'pausas_permitidas' => $pausasPermitidas,
            'pausas_usadas' => $pausasUsadas,
            'pausas_restantes' => $pausasRestantes,
            'fecha_pausa' => $fechaPausa,
            'fecha_fin_proyectada' => $fechaFinProyectada,
            'fecha_limite_pausas' => $fechaLimitePausas,
            'plazo_dias_restantes' => $plazoDiasRestantes,
            'plazo_vencido' => $plazoVencido,
            'dias_guardados_pausas' => $diasGuardadosPausas,
            'pausas_detalle' => $pausasDetalle,
        ];
    }

    // Calcular cambio porcentual (0 previo => "nuevo", sin falso +100%)
    $calcularCambio = function (int $actual, int $previo) {
        if ($previo > 0) {
            return round((($actual - $previo) / $previo) * 100, 1);
        }
        return $actual > 0 ? null : 0;
    };

    $cambioVisitas = $calcularCambio($totales['visitas'], $anterior['visitas']);
    $cambioContactos = $calcularCambio($totales['contactos'], $anterior['contactos']);

    echo json_encode(['success' => true, 'data' => [
        'periodo' => $periodo,
        'diarias' => $diarias,
        'hoy' => $hoy,
        'totales' => $totales,
        'comparativa' => [
            'visitas_prev' => $anterior['visitas'],
            'contactos_prev' => $anterior['contactos'],
            'cambio_visitas' => $cambioVisitas,
            'cambio_contactos' => $cambioContactos,
        ],
        'all_time' => [
            'visitas_perfil' => (int)($allTimeRow['visitas_perfil'] ?? 0),
            'contactos' => $contactosTotales,
            'favoritos' => (int)($allTimeRow['total_favoritos'] ?? 0),
            'comentarios' => (int)($allTimeRow['total_comentarios'] ?? 0),
        ],
        'publicada_desde' => $publicadaDesde,
        'dias_activa' => $diasActiva,
        'plan' => $plan,
    ]]);
} catch (Throwable $e) {
    error_log("Error estadisticas.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
