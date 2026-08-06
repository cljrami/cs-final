<?php
// public_html/api/escort/perfil-update.php

header('Content-Type: application/json');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido o expirado']);
        exit;
    }

    $escortId = (int) $tokenData['id'];
    $input = json_decode(file_get_contents('php://input'), true);

    // Validaciones
    $errores = [];

    if (empty($input['nombre']) || strlen(trim($input['nombre'])) < 2) {
        $errores[] = 'El nombre artístico debe tener al menos 2 caracteres';
    }

    if (empty($input['email']) || !filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
        $errores[] = 'El email no es válido';
    }

    $edad = !empty($input['edad']) ? (int)$input['edad'] : null;
    if ($edad === null || $edad < 18) {
        $errores[] = 'La edad debe ser mayor o igual a 18 años';
    }

    if (empty($input['ciudad'])) {
        $errores[] = 'Debes seleccionar una ciudad';
    }

    if (!empty($errores)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => implode(' | ', $errores)]);
        exit;
    }

    // Verificar que la ciudad existe
    $checkCiudad = $pdo->prepare("SELECT nombre FROM ciudades WHERE nombre = ? AND activa = 1");
    $checkCiudad->execute([$input['ciudad']]);
    $ciudadData = $checkCiudad->fetch(PDO::FETCH_ASSOC);

    // Verificar email único (excepto el propio)
    $checkEmail = $pdo->prepare("SELECT id FROM escorts WHERE email = ? AND id != ?");
    $checkEmail->execute([$input['email'], $escortId]);
    if ($checkEmail->fetch()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Este email ya está en uso']);
        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE escorts SET
            nombre = ?,
            email = ?,
            edad = ?,
            altura = ?,
            peso = ?,
            medidas = ?,
            ciudad = ?,
            nacionalidad = ?,
            telefono = ?,
            whatsapp = ?,
            direccion = ?,
            idiomas = ?,
            orientacion = ?,
            etnia = ?,
            color_ojos = ?,
            color_pelo = ?,
            estilo = ?,
            descripcion_corta = ?,
            descripcion_larga = ?,
            primer_login = 0,
            updated_at = NOW()
        WHERE id = ?
    ");

    $stmt->execute([
        trim($input['nombre']),
        trim($input['email']),
        $edad,
        !empty($input['altura']) ? (int)$input['altura'] : null,
        !empty($input['peso']) ? (int)$input['peso'] : null,
        $input['medidas'] ?? null,
        $input['ciudad'],
        $input['nacionalidad'] ?? null,
        $input['telefono'] ?? null,
        $input['whatsapp'] ?? null,
        $input['direccion'] ?? null,
        $input['idiomas'] ?? null,
        $input['orientacion'] ?? null,
        $input['etnia'] ?? null,
        $input['color_ojos'] ?? null,
        $input['color_pelo'] ?? null,
        $input['estilo'] ?? null,
        $input['descripcion_corta'] ?? null,
        $input['descripcion_larga'] ?? null,
        $escortId
    ]);

    echo json_encode(['success' => true, 'message' => 'Perfil actualizado']);
} catch (Throwable $e) {
    error_log("Error perfil-update.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
