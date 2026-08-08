<?php
// public/api/escort/fotos/upload-audio.php
// Subida de audio de presentación (máx 15s) para escorts
// Formatos: mp3, m4a, aac, ogg, wav

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

    // GET: obtener el audio_preview actual del escort
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare("SELECT audio_preview FROM escorts WHERE id = ?");
        $stmt->execute([$escortId]);
        $url = $stmt->fetchColumn();

        echo json_encode(['success' => true, 'url' => $url ?: null]);
        exit;
    }

    // Método DELETE: eliminar audio de presentación
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $oldAudio = $pdo->prepare("SELECT audio_preview FROM escorts WHERE id = ?");
        $oldAudio->execute([$escortId]);
        $oldUrl = $oldAudio->fetchColumn();

        if ($oldUrl && !str_starts_with($oldUrl, 'http')) {
            $oldPath = __DIR__ . '/../../../..' . $oldUrl;
            if (file_exists($oldPath)) @unlink($oldPath);
        }

        $pdo->prepare("UPDATE escorts SET audio_preview = NULL WHERE id = ?")->execute([$escortId]);

        require_once __DIR__ . '/../../mail.php';
        notificarAccionEscort('fotos', $escortId, 'Audio de presentación eliminado', []);

        echo json_encode(['success' => true, 'eliminado' => true]);
        exit;
    }

    // POST: subir nuevo audio
    if (!isset($_FILES['audio_preview']) || $_FILES['audio_preview']['error'] !== UPLOAD_ERR_OK) {

    // Validar MIME de audio
    $finfo = finfo_open(FILEINFO_MIME_TYPE, $file['tmp_name']);
    $mime = $finfo ? finfo_file($finfo, $file['tmp_name']) : '';
    finfo_close($finfo);

    $allowedMimes = [
        'audio/mpeg'  => 'mp3',
        'audio/mp4'   => 'm4a',
        'audio/aac'   => 'aac',
        'audio/ogg'   => 'ogg',
        'audio/wav'   => 'wav',
    ];

    if (!isset($allowedMimes[$mime])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Formato de audio no permitido']);
        exit;
    }

    $extension = $allowedMimes[$mime];

    // Tamaño máximo: 2MB (15s mp3 a ~128-320kbps + margen)
    if ($file['size'] > 2 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Audio demasiado grande (máx 2MB)']);
        exit;
    }

    // Validar duración con ffprobe (si está disponible)
    $ffprobe = trim((string)shell_exec('which ffprobe 2>/dev/null'));
    if ($ffprobe !== '') {
        $duration = null;
        $output = [];
        $cmd = escapeshellarg($ffprobe) . ' -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ' . escapeshellarg($file['tmp_name']);
        @exec($cmd, $output, $exitCode);
        if ($exitCode === 0 && isset($output[0]) && is_numeric($output[0])) {
            $duration = (float)$output[0];
        }

        if ($duration !== null && $duration > 15) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'El audio supera los 15 segundos']);
            exit;
        }
    }

    $hash = md5_file($file['tmp_name']);

    $uploadDir = __DIR__ . '/../../../uploads/escorts/audio/' . $escortId . '/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Limpiar audio anterior
    $oldAudio = $pdo->prepare("SELECT audio_preview FROM escorts WHERE id = ?");
    $oldAudio->execute([$escortId]);
    $oldUrl = $oldAudio->fetchColumn();
    if ($oldUrl && !str_starts_with($oldUrl, 'http')) {
        $oldPath = __DIR__ . '/../../../..' . $oldUrl;
        if (file_exists($oldPath)) {
            @unlink($oldPath);
        }
    }

    $newName = 'audio_' . date('YmdHis') . '_' . substr($hash, 0, 8) . '.' . $extension;
    $destPath = $uploadDir . $newName;
    $counter = 1;
    while (file_exists($destPath)) {
        $newName = 'audio_' . date('YmdHis') . '_' . substr($hash, 0, 8) . '_' . $counter . '.' . $extension;
        $destPath = $uploadDir . $newName;
        $counter++;
    }

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al guardar archivo']);
        exit;
    }

    $url = '/uploads/escorts/audio/' . $escortId . '/' . $newName;

    // Almacenar audio_preview en la tabla escorts
    $pdo->prepare("UPDATE escorts SET audio_preview = ? WHERE id = ?")
        ->execute([$url, $escortId]);

    require_once __DIR__ . '/../../mail.php';
    notificarAccionEscort('fotos', $escortId, 'Audio de presentación actualizado', [
        'Archivo' => $newName,
    ]);

    echo json_encode(['success' => true, 'url' => $url, 'hash' => $hash, 'mime' => $mime]);

} catch (Throwable $e) {
    error_log("Error upload-audio.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}