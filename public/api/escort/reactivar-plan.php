<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/reactivar-plan.php
// POST - Reactivar plan pausado

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
    // Obtener suscripción pausada
    $stmt = $pdo->prepare("
        SELECT s.id, s.fecha_fin, s.fecha_aprobacion, s.fecha_primer_pausa, p.duracion_dias
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND p.tipo = 'base' AND s.estado = 'pausada'
        ORDER BY s.creado_en DESC
        LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $suscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$suscripcion) {
        echo json_encode(['success' => false, 'error' => 'No tienes un plan pausado']);
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

    // Obtener días acumulados de pausa
    $stmtPausas = $pdo->prepare("
        SELECT COALESCE(SUM(dias_acumulados_pausa), 0) as total_pausado
        FROM historial_pausas 
        WHERE suscripcion_id = ? AND accion = 'pausa'
    ");
    $stmtPausas->execute([$suscripcion['id']]);
    $diasPausados = (int)$stmtPausas->fetchColumn();

    // Calcular nueva fecha fin (extender por los días pausados)
    $fechaFinActual = new DateTime($suscripcion['fecha_fin']);
    $fechaFinActual->modify("+{$diasPausados} days");

    // Reactivar
    $update = $pdo->prepare("
        UPDATE suscripciones 
        SET estado = 'activa', fecha_fin = ? 
        WHERE id = ?
    ");
    $update->execute([$fechaFinActual->format('Y-m-d'), $suscripcion['id']]);

    // Registrar reactivación
    $insert = $pdo->prepare("
        INSERT INTO historial_pausas (suscripcion_id, escort_id, accion, dias_acumulados_pausa, notas)
        VALUES (?, ?, 'reactivacion', 0, 'Reactivado desde panel escort')
    ");
    $insert->execute([$suscripcion['id'], $escortId]);

    echo json_encode([
        'success' => true,
        'message' => 'Plan reactivado correctamente',
        'nueva_fecha_fin' => $fechaFinActual->format('Y-m-d')
    ]);
} catch (PDOException $e) {
    error_log("Error reactivar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error reactivar-plan.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
