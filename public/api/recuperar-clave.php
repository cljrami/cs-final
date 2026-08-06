<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/bootstrap.php';

$pdo = getDBConnection();

// GET: validar token
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = trim($_GET['token'] ?? '');
    $tipo = trim($_GET['tipo'] ?? '');

    if (empty($token) || !in_array($tipo, ['usuario', 'escort'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Parámetros inválidos']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT id, email, expira_en FROM password_resets WHERE token = ? AND tipo = ? AND usado = 0 AND expira_en > NOW() LIMIT 1");
        $stmt->execute([$token, $tipo]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Token inválido o expirado']);
            exit;
        }

        echo json_encode(['success' => true, 'email' => $row['email'], 'tipo' => $tipo]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
    }
    exit;
}

// POST: cambiar contraseña con token
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = trim($input['token'] ?? '');
    $tipo = trim($input['tipo'] ?? '');
    $password = $input['password'] ?? '';
    $passwordConfirm = $input['password_confirm'] ?? '';

    $errors = [];
    if (empty($token) || !in_array($tipo, ['usuario', 'escort'], true)) {
        $errors['general'] = 'Parámetros inválidos';
    }
    if (strlen($password) < 8) {
        $errors['password'] = 'Mínimo 8 caracteres';
    }
    if ($password !== $passwordConfirm) {
        $errors['password_confirm'] = 'Las contraseñas no coinciden';
    }
    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $errors]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT id, email, expira_en FROM password_resets WHERE token = ? AND tipo = ? AND usado = 0 AND expira_en > NOW() LIMIT 1");
        $stmt->execute([$token, $tipo]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Token inválido o expirado']);
            exit;
        }

        $hashed = password_hash($password, PASSWORD_BCRYPT);

        if ($tipo === 'escort') {
            $update = $pdo->prepare("UPDATE escorts SET password_hash = ? WHERE email = ?");
            $update->execute([$hashed, $row['email']]);
        } else {
            $update = $pdo->prepare("UPDATE usuarios SET password_hash = ? WHERE email = ?");
            $update->execute([$hashed, $row['email']]);
        }

        $mark = $pdo->prepare("UPDATE password_resets SET usado = 1 WHERE id = ?");
        $mark->execute([$row['id']]);

        echo json_encode(['success' => true, 'message' => 'Contraseña actualizada correctamente']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido']);
