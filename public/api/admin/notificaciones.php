<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $usuarioId = $tokenData['id'] ?? 0;
    if ($usuarioId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $unreadOnly = !empty($_GET['unread_only']);
        $all = !empty($_GET['all']);
        $limit = min((int)($_GET['limit'] ?? 20), 50);
        $search = trim($_GET['search'] ?? '');
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $perPage = isset($_GET['per_page']) ? max(10, min(100, intval($_GET['per_page']))) : 20;
        $offset = ($page - 1) * $perPage;

        $sql = "SELECT n.id, n.tipo, n.titulo, n.mensaje, n.leida, n.url, n.created_at, 
                       COALESCE(n.actor_foto, '') as actor_foto,
                       COALESCE(e.nombre, '') as actor_nombre,
                       COALESCE(NULLIF(e.foto_principal, ''), pf.url) as escort_foto,
                       n.escort_id,
                       n.usuario_id
                FROM notificaciones n
                LEFT JOIN escorts e ON e.id = n.escort_id
                LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1";
        $countSql = "SELECT COUNT(*) FROM notificaciones n LEFT JOIN escorts e ON e.id = n.escort_id";
        $where = [];
        $params = [];
        $countParams = [];

        if ($search !== '') {
            $escapedSearch = str_replace(['%', '_'], ['\\%', '\\_'], $search);
            $s = "%{$escapedSearch}%";
            $where[] = "(n.id LIKE ? OR n.escort_id LIKE ? OR n.titulo LIKE ? OR n.mensaje LIKE ? OR n.tipo LIKE ? OR COALESCE(e.nombre, '') LIKE ?)";
            $params = [$s, $s, $s, $s, $s, $s];
            $countParams = [$s, $s, $s, $s, $s, $s];
        } elseif ($all) {
            // Mostrar todas las notificaciones (CRUD global)
        } else {
            $where[] = "(n.usuario_id = ? OR n.usuario_id IS NULL)";
            $params[] = $usuarioId;
            $countParams[] = $usuarioId;
            if ($unreadOnly) {
                $where[] = "n.leida = 0";
            }
        }

        if (!empty($where)) {
            $sql .= " WHERE " . implode(' AND ', $where);
            $countSql .= " WHERE " . implode(' AND ', $where);
        }

        $sql .= " ORDER BY n.created_at DESC";

        if ($all || $search !== '') {
            $sql .= " LIMIT $perPage OFFSET $offset";
            $stmtCount = $pdo->prepare($countSql);
            $stmtCount->execute($countParams ?: []);
            $total = (int)$stmtCount->fetchColumn();
        } else {
            $sql .= " LIMIT ?";
            $params[] = $limit;
            $total = 0;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $notificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if ($all || $search !== '') {
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM notificaciones WHERE leida = 0");
            $countStmt->execute();
            $unreadCount = (int)$countStmt->fetchColumn();
        } else {
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM notificaciones WHERE (usuario_id = ? OR usuario_id IS NULL) AND leida = 0");
            $countStmt->execute([$usuarioId]);
            $unreadCount = (int)$countStmt->fetchColumn();
        }

        foreach ($notificaciones as &$n) {
            $n['id'] = (int)$n['id'];
            $n['leida'] = (bool)$n['leida'];
            if (isset($n['escort_id'])) $n['escort_id'] = (int)$n['escort_id'];
            if (empty($n['actor_foto']) && !empty($n['escort_foto'])) {
                $n['actor_foto'] = '/api/serve-upload.php?path=/' . ltrim($n['escort_foto'], '/');
            }
            unset($n['escort_foto']);
        }
        unset($n);

        echo json_encode([
            'success' => true,
            'notificaciones' => $notificaciones,
            'unread_count' => $unreadCount,
            'total' => $total
        ]);
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';
        $notificacionId = $input['id'] ?? null;

        if ($action === 'mark_read') {
            if ($notificacionId) {
                $stmt = $pdo->prepare("UPDATE notificaciones SET leida = 1 WHERE id = ?");
                $stmt->execute([$notificacionId]);
            } else {
                $stmt = $pdo->prepare("UPDATE notificaciones SET leida = 1 WHERE leida = 0");
                $stmt->execute();
            }

            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM notificaciones WHERE leida = 0");
            $countStmt->execute();
            $unreadCount = (int)$countStmt->fetchColumn();

            echo json_encode(['success' => true, 'unread_count' => $unreadCount]);
        } elseif ($action === 'mark_unread') {
            if ($notificacionId) {
                $stmt = $pdo->prepare("UPDATE notificaciones SET leida = 0 WHERE id = ?");
                $stmt->execute([$notificacionId]);
            }
            echo json_encode(['success' => true]);
        } elseif ($action === 'delete') {
            if ($notificacionId) {
                $stmt = $pdo->prepare("DELETE FROM notificaciones WHERE id = ?");
                $stmt->execute([$notificacionId]);
                echo json_encode(['success' => true]);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'ID requerido']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción no válida']);
        }
    } elseif ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $notificacionId = $input['id'] ?? ($_GET['id'] ?? null);
        if ($notificacionId) {
            $stmt = $pdo->prepare("DELETE FROM notificaciones WHERE id = ?");
            $stmt->execute([$notificacionId]);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
        }
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    }
} catch (PDOException $e) {
    error_log("Error notificaciones.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error notificaciones.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

