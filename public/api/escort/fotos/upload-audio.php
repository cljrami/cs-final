<?php
// public/api/escort/fotos/upload-audio.php
// Subida de audio de presentación (máx 20MB) para escorts
// Formatos: mp3, m4a, aac, ogg, wav

// Header JSON + CORS + override Permissions-Policy
header('Content-Type: application/json');
header('Permissions-Policy: microphone=*');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Logging temprano
error_log("=== upload-audio.php START method=" . $_SERVER['REQUEST_METHOD'] . " ===");

try {
    // 1. Cargar bootstrap
    $bootstrapPath = __DIR__ . '/../../bootstrap.php';
    if (!file_exists($bootstrapPath)) {
        throw new Exception("Bootstrap no encontrado: $bootstrapPath");
    }
    require_once $bootstrapPath;
    error_log("Bootstrap OK");

    // 2. Conexión BD
    $pdo = getDBConnection();
    error_log("DB OK");

    // 3. Auth
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

    // 4. GET: obtener audio actual
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare("SELECT audio_preview FROM escorts WHERE id = ?");
        $stmt->execute([$escortId]);
        $url = $stmt->fetchColumn();
        echo json_encode(['success' => true, 'url' => $url ?: null]);
        exit;
    }

     // 5. DELETE | POST _method=delete: eliminar audio
     $isDelete = $_SERVER['REQUEST_METHOD'] === 'DELETE'
         || ($_SERVER['REQUEST_METHOD'] === 'POST' && (($_POST['_method'] ?? '') === 'delete' || ($_GET['_method'] ?? '') === 'delete'));
     if ($isDelete) {
        $stmt = $pdo->prepare("SELECT audio_preview FROM escorts WHERE id = ?");
        $stmt->execute([$escortId]);
        $oldUrl = $stmt->fetchColumn();
        if ($oldUrl && !str_starts_with($oldUrl, 'http')) {
            $oldPath = __DIR__ . '/../../../..' . $oldUrl;
            if (file_exists($oldPath)) @unlink($oldPath);
        }
        $pdo->prepare("UPDATE escorts SET audio_preview = NULL WHERE id = ?")->execute([$escortId]);
        // Notificación (opcional)
        if (file_exists(__DIR__ . '/../../mail.php')) {
            require_once __DIR__ . '/../../mail.php';
            notificarAccionEscort('fotos', $escortId, 'Audio de presentación eliminado', []);
        }
        echo json_encode(['success' => true, 'eliminado' => true]);
        exit;
    }

     // 6. POST: subir audio
     // Gate: el plan activo debe permitir audio de presentación
     $gateStmt = $pdo->prepare("
         SELECT p.permite_audio
         FROM suscripciones s
         JOIN planes p ON p.id = s.plan_id
         WHERE s.escort_id = ? AND s.estado = 'activa' AND s.fecha_fin >= CURDATE()
         LIMIT 1
     ");
     $gateStmt->execute([$escortId]);
     $row = $gateStmt->fetch(PDO::FETCH_ASSOC);
     $permiteAudio = $row ? (bool)$row['permite_audio'] : false;
     if (!$permiteAudio) {
         http_response_code(403);
         echo json_encode(['success' => false, 'error' => 'Tu plan no incluye audio de presentación. Actualiza tu plan para subir tu saludo de audio.']);
         exit;
     }

    if (!isset($_FILES['audio_preview']) || $_FILES['audio_preview']['error'] !== UPLOAD_ERR_OK) {
        $errCode = $_FILES['audio_preview']['error'] ?? UPLOAD_ERR_NO_FILE;
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

    $file = $_FILES['audio_preview'];
    error_log("File: name={$file['name']}, size={$file['size']}, tmp={$file['tmp_name']}, error={$file['error']}");

    // Validar MIME (detección real por contenido)
    // Nota: finfo_open() NUNCA debe recibir el tmp del archivo como 2º argumento;
    // ese parámetro es la ruta de la base de datos de "magia". Pasarlo genera un
    // finfo inválido que devuelve '' y rechazaba todos los archivos válidos.
    $mime = '';
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo !== false) {
        $detected = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        if (is_string($detected) && $detected !== '') {
            $mime = $detected;
        }
    }

    // Fallback a extensión si fileinfo no está disponible en el hosting
    if ($mime === '') {
        $extFallback = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $extToMime = [
            'mp3' => 'audio/mpeg',
            'm4a' => 'audio/mp4',
            'aac' => 'audio/aac',
            'ogg' => 'audio/ogg',
            'opus' => 'audio/ogg',
            'wav' => 'audio/wav',
            'webm' => 'audio/webm',
        ];
        if (isset($extToMime[$extFallback])) {
            $mime = $extToMime[$extFallback];
        }
    }

    $allowedMimes = [
        'audio/mpeg'      => 'mp3',
        'audio/mp3'       => 'mp3',
        'audio/x-mpeg'    => 'mp3',
        'audio/x-mp3'     => 'mp3',
        'audio/mp4'       => 'm4a',
        'audio/m4a'       => 'm4a',
        'audio/x-m4a'     => 'm4a',
        'audio/aac'       => 'aac',
        'audio/x-aac'     => 'aac',
        'audio/ogg'       => 'ogg',
        'audio/x-ogg'     => 'ogg',
        'audio/opus'      => 'opus',
        'audio/wav'       => 'wav',
        'audio/x-wav'     => 'wav',
        'audio/wave'      => 'wav',
        // Audios grabados con MediaRecorder (Opus dentro de contenedor WebM).
        // fileinfo suele reportar `video/webm` incluso para audio puro.
        'audio/webm'      => 'webm',
        'audio/x-webm'    => 'webm',
        'video/webm'      => 'webm',
        'application/webm' => 'webm',
    ];

    if (!isset($allowedMimes[$mime])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Formato no permitido. Usa MP3, M4A, AAC, OGG, WAV o WebM (grabación)']);
        exit;
    }

    $extension = $allowedMimes[$mime];

    // Tamaño máximo: 20MB
    if ($file['size'] > 20 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Audio demasiado grande (máx 20MB)']);
        exit;
    }

    // Hash
    $hash = md5_file($file['tmp_name']);

    // Directorio de subida
    $uploadDir = __DIR__ . '/../../../uploads/escorts/audio/' . $escortId . '/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            throw new Exception("No se pudo crear directorio: $uploadDir");
        }
    }
    if (!is_writable($uploadDir)) {
        throw new Exception("Directorio no escribible: $uploadDir");
    }

    // Limpiar audio anterior
    $stmt = $pdo->prepare("SELECT audio_preview FROM escorts WHERE id = ?");
    $stmt->execute([$escortId]);
    $oldUrl = $stmt->fetchColumn();
    if ($oldUrl && !str_starts_with($oldUrl, 'http')) {
        $oldPath = __DIR__ . '/../../../..' . $oldUrl;
        if (file_exists($oldPath)) @unlink($oldPath);
    }

    // Nombre único
    $newName = 'audio_' . date('YmdHis') . '_' . substr($hash, 0, 8) . '.' . $extension;
    $destPath = $uploadDir . $newName;
    $counter = 1;
    while (file_exists($destPath)) {
        $newName = 'audio_' . date('YmdHis') . '_' . substr($hash, 0, 8) . '_' . $counter . '.' . $extension;
        $destPath = $uploadDir . $newName;
        $counter++;
    }

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        throw new Exception("move_uploaded_file falló");
    }

    $url = '/uploads/escorts/audio/' . $escortId . '/' . $newName;

    // Guardar en BD
    $pdo->prepare("UPDATE escorts SET audio_preview = ? WHERE id = ?")->execute([$url, $escortId]);

    // Notificación (opcional)
    if (file_exists(__DIR__ . '/../../mail.php')) {
        require_once __DIR__ . '/../../mail.php';
        notificarAccionEscort('fotos', $escortId, 'Audio de presentación actualizado', ['Archivo' => $newName]);
    }

    error_log("=== upload-audio.php SUCCESS url=$url ===");
    echo json_encode(['success' => true, 'url' => $url, 'hash' => $hash, 'mime' => $mime]);

} catch (Throwable $e) {
    error_log("=== upload-audio.php ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString() . " ===");
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error servidor: ' . $e->getMessage()]);
}