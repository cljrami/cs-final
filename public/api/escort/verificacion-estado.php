<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/verificacion-estado.php
header('Content-Type: application/json');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

try {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

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

    $escortId = $tokenData['id'] ?? 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    require_once __DIR__ . '/../bootstrap.php';

$pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT verificado FROM escorts WHERE id = ?");
    $stmt->execute([$escortId]);
    $verificado = (int)$stmt->fetchColumn();

    if ($verificado === 1) {
        $stmt = $pdo->prepare("
            SELECT 'aprobada' as estado, foto_perfil_real,
                   notas_revision, revisado_en, creado_en
            FROM verificaciones 
            WHERE escort_id = ? AND estado = 'aprobada'
            ORDER BY creado_en DESC LIMIT 1
        ");
        $stmt->execute([$escortId]);
        $verificacion = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($verificacion) {
            $cb = !empty($verificacion['creado_en']) ? '&_=' . strtotime($verificacion['creado_en']) : '';
            if (!empty($verificacion['foto_perfil_real'])) {
                $verificacion['foto_perfil_real'] = '/api/serve-upload.php?path=' . urlencode($verificacion['foto_perfil_real']) . $cb;
            }
        }

        echo json_encode([
            'success' => true,
            'verificacion' => $verificacion ?: ['estado' => 'aprobada']
        ]);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT estado, foto_perfil_real,
               notas_revision, revisado_en, creado_en
        FROM verificaciones 
        WHERE escort_id = ? AND estado IN ('pendiente', 'rechazada')
        ORDER BY creado_en DESC LIMIT 1
    ");
    $stmt->execute([$escortId]);
    $verificacion = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($verificacion) {
        $cb = !empty($verificacion['creado_en']) ? '&_=' . strtotime($verificacion['creado_en']) : '';
        if (!empty($verificacion['foto_perfil_real'])) {
            $verificacion['foto_perfil_real'] = '/api/serve-upload.php?path=' . urlencode($verificacion['foto_perfil_real']) . $cb;
        }
        echo json_encode([
            'success' => true,
            'verificacion' => $verificacion
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'verificacion' => ['estado' => 'no_solicitado']
        ]);
    }
} catch (Throwable $e) {
    error_log("Error verificacion-estado: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
