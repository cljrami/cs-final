<?php
// public_html/api/escort/datos/eliminar-cuenta.php

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../../bootstrap.php';

    $pdo = getDBConnection();
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

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

    $input = json_decode(file_get_contents('php://input'), true);
    $escortId = $tokenData['id'];
    $password = $input['password'] ?? '';

    if ($password === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Debes confirmar tu contrasena']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT password_hash FROM escorts WHERE id = ?");
    $stmt->execute([$escortId]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort || !password_verify($password, $escort['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Contrasena incorrecta']);
        exit;
    }

    function eliminarDirectorioRecursivo(string $ruta): void {
        if (!is_dir($ruta)) return;
        $items = scandir($ruta);
        if ($items === false) return;
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $rutaItem = $ruta . DIRECTORY_SEPARATOR . $item;
            if (is_dir($rutaItem)) {
                eliminarDirectorioRecursivo($rutaItem);
            } else {
                @unlink($rutaItem);
            }
        }
        @rmdir($ruta);
    }

    $pdo->beginTransaction();

    // Eliminar datos relacionados sin cascade para no dejar huérfanos
    $pdo->prepare("DELETE FROM reportes WHERE escort_id = ?")->execute([$escortId]);
    $pdo->prepare("DELETE FROM planes_usados WHERE escort_id = ?")->execute([$escortId]);
    $pdo->prepare("DELETE FROM historial_pausas WHERE escort_id = ?")->execute([$escortId]);
    $pdo->prepare("DELETE FROM suscripciones_historial WHERE escort_id = ?")->execute([$escortId]);
    $pdo->prepare("DELETE FROM estadisticas_diarias WHERE escort_id = ?")->execute([$escortId]);
    $pdo->prepare("DELETE FROM sticky_posiciones WHERE escort_id = ?")->execute([$escortId]);

    // Borrado definitivo: el DELETE de escorts activa cascade en tablas vinculadas
    $pdo->prepare("DELETE FROM escorts WHERE id = ?")->execute([$escortId]);

    $pdo->commit();

    // Borrar archivos del servidor fuera de la transacción
    $uploadBase = __DIR__ . '/../../../uploads';
    $carpetas = [
        $uploadBase . '/escorts/fotos/' . $escortId,
        $uploadBase . '/escorts/historias/' . $escortId,
        $uploadBase . '/comprobantes/' . $escortId,
        $uploadBase . '/verificaciones/' . $escortId,
    ];
    foreach ($carpetas as $carpeta) {
        eliminarDirectorioRecursivo($carpeta);
    }

    require_once __DIR__ . '/../../mail.php';
    notificarAccionEscort('cuentas', $escortId, 'Escort eliminó su cuenta');

    echo json_encode(['success' => true, 'message' => 'Cuenta y todos sus datos eliminados']);
} catch (Throwable $e) {
    error_log("Error datos/eliminar-cuenta.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
