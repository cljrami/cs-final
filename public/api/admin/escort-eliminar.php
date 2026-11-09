<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

$tokenData = requireAuth();
requireAdminRole($tokenData);

$input = json_decode(file_get_contents('php://input'), true);
$id = intval($input['id'] ?? 0);

if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID requerido']);
    exit;
}

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();

    $check = $pdo->prepare("SELECT id, nombre, email, activa, estado FROM escorts WHERE id = ?");
    $check->execute([$id]);
    $escort = $check->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE escorts SET eliminada = 1, activa = 0, estado = 'eliminada', nombre = '', foto_principal = NULL, edad = 0, ciudad = NULL, telefono = NULL, whatsapp = NULL, descripcion_corta = NULL, descripcion_larga = NULL, altura = NULL, peso = NULL, medidas = NULL, categoria_id = NULL, nacionalidad = NULL, etnia = NULL, color_ojos = NULL, color_pelo = NULL, orientacion = NULL, estilo = NULL, privacidad = NULL, disponible_ahora = 0, en_gira = 0, gira_ciudad_id = NULL, gira_fecha_inicio = NULL, gira_fecha_fin = NULL, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$id]);

    $pdo->prepare("UPDATE suscripciones SET estado = 'cancelada', actualizado_en = NOW() WHERE escort_id = ? AND estado IN ('activa', 'pendiente_aprobacion')")->execute([$id]);

    $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$id]);

    $tables = [
        'pagos', 'suscripciones', 'escort_vip_solicitudes', 'verificaciones',
        'reportes', 'planes_usados', 'historial_pausas', 'suscripciones_historial',
        'estadisticas_diarias', 'servicios', 'valoraciones',
        'escort_fotos', 'escort_historias', 'escort_idiomas', 'escort_servicios',
        'favoritos', 'comentarios', 'notificaciones', 'codigos_verificacion',
        'sticky_posiciones', 'banners'
    ];
    foreach ($tables as $t) {
        try {
            $pdo->prepare("DELETE FROM `{$t}` WHERE escort_id = ?")->execute([$id]);
        } catch (PDOException $e) {
            error_log("escort-eliminar tabla {$t}: " . $e->getMessage());
        }
    }

    $pdo->prepare("
        INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address)
        VALUES (?, ?, 'eliminar_escort', 'escorts', ?, ?, ?)
    ")->execute([
        $tokenData['id'],
        $id,
        $id,
        json_encode($escort),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    $pdo->commit();

    function eliminarDirectorioRecursivo(string $ruta): void {
        if (!is_dir($ruta)) return;
        $items = scandir($ruta);
        if ($items === false) return;
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $rutaItem = $ruta . DIRECTORY_SEPARATOR . $item;
            if (is_dir($rutaItem)) {
                eliminarDirectorioRecursivo($rutaItem);
            } else {
                @unlink($rutaItem);
            }
        }
        @rmdir($ruta);
    }
    $base = __DIR__ . '/../../uploads';
    foreach ([
        $base . '/escorts/fotos/' . $id,
        $base . '/escorts/historias/' . $id,
        $base . '/comprobantes/' . $id,
        $base . '/verificaciones/' . $id,
    ] as $carp) {
        eliminarDirectorioRecursivo($carp);
    }

    echo json_encode(['success' => true, 'message' => 'Escort enviada a la papelera']);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("Error escort-eliminar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()]);
}
