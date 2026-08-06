<?php
// public/api/escort.php - API JSON para perfil de escort

header('Content-Type: application/json');
ini_set('display_errors', 0);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // config.php está en la MISMA carpeta api/
    require_once __DIR__ . '/bootstrap.php';

    $pdo = getDBConnection();
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(array('success' => false, 'message' => 'ID invalido'));
        exit;
    }

    // Obtener escort con TODOS los campos (columnas reales de la tabla escorts)
    $stmt = $pdo->prepare("
        SELECT 
            id, nombre, edad, ciudad, 
            descripcion_corta, descripcion_larga, 
            telefono, whatsapp, foto_principal, 
            verificado, vip, activa, destacado,
            estado, altura, peso,
            rating, total_valoraciones,
            created_at
        FROM escorts 
        WHERE id = ? AND activa = 1 
        LIMIT 1
    ");
    $stmt->execute(array($id));
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode(array('success' => false, 'message' => 'Escort no encontrada'));
        exit;
    }

    // Limpiar campos sensibles
    unset($escort['activa']);

    // === FOTOS desde tabla escort_fotos ===
    $stmtFotos = $pdo->prepare("
        SELECT id, url, tipo, es_portada
        FROM escort_fotos
        WHERE escort_id = ?
        ORDER BY es_portada DESC, orden ASC
    ");
    $stmtFotos->execute(array($id));
    $fotosRows = $stmtFotos->fetchAll(PDO::FETCH_ASSOC);
    $fotos = array_column($fotosRows, 'url');

    // Fallback: foto_principal si no hay fotos en galeria
    if (empty($fotos) && !empty($escort['foto_principal'])) {
        $fotos = array($escort['foto_principal']);
    }

    // === SERVICIOS ===
    $servicios = array();
    try {
        $stmtServ = $pdo->prepare("
            SELECT s.nombre, s.icono, es.incluido
            FROM servicios s 
            JOIN escort_servicios es ON s.id = es.servicio_id 
            WHERE es.escort_id = ?
        ");
        $stmtServ->execute(array($id));
        $servicios = $stmtServ->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        // Ignorar si tabla no existe
    }

    // === TARIFAS ===
    $tarifas = array();
    if ($escort['tarifa_30min']) $tarifas['30min'] = (int)$escort['tarifa_30min'];
    if ($escort['tarifa_1h']) $tarifas['1h'] = (int)$escort['tarifa_1h'];
    if ($escort['tarifa_2h']) $tarifas['2h'] = (int)$escort['tarifa_2h'];
    if ($escort['tarifa_noche']) $tarifas['noche'] = (int)$escort['tarifa_noche'];

    // Limpiar tarifas individuales del array principal
    unset($escort['tarifa_30min'], $escort['tarifa_1h'], $escort['tarifa_2h'], $escort['tarifa_noche']);

    echo json_encode(array(
        'success' => true,
        'escort' => array_merge($escort, array(
            'fotos' => $fotos,
            'servicios' => $servicios,
            'tarifas' => $tarifas
        ))
    ));
} catch (Throwable $e) {
    error_log("Error API escort: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array('success' => false, 'message' => 'Error del servidor'));
}
