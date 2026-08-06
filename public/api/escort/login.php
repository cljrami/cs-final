<?php
// public_html/api/escort/login.php

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();

    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'JSON invalido']);
        exit;
    }

    $usuario = trim($input['usuario'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($usuario) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Usuario y contrasena requeridos']);
        exit;
    }

    // Rate limit: máx 10 intentos por IP cada 15 minutos
    rateLimitLogin('login_escort', 10, 15, strtolower($usuario));

    $stmt = $pdo->prepare("SELECT id, usuario, email, password_hash, nombre, primer_login, activa, eliminada, verificado, vip FROM escorts WHERE usuario = ? OR email = ?");
    $stmt->execute([$usuario, $usuario]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']);
        exit;
    }

    if (!password_verify($password, $escort['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Contrasena incorrecta']);
        exit;
    }

    if ((int)$escort['eliminada'] === 1) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Cuenta eliminada']);
        exit;
    }

    rateLimitReset('login_escort', strtolower($usuario));

    $tokenData = [
        'id' => $escort['id'],
        'usuario' => $escort['usuario'],
        'tipo' => 'escort',
        'primer_login' => (int)$escort['primer_login'],
        'exp' => time() + (7 * 24 * 60 * 60)
    ];
    $token = signToken($tokenData);

    echo json_encode([
        'success' => true,
        'token' => $token,
        'primerLogin' => (int)$escort['primer_login'],
        'escort' => [
            'id' => $escort['id'],
            'usuario' => $escort['usuario'],
            'nombre' => $escort['nombre'],
            'verificado' => (int)$escort['verificado'],
            'vip' => (int)$escort['vip']
        ]
    ]);
} catch (Throwable $e) {
    error_log("Error escort/login.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
