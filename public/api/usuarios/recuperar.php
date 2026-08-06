<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$email = trim($data['email'] ?? '');

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email válido requerido']);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

$pdo = getDBConnection();
try {
    $stmt = $pdo->prepare("SELECT id, nombre FROM usuarios WHERE email = ? AND activo = 1 LIMIT 1");
    $stmt->execute([$email]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario) {
        echo json_encode(['success' => true, 'message' => 'Si el email existe, recibirás un enlace']);
        exit;
    }

    $resetToken = bin2hex(random_bytes(32));
    $expira = date('Y-m-d H:i:s', time() + 3600);

    $clean = $pdo->prepare("DELETE FROM password_resets WHERE email = ? AND tipo = 'usuario'");
    $clean->execute([$email]);

    $insert = $pdo->prepare("INSERT INTO password_resets (email, token, tipo, expira_en) VALUES (?, ?, 'usuario', ?)");
    $insert->execute([$email, $resetToken, $expira]);

    require_once __DIR__ . '/../mail.php';
    sendRecovery($email, $resetToken, 'usuario');

    echo json_encode([
        'success' => true,
        'message' => 'Se ha enviado un enlace de recuperación a tu email'
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno']);
}
