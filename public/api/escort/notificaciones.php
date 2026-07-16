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

    $escortId = $tokenData['id'] ?? 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $unreadOnly = !empty($_GET['unread_only']);
        $limit = min((int)($_GET['limit'] ?? 20), 50);

        $sql = "SELECT id, tipo, titulo, mensaje, leida, url, created_at 
                FROM notificaciones 
                WHERE escort_id = ?";
        $params = [$escortId];

        if ($unreadOnly) {
            $sql .= " AND leida = 0";
        }

        $sql .= " ORDER BY created_at DESC LIMIT ?";
        $params[] = $limit;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $notificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($notificaciones as &$n) {
            $n['id'] = (int)$n['id'];
            $n['leida'] = (bool)$n['leida'];
        }
        unset($n);

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM notificaciones WHERE escort_id = ? AND leida = 0");
        $countStmt->execute([$escortId]);
        $unreadCount = (int)$countStmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'notificaciones' => $notificaciones,
            'unread_count' => $unreadCount,
            'total' => count($notificaciones)
        ]);
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';
        $notificacionId = $input['id'] ?? null;

        if ($action === 'mark_read') {
            if ($notificacionId) {
                $stmt = $pdo->prepare("UPDATE notificaciones SET leida = 1 WHERE id = ? AND escort_id = ?");
                $stmt->execute([$notificacionId, $escortId]);
            } else {
                $stmt = $pdo->prepare("UPDATE notificaciones SET leida = 1 WHERE escort_id = ? AND leida = 0");
                $stmt->execute([$escortId]);
            }

            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM notificaciones WHERE escort_id = ? AND leida = 0");
            $countStmt->execute([$escortId]);
            $unreadCount = (int)$countStmt->fetchColumn();

            echo json_encode(['success' => true, 'unread_count' => $unreadCount]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción no válida']);
        }
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    }
} catch (PDOException $e) {
    error_log("Error notificaciones.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB: ' . $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Error notificaciones.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
