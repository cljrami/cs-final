<?php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    $claves = [
        'admin_notify_emails',
        'admin_notify_last_sent',
        'notify_reportes',
        'notify_inscripciones',
        'notify_verificaciones',
        'notify_pagos',
        'notify_comentarios',
        'notify_contacto',
        'notify_perfil',
        'notify_fotos',
        'notify_historias',
        'notify_planes',
        'notify_disponibilidad',
        'notify_cuentas',
        'notify_codigos',
        'notify_usuarios',
        'notify_favoritos',
    ];

    if ($method === 'GET') {
        $in = implode(',', array_fill(0, count($claves), '?'));
        $stmt = $pdo->prepare("SELECT clave, valor FROM configuracion WHERE clave IN ($in)");
        $stmt->execute($claves);
        $config = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $config[$row['clave']] = $row['valor'];
        }
        echo json_encode(['success' => true, 'config' => $config], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
            exit;
        }
        $updates = [];
        foreach ($claves as $key) {
            if (!array_key_exists($key, $input)) continue;
            $valor = trim((string)$input[$key]);
            $stmt = $pdo->prepare("SELECT id FROM configuracion WHERE clave = ?");
            $stmt->execute([$key]);
            if ($stmt->fetch()) {
                $pdo->prepare("UPDATE configuracion SET valor = ? WHERE clave = ?")->execute([$valor, $key]);
            } else {
                $pdo->prepare("INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES (?, ?, 'string', ?)")->execute([$key, $valor, $key]);
            }
            $updates[] = $key;
        }
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No hay datos para actualizar']);
            exit;
        }
        echo json_encode(['success' => true, 'message' => 'Configuración guardada']);
        exit;
    }

    if ($method === 'POST') {
        require_once __DIR__ . '/../mail.php';
        $input = json_decode(file_get_contents('php://input'), true);
        $to = trim($input['email'] ?? '');
        $targets = [];
        if (!empty($to)) {
            if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Email de prueba inválido']);
                exit;
            }
            $targets = [$to];
        } else {
            $targets = getAdminNotifyEmails();
            if (empty($targets)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'No hay emails de destino configurados']);
                exit;
            }
        }

        $body = mailHeader('Prueba de notificaciones');
        $body .= '<p>Este es un correo de prueba de las <strong style="color:#ffffff">notificaciones a administradores</strong> de Kimi.</p>';
        $body .= '<p>Si recibes este mensaje, el envío de notificaciones está configurado correctamente.</p>';
        $body .= '<p class="text-green">Destinos activos: <strong style="color:#ffffff">' . htmlspecialchars(implode(', ', $targets), ENT_QUOTES, 'UTF-8') . '</strong></p>';
        $html = $body . mailFooter();

        $results = [];
        $allOk = true;
        foreach ($targets as $email) {
            $ok = sendMail($email, 'Kimi - Prueba de notificaciones', $html);
            $results[$email] = $ok;
            if (!$ok) $allOk = false;
        }

        echo json_encode([
            'success' => $allOk,
            'message' => $allOk ? 'Correo de prueba enviado' : 'Error al enviar el correo de prueba (revisa logs)',
            'results' => $results,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error email-notificaciones.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
