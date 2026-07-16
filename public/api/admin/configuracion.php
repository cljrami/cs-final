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
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Obtener configuración ===
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT clave, valor, descripcion FROM configuracion WHERE clave IN ('precio_vip', 'moneda_vip', 'duracion_vip_dias')");
        $config = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($config as $c) {
            $result[$c['clave']] = [
                'valor' => $c['valor'],
                'descripcion' => $c['descripcion']
            ];
        }

        echo json_encode(['success' => true, 'config' => $result]);
        exit;
    }

    // === PUT - Actualizar configuración ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        $allowedKeys = ['precio_vip', 'moneda_vip', 'duracion_vip_dias'];
        $updates = [];

        foreach ($allowedKeys as $key) {
            if (isset($input[$key])) {
                $stmt = $pdo->prepare("UPDATE configuracion SET valor = ? WHERE clave = ?");
                $stmt->execute([trim($input[$key]), $key]);
                $updates[] = $key;
            }
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No hay datos para actualizar']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Configuración actualizada',
            'actualizados' => $updates
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error configuracion.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Error configuracion.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
