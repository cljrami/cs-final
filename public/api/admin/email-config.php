<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../mail.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';

        if ($action === 'prueba') {
            $to = trim((string)($input['to'] ?? ''));
            if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Correo destino inválido']);
                exit;
            }

            $from = MAIL_FROM;
            $fromName = MAIL_FROM_NAME;
            $stmt = $pdo->prepare("SELECT clave, valor FROM configuracion WHERE clave IN ('email_from', 'email_from_name')");
            $stmt->execute();
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if ($row['clave'] === 'email_from' && !empty($row['valor'])) $from = $row['valor'];
                if ($row['clave'] === 'email_from_name' && !empty($row['valor'])) $fromName = $row['valor'];
            }

            $body = mailHeader('Correo de prueba - Kimi');
            $body .= '<p>Hola,</p>';
            $body .= '<p>Este es un correo de prueba para verificar que el envío de emails del sitio funciona correctamente.</p>';
            $body .= '<p>Si recibes este mensaje, el sistema de correo está operativo.</p>';
            $body .= '<p><strong>Remitente configurado:</strong> ' . htmlspecialchars($fromName, ENT_QUOTES, 'UTF-8') . ' &lt;' . htmlspecialchars($from, ENT_QUOTES, 'UTF-8') . '&gt;</p>';
            $body .= '<p class="warning">Enviado el ' . date('d/m/Y H:i:s') . '</p>';
            $body .= mailFooter();

            $sent = sendMail($to, 'Correo de prueba - Kimi', $body);
            if ($sent) {
                echo json_encode(['success' => true, 'message' => 'Correo de prueba enviado a ' . $to]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'El correo no se pudo enviar. Revisa la configuración de PHP mail() en el servidor.']);
            }
            exit;
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Acción inválida']);
        exit;
    }

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

