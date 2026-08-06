<?php
// public/api/escort/historias/upload.php
// Subida de historias (imágenes/videos 24h) con soporte WebP, AVIF, GIF y seguridad mejorada

ini_set('display_errors', 0);
ini_set('upload_max_filesize', '100M');
ini_set('post_max_size', '110M');
ini_set('max_execution_time', '300');

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../../bootstrap.php';

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

    $planStmt = $pdo->prepare("
        SELECT p.max_videos
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND s.estado = 'activa' AND s.fecha_fin >= CURDATE()
        LIMIT 1
    ");
    $planStmt->execute([$escortId]);
    $plan = $planStmt->fetch(PDO::FETCH_ASSOC);
    $maxVideos = $plan ? (int)$plan['max_videos'] : 0;

    if ($maxVideos <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Tu plan no incluye historias. Actualiza tu plan para subir contenido.']);
        exit;
    }

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM escort_historias WHERE escort_id = ? AND expira_en > NOW()");
    $countStmt->execute([$escortId]);
    $activas = (int)$countStmt->fetchColumn();

    $files = $_FILES['historias'] ?? [];
    $tmpNames = $files['tmp_name'] ?? [];
    if (empty($tmpNames)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No se enviaron archivos o el archivo supera el límite del servidor']);
        exit;
    }

    $totalFiles = is_array($tmpNames) ? count($tmpNames) : 1;
    if ($activas + $totalFiles > $maxVideos) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Límite de $maxVideos historias. Tienes $activas activas."]);
        exit;
    }

    $uploadDir = __DIR__ . '/../../../uploads/escorts/historias/' . $escortId . '/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $MAX_IMG = 10 * 1024 * 1024;
    $MAX_VID = 50 * 1024 * 1024;
    $MAX_DIM = 4096;

    $formatosImg = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'webp' => ['image/webp'],
        'avif' => ['image/avif'],
        'gif' => ['image/gif'],
        'bmp' => ['image/bmp'],
    ];
    $formatosVid = [
        'mp4' => ['video/mp4'],
        'mov' => ['video/quicktime'],
        'webm' => ['video/webm'],
    ];

    $historias = [];
    $errores = [];

    for ($i = 0; $i < $totalFiles; $i++) {
        $tmpName = is_array($tmpNames) ? $tmpNames[$i] : $tmpNames;
        $name = is_array($files['name']) ? $files['name'][$i] : $files['name'];
        $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];
        $size = is_array($files['size']) ? $files['size'][$i] : $files['size'];

        if ($error !== UPLOAD_ERR_OK) {
            switch ($error) {
                case UPLOAD_ERR_INI_SIZE:
                case UPLOAD_ERR_FORM_SIZE:
                    $errMsg = 'El archivo supera el límite de tamaño permitido';
                    break;
                case UPLOAD_ERR_PARTIAL:
                    $errMsg = 'El archivo se subió parcialmente';
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $errMsg = 'No se recibió el archivo';
                    break;
                default:
                    $errMsg = 'Error al subir el archivo';
            }
            $errores[] = "$name: $errMsg";
            continue;
        }

        if (!is_uploaded_file($tmpName)) continue;

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        $esImagen = isset($formatosImg[$ext]);
        $esVideo = isset($formatosVid[$ext]);

        if (!$esImagen && !$esVideo) {
            $errores[] = "Formato .$ext no permitido ($name)";
            continue;
        }

        $isVideo = $esVideo;
        $maxSize = $isVideo ? $MAX_VID : $MAX_IMG;

        if ($size > $maxSize) {
            $humanSize = $isVideo ? '50MB' : '10MB';
            $errores[] = "$name supera el límite de $humanSize";
            continue;
        }

        // Validar por MIME real
        if (!$isVideo) {
            if (!validarMIME($tmpName, array_merge(...array_values($formatosImg)))) {
                $errores[] = "$name no es una imagen válida o está corrupta";
                continue;
            }
            $imgInfo = @getimagesize($tmpName);
            if ($imgInfo === false) {
                $errores[] = "$name no es una imagen válida o está corrupta";
                continue;
            }
            if ($imgInfo[0] > $MAX_DIM || $imgInfo[1] > $MAX_DIM) {
                $errores[] = "$name excede $MAX_DIM px ({$imgInfo[0]}x{$imgInfo[1]})";
                continue;
            }
            if ($ext === 'jpeg') {
                $ext = 'jpg';
            }
        } else {
            if (!validarMIME($tmpName, array_merge(...array_values($formatosVid)))) {
                $errores[] = "$name no es un video válido o está corrupto";
                continue;
            }
        }

        $fileType = $isVideo ? 'video' : 'imagen';
        $newName = uniqid('hist_') . '.' . $ext;
        $destPath = $uploadDir . $newName;

        if (move_uploaded_file($tmpName, $destPath)) {
            $url = '/api/serve-upload.php?path=/uploads/escorts/historias/' . $escortId . '/' . $newName;
            $expiraEn = date('Y-m-d H:i:s', strtotime('+24 hours'));

            $stmt = $pdo->prepare("
                INSERT INTO escort_historias (escort_id, url, tipo, expira_en, vistas, creado_en)
                VALUES (?, ?, ?, ?, 0, NOW())
            ");
            $stmt->execute([$escortId, $url, $fileType, $expiraEn]);

            $historias[] = [
                'id' => $pdo->lastInsertId(),
                'url' => $url,
                'tipo' => $fileType,
                'expiraEn' => $expiraEn,
                'vistas' => 0
            ];
        }
    }

    $respuesta = ['success' => true, 'historias' => $historias];
    if (!empty($errores)) {
        $respuesta['errores'] = $errores;
    }
    if (count($historias) > 0) {
        require_once __DIR__ . '/../../mail.php';
        notificarAccionEscort('historias', $escortId, 'Escort publicó nueva historia', [
            'Historias publicadas' => count($historias),
        ]);
    }
    echo json_encode($respuesta);
} catch (Throwable $e) {
    error_log("Error historias/upload.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor al procesar el archivo. Verifica el tamaño y formato.'
    ]);
}
