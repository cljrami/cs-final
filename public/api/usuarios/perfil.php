<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    $usuarioId = intval($tokenData['id'] ?? 0);
    if ($usuarioId <= 0) { http_response_code(401); echo json_encode(['success' => false, 'error' => 'No autorizado']); exit; }

    // Solo tokens de tipo 'usuario'. Sin esto, un token de escort/admin con el
    // mismo id numérico podía modificar (o cambiar la contraseña de) una cuenta.
    $tokenTipo = (string)($tokenData['tipo'] ?? '');
    if ($tokenTipo !== '' && $tokenTipo !== 'usuario') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Acceso denegado: token de otro tipo']);
        exit;
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT id, nombre, email, telefono, ciudad, created_at FROM usuarios WHERE id = ?");
        $stmt->execute([$usuarioId]);
        $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$usuario) { http_response_code(404); echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']); exit; }

        echo json_encode([
            'success' => true,
            'usuario' => [
                'id' => (int)$usuario['id'],
                'nombre' => $usuario['nombre'],
                'email' => $usuario['email'],
                'telefono' => $usuario['telefono'],
                'ciudad' => $usuario['ciudad'],
                'created_at' => $usuario['created_at'],
            ]
        ]);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $nombre = trim($input['nombre'] ?? '');
        $email = trim($input['email'] ?? '');
        $telefono = trim($input['telefono'] ?? '');
        $ciudad = trim($input['ciudad'] ?? '');
        $password = $input['password'] ?? '';
        $passwordConfirm = $input['password_confirm'] ?? '';
        $passwordActual = $input['password_actual'] ?? '';

        $errors = [];
        if (strlen($nombre) < 2) $errors['nombre'] = 'Nombre muy corto';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Email inválido';

        if (!empty($password)) {
            if (strlen($password) < 8) $errors['password'] = 'Mínimo 8 caracteres';
            if ($password !== $passwordConfirm) $errors['password_confirm'] = 'Las contraseñas no coinciden';
            // Para cambiar la contraseña hay que demostrar la actual: si no,
            // basta con robar el token para tomar el control de la cuenta.
            if (trim((string)$passwordActual) === '') {
                $errors['password_actual'] = 'Ingresa tu contraseña actual';
            }
        }

        if (!empty($errors)) { http_response_code(422); echo json_encode(['success' => false, 'fieldErrors' => $errors]); exit; }

        $check = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? AND id != ?");
        $check->execute([$email, $usuarioId]);
        if ($check->fetch()) { http_response_code(409); echo json_encode(['success' => false, 'fieldErrors' => ['email' => 'Email ya registrado']]); exit; }

        $nuevoToken = null;

        if (!empty($password)) {
            // Verificar la contraseña actual
            $stmtHash = $pdo->prepare("SELECT password_hash FROM usuarios WHERE id = ?");
            $stmtHash->execute([$usuarioId]);
            $filaHash = $stmtHash->fetch(PDO::FETCH_ASSOC);
            $hashActual = (string)($filaHash['password_hash'] ?? '');
            if ($hashActual === '' || !password_verify((string)$passwordActual, $hashActual)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'La contraseña actual no es correcta', 'fieldErrors' => ['password_actual' => 'La contraseña actual no es correcta']]);
                exit;
            }

            $hash = password_hash($password, PASSWORD_BCRYPT);
            // Al cambiar la contraseña se revocan las demás sesiones (token_version)
            $stmt = $pdo->prepare("UPDATE usuarios SET nombre = ?, email = ?, telefono = ?, ciudad = ?, password_hash = ?, token_version = token_version + 1, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$nombre, $email, $telefono, $ciudad, $hash, $usuarioId]);

            // Se emite un token nuevo para que esta sesión siga activa
            $stmtTv = $pdo->prepare("SELECT token_version FROM usuarios WHERE id = ?");
            $stmtTv->execute([$usuarioId]);
            $tv = (int)($stmtTv->fetchColumn() ?? 0);
            $nuevoToken = signToken([
                'id' => $usuarioId,
                'tipo' => 'usuario',
                'email' => $email,
                'tv' => $tv,
                'exp' => time() + (30 * 24 * 3600),
                'rand' => bin2hex(random_bytes(16)),
            ]);

            require_once __DIR__ . '/../mail.php';
            sendPasswordChanged($email, $nombre);
        } else {
            $stmt = $pdo->prepare("UPDATE usuarios SET nombre = ?, email = ?, telefono = ?, ciudad = ? WHERE id = ?");
            $stmt->execute([$nombre, $email, $telefono, $ciudad, $usuarioId]);
        }

        $respuesta = [
            'success' => true,
            'usuario' => [
                'id' => $usuarioId,
                'nombre' => $nombre,
                'email' => $email,
            ]
        ];
        if ($nuevoToken) $respuesta['nuevo_token'] = $nuevoToken;

        echo json_encode($respuesta);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error usuarios/perfil.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
