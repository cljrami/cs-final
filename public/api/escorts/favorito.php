<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
    echo json_encode(['success' => false, 'error' => 'ID requerido']);
    exit;
}

try {
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    // Intentar obtener usuario autenticado (opcional)
    $usuarioId = null;
    $token = getBearerToken();
    if ($token) {
        $payload = verifyToken($token);
        if ($payload && isset($payload['id']) && $payload['tipo'] === 'usuario') {
            $usuarioId = (int)$payload['id'];
        }
    }

    if ($method === 'GET') {
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM favoritos WHERE escort_id = ?");
        $countStmt->execute([$id]);
        $likes = (int)$countStmt->fetchColumn();

        $favorito = false;
        if ($usuarioId) {
            $checkStmt = $pdo->prepare("SELECT 1 FROM favoritos WHERE usuario_id = ? AND escort_id = ?");
            $checkStmt->execute([$usuarioId, $id]);
            $favorito = (bool)$checkStmt->fetchColumn();
        }

        echo json_encode(['success' => true, 'likes' => $likes, 'favorito' => $favorito]);
        exit;
    }

    if ($method === 'POST') {
        if (!$usuarioId) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Debes iniciar sesión']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT IGNORE INTO favoritos (usuario_id, escort_id) VALUES (?, ?)");
        $stmt->execute([$usuarioId, $id]);

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM favoritos WHERE escort_id = ?");
        $countStmt->execute([$id]);
        $likes = (int)$countStmt->fetchColumn();

        require_once __DIR__ . '/../mail.php';
        $escortStmt = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
        $escortStmt->execute([$id]);
        $nombreEscort = $escortStmt->fetchColumn() ?: 'Escort';
        notificarAccionUsuario('favoritos', $usuarioId, 'Agregó a ' . $nombreEscort . ' a sus favoritos', [
            'Escort' => $nombreEscort . ' (ID ' . $id . ')',
        ]);

        echo json_encode(['success' => true, 'likes' => $likes, 'favorito' => true]);
        exit;
    }

    if ($method === 'DELETE') {
        if (!$usuarioId) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Debes iniciar sesión']);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM favoritos WHERE usuario_id = ? AND escort_id = ?");
        $stmt->execute([$usuarioId, $id]);

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM favoritos WHERE escort_id = ?");
        $countStmt->execute([$id]);
        $likes = (int)$countStmt->fetchColumn();

        require_once __DIR__ . '/../mail.php';
        $escortStmt = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
        $escortStmt->execute([$id]);
        $nombreEscort = $escortStmt->fetchColumn() ?: 'Escort';
        notificarAccionUsuario('favoritos', $usuarioId, 'Quitó de favoritos a ' . $nombreEscort, [
            'Escort' => $nombreEscort . ' (ID ' . $id . ')',
        ]);

        echo json_encode(['success' => true, 'likes' => $likes, 'favorito' => false]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error favorito.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

