<?php
// public_html/api/escort/fotos/eliminar.php

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

    $fotoId = (int)($_GET['id'] ?? 0);
    $escortId = $tokenData['id'];

    if ($fotoId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID inválido']);
        exit;
    }

    $check = $pdo->prepare("SELECT url, es_portada FROM escort_fotos WHERE id = ? AND escort_id = ?");
    $check->execute([$fotoId, $escortId]);
    $foto = $check->fetch(PDO::FETCH_ASSOC);

    if (!$foto) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Foto no encontrada']);
        exit;
    }

    // Eliminar archivo físico
    $filePath = __DIR__ . '/../../../' . ltrim($foto['url'], '/');
    if (file_exists($filePath)) unlink($filePath);

    // Eliminar de BD
    $pdo->prepare("DELETE FROM escort_fotos WHERE id = ? AND escort_id = ?")->execute([$fotoId, $escortId]);

    // Si era portada, poner la primera como portada y sincronizar foto_principal
    if ($foto['es_portada']) {
        $pdo->prepare("
            UPDATE escort_fotos SET es_portada = 1 
            WHERE escort_id = ? 
            ORDER BY orden ASC, id ASC 
            LIMIT 1
        ")->execute([$escortId]);

        // Sincronizar foto_principal con la nueva portada
        $nueva = $pdo->prepare("SELECT url FROM escort_fotos WHERE escort_id = ? AND es_portada = 1 LIMIT 1");
        $nueva->execute([$escortId]);
        $nuevaUrl = $nueva->fetchColumn();
        if ($nuevaUrl) {
            $pdo->prepare("UPDATE escorts SET foto_principal = ? WHERE id = ?")->execute([$nuevaUrl, $escortId]);
            // Notificar cambio de portada
            $nombreStmt = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
            $nombreStmt->execute([$escortId]);
            $nombreEscort = $nombreStmt->fetchColumn();
            $pdo->prepare("INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) VALUES (?, 'fotos_actualizadas', 'Foto de portada cambiada', 'Tu foto de portada ha sido actualizada automáticamente.', '/micuenta/fotos', NOW())")
                ->execute([$escortId]);
            $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id, created_at) VALUES (NULL, 'sistema', 'Foto de portada cambiada', ?, '/admin/escorts', ?, NOW())")
                ->execute(["{$nombreEscort} cambió su foto de portada (al eliminar la anterior).", $escortId]);
        } else {
            // No quedan fotos
            $pdo->prepare("UPDATE escorts SET foto_principal = NULL WHERE id = ?")->execute([$escortId]);
        }
    }

    require_once __DIR__ . '/../../mail.php';
    $nombreEscort = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
    $nombreEscort->execute([$escortId]);
    notificarAccionEscort('fotos', $escortId, $nombreEscort->fetchColumn() . ' eliminó una foto de su galería', [
        'Foto eliminada' => $foto['url'] ?: '—',
        'Era portada' => $foto['es_portada'] ? 'Sí' : 'No',
    ]);

    $pdo->prepare("INSERT INTO logs_auditoria (escort_id, accion, tabla_afectada, datos_nuevos, ip_address, user_agent, created_at) VALUES (?, 'fotos_eliminar', 'escort_fotos', ?, ?, ?, NOW())")
        ->execute([
            $escortId,
            json_encode(['foto_id' => $fotoId, 'era_portada' => (int)$foto['es_portada']]),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

    echo json_encode(['success' => true, 'message' => 'Foto eliminada']);
} catch (Throwable $e) {
    error_log("Error fotos/eliminar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
