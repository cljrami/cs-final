<?php

/**
 * Normaliza el valor almacenado de un comprobante de pago.
 * Devuelve una ruta relativa canonica: uploads/comprobantes/{carpeta}/{archivo}
 * o null si el valor no corresponde a un comprobante valido.
 */
function comprobante_path(?string $raw): ?string
{
    if ($raw === null) {
        return null;
    }

    $raw = trim($raw);
    if ($raw === '' || preg_match('/^(pendiente|sin_comprobante|none|null|sistema_reparacion)$/i', $raw)) {
        return null;
    }

    if (stripos($raw, 'serve-upload.php') !== false) {
        $query = parse_url($raw, PHP_URL_QUERY);
        if (is_string($query)) {
            parse_str($query, $params);
            if (!empty($params['path'])) {
                $raw = (string)$params['path'];
            }
        }
    }

    $parsedPath = parse_url($raw, PHP_URL_PATH);
    if (is_string($parsedPath) && $parsedPath !== '') {
        $raw = $parsedPath;
    }

    $path = str_replace('\\', '/', $raw);
    $path = preg_replace('#/+#', '/', $path);
    $path = ltrim($path, '/');

    while (str_starts_with($path, 'uploads/comprobantes/uploads/comprobantes/')) {
        $path = substr($path, strlen('uploads/comprobantes/'));
    }

    if (str_starts_with($path, 'uploads/comprobantes/')) {
        // Formato canonico.
    } elseif (str_starts_with($path, 'comprobantes/')) {
        $path = 'uploads/' . $path;
    } else {
        $path = 'uploads/comprobantes/' . $path;
    }

    if (strpos($path, '..') !== false) {
        return null;
    }

    if (!preg_match('#^uploads/comprobantes/[A-Za-z0-9_-]+/[^/]+\.[A-Za-z0-9]+$#', $path)) {
        return null;
    }

    return $path;
}

/**
 * Devuelve la URL proxificada de un comprobante para usar en <img>/<a>.
 * El token de serve-upload.php lo agrega el frontend.
 */
function comprobante_url(?string $raw): ?string
{
    $path = comprobante_path($raw);
    return $path ? '/api/serve-upload.php?path=/' . $path : null;
}

/**
 * Normaliza la ruta de una selfie de verificacion y valida que pertenezca
 * a la carpeta de la escort indicada.
 * Devuelve uploads/verificaciones/{escortId}/{archivo} o null.
 */
function verificacion_foto_path(?string $raw, int $escortId): ?string
{
    if ($raw === null || $escortId <= 0) {
        return null;
    }

    $raw = trim($raw);
    if ($raw === '') {
        return null;
    }

    if (stripos($raw, 'serve-upload.php') !== false) {
        $query = parse_url($raw, PHP_URL_QUERY);
        if (is_string($query)) {
            parse_str($query, $params);
            if (!empty($params['path'])) {
                $raw = (string)$params['path'];
            }
        }
    }

    $parsedPath = parse_url($raw, PHP_URL_PATH);
    if (is_string($parsedPath) && $parsedPath !== '') {
        $raw = $parsedPath;
    }

    $path = str_replace('\\', '/', $raw);
    $path = preg_replace('#/+#', '/', $path);
    $path = ltrim($path, '/');

    if (strpos($path, '..') !== false) {
        return null;
    }

    $prefix = 'uploads/verificaciones/' . $escortId . '/';
    if (!str_starts_with($path, $prefix)) {
        return null;
    }

    $filename = substr($path, strlen($prefix));
    if (!preg_match('/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|gif)$/i', $filename)) {
        return null;
    }

    return $path;
}
