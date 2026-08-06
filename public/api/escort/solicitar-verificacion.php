<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/solicitar-verificacion.php
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

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = $tokenData['id'] ?? 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    require_once __DIR__ . '/../bootstrap.php';

$pdo = getDBConnection();
    // === PROCESAR ARCHIVOS ===

    $fotoPerfil = $_FILES['foto_perfil'] ?? null;

    if (!$fotoPerfil || $fotoPerfil['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'error' => 'Debes subir la foto de perfil (selfie)']);
        exit;
    }

    if ($fotoPerfil['size'] > 5 * 1024 * 1024) {
        echo json_encode(['success' => false, 'error' => 'El archivo no puede superar 5MB']);
        exit;
    }

    $tiposImg = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validarMIME($fotoPerfil['tmp_name'], $tiposImg)) {
        echo json_encode(['success' => false, 'error' => 'El archivo debe ser una imagen (JPG, PNG, WebP o GIF)']);
        exit;
    }

    // === CREAR CARPETA POR ESCORT ID ===
    $uploadDir = __DIR__ . '/../../uploads/verificaciones/' . $escortId . '/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Limpiar archivos anteriores de esta escort (si reenvía)
    foreach (glob($uploadDir . '*') as $oldFile) {
        if (is_file($oldFile)) {
            @unlink($oldFile);
        }
    }

    // Generar nombres (extensión restringida a tipos de imagen validados)
    $extPermitidas = ['jpg' => 'jpg', 'jpeg' => 'jpg', 'png' => 'png', 'webp' => 'webp', 'gif' => 'gif'];
    $extPerfil = $extPermitidas[strtolower(pathinfo($fotoPerfil['name'], PATHINFO_EXTENSION))] ?? '';
    if ($extPerfil === '') {
        echo json_encode(['success' => false, 'error' => 'Extensión de imagen no permitida']);
        exit;
    }

    $nombrePerfil = 'perfil_real.' . $extPerfil;

    $rutaPerfilFs = $uploadDir . $nombrePerfil;

    // URLs para guardar en BD (relativas a public/)
    $rutaPerfil = '/uploads/verificaciones/' . $escortId . '/' . $nombrePerfil;

    if (!move_uploaded_file($fotoPerfil['tmp_name'], $rutaPerfilFs)) {
        throw new Exception('Error subiendo foto de perfil');
    }

    // === GUARDAR EN BD ===

    $stmt = $pdo->prepare("SELECT id, estado FROM verificaciones WHERE escort_id = ? AND estado IN ('pendiente', 'en_revision', 'rechazada', 'aprobada') ORDER BY FIELD(estado, 'pendiente', 'en_revision', 'rechazada', 'aprobada') LIMIT 1");
    $stmt->execute([$escortId]);
    $existente = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existente) {
        $nuevoEstado = ($existente['estado'] === 'aprobada') ? 'aprobada' : 'pendiente';
        $stmt = $pdo->prepare("
            UPDATE verificaciones 
            SET estado = ?,
                foto_perfil_real = ?,
                notas_revision = NULL,
                revisado_por = NULL,
                revisado_en = NULL,
                creado_en = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$nuevoEstado, $rutaPerfil, $existente['id']]);
        $verifId = $existente['id'];
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO verificaciones 
            (escort_id, foto_perfil_real, foto_documento, estado, creado_en) 
            VALUES (?, ?, '', 'pendiente', NOW())
        ");
        $stmt->execute([$escortId, $rutaPerfil]);
        $verifId = $pdo->lastInsertId();
    }

    require_once __DIR__ . '/../mail.php';
    try {
        $esc = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
        $esc->execute([$escortId]);
        $escName = $esc->fetchColumn() ?: "ID {$escortId}";
        $body = '<p>Una escort ha enviado una <strong style="color:#ffffff">solicitud de verificación de identidad</strong>:</p>';
        $body .= '<table class="info">';
        $body .= '<tr><td>Escort:</td><td>' . htmlspecialchars($escName, ENT_QUOTES, 'UTF-8') . '</td></tr>';
        $body .= '</table>';
        $body .= '<p>Revisa la foto de perfil real y aprueba o rechaza la solicitud.</p>';
        $body .= '<p style="text-align:center;margin-top:24px"><a class="btn" href="' . SITE_URL . '/admin/verificaciones">Revisar solicitud</a></p>';
        sendAdminNotification('verificaciones', 'Nueva solicitud de verificación', $body);
    } catch (\Throwable $e2) {
        error_log("solicitar-verificacion notify error: " . $e2->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => 'Solicitud enviada correctamente',
        'verificacion_id' => $verifId
    ]);
} catch (Exception $e) {
    error_log("Error solicitar-verificacion: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
