<?php
// /api/escort/perfil-publico.php
// Endpoint público - NO requiere autenticación

require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json');

$slug = $_GET['slug'] ?? '';
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if (empty($slug) && !$id) {
    echo json_encode(['success' => false, 'error' => 'Slug o ID requerido']);
    exit;
}

try {
    $pdo = getDBConnection();

    if ($id) {
        $stmt = $pdo->prepare("
            SELECT 
                e.*,
                p.nombre as plan_nombre,
                p.precio as plan_precio
            FROM escorts e
            LEFT JOIN planes p ON e.plan_id = p.id
            WHERE e.id = :id 
            AND e.activa = 1
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
    } else {
        $stmt = $pdo->prepare("
            SELECT 
                e.*,
                p.nombre as plan_nombre,
                p.precio as plan_precio
            FROM escorts e
            LEFT JOIN planes p ON e.plan_id = p.id
            WHERE e.slug = :slug 
            AND e.activa = 1
            LIMIT 1
        ");
        $stmt->execute([':slug' => $slug]);
    }
    $perfil = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$perfil) {
        echo json_encode(['success' => false, 'error' => 'Perfil no encontrado']);
        exit;
    }

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
        SELECT id, url, orden, es_portada 
        FROM escort_fotos 
        WHERE escort_id = :escort_id 
        ORDER BY es_portada DESC, orden ASC
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

    // Construir respuesta
    $response = [
        'success' => true,
        'perfil' => [
            'id' => (int)$perfil['id'],
            'nombre' => $perfil['nombre'],
            'slug' => $perfil['slug'],
            'email' => $perfil['email'],
            'telefono' => $perfil['telefono'],
            'whatsapp' => $perfil['whatsapp'],
            'edad' => (int)$perfil['edad'],
            'altura' => $perfil['altura'] ? (int)$perfil['altura'] : null,
            'peso' => $perfil['peso'] ? (int)$perfil['peso'] : null,
            'medidas' => $perfil['medidas'],
            'ciudad' => $perfil['ciudad'],
            'nacionalidad' => $perfil['nacionalidad'],
            'idiomas' => $perfil['idiomas'],
            'orientacion' => $perfil['orientacion'],
            'etnia' => $perfil['etnia'],
            'color_ojos' => $perfil['color_ojos'],
            'color_pelo' => $perfil['color_pelo'],
            'estilo' => $perfil['estilo'],
            'descripcion_corta' => $perfil['descripcion_corta'],
            'descripcion_larga' => $perfil['descripcion_larga'],
            'foto_principal' => $perfil['foto_principal'],
            'video_presentacion' => $perfil['video_presentacion'],
            'estado' => $perfil['estado'],
            'verificado' => (int)$perfil['verificado'],
            'vip' => (int)$perfil['vip'],
            'vip_expira' => $perfil['vip_expira'],
            'destacado' => (int)$perfil['destacado'],
            'sticky' => (int)$perfil['sticky'],
            'activa' => (int)$perfil['activa'],
            'plan_id' => $perfil['plan_id'] ? (int)$perfil['plan_id'] : null,
            'visitas_perfil' => (int)$perfil['visitas_perfil'] + 1, // +1 porque ya incrementamos
            'contactos_recibidos' => (int)$perfil['contactos_recibidos'],
            'rating' => $perfil['rating'] ?? '0.0',
            'total_valoraciones' => (int)$perfil['total_valoraciones'],
            'plan' => $perfil['plan_nombre'] ? [
                'nombre' => $perfil['plan_nombre'],
                'precio' => (float)$perfil['plan_precio']
            ] : null,
            'servicios' => $servicios,
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
