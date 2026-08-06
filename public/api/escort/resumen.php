<?php
// public_html/api/escort/resumen.php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

try {
    require_once __DIR__ . '/../bootstrap.php';
    require_once __DIR__ . '/../lib/plan_pausas.php';
    $pdo = getDBConnection();

    $tokenData = requireEscortAuth();

    $escortId = (int) ($tokenData['id'] ?? 0);

    if (!$escortId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID no válido en token']);
        exit;
    }

    // ¿Existe la columna aprobada? (por si la migración aún no se ejecuta)
    $colStmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'aprobada'
    ");
    $colStmt->execute();
    $tieneAprobada = (int)$colStmt->fetchColumn() > 0;

    if ($tieneAprobada) {
        $stmt = $pdo->prepare("
            SELECT id, nombre as nombreArtistico, usuario, email, telefono, whatsapp,
                   edad, altura, peso, medidas, ciudad, descripcion_corta, descripcion_larga,
                   estado, verificado, vip, destacado, sticky, activa, aprobada,
                   disponible_ahora,
                   fecha_vip_expira, fecha_destacado_expira,
                    visitas_perfil, contactos_whatsapp, contactos_llamar,
                    rating, total_valoraciones,
                    created_at, updated_at
             FROM escorts WHERE id = ?
        ");
    } else {
        $stmt = $pdo->prepare("
            SELECT id, nombre as nombreArtistico, usuario, email, telefono, whatsapp,
                   edad, altura, peso, medidas, ciudad, descripcion_corta, descripcion_larga,
                   estado, verificado, vip, destacado, sticky, activa,
                   disponible_ahora,
                   fecha_vip_expira, fecha_destacado_expira,
                    visitas_perfil, contactos_whatsapp, contactos_llamar,
                    rating, total_valoraciones,
                    created_at, updated_at
             FROM escorts WHERE id = ?
        ");
    }
    $stmt->execute([$escortId]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    // Aprobada si columna aprobada=1, o estado='aprobada', o tiene suscripción aprobada
    $cuentaAprobada = ($tieneAprobada && !empty($escort['aprobada'])) || $escort['estado'] === 'aprobada';

    if (!$cuentaAprobada) {
        $susFallback = $pdo->prepare("
            SELECT 1 FROM suscripciones 
            WHERE escort_id = ? AND fecha_aprobacion IS NOT NULL
            LIMIT 1
        ");
        $susFallback->execute([$escortId]);
        if ($susFallback->fetch()) {
            $cuentaAprobada = true;
        }
    }

    // Fallback adicional: si activa=1, automáticamente aprobada
    if (!$cuentaAprobada && $escort['activa'] == 1) {
        $cuentaAprobada = true;
    }

    // FOTO PORTADA desde escort_fotos
    $fotoStmt = $pdo->prepare("
        SELECT url FROM escort_fotos 
        WHERE escort_id = ? AND es_portada = 1 
        ORDER BY orden ASC LIMIT 1
    ");
    $fotoStmt->execute([$escortId]);
    $fotoPortada = $fotoStmt->fetchColumn() ?: null;

    // ─── CONTAR COMENTARIOS (aprobados) Y CALCULAR RATING ───
    $comentariosStmt = $pdo->prepare("
        SELECT COUNT(*) as total, COALESCE(AVG(puntuacion), 0) as promedio
        FROM comentarios
        WHERE escort_id = ? AND aprobado = 1
    ");
    $comentariosStmt->execute([$escortId]);
    $comentarioStats = $comentariosStmt->fetch(PDO::FETCH_ASSOC);
    $totalValorizaciones = (int)$comentarioStats['total'];
    $promedioValorizaciones = (float)$comentarioStats['promedio'];

    $comentariosTextoStmt = $pdo->prepare("
        SELECT COUNT(*) as total
        FROM comentarios
        WHERE escort_id = ? AND aprobado = 1 AND comentario != ''
    ");
    $comentariosTextoStmt->execute([$escortId]);
    $totalComentarios = (int)$comentariosTextoStmt->fetchColumn();

    // Actualizar rating y total_valoraciones en escorts con datos de comentarios
    $updateEscort = $pdo->prepare("UPDATE escorts SET rating = ?, total_valoraciones = ? WHERE id = ?");
    $updateEscort->execute([$promedioValorizaciones, $totalValorizaciones, $escortId]);

    $fotosStmt = $pdo->prepare("SELECT COUNT(*) FROM escort_fotos WHERE escort_id = ?");
    $fotosStmt->execute([$escortId]);
    $fotosCount = (int) $fotosStmt->fetchColumn();

    $historiasStmt = $pdo->prepare("SELECT COUNT(*) FROM escort_historias WHERE escort_id = ?");
    $historiasStmt->execute([$escortId]);
    $historiasCount = (int) $historiasStmt->fetchColumn();

    $planVencido = false;
    $planNombre = null;
    $planBadge = null;
    $planColor = null;
    $planDiasRestantes = 0;
    $planVigente = false;
    $planPendiente = false;

    $sus = $pdo->prepare("
        SELECT s.*, p.nombre as plan_nombre, p.badge, p.color_badge, p.duracion_dias, p.max_pausas_permitidas
        FROM suscripciones s
        LEFT JOIN planes p ON s.plan_id = p.id
        WHERE s.escort_id = ? AND (s.estado = 'activa' OR s.estado = 'pausada')
        ORDER BY s.fecha_fin DESC LIMIT 1
    ");
    $sus->execute([$escortId]);
    $suscripcion = $sus->fetch(PDO::FETCH_ASSOC);

    // Si no hay activa/pausada, buscar si hay alguna pendiente
    if (!$suscripcion) {
        $susPend = $pdo->prepare("
            SELECT s.*, p.nombre as plan_nombre, p.badge, p.color_badge
            FROM suscripciones s
            LEFT JOIN planes p ON s.plan_id = p.id
            WHERE s.escort_id = ? AND s.estado = 'pendiente_aprobacion'
            ORDER BY s.creado_en DESC LIMIT 1
        ");
        $susPend->execute([$escortId]);
        $pendiente = $susPend->fetch(PDO::FETCH_ASSOC);
        if ($pendiente) {
            $planPendiente = true;
            $planNombre = $pendiente['plan_nombre'];
            $planBadge = $pendiente['badge'];
            $planColor = $pendiente['color_badge'];
        }
    }

    // Si está pausada, marcar planVigente=false pero mantener la info del plan
    $planPausado = $suscripcion && $suscripcion['estado'] === 'pausada';

    if ($suscripcion) {
        $planNombre = $suscripcion['plan_nombre'];
        $planBadge = $suscripcion['badge'];
        $planColor = $suscripcion['color_badge'];

        // Calcular días restantes desde fecha_fin (más confiable que creado_en + duracion_dias)
        $ahora = new DateTime();
        if ($suscripcion['estado'] === 'pausada' && !empty($suscripcion['fecha_pausa']) && !empty($suscripcion['fecha_fin'])) {
            // Reloj congelado: no descontar contra hoy mientras esté pausada
            $planDiasRestantes = max(0, (int)(new DateTime($suscripcion['fecha_fin']))->diff(new DateTime($suscripcion['fecha_pausa']))->days);
        } elseif (!empty($suscripcion['fecha_fin'])) {
            $fechaFin = new DateTime($suscripcion['fecha_fin']);
            $planDiasRestantes = max(0, (int)$ahora->diff($fechaFin)->days);
        } elseif (!empty($suscripcion['duracion_dias'])) {
            $fechaBase = new DateTime($suscripcion['creado_en']);
            $fechaEsperada = clone $fechaBase;
            $fechaEsperada->modify("+{$suscripcion['duracion_dias']} days");
            $diasPausados = (int)($suscripcion['dias_pausados'] ?? 0);
            if ($diasPausados > 0) {
                $fechaEsperada->modify("+{$diasPausados} days");
            }
            $planDiasRestantes = max(0, (int)$ahora->diff($fechaEsperada)->days);
        } else {
            $planDiasRestantes = 0;
        }
        $planVencido = $planDiasRestantes <= 0;
        $planVigente = !$planVencido && !$planPausado;
    }

    // ─── PAUSE STATS ───
    $pausasUsadas = 0;
    $pausasMaximas = 0;
    $pausasRestantes = 0;
    $fechaLimitePausas = null;
    $plazoDiasRestantes = null;
    $plazoVencido = false;
    $diasGuardadosPausas = 0;
    $pausasDetalle = [];
    $fechaPausaActual = null;
    $fechaFinProyectada = null;
    $fechaFin = null;
    $planMaxPausasPlan = 0;

    if ($suscripcion) {
        $cp = $pdo->prepare("SELECT COUNT(*) FROM historial_pausas WHERE suscripcion_id = ? AND accion = 'pausa'");
        $cp->execute([$suscripcion['id']]);
        $pausasUsadas = (int)$cp->fetchColumn();

        $planPausas = $pdo->prepare("SELECT max_pausas_permitidas FROM planes WHERE id = ?");
        $planPausas->execute([$suscripcion['plan_id']]);
        $pausasMaximas = (int)$planPausas->fetchColumn();

        $pausasRestantes = max(0, $pausasMaximas - $pausasUsadas);
        $planMaxPausasPlan = $pausasMaximas;

        // Fecha de vencimiento real del plan (fecha_fin de la suscripción)
        $fechaFin = !empty($suscripcion['fecha_fin']) ? date('d/m/Y', strtotime($suscripcion['fecha_fin'])) : null;

        $plazoPausas = plan_plazo_pausas($pdo, (int)$suscripcion['id'], (int)($suscripcion['duracion_dias'] ?? 0));
        if (!empty($plazoPausas['limite'])) {
            $fechaLimitePausas = date('d/m/Y', strtotime($plazoPausas['limite']));
        }
        $plazoDiasRestantes = $plazoPausas['dias_restantes'];
        $plazoVencido = (bool)$plazoPausas['vencido'];

        // Historial de pausas emparejado (pausa → reactivación) con días guardados
        $stmtHP = $pdo->prepare("
            SELECT accion, fecha_accion, COALESCE(dias_acumulados_pausa, 0) as dias_acumulados_pausa, COALESCE(notas, '') as notas
            FROM historial_pausas
            WHERE suscripcion_id = ?
            ORDER BY fecha_accion ASC, id ASC
        ");
        $stmtHP->execute([(int)$suscripcion['id']]);
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
                    'notas' => $pendiente['notas'] ?? '',
                ];
                $pendiente = null;
            }
        }
        if ($pendiente) {
            $dias = max(0, (int)((strtotime(date('Y-m-d')) - strtotime(date('Y-m-d', strtotime($pendiente['fecha_accion'])))) / 86400));
            if ($dias <= 0) {
                $dias = (int)$pendiente['dias_acumulados_pausa'];
            }
            $pausasDetalle[] = [
                'inicio' => date('d/m/Y', strtotime($pendiente['fecha_accion'])),
                'fin' => null,
                'dias' => $dias,
                'vigente' => true,
                'notas' => $pendiente['notas'] ?? '',
            ];
        }

        $diasGuardadosPausas = array_sum(array_column($pausasDetalle, 'dias'));

        // Vencimiento proyectado si está pausada (fecha_fin + días en pausa)
        if ($suscripcion['estado'] === 'pausada') {
            if (!empty($suscripcion['fecha_pausa'])) {
                $fechaPausaActual = date('d/m/Y', strtotime($suscripcion['fecha_pausa']));
            }
            if (!empty($suscripcion['fecha_fin'])) {
                $diasEnPausa = max(0, (int)((strtotime(date('Y-m-d')) - strtotime($suscripcion['fecha_pausa'] ?? date('Y-m-d'))) / 86400));
                $fechaFinProyectada = date('d/m/Y', strtotime($suscripcion['fecha_fin'] . " +{$diasEnPausa} days"));
            }
        }
    }

    $vipVencido = $escort['fecha_vip_expira'] ? strtotime($escort['fecha_vip_expira']) < time() : true;
    $destacadoVencido = $escort['fecha_destacado_expira'] ? strtotime($escort['fecha_destacado_expira']) < time() : true;

    // Extra 'destacado' activo (aprobado y no vencido) para mostrar su nombre real en el resumen
    $extraNombre = null;
    $extraStmt = $pdo->prepare("
        SELECT p.nombre
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND p.tipo = 'extra' AND p.extra_tipo = 'destacado'
          AND s.estado = 'activa' AND s.fecha_aprobacion IS NOT NULL AND s.fecha_fin >= CURDATE()
        ORDER BY s.fecha_fin DESC LIMIT 1
    ");
    $extraStmt->execute([$escortId]);
    $extraNombre = $extraStmt->fetchColumn() ?: null;

    $campos = ['nombreArtistico', 'usuario', 'email', 'telefono', 'edad', 'altura', 'peso', 'medidas', 'ciudad', 'descripcion_corta', 'descripcion_larga'];
    $llenos = 0;
    foreach ($campos as $c) {
        if (!empty($escort[$c]) && $escort[$c] !== '0' && $escort[$c] !== '') {
            $llenos++;
        }
    }
    $perfilCompleto = min(100, round(($llenos / count($campos)) * 100));

    echo json_encode(['success' => true, 'data' => [
        'id' => (int) $escort['id'],
        'nombre' => $escort['nombreArtistico'],
        'aprobada' => (int) $cuentaAprobada,
        'nombreArtistico' => $escort['nombreArtistico'] ?: (isset($escort['email']) ? explode('@', $escort['email'])[0] : ''),
        'email' => $escort['email'],
        'telefono' => $escort['telefono'],
        'whatsapp' => $escort['whatsapp'],
        'edad' => (int) $escort['edad'],
        'altura' => $escort['altura'] ? (int) $escort['altura'] : null,
        'peso' => $escort['peso'] ? (int) $escort['peso'] : null,
        'medidas' => $escort['medidas'],
        'ciudad' => $escort['ciudad'],
        'descripcionCorta' => $escort['descripcion_corta'],
        'descripcionLarga' => $escort['descripcion_larga'],
        'estado' => $escort['estado'],
        'verificado' => (int) $escort['verificado'],
        'vip' => (int) $escort['vip'],
        'destacado' => (int) $escort['destacado'],
        'sticky' => (int) $escort['sticky'],
        'activa' => (int) $escort['activa'],
        'disponibleAhora' => (int) ($escort['disponible_ahora'] ?? 0),
        'planVencido' => $planVencido,
        'planPausado' => $planPausado ?? false,
        'planPendiente' => $planPendiente,
        'planNombre' => $planNombre,
        'planBadge' => $planBadge,
        'planColor' => $planColor,
        'planDiasRestantes' => $planDiasRestantes,
        'planVigente' => $planVigente,
        'pausasUsadas' => $pausasUsadas,
        'pausasMaximas' => $pausasMaximas,
        'pausasRestantes' => $pausasRestantes,
        'fechaLimitePausas' => $fechaLimitePausas,
        'plazoDiasRestantes' => $plazoDiasRestantes,
        'plazoVencido' => $plazoVencido,
        'diasGuardadosPausas' => $diasGuardadosPausas,
        'pausasDetalle' => $pausasDetalle,
        'fechaPausaActual' => $fechaPausaActual,
        'fechaFinProyectada' => $fechaFinProyectada,
        'fechaFin' => $fechaFin,
        'vipVencido' => $vipVencido,
        'destacadoVencido' => $destacadoVencido,
        'extraNombre' => $extraNombre,
        'fotosCount' => $fotosCount,
        'historiasCount' => $historiasCount,
        'visitasHoy' => 0,
        'visitasTotal' => (int) $escort['visitas_perfil'],
        'contactosWhatsapp' => (int) ($escort['contactos_whatsapp'] ?? 0),
        'contactosLlamar' => (int) ($escort['contactos_llamar'] ?? 0),
        'rating' => (float) $escort['rating'],
        'totalValorizaciones' => $totalValorizaciones,
        'totalComentarios' => $totalComentarios,
        'perfilCompleto' => $perfilCompleto,
        'fotoPrincipal' => $fotoPortada,
        'createdAt' => $escort['created_at'],
        'updatedAt' => $escort['updated_at']
    ]]);
} catch (Throwable $e) {
    error_log("Error resumen.php: " . $e->getMessage() . " en " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
