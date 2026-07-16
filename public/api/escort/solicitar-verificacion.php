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
    // === VERIFICAR ESTADO ACTUAL ===

    $stmt = $pdo->prepare("
        SELECT e.verificado, v.estado as verif_estado 
        FROM escorts e 
        LEFT JOIN verificaciones v ON v.escort_id = e.id AND v.estado = 'aprobada'
        WHERE e.id = ?
    ");
    $stmt->execute([$escortId]);
    $estadoActual = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($estadoActual && (int)$estadoActual['verificado'] === 1 && $estadoActual['verif_estado'] === 'aprobada') {
        echo json_encode(['success' => false, 'error' => 'Ya estás verificada']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT id FROM verificaciones 
        WHERE escort_id = ? AND estado IN ('pendiente', 'en_revision')
    ");
    $stmt->execute([$escortId]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'error' => 'Ya tienes una solicitud en revisión']);
        exit;
    }

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

    if (!str_starts_with($fotoPerfil['type'], 'image/')) {
        echo json_encode(['success' => false, 'error' => 'El archivo debe ser una imagen']);
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

    // Generar nombres
    $extPerfil = pathinfo($fotoPerfil['name'], PATHINFO_EXTENSION);

    $nombrePerfil = 'perfil_real.' . $extPerfil;

    $rutaPerfilFs = $uploadDir . $nombrePerfil;

    // URLs para guardar en BD (relativas a public/)
    $rutaPerfil = '/uploads/verificaciones/' . $escortId . '/' . $nombrePerfil;

    if (!move_uploaded_file($fotoPerfil['tmp_name'], $rutaPerfilFs)) {
        throw new Exception('Error subiendo foto de perfil');
    }

    // === GUARDAR EN BD ===

    $stmt = $pdo->prepare("SELECT id FROM verificaciones WHERE escort_id = ? AND estado = 'rechazada'");
    $stmt->execute([$escortId]);
    $rechazada = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($rechazada) {
        $stmt = $pdo->prepare("
            UPDATE verificaciones 
            SET estado = 'pendiente',
                foto_perfil_real = ?,
                foto_documento = '',
                notas_revision = NULL,
                revisado_por = NULL,
                revisado_en = NULL,
                creado_en = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$rutaPerfil, $rechazada['id']]);
        $verifId = $rechazada['id'];
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO verificaciones 
            (escort_id, foto_perfil_real, foto_documento, estado, creado_en) 
            VALUES (?, ?, '', 'pendiente', NOW())
        ");
        $stmt->execute([$escortId, $rutaPerfil]);
        $verifId = $pdo->lastInsertId();
    }

    echo json_encode([
        'success' => true,
        'message' => 'Solicitud enviada correctamente',
        'verificacion_id' => $verifId
    ]);
} catch (Exception $e) {
    error_log("Error solicitar-verificacion: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
