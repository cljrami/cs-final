<?php
// public/api/escort/fotos/upload-gif.php
// Sube el GIF generado client-side desde un video (portada animada)

header('Content-Type: application/json');
header('Permissions-Policy: microphone=*');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

error_log("=== upload-gif.php START ===");

try {
    $bootstrapPath = __DIR__ . '/../../bootstrap.php';
    if (!file_exists($bootstrapPath)) {
        throw new Exception("Bootstrap no encontrado: $bootstrapPath");
    }
    require_once $bootstrapPath;
    error_log("Bootstrap OK");

    $pdo = getDBConnection();
    error_log("DB OK");

    $headers = getallheaders();
    $authHeader = '';
    foreach ($headers as $k => $v) {
        if (strtolower($k) === 'authorization') { $authHeader = $v; break; }
    }
    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }
    $token = substr($authHeader, 7);
    $tokenData = verifyEscortToken($token);
    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }
    $escortId = (int)$tokenData['id'];
    error_log("Auth OK escortId=$escortId");

    // Validar archivo
    if (!isset($_FILES['gif_portada']) || $_FILES['gif_portada']['error'] !== UPLOAD_ERR_OK) {
        $errCode = $_FILES['gif_portada']['error'] ?? UPLOAD_ERR_NO_FILE;
        $errMsg = [
            UPLOAD_ERR_INI_SIZE => 'Archivo supera upload_max_filesize',
            UPLOAD_ERR_FORM_SIZE => 'Archivo supera MAX_FILE_SIZE',
            UPLOAD_ERR_PARTIAL => 'Subida parcial',
            UPLOAD_ERR_NO_FILE => 'No se envió archivo',
            UPLOAD_ERR_NO_TMP_DIR => 'Falta directorio temporal',
            UPLOAD_ERR_CANT_WRITE => 'Error escritura disco',
            UPLOAD_ERR_EXTENSION => 'Extensión PHP bloqueó subida',
        ][$errCode] ?? 'Error subida: ' . $errCode;
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $errMsg]);
        exit;
    }

    $file = $_FILES['gif_portada'];
    error_log("File: name={$file['name']}, size={$file['size']}, tmp={$file['tmp_name']}, error={$file['error']}");

    // Validar MIME por contenido real.
    // OJO: finfo_open() NO debe recibir el tmp como 2º argumento (es la ruta de
    // la base de magia); hacerlo devolvía '' y rechazaba hasta archivos válidos.
    $mime = '';
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo !== false) {
        $detected = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        if (is_string($detected) && $detected !== '') $mime = $detected;
    }

    // Fallback a extensión si fileinfo no está disponible
    if ($mime === '') {
        $extFallback = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $extToMime = [
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
        ];
        if (isset($extToMime[$extFallback])) {
            $mime = $extToMime[$extFallback];
        }
    }

    $allowedMimes = [
        'image/gif',
        'image/x-gif',
        'image/webp',
        'image/x-webp',
        'image/jpeg',
        'image/pjpeg',
    ];
    if (!in_array($mime, $allowedMimes, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Formato de portada no permitido (solo GIF, WebP o JPEG; recibido: ' . ($mime ?: 'desconocido') . ')']);
        exit;
    }

    // Tamaño máximo: 2MB (el cliente ya optimiza a <=500KB)
    if ($file['size'] > 2 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Portada demasiado grande (máx 2MB)']);
        exit;
    }

    $hash = md5_file($file['tmp_name']);

    // Verificar duplicados
    $checkGif = $pdo->prepare(
        "SELECT gif_url FROM escort_fotos WHERE escort_id = ? AND gif_url IS NOT NULL AND gif_url != ''"
    );
    $checkGif->execute([$escortId]);
    $existing = $checkGif->fetch(PDO::FETCH_ASSOC);
    if ($existing) {
        $existingPath = __DIR__ . '/../../../..' . $existing['gif_url'];
        if (file_exists($existingPath) && md5_file($existingPath) === $hash) {
            error_log("GIF duplicado reutilizado: " . $existing['gif_url']);
            echo json_encode(['success' => true, 'url' => $existing['gif_url'], 'reutilizado' => true]);
            exit;
        }
    }

    // Directorio
    $uploadDir = __DIR__ . '/../../../uploads/escorts/fotos/' . $escortId . '/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            throw new Exception("No se pudo crear directorio: $uploadDir");
        }
    }
    if (!is_writable($uploadDir)) {
        throw new Exception("Directorio no escribible: $uploadDir");
    }

    $newName = 'gif_portada_' . uniqid() . '.gif';
    $destPath = $uploadDir . $newName;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        throw new Exception("move_uploaded_file falló");
    }

    $url = '/uploads/escorts/fotos/' . $escortId . '/' . $newName;

    // Guardar gif_url en la foto indicada (la que se está marcando como portada).
    // Si no se envía fotoId, cae al comportamiento anterior (portada actual + fallback).
    $fotoId = isset($_POST['fotoId']) ? (int)$_POST['fotoId'] : 0;
    if ($fotoId > 0) {
        $updateGif = $pdo->prepare(
            "UPDATE escort_fotos SET gif_url = ? WHERE id = ? AND escort_id = ?"
        );
        $updateGif->execute([$url, $fotoId, $escortId]);
    } else {
        $updateGif = $pdo->prepare(
            "UPDATE escort_fotos SET gif_url = ? WHERE escort_id = ? AND es_portada = 1"
        );
        $updateGif->execute([$url, $escortId]);
        if ($updateGif->rowCount() === 0) {
            $updateGifFallback = $pdo->prepare(
                "UPDATE escort_fotos SET gif_url = ? WHERE escort_id = ? AND tipo = 'video' ORDER BY created_at DESC LIMIT 1"
            );
            $updateGifFallback->execute([$url, $escortId]);
        }
    }

    error_log("=== upload-gif.php SUCCESS url=$url ===");
    echo json_encode(['success' => true, 'url' => $url, 'hash' => $hash]);

} catch (Throwable $e) {
    error_log("=== upload-gif.php ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString() . " ===");
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error servidor: ' . $e->getMessage()]);
}