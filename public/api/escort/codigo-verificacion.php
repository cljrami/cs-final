<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $pdo = getDBConnection();
    $auth = requireEscortAuth();
    $escortId = (int)$auth['id'];

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare("
            SELECT id, codigo, creado_en, expira_en, usado, usado_por, usado_en
            FROM codigos_verificacion
            WHERE escort_id = ?
            ORDER BY creado_en DESC
            LIMIT 50
        ");
        $stmt->execute([$escortId]);
        $codigos = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($codigos as &$c) {
            $c['expirado'] = strtotime($c['expira_en']) < time();
        }

        echo json_encode(['success' => true, 'codigos' => $codigos]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $codigo = strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $expiraEn = date('Y-m-d H:i:s', time() + 48 * 3600);

        $stmt = $pdo->prepare("INSERT INTO codigos_verificacion (escort_id, codigo, creado_en, expira_en) VALUES (?, ?, NOW(), ?)");
        $stmt->execute([$escortId, $codigo, $expiraEn]);

        require_once __DIR__ . '/../mail.php';
        notificarAccionEscort('codigos', $escortId, 'Escort generó un código de verificación', [
            'Código' => $codigo,
            'Expira' => date('d/m/Y H:i', strtotime($expiraEn)),
        ]);

        echo json_encode([
            'success' => true,
            'codigo' => $codigo,
            'expira_en' => $expiraEn
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id FROM codigos_verificacion WHERE id = ? AND escort_id = ?");
        $stmt->execute([$id, $escortId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Código no encontrado']);
            exit;
        }

        $pdo->prepare("DELETE FROM codigos_verificacion WHERE id = ? AND escort_id = ?")->execute([$id, $escortId]);

        echo json_encode(['success' => true, 'message' => 'Código eliminado']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error codigo-verificacion.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
