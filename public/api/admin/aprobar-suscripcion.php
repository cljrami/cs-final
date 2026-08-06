<?php
require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Asegurar que solo peticiones POST procesen el cambio
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('success' => false, 'error' => 'Método no permitido'));
    exit;
}

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    // Obtener parámetros enviados por el panel de administración
    $suscripcionId = isset($_POST['suscripcion_id']) ? intval($_POST['suscripcion_id']) : 0;
    $escortId = isset($_POST['escort_id']) ? intval($_POST['escort_id']) : 0;

    if ($suscripcionId <= 0 || $escortId <= 0) {
        // Intentar leer si viene en formato JSON crudo (raw input)
        $input = json_decode(file_get_contents('php://input'), true);
        $suscripcionId = isset($input['suscripcion_id']) ? intval($input['suscripcion_id']) : 0;
        $escortId = isset($input['escort_id']) ? intval($input['escort_id']) : 0;
    }

    if ($suscripcionId <= 0 || $escortId <= 0) {
        http_response_code(400);
        echo json_encode(array('success' => false, 'error' => 'Parámetros inválidos o faltantes'));
        exit;
    }

    $pdo->beginTransaction();

    // Verificar que la suscripciíƒÂ³n pertenece a un plan base (los extras se gestionan en Solicitudes Extras)
    $stmtPlanCheck = $pdo->prepare("
        SELECT p.tipo
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.id = ?
    ");
    $stmtPlanCheck->execute(array($suscripcionId));
    $planTipo = $stmtPlanCheck->fetchColumn();
    if ($planTipo === 'extra') {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(array('success' => false, 'error' => 'Las solicitudes de planes extra se gestionan desde el panel de Solicitudes Extras'));
        exit;
    }

    // 1. Aprobar y activar la cuenta base de la escort globalmente
    $stmtEscort = $pdo->prepare("
        UPDATE escorts 
        SET estado = 'aprobada', 
            aprobada = 1
        WHERE id = ?
    ");
    $stmtEscort->execute(array($escortId));

    // 2. Activar la suscripción calculando dinámicamente la fecha de término (fecha_fin)
    $stmtSuscripcion = $pdo->prepare("
        UPDATE suscripciones s
        JOIN planes p ON p.id = s.plan_id
        SET s.estado = 'activa',
            s.fecha_aprobacion = NOW(),
            s.fecha_inicio = NOW(),
            s.fecha_fin = DATE_ADD(NOW(), INTERVAL p.duracion_dias DAY)
        WHERE s.id = ? AND s.escort_id = ?
    ");
    $stmtSuscripcion->execute(array($suscripcionId, $escortId));

    $pdo->commit();

    echo json_encode(array(
        'success' => true,
        'message' => 'Suscripción aprobada y cuenta de escort activada correctamente.'
    ));
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Error crítico en aprobación de suscripción: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(array('success' => false, 'error' => 'Error interno al procesar la aprobación'));
}
