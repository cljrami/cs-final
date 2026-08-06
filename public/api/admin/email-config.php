<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT clave, valor FROM configuracion WHERE clave IN ('email_from', 'email_from_name')");
        $config = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $config[$row['clave']] = $row['valor'];
        }
        echo json_encode(['success' => true, 'config' => $config]);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $allowedKeys = ['email_from', 'email_from_name'];
        $updates = [];

        foreach ($allowedKeys as $key) {
            if (isset($input[$key])) {
                $stmt = $pdo->prepare("SELECT id FROM configuracion WHERE clave = ?");
                $stmt->execute([$key]);
                if ($stmt->fetch()) {
                    $stmt = $pdo->prepare("UPDATE configuracion SET valor = ? WHERE clave = ?");
                    $stmt->execute([trim((string)$input[$key]), $key]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO configuracion (clave, valor, tipo) VALUES (?, ?, 'string')");
                    $stmt->execute([$key, trim((string)$input[$key])]);
                }
                $updates[] = $key;
            }
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No hay datos para actualizar']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'ConfiguraciíƒÂ³n actualizada']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);
} catch (PDOException $e) {
    error_log("Error email-config.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error email-config.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

