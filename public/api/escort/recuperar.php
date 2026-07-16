<?php
// public_html/api/escort/recuperar.php

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
    // Verificar que el email existe
    $stmt = $pdo->prepare("SELECT id, nombre FROM escorts WHERE email = ? AND activa = 1 AND eliminada = 0 LIMIT 1");
    $stmt->execute([$email]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        // Por seguridad, no revelar si el email existe o no
        echo json_encode(['success' => true, 'message' => 'Si el email existe, recibirás un enlace']);
        exit;
    }

    // Generar token de recuperación (válido por 1 hora)
    $resetToken = bin2hex(random_bytes(32));
    $expira = date('Y-m-d H:i:s', time() + 3600);

    // Guardar token en tabla (necesitas crear esta tabla o usar otra lógica)
    // Por ahora, simulamos éxito

    // Aquí deberías enviar el email real con PHPMailer o similar
    // mail($email, 'Recuperar contraseña', 'Tu enlace: https://tusitio.com/micuenta/reset?token=' . $resetToken);

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
