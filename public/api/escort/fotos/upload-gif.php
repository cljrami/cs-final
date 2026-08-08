<?php
// public/api/escort/fotos/upload-gif.php
// Subida de GIF animado generado client-side a partir de un video portada

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../../../bootstrap.php';
    $pdo = getDBConnection();

    $headers = getallheaders();
    $authHeader = '';
    foreach ($headers as $k => $v) {
        if (strtolower($k) === 'authorization') {
            $authHeader = $v;
            break;
        }
    }

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

    $escortId = $tokenData['id'];

    // Validar archivo subido
    if (!isset($_FILES['gif_portada']) || $_FILES['gif_portada']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Archivo no recibido']);
        exit;
    }

    $file = $_FILES['gif_portada'];

    // Validar MIME GIF
    $finfo = finfo_open(FILEINFO_MIME_TYPE, $file['tmp_name']);
    $mime = $finfo ? finfo_file($finfo, $file['tmp_name']) : '';
    finfo_close($finfo);

    $allowedMimes = ['image/gif'];
    if (!in_array($mime, $allowedMimes)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Solo se permiten archivos GIF animados']);
        exit;
    }

    // Tamaño máximo: 1MB
    if ($file['size'] > 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'GIF demasiado grande (máx 1MB)']);
        exit;
    }

    // Hash para duplicados
    $hash = md5_file($file['tmp_name']);

    // Verificar que no exista ya un GIF con el mismo hash para este escort
    $checkGif = $pdo->prepare(
        "SELECT gif_url FROM escort_fotos WHERE escort_id = ? AND gif_url IS NOT NULL AND gif_url != ''"
    );
    $checkGif->execute([$escortId]);
    $existing = $checkGif->fetch(PDO::FETCH_ASSOC);
    if ($existing && md5_file(__DIR__ . '/../../../..' . $existing['gif_url']) === $hash) {
        echo json_encode(['success' => true, 'url' => $existing['gif_url'], 'reutilizado' => true]);
        exit;
    }

    $uploadDir = __DIR__ . '/../../../uploads/escorts/fotos/' . $escortId . '/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $newName = 'gif_portada_' . uniqid() . '.gif';
    $destPath = $uploadDir . $newName;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al guardar archivo']);
        exit;
    }

    $url = '/uploads/escorts/fotos/' . $escortId . '/' . $newName;

    // Guardar gif_url en la foto que actualmente es portada (o la más reciente video)
    $updateGif = $pdo->prepare(
        "UPDATE escort_fotos SET gif_url = ? WHERE escort_id = ? AND es_portada = 1"
    );
    $updateGif->execute([$url, $escortId]);

    // Si no hay portada activa, guardar en la foto más reciente de tipo video
    if ($updateGif->rowCount() === 0) {
        $updateGifFallback = $pdo->prepare(
            "UPDATE escort_fotos SET gif_url = ? WHERE escort_id = ? AND tipo = 'video' ORDER BY created_at DESC LIMIT 1"
        );
        $updateGifFallback->execute([$url, $escortId]);
    }

    require_once __DIR__ . '/../../mail.php';
    notificarAccionEscort('fotos', $escortId, 'GIF de portada generado', [
        'Archivo' => $newName,
    ]);

    echo json_encode(['success' => true, 'url' => $url, 'hash' => $hash]);

} catch (Throwable $e) {
    error_log("Error upload-gif.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
