<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Email y contraseña requeridos']);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();

    // Rate limit: máx 8 intentos por IP cada 15 minutos
    rateLimitLogin('login_admin', 8, 15, strtolower($email));

    $stmt = $pdo->prepare("SELECT * FROM admins WHERE email = ? AND activo = 1 LIMIT 1");
    $stmt->execute([$email]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$admin) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
        exit;
    }

    if (!password_verify($password, $admin['password_hash'])) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Credenciales incorrectas']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE admins SET ultimo_login = NOW() WHERE id = ?");
    $stmt->execute([$admin['id']]);

    rateLimitReset('login_admin', strtolower($email));

    $token = signToken([
        'id' => (int)$admin['id'],
        'email' => $admin['email'],
        'nombre' => $admin['nombre'],
        'rol' => $admin['rol'],
        'exp' => time() + (24 * 60 * 60),
        'rand' => bin2hex(random_bytes(16))
    ]);

    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'token' => $token,
        'admin' => [
            'id' => $admin['id'],
            'nombre' => $admin['nombre'],
            'email' => $admin['email'],
            'rol' => $admin['rol']
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
