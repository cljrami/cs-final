<?php
// public/api/escort/perfil.php

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // RUTA CORRECTA: subir un nivel desde /escort/ para llegar a /api/
    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (substr($authHeader, 0, 7) !== 'Bearer ') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = $tokenData['id'];

    // Consulta que extrae la escort y verifica si tiene una suscripción válida activa
    $stmt = $pdo->prepare("
        SELECT 
            e.*,
            CASE 
                WHEN e.estado = 'aprobada' OR (
                    SELECT COUNT(*) 
                    FROM suscripciones s 
                    WHERE s.escort_id = e.id AND s.estado = 'activa' AND (s.fecha_fin IS NULL OR s.fecha_fin >= CURDATE())
                ) > 0 THEN 1
                ELSE 0
            END as cuenta_aprobada
        FROM escorts e 
        WHERE e.id = ? AND e.eliminada = 0
    ");
    $stmt->execute([$escortId]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    // Fuerza las propiedades de aprobación en la respuesta para que React no bloquee la UI
    if ((int)$escort['cuenta_aprobada'] === 1) {
        $escort['aprobada'] = 1;
        $escort['estado'] = 'aprobada';
    }

    echo json_encode([
        'success' => true,
        'escort' => $escort,
        'aprobada' => (int)$escort['cuenta_aprobada'] === 1 // "Salvavidas" directo para el hook useAprobacion
    ]);
} catch (Throwable $e) {
    error_log("Error escort/perfil.php: " . $e->getMessage() . " en " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
