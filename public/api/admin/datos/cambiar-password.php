<?php
// POST: cambiar contraseíƒÂ±a del admin autenticado

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    require_once __DIR__ . '/../../bootstrap.php';

    $tokenData = requireAuth();


    requireAdminRole($tokenData);
    $adminId = intval($tokenData['id'] ?? 0);
    if ($adminId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token invíƒÂ¡lido']);
        exit;
    }

    $pdo = getDBConnection();
    $input = json_decode(file_get_contents('php://input'), true);

    $actual = $input['actual'] ?? '';
    $nueva = $input['nueva'] ?? '';

    $errors = [];

    if (strlen($nueva) < 8) {
        $errors['passNueva'] = 'MíƒÂ­nimo 8 caracteres';
    }

    // Verificar contraseíƒÂ±a actual
    $stmt = $pdo->prepare("SELECT password_hash FROM admins WHERE id = ?");
    $stmt->execute([$adminId]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$admin || !password_verify($actual, $admin['password_hash'])) {
        $errors['passActual'] = 'ContraseíƒÂ±a actual incorrecta';
    }

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $errors]);
        exit;
    }

    $hashed = password_hash($nueva, PASSWORD_BCRYPT);
    $update = $pdo->prepare("UPDATE admins SET password_hash = ? WHERE id = ?");
    $update->execute([$hashed, $adminId]);

    echo json_encode(['success' => true, 'message' => 'ContraseíƒÂ±a cambiada']);
} catch (Throwable $e) {
    error_log("Error admin/datos/cambiar-password.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

