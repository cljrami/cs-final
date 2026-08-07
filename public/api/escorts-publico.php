<?php
// public/api/escort/perfil-publico.php
// 
// Perfil público individual de una escort.
// Solo muestra si: activa=1, eliminada=0, suscripción aprobada y vigente.
// Incrementa visitas_perfil.
// No requiere autenticación (es público).

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

try {
    require_once __DIR__ . '/bootstrap.php';

    $pdo = getDBConnection();
    // â”€â”€â”€ IDENTIFICADOR DE LA ESCORT â”€â”€â”€
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    $slug = isset($_GET['slug']) ? trim($_GET['slug']) : '';

    if ($id <= 0 && empty($slug)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID o slug requerido']);
        exit;
    }

    // â”€â”€â”€ CONDICIONES DE VISIBILIDAD â”€â”€â”€
    // La escort debe estar activa y tener suscripción aprobada
    $whereId = $id > 0 ? 'e.id = :id' : 'e.slug = :slug';
    $params = $id > 0 ? [':id' => $id] : [':slug' => $slug];

    $sql = "
        SELECT 
            e.id,
            e.nombre,
            e.slug,
            e.edad,
            e.altura,
            e.peso,
            e.medidas,
            e.ciudad,
            e.direccion,
            e.nacionalidad,
            e.idiomas,
            e.orientacion,
            e.etnia,
            e.color_ojos,
            e.color_pelo,
            e.estilo,
            e.descripcion_corta,
            e.descripcion_larga,
            e.tarifa_30min,
            e.tarifa_1h,
            e.tarifa_2h,
            e.tarifa_noche,
            e.tarifa_viaje,
            e.moneda,
            e.foto_principal,
            e.video_presentacion,
            e.estado,
            e.verificado,
            e.vip,
            e.destacado,
            e.sticky,
            e.rating,
            e.total_valoraciones,
            e.visitas_perfil,
            e.created_at,
            p.nombre AS plan_nombre,
            p.badge AS plan_badge,
            p.color_badge AS plan_color_badge,
            p.max_fotos,
            p.max_videos,
            p.permite_vip,
            p.permite_destacado,
            s.fecha_inicio AS plan_inicio,
            s.fecha_fin AS plan_vence,
            s.dias_restantes
        FROM escorts e
        LEFT JOIN suscripciones s ON s.escort_id = e.id AND s.id = (
          SELECT s2.id FROM suscripciones s2
          JOIN planes p2 ON p2.id = s2.plan_id AND p2.extra_tipo IS NULL
          WHERE s2.escort_id = e.id
          ORDER BY s2.id DESC LIMIT 1
        )
        LEFT JOIN planes p ON p.id = s.plan_id
        WHERE $whereId
          AND e.activa = 1
          AND e.eliminada = 0
          AND s.fecha_aprobacion IS NOT NULL
          AND s.estado = 'activa'
          AND s.fecha_fin >= CURDATE()
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Perfil no encontrado o no disponible',
            'motivo' => 'La escort puede estar inactiva, no tener un plan aprobado, o el plan ha expirado.'
        ]);
        exit;
    }

    // â”€â”€â”€ INCREMENTAR VISITAS â”€â”€â”€
    $updVisitas = $pdo->prepare("UPDATE escorts SET visitas_perfil = visitas_perfil + 1 WHERE id = ?");
    $updVisitas->execute([$escort['id']]);
    $escort['visitas_perfil']++;

    // â”€â”€â”€ SERVICIOS (solo incluidos, sin precios) â”€â”€â”€
    $servStmt = $pdo->prepare("
        SELECT 
            s.id,
            s.nombre,
            s.slug,
            s.descripcion_corta,
            s.grupo,
            s.icono,
            s.color,
            s.tipicamente_adicional
        FROM escort_servicios es
        JOIN servicios s ON s.id = es.servicio_id
        WHERE es.escort_id = ? AND es.incluido = 1 AND s.activo = 1
        ORDER BY s.grupo ASC, s.orden ASC, s.nombre ASC
    ");
    $servStmt->execute([$escort['id']]);
    $servicios = $servStmt->fetchAll(PDO::FETCH_ASSOC);

    // Agrupar por grupo
    $serviciosAgrupados = [];
    foreach ($servicios as $serv) {
        $grupo = $serv['grupo'];
        if (!isset($serviciosAgrupados[$grupo])) {
            $serviciosAgrupados[$grupo] = [
                'grupo' => $grupo,
                'servicios' => []
            ];
        }
        $serviciosAgrupados[$grupo]['servicios'][] = [
            'id' => (int)$serv['id'],
            'nombre' => $serv['nombre'],
            'slug' => $serv['slug'],
            'descripcion' => $serv['descripcion_corta'],
            'icono' => $serv['icono'],
            'color' => $serv['color']
        ];
    }
    $serviciosAgrupados = array_values($serviciosAgrupados);

    // â”€â”€â”€ GALERÍA DE FOTOS â”€â”€â”€
    $fotosStmt = $pdo->prepare("
        SELECT id, url, tipo, es_portada, orden
        FROM escort_fotos
        WHERE escort_id = ? AND tipo = 'publica'
        ORDER BY es_portada DESC, orden ASC
    ");
    $fotosStmt->execute([$escort['id']]);
    $fotos = $fotosStmt->fetchAll(PDO::FETCH_ASSOC);

    // â”€â”€â”€ HISTORIAS (solo si no expiraron) â”€â”€â”€
    $histStmt = $pdo->prepare("
        SELECT id, url, tipo, expira_en, vistas
        FROM escort_historias
        WHERE escort_id = ? AND expira_en > NOW()
        ORDER BY creado_en DESC
    ");
    $histStmt->execute([$escort['id']]);
    $historias = $histStmt->fetchAll(PDO::FETCH_ASSOC);

    // â”€â”€â”€ HORARIOS â”€â”€â”€
    $horStmt = $pdo->prepare("
        SELECT dia_semana, hora_inicio, hora_fin, disponible
        FROM escort_horarios
        WHERE escort_id = ? AND disponible = 1
        ORDER BY dia_semana ASC
    ");
    $horStmt->execute([$escort['id']]);
    $horarios = $horStmt->fetchAll(PDO::FETCH_ASSOC);

    $diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    $horariosFormateados = [];
    foreach ($horarios as $h) {
        $horariosFormateados[] = [
            'dia' => $diasSemana[$h['dia_semana']],
            'hora_inicio' => $h['hora_inicio'],
            'hora_fin' => $h['hora_fin']
        ];
    }

    // â”€â”€â”€ VALORACIONES (aprobadas) â”€â”€â”€
    $valStmt = $pdo->prepare("
        SELECT 
            v.id,
            v.general as rating,
            v.comentario,
            v.anonimo,
            v.created_at,
            COALESCE(u.nombre, 'Anónimo') as usuario_nombre
        FROM valoraciones v
        LEFT JOIN usuarios u ON u.id = v.usuario_id AND v.anonimo = 0
        WHERE v.escort_id = ? AND v.aprobado = 1
        ORDER BY v.created_at DESC
        LIMIT 10
    ");
    $valStmt->execute([$escort['id']]);
    $valoraciones = $valStmt->fetchAll(PDO::FETCH_ASSOC);

    // â”€â”€â”€ BADGES â”€â”€â”€
    $badges = [];
    if ($escort['verificado']) {
        $badges[] = ['tipo' => 'verificado', 'texto' => 'Verificada', 'icono' => 'check-circle', 'color' => '#10b981'];
    }
    if ($escort['vip']) {
        $badges[] = ['tipo' => 'vip', 'texto' => 'VIP', 'icono' => 'crown', 'color' => '#f59e0b'];
    }
    if ($escort['destacado']) {
        $badges[] = ['tipo' => 'destacado', 'texto' => 'Destacada', 'icono' => 'star', 'color' => '#6366f1'];
    }
    if ($escort['video_presentacion']) {
        $badges[] = ['tipo' => 'video', 'texto' => 'Video', 'icono' => 'video', 'color' => '#ec4899'];
    }

    // â”€â”€â”€ CONSTRUIR RESPUESTA â”€â”€â”€
    $perfil = [
        'id' => (int)$escort['id'],
        'nombre' => $escort['nombre'],
        'slug' => $escort['slug'],
        'edad' => (int)$escort['edad'],
        'altura' => $escort['altura'] ? (int)$escort['altura'] : null,
        'peso' => $escort['peso'] ? (int)$escort['peso'] : null,
        'medidas' => $escort['medidas'],
        'ciudad' => $escort['ciudad'],
        'nacionalidad' => $escort['nacionalidad'],
        'idiomas' => $escort['idiomas'] ? explode(',', $escort['idiomas']) : [],
        'orientacion' => $escort['orientacion'],
        'etnia' => $escort['etnia'],
        'color_ojos' => $escort['color_ojos'],
        'color_pelo' => $escort['color_pelo'],
        'estilo' => $escort['estilo'],
        'descripcion' => [
            'corta' => $escort['descripcion_corta'],
            'larga' => $escort['descripcion_larga']
        ],
        'tarifas' => [
            'moneda' => $escort['moneda'],
            '30min' => $escort['tarifa_30min'] ? (float)$escort['tarifa_30min'] : null,
            '1h' => $escort['tarifa_1h'] ? (float)$escort['tarifa_1h'] : null,
            '2h' => $escort['tarifa_2h'] ? (float)$escort['tarifa_2h'] : null,
            'noche' => $escort['tarifa_noche'] ? (float)$escort['tarifa_noche'] : null,
            'viaje' => $escort['tarifa_viaje'] ? (float)$escort['tarifa_viaje'] : null
        ],
        'media' => [
            'foto_principal' => $escort['foto_principal'],
            'video_presentacion' => $escort['video_presentacion'],
            'galeria' => $fotos,
            'historias' => $historias,
            'total_fotos' => count($fotos)
        ],
        'estado' => $escort['estado'],
        'badges' => $badges,
        'stats' => [
            'rating' => (float)$escort['rating'],
            'total_valoraciones' => (int)$escort['total_valoraciones'],
            'visitas_perfil' => (int)$escort['visitas_perfil']
        ],
        'servicios' => $serviciosAgrupados,
        'horarios' => $horariosFormateados,
        'valoraciones' => $valoraciones,
        'plan' => [
            'nombre' => $escort['plan_nombre'],
            'badge' => $escort['plan_badge'],
            'color_badge' => $escort['plan_color_badge'],
            'vence' => $escort['plan_vence']
        ],
        'contacto' => [
            'whatsapp' => $escort['whatsapp'] ?? null,
            'telefono' => $escort['telefono'] ?? null
        ]
    ];

    echo json_encode([
        'success' => true,
        'perfil' => $perfil
    ]);
} catch (PDOException $e) {
    error_log("Error perfil-publico.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error perfil-publico.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
