<?php
require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

try {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

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

    $pdo = getDBConnection();
    if (!isset($_FILES['comprobante']) || $_FILES['comprobante']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No se recibió el archivo o hubo un error']);
        exit;
    }

    $file = $_FILES['comprobante'];

    $tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!in_array($file['type'], $tiposPermitidos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Solo se permiten imágenes (JPG, PNG, WebP) o PDF']);
        exit;
    }

    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'El archivo no puede superar los 5MB']);
        exit;
    }

    $uploadDir = __DIR__ . '/../../uploads/comprobantes/' . $escortId . '/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = date('Ymd_His') . '_comprobante_' . uniqid() . '.' . $ext;
    $filepath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        throw new Exception('Error al guardar el archivo');
    }

    $rutaRelativa = 'uploads/comprobantes/' . $escortId . '/' . $filename;

    $tipo = $_POST['tipo'] ?? 'suscripcion';
    $id = isset($_POST['id']) ? intval($_POST['id']) : 0;

    if ($tipo === 'pago' && $id > 0) {
        // Actualizar comprobante de un pago existente (plan base)
        $stmt = $pdo->prepare("UPDATE pagos SET comprobante_url = ? WHERE id = ? AND escort_id = ?");
        $stmt->execute([$rutaRelativa, $id, $escortId]);
    } elseif ($tipo === 'suscripcion' && $id > 0) {
        // Actualizar comprobante de una suscripción existente (extra)
        $stmt = $pdo->prepare("UPDATE suscripciones SET comprobante_pago = ?, estado_pago = 'comprobante_subido' WHERE id = ? AND escort_id = ?");
        $stmt->execute([$rutaRelativa, $id, $escortId]);
    } elseif ($tipo === 'vip' && $id > 0) {
        // Actualizar comprobante de una solicitud VIP existente
        $stmt = $pdo->prepare("UPDATE escort_vip_solicitudes SET comprobante_pago = ? WHERE id = ? AND escort_id = ?");
        $stmt->execute([$rutaRelativa, $id, $escortId]);
    } else {
        // Fallback: actualizar suscripción pendiente (compatibilidad hacia atrás)
        $stmt = $pdo->prepare("
            UPDATE suscripciones 
            SET comprobante_pago = ?,
                estado_pago = 'comprobante_subido'
            WHERE escort_id = ? 
              AND estado = 'pendiente_aprobacion'
            ORDER BY creado_en DESC
            LIMIT 1
        ");
        $stmt->execute([$rutaRelativa, $escortId]);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Comprobante subido correctamente',
        'comprobante_url' => '/' . $rutaRelativa
    ]);
} catch (PDOException $e) {
    error_log("Error subir-comprobante.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error subir-comprobante.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno: ' . $e->getMessage()]);
}
