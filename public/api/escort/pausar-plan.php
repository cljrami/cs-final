<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/pausar-plan.php
// POST - Pausar plan base activo

header('Content-Type: application/json');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

try {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || !isset($tokenData['exp']) || $tokenData['exp'] < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = isset($tokenData['id']) ? intval($tokenData['id']) : 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();
    // Obtener suscripción activa
    $stmt = $pdo->prepare("
        SELECT s.id, s.fecha_fin, s.fecha_aprobacion, s.fecha_primer_pausa, s.estado,
               p.max_pausas_permitidas, p.duracion_dias
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND p.tipo = 'base' AND s.estado = 'activa' AND s.fecha_aprobacion IS NOT NULL
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        echo json_encode(['success' => false, 'error' => 'No tienes un plan activo para pausar']);
        exit;
    }

    // Verificar ventana desde primera pausa
    $fechaPrimerPausa = $suscripcion['fecha_primer_pausa'];
    $ventanaDias = max(1, (int)$suscripcion['duracion_dias']);
    if ($fechaPrimerPausa) {
        $inicio = new DateTime($fechaPrimerPausa);
        $diff = (int)$inicio->diff(new DateTime())->days;
        if ($diff > $ventanaDias) {
            $pdo->prepare("UPDATE suscripciones SET estado = 'expirada' WHERE id = ?")->execute([$suscripcion['id']]);
            echo json_encode(['success' => false, 'error' => "Pasaron más de {$ventanaDias} días desde la primera pausa. El plan ha expirado."]);
            exit;
        }
    }

    // Verificar pausas usadas
    $stmtPausas = $pdo->prepare("
        SELECT COUNT(*) FROM historial_pausas 
        WHERE suscripcion_id = ? AND accion = 'pausa'
    ");
    $stmtPausas->execute([$suscripcion['id']]);
    $pausasUsadas = (int)$stmtPausas->fetchColumn();

    if ($pausasUsadas >= (int)$suscripcion['max_pausas_permitidas']) {
        echo json_encode(['success' => false, 'error' => 'Límite de pausas alcanzado']);
        exit;
    }

    // Si es la primera pausa, guardar fecha de referencia
    if ($pausasUsadas === 0) {
        $pdo->prepare("UPDATE suscripciones SET fecha_primer_pausa = NOW() WHERE id = ?")->execute([$suscripcion['id']]);
    }

    // Calcular días usados hasta hoy
    $fechaInicio = new DateTime($suscripcion['fecha_aprobacion']);
    $hoy = new DateTime();
    $diasUsados = (int)$fechaInicio->diff($hoy)->days;

    // Pausar suscripción
    $update = $pdo->prepare("UPDATE suscripciones SET estado = 'pausada' WHERE id = ?");
    $update->execute([$suscripcion['id']]);

    // Registrar en historial
    $insert = $pdo->prepare("
        INSERT INTO historial_pausas (suscripcion_id, escort_id, accion, dias_acumulados_pausa, notas)
        VALUES (?, ?, 'pausa', ?, 'Pausado desde panel escort')
    ");
    $insert->execute([$suscripcion['id'], $escortId, $diasUsados]);

    echo json_encode([
        'success' => true,
        'message' => 'Plan pausado correctamente',
        'dias_usados' => $diasUsados
    ]);
} catch (PDOException $e) {
    error_log("Error pausar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error pausar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
