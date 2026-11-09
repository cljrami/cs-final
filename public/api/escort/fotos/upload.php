<?php
// public/api/escort/fotos/upload.php
// Subida de fotos y videos con soporte WebP, AVIF, GIF y seguridad mejorada

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
    $tokenData = verifyEscortToken($token);

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = $tokenData['id'];

    $files = $_FILES['fotos'] ?? [];
    if (empty($files['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No se enviaron archivos']);
        exit;
    }

    $uploadDir = __DIR__ . '/../../../uploads/escorts/fotos/' . $escortId . '/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    // Obtener límites del plan activo
    $planStmt = $pdo->prepare("
        SELECT p.max_fotos, p.max_videos, p.permite_audio
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND s.estado = 'activa' AND s.fecha_fin >= CURDATE()
        LIMIT 1
    ");
    $planStmt->execute([$escortId]);
    $plan = $planStmt->fetch(PDO::FETCH_ASSOC);
    $maxFotos = $plan ? (int)$plan['max_fotos'] : 5;
    $maxVideos = $plan ? (int)$plan['max_videos'] : 0;

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM escort_fotos WHERE escort_id = ?");
    $countStmt->execute([$escortId]);
    $totalActual = (int)$countStmt->fetchColumn();

    // Contar fotos y videos existentes por separado para aplicar límites por tipo
    $countTiposStmt = $pdo->prepare("SELECT tipo, COUNT(*) FROM escort_fotos WHERE escort_id = ? GROUP BY tipo");
    $countTiposStmt->execute([$escortId]);
    $actualPorTipo = ['imagen' => 0, 'video' => 0];
    foreach ($countTiposStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $actualPorTipo[$row['tipo']] = (int)$row['COUNT(*)'];
    }

    $fileCount = is_array($files['tmp_name']) ? count($files['tmp_name']) : 1;

    // Contabilizar cuántas fotos/videos vienen en este lote por tipo
    $fotosEnLote = 0;
    $videosEnLote = 0;
    for ($c = 0; $c < $fileCount; $c++) {
        $chkName = is_array($files['name']) ? $files['name'][$c] : $files['name'];
        $chkExt = strtolower(pathinfo($chkName, PATHINFO_EXTENSION));
        if (isset($formatosImg[$chkExt])) $fotosEnLote++;
        elseif (isset($formatosVid[$chkExt])) $videosEnLote++;
    }

    $libreFotos = $maxFotos - ($actualPorTipo['imagen'] + $fotosEnLote);
    $libreVideos = $maxVideos - ($actualPorTipo['video'] + $videosEnLote);

    if ($libreFotos < 0 && $fotosEnLote > 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Límite de $maxFotos fotos alcanzado. Actualiza tu plan para subir más."]);
        exit;
    }
    if ($videosEnLote > 0 && ($maxVideos <= 0 || $libreVideos < 0)) {
        $msg = $maxVideos <= 0 ? 'Tu plan no incluye videos.' : "Límite de $maxVideos videos alcanzado. Actualiza tu plan para subir más.";
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $msg]);
        exit;
    }

    // Formatos permitidos con sus MIME asociados
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
        'webm' => ['video/webm'],
        'mov' => ['video/quicktime'],
    ];

    $MAX_DIM = 4096;
    $MAX_IMG_SIZE = 10 * 1024 * 1024;
    $MAX_VID_SIZE = 50 * 1024 * 1024;

    $fotos = [];
    $duplicados = 0;
    $errores = [];
    $subidasImagenes = 0;
    $subidasVideos = 0;
    $checkHash = $pdo->prepare("SELECT id FROM escort_fotos WHERE escort_id = ? AND hash = ?");

    for ($i = 0; $i < $fileCount; $i++) {
        $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $name = is_array($files['name']) ? $files['name'][$i] : $files['name'];
        $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];

        if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($tmpName)) continue;

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        // Determinar si es imagen o video
        $esImagen = isset($formatosImg[$ext]);
        $esVideo = isset($formatosVid[$ext]);

        if (!$esImagen && !$esVideo) {
            $errores[] = "Formato .$ext no permitido (usar: " . implode(', ', array_keys(array_merge($formatosImg, $formatosVid))) . ")";
            continue;
        }

        $tipo = $esVideo ? 'video' : 'imagen';
        $size = is_array($files['size']) ? $files['size'][$i] : $files['size'];
        $maxSize = $tipo === 'video' ? $MAX_VID_SIZE : $MAX_IMG_SIZE;

        // Respetar límites por tipo (fotos y videos cuentan por separado)
        if ($tipo === 'imagen' && $subidasImagenes >= $maxFotos) {
            $errores[] = "$name: límite de $maxFotos fotos del plan alcanzado";
            continue;
        }
        if ($tipo === 'video') {
            if ($maxVideos <= 0) {
                $errores[] = "$name: tu plan no incluye videos";
                continue;
            }
            if ($subidasVideos >= $maxVideos) {
                $errores[] = "$name: límite de $maxVideos videos del plan alcanzado";
                continue;
            }
        }

        if ($size > $maxSize) {
            $humanSize = $tipo === 'video' ? '50MB' : '10MB';
            $errores[] = "$name supera el límite de $humanSize";
            continue;
        }

        // Validar imagen con getimagesize y MIME real
        if ($tipo === 'imagen') {
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
                $errores[] = "$name excede $MAX_DIM px en alguna dimensión ({$imgInfo[0]}x{$imgInfo[1]})";
                continue;
            }
            // Normalizar extensión jpeg → jpg
            if ($ext === 'jpeg') {
                $ext = 'jpg';
            }
        }

        // Validar video con MIME real
        if ($tipo === 'video') {
            if (!validarMIME($tmpName, array_merge(...array_values($formatosVid)))) {
                $errores[] = "$name no es un video válido o está corrupto";
                continue;
            }
        }

        // Para videos, validar extensión (no podemos inspeccionar el contenido sin FFmpeg)
        // pero al menos rechazamos si no coincide con formato conocido

        $newName = uniqid('foto_') . '.' . $ext;
        $destPath = $uploadDir . $newName;

        if (move_uploaded_file($tmpName, $destPath)) {
            $hash = null;
            if ($tipo === 'imagen') {
                $hash = md5_file($destPath);
                $checkHash->execute([$escortId, $hash]);
                if ($checkHash->fetch()) {
                    unlink($destPath);
                    $duplicados++;
                    continue;
                }
            }

            if ($tipo === 'imagen') $subidasImagenes++;
            if ($tipo === 'video') $subidasVideos++;

            $url = '/uploads/escorts/fotos/' . $escortId . '/' . $newName;

            $nuevoOrden = $totalActual + count($fotos);
            $esPortada = $nuevoOrden == 0 ? 1 : 0;

            $stmt = $pdo->prepare("
                INSERT INTO escort_fotos (escort_id, url, tipo, es_portada, orden, hash)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$escortId, $url, $tipo, $esPortada, $nuevoOrden, $hash]);

            $fotos[] = [
                'id' => $pdo->lastInsertId(),
                'url' => $url,
                'tipo' => $tipo,
                'esPortada' => $esPortada,
                'orden' => 0
            ];
        }
    }

    // Notificar a la escort que actualizó su galería
    if (count($fotos) > 0) {
        $pdo->prepare("
            INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at)
            VALUES (?, 'fotos_actualizadas', 'Galería actualizada', 'Has actualizado tu galería de fotos.', '/micuenta/fotos', NOW())
        ")->execute([$escortId]);

        $escortNombre = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
        $escortNombre->execute([$escortId]);
        $nombreEscort = $escortNombre->fetchColumn();
        $pdo->prepare("
            INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id, created_at)
            VALUES (NULL, 'sistema', 'Galería actualizada', ?, '/admin/escorts', ?, NOW())
        ")->execute(["{$nombreEscort} actualizó su galería de fotos.", $escortId]);

        $pdo->prepare("
            INSERT INTO logs_auditoria (escort_id, accion, tabla_afectada, datos_nuevos, ip_address, user_agent, created_at)
            VALUES (?, 'galeria_actualizada', 'escort_fotos', ?, ?, ?, NOW())
        ")->execute([
            $escortId,
            json_encode(['archivos' => count($fotos)]),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

        require_once __DIR__ . '/../../mail.php';
        notificarAccionEscort('fotos', $escortId, $nombreEscort . ' actualizó su galería', [
            'Archivos subidos' => count($fotos),
        ]);
    }

    $respuesta = ['success' => true, 'fotos' => $fotos, 'duplicados' => $duplicados];
    if (!empty($errores)) {
        $respuesta['errores'] = $errores;
    }
    echo json_encode($respuesta);
} catch (Throwable $e) {
    error_log("Error fotos/upload.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor al procesar el archivo. Verifica el tamaño y formato.'
    ]);
}
