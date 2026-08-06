<?php
// public/api/og_util.php
// Regenera current-og.jpg desde la fuente efectiva (og_imagen || schema_imagen)
// y parchea index.html (servido) para que og:image use la URL con su versión actual,
// de modo que cambiar la imagen en el admin se refleja SIN re-compilar el sitio.

function refrescarOgActual($pdo): bool {
    $stmt = $pdo->prepare("SELECT clave, valor FROM configuracion WHERE clave IN ('og_imagen','schema_imagen')");
    $stmt->execute();
    $row = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $v = trim((string) ($row['og_imagen'] ?? ''));
    if ($v === '') $v = trim((string) ($row['schema_imagen'] ?? ''));
    if ($v === '' || preg_match('~^https?://~i', $v)) return false;

    $src = realpath(__DIR__ . '/../' . ltrim($v, '/'));
    if (!$src || !is_file($src)) return false;

    $dirOg = __DIR__ . '/../uploads/og/';
    if (!is_dir($dirOg)) @mkdir($dirOg, 0755, true);
    $dest = $dirOg . 'current-og.jpg';

    if (function_exists('imagecreatefromstring')) {
        $img = @imagecreatefromstring(@file_get_contents($src));
        if ($img !== false) {
            @imagejpeg($img, $dest, 90);
            @imagedestroy($img);
        } else {
            @copy($src, $dest);
        }
    } else {
        @copy($src, $dest);
    }

    if (!is_file($dest)) return false;

    $ver = substr(md5_file($dest), 0, 8);
    $dims = @getimagesize($dest);
    $w = $dims ? (int) $dims[0] : null;
    $h = $dims ? (int) $dims[1] : null;

    $idx = __DIR__ . '/../index.html';
    if (!is_file($idx) || !is_writable($idx)) return true;

    $html = @file_get_contents($idx);
    if ($html === false) return true;

    if ($w && $h) {
        $html = preg_replace('~(<meta property="og:image:width" content=")\d+(")~', '${1}' . $w . '$2', $html);
        $html = preg_replace('~(<meta property="og:image:height" content=")\d+(")~', '${1}' . $h . '$2', $html);
    }
    $html = preg_replace('~(https?://[^"]*?/uploads/og/current-og\.jpg)(\?v=[^"]*)?~', '$1?v=' . $ver, $html);
    @file_put_contents($idx, $html);
    return true;
}