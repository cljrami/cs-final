<?php
// /api/escort/perfil-publico.php
// Endpoint público - NO requiere autenticación

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/gira.php';
require_once __DIR__ . '/../lib/escort_status.php';

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate');

$slug = $_GET['slug'] ?? '';
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if (empty($slug) && !$id) {
    echo json_encode(['success' => false, 'error' => 'Slug o ID requerido']);
    exit;
}

try {
    $pdo = getDBConnection();

    $baseSql = "
        SELECT 
            e.*,
            c.nombre as categoria_nombre,
            p.nombre as plan_nombre,
            p.precio as plan_precio,
            gc.nombre as gira_ciudad,
            " . gira_activa() . " as gira_activa,
            " . efectiva_ciudad() . " as ciudad_efectiva
        FROM escorts e
        LEFT JOIN categorias c ON e.categoria_id = c.id
        LEFT JOIN suscripciones s ON s.escort_id = e.id AND s.estado IN ('activa', 'pausada')
        LEFT JOIN planes p ON p.id = s.plan_id
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE 1=1
    ";
    $params = [];
    if ($id) {
        $baseSql .= " AND e.id = :id LIMIT 1";
        $params[':id'] = $id;
        $stmt = $pdo->prepare($baseSql);
        $stmt->execute($params);
    } else {
        $baseSql .= " AND e.slug = :slug LIMIT 1";
        $params[':slug'] = $slug;
        $stmt = $pdo->prepare($baseSql);
        $stmt->execute($params);
    }
    $perfil = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$perfil) {
        echo json_encode(['success' => false, 'error' => 'Perfil no encontrado']);
        exit;
    }

    // Calcular plan_vencido y estados efectivos
    $suscripcionBase = null;
    if (!empty($perfil['plan_nombre'])) {
        $suscripcionBase = [
            'estado' => 'activa',
            'fecha_fin' => $perfil['plan_precio'] // approximate, we don't have fecha_fin here
        ];
    }
    // For public profile, we consider plan active if plan_nombre exists
    $planVencido = !$perfil['plan_nombre'];
    $efectivo = getEscortEffectiveStatus($perfil, $planVencido, $perfil['plan_nombre'] !== null);

    // Incrementar visitas
    $pdo->prepare("UPDATE escorts SET visitas_perfil = visitas_perfil + 1 WHERE id = :id")
        ->execute([':id' => $perfil['id']]);

    // Obtener servicios con detalles
    $stmtServicios = $pdo->prepare("
        SELECT 
            s.id,
            s.nombre,
            s.grupo,
            s.color,
            s.icono,
            es.incluido
        FROM escort_servicios es
        JOIN servicios s ON es.servicio_id = s.id
        WHERE es.escort_id = :escort_id
        ORDER BY s.grupo, s.nombre
    ");
    $stmtServicios->execute([':escort_id' => $perfil['id']]);
    $servicios = $stmtServicios->fetchAll(PDO::FETCH_ASSOC);

    // Obtener fotos
    $stmtFotos = $pdo->prepare("
        SELECT id, url, tipo, gif_url, orden, es_portada 
        FROM escort_fotos 
        WHERE escort_id = :escort_id 
        ORDER BY orden ASC, created_at ASC
    ");
    $stmtFotos->execute([':escort_id' => $perfil['id']]);
    $fotos = $stmtFotos->fetchAll(PDO::FETCH_ASSOC);

    // Obtener horarios (si la tabla existe)
    $horarios = [];
    try {
        $stmtHorarios = $pdo->prepare("
            SELECT dia_semana, hora_inicio, hora_fin, activo 
            FROM escort_horarios 
            WHERE escort_id = :escort_id 
            ORDER BY dia_semana
        ");
        $stmtHorarios->execute([':escort_id' => $perfil['id']]);
        $horarios = $stmtHorarios->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        $horarios = [];
    }

    // Obtener idiomas desde tabla relacionada
    $idiomas = [];
    try {
        $stmtIdiomas = $pdo->prepare("
            SELECT i.nombre FROM idiomas i
            JOIN escort_idiomas ei ON i.id = ei.idioma_id
            WHERE ei.escort_id = :escort_id
            ORDER BY i.nombre ASC
        ");
        $stmtIdiomas->execute([':escort_id' => $perfil['id']]);
        $idiomas = $stmtIdiomas->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
        $idiomas = [];
    }
    $idiomasStr = !empty($idiomas) ? implode(', ', $idiomas) : null;

    // Aplicar privacidad: ocultar campos según JSON almacenado
    $camposOcultos = [];
    if (!empty($perfil['privacidad'])) {
        $decoded = json_decode($perfil['privacidad'], true);
        if (is_array($decoded)) {
            $camposOcultos = $decoded;
        }
    }

    $ocultar = function($campo) use ($camposOcultos, $perfil) {
        return in_array($campo, $camposOcultos) ? null : $perfil[$campo];
    };

    // Construir respuesta
    $response = [
        'success' => true,
        'perfil' => [
            'id' => (int)$perfil['id'],
            'foto_principal' => $perfil['foto_principal'] ?? null,
            'nombre' => $perfil['nombre'],
            'slug' => $perfil['slug'],
            'email' => $perfil['email'],
            'telefono' => $perfil['telefono'],
            'whatsapp' => $perfil['whatsapp'],
        'edad' => (int)$perfil['edad'],
        'altura' => $perfil['altura'] ? (int)$perfil['altura'] : null,
        'peso' => $perfil['peso'] ? (int)$perfil['peso'] : null,
        'medidas' => $ocultar('medidas'),
        'created_at' => $perfil['created_at'] ?? null,
            'rating' => (float)($perfil['rating'] ?? 0),
            'total_valoraciones' => (int)($perfil['total_valoraciones'] ?? 0),
            'ciudad' => $perfil['ciudad_efectiva'],
            'ciudad_base' => $perfil['ciudad'],
            'en_gira' => (int)$perfil['en_gira'],
            'gira_activa' => (int)$perfil['gira_activa'],
            'gira_ciudad' => $perfil['gira_ciudad'],
            'gira_fecha_inicio' => $perfil['gira_fecha_inicio'] ?? null,
            'gira_fecha_fin' => $perfil['gira_fecha_fin'] ?? null,
            'categoria_nombre' => $perfil['categoria_nombre'] ?? null,
            'nacionalidad' => $ocultar('nacionalidad'),
            'idiomas' => $idiomasStr,
            'orientacion' => $ocultar('orientacion'),
            'etnia' => $ocultar('etnia'),
            'color_ojos' => $perfil['color_ojos'],
            'color_pelo' => $perfil['color_pelo'],
            'estilo' => $perfil['estilo'],
            'descripcion_corta' => $perfil['descripcion_corta'],
            'descripcion_larga' => $perfil['descripcion_larga'],
            'audio_preview' => $perfil['audio_preview'] ?? null,
            'privacidad' => $perfil['privacidad'] ?? null,
            // Estados efectivos
            'verificado_vigente' => $efectivo['verificado_vigente'],
            'vip_vigente' => $efectivo['vip_vigente'],
            'destacado_vigente' => $efectivo['destacado_vigente'],
            'sticky_vigente' => $efectivo['sticky_vigente'],
            'activa_vigente' => $efectivo['activa_vigente'],
            'plan_vencido' => $efectivo['plan_vencido'],
            'plan' => $perfil['plan_nombre'] ? [
                'nombre' => $perfil['plan_nombre'],
                'precio' => (float)$perfil['plan_precio']
            ] : null,
            'servicios' => in_array('servicios', $camposOcultos) ? [] : $servicios,
            'fotos' => $fotos,
            'horarios' => $horarios,
        ]
    ];

    echo json_encode($response);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
