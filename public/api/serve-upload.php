<?php
$requestPath = parse_url($_GET['path'] ?? '', PHP_URL_PATH);
$decodedPath = urldecode((string)$requestPath);

// Validar ruta: debe estar bajo /uploads/ y no contener secuencias de salida (..)
// Se comprueba tanto la ruta cruda como la decodificada (%2e%2e => ..)
if ($requestPath === false || $decodedPath === ''
    || stripos($decodedPath, '/uploads/') !== 0
    || strpos($decodedPath, '..') !== false
    || strpos($requestPath, '..') !== false) {
    http_response_code(400);
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['error' => 'Ruta inválida']);
    exit;
}

// New location: documents root /public_html/ or /public/
$newBase = __DIR__ . '/..';
$newFile = $newBase . $requestPath;

// Old location: one level above documents root
$oldBase = __DIR__ . '/../..';
$oldFile = $oldBase . $requestPath;

$foundFile = null;
if (file_exists($newFile) && is_file($newFile)) {
    $foundFile = $newFile;
} elseif (file_exists($oldFile) && is_file($oldFile)) {
    $foundFile = $oldFile;
}

if (!$foundFile) {
    http_response_code(404);
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['error' => 'Archivo no encontrado']);
    exit;
}

// Canonicalizar y verificar que el archivo resuelto esté realmente bajo /uploads/
$realFile = realpath($foundFile);
$realNorm = str_replace('\\', '/', (string)$realFile);
$inUploads = $realFile !== false && stripos($realNorm, '/uploads/') !== false;
if (!$inUploads) {
    http_response_code(403);
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['error' => 'Acceso denegado']);
    exit;
}

$ext = strtolower(pathinfo($foundFile, PATHINFO_EXTENSION));
$mimeMap = [
    'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
    'gif' => 'image/gif', 'webp' => 'image/webp', 'avif' => 'image/avif',
    'bmp' => 'image/bmp', 'pdf' => 'application/pdf',
    'mp4' => 'video/mp4', 'mov' => 'video/quicktime', 'webm' => 'video/webm',
];
$mime = $mimeMap[$ext] ?? 'application/octet-stream';

// ---------------------------------------------------------------------------
// Optimización de imágenes: redirige/redimensiona según parámetros ?w &q &fm
// ---------------------------------------------------------------------------
$reqW = isset($_GET['w']) ? max(1, (int)$_GET['w']) : 0;
$reqQ = isset($_GET['q']) ? max(30, min(85, (int)$_GET['q'])) : 70;
$reqFm = strtolower($_GET['fm'] ?? '');

$isRaster = in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true) && $reqW > 0;

if ($isRaster && function_exists('imagecreatefromjpeg') && function_exists('imagewebp')) {
    // Dimensiones originales
    $info = @getimagesize($foundFile);
    if (is_array($info) && ($info[0] ?? 0) > 0 && ($info[1] ?? 0) > 0) {
        $origW = (int)$info[0];
        $origH = (int)$info[1];
        $w = min($reqW, $origW);

        // Evitar agrandar si el ancho pedido supera el original
        if ($origW > 0 && $w > 0 && $origW > $w) {
            $h = max(1, (int)round($origH * ($w / $origW)));

            // Directorio de caché bajo /uploads/cache-resized
            $uploadRoot = __DIR__ . '/../uploads';
            $cacheDir = $uploadRoot . '/cache-resized';
            if (!is_dir($cacheDir)) { @mkdir($cacheDir, 0755, true); }

            $cacheKey = md5($foundFile . '|' . $w . '|' . $reqQ . '|' . $reqFm . '|' . (filemtime($foundFile) ?: 0));
            $cachePath = $cacheDir . '/' . $cacheKey . '.webp';

            $serveOut = $cachePath;
            if (!file_exists($cachePath) || filesize($cachePath) === 0) {
                @set_time_limit(60);
                try {
                    $src = null;
                    switch ($ext) {
                        case 'jpg':
                        case 'jpeg': $src = @imagecreatefromjpeg($foundFile); break;
                        case 'png':  $src = @imagecreatefrompng($foundFile);  break;
                        case 'webp': $src = @imagecreatefromwebp($foundFile);  break;
                    }
                    if ($src !== false) {
                        $dst = @imagecreatetruecolor($w, $h);
                        if ($dst !== false) {
                            // Fondo transparente para PNG
                            imagealphablending($dst, false);
                            $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
                            imagefill($dst, 0, 0, $transparent);
                            imagesavealpha($dst, true);

                            @imagecopyresampled($dst, $src, 0, 0, 0, 0, $w, $h, $origW, $origH);
                            // Forzar a WebP (mejor compresión) al menos q= reqQ-10 para mantener calidad
                            $webpQ = max(50, $reqQ);
                            $ok = @imagewebp($dst, $cachePath, $webpQ);
                            @imagedestroy($src);
                            @imagedestroy($dst);
                            if (!$ok && file_exists($cachePath)) { @unlink($cachePath); }
                        } else {
                            @imagedestroy($src);
                        }
                    }
                } catch (\Throwable $e) {
                    // fallback: sigue con el original
                    if (file_exists($cachePath)) { @unlink($cachePath); }
                    $serveOut = null;
                }
            }

            if (is_string($serveOut) && file_exists($serveOut) && is_file($serveOut) && filesize($serveOut) > 0) {
                header('Content-Type: image/webp');
                header('X-Content-Type-Options: nosniff');
                header('Content-Length: ' . filesize($serveOut));
                header('Cache-Control: public, max-age=31536000, immutable');
                readfile($serveOut);
                exit;
            }
        }
    }
}

// Cualquier otra cosa (no imagen, sin `w`, o fallback de redimensionado fallido):
// sirve el archivo original completo con caché razonable
header('Content-Type: ' . $mime);
header('X-Content-Type-Options: nosniff');
header('Content-Length: ' . filesize($foundFile));
header('Cache-Control: public, max-age=604800');
readfile($foundFile);
