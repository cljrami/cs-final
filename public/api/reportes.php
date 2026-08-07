<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle) { return strpos($haystack, $needle) === 0; }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = getDBConnection();

    // Detectar si la tabla reportes tiene la columna usuario_id (migración reportes-usuario.sql)
    $hasUsuarioId = false;
    try {
        $hasUsuarioId = (bool)$pdo->query("SHOW COLUMNS FROM reportes LIKE 'usuario_id'")->fetch();
    } catch (\Throwable $e) {
        $hasUsuarioId = false;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        requireAdminAuth();
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        try {
            $check = $pdo->prepare("SELECT id FROM reportes WHERE id = ?");
            $check->execute([$id]);
            if (!$check->fetch()) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Reporte no encontrado'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $pdo->prepare("DELETE FROM reportes WHERE id = ?")->execute([$id]);
            echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            error_log("Error reportes.php DELETE: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error de base de datos'], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        // Admin: cambiar estado del reporte
        if (strpos($_SERVER['REQUEST_URI'], '/review') !== false) {
            $adminToken = requireAdminAuth();
            $adminId = (int)($adminToken['id'] ?? 0);
            $id = isset($input['id']) ? intval($input['id']) : 0;
            $estado = isset($input['estado']) ? $input['estado'] : 'reviewed';

            if (!in_array($estado, ['pending', 'reviewed', 'dismissed'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Estado inválido'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            try {
                $stmt = $pdo->prepare("UPDATE reportes SET estado = ? WHERE id = ?");
                $stmt->execute([$estado, $id]);

                // Auditoría
                $rep = $pdo->prepare("SELECT escort_id FROM reportes WHERE id = ?");
                $rep->execute([$id]);
                $escortId = $rep->fetchColumn() ?: null;
                $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, ip_address, user_agent, created_at) VALUES (?, ?, 'revisar_reporte', 'reportes', ?, ?, ?, ?, ?, NOW())")
                    ->execute([
                        $adminId,
                        $escortId,
                        $id,
                        json_encode(['estado_previo' => 'pending']),
                        json_encode(['estado' => $estado]),
                        $_SERVER['REMOTE_ADDR'] ?? null,
                        $_SERVER['HTTP_USER_AGENT'] ?? null,
                    ]);

                echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
                exit;
            } catch (PDOException $e) {
                if ($e->getCode() === '42S02') {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'error' => 'Tabla de reportes no existe. Ejecute migrations/features-completas.sql'], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                error_log("Error reportes.php UPDATE: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Error de base de datos'], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        // Crear reporte - requiere usuario autenticado
        $auth = requireAuth();
        $tipo = $auth['tipo'] ?? '';
        if ($tipo !== 'usuario') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Solo usuarios registrados pueden reportar'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $escortId = isset($input['escort_id']) ? intval($input['escort_id']) : 0;
        $motivo = isset($input['motivo']) ? trim($input['motivo']) : '';
        $detalle = isset($input['detalle']) ? trim($input['detalle']) : null;

        if ($escortId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'escort_id requerido'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (empty($motivo)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'motivo requerido'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $usuarioId = (int)($auth['id'] ?? 0);

        try {
            if ($hasUsuarioId) {
                $stmt = $pdo->prepare("INSERT INTO reportes (escort_id, reportado_por, usuario_id, motivo, detalle) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$escortId, $ip, $usuarioId, $motivo, $detalle]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO reportes (escort_id, reportado_por, motivo, detalle) VALUES (?, ?, ?, ?)");
                $stmt->execute([$escortId, $ip, $motivo, $detalle]);
            }

            require_once __DIR__ . '/mail.php';
            try {
                $esc = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
                $esc->execute([$escortId]);
                $escName = $esc->fetchColumn() ?: "ID {$escortId}";
                $body = '<p>Se ha recibido un nuevo reporte en la plataforma:</p>';
                $body .= '<table class="info">';
                $body .= '<tr><td>Escort:</td><td>' . htmlspecialchars($escName, ENT_QUOTES, 'UTF-8') . '</td></tr>';
                $body .= '<tr><td>Motivo:</td><td>' . htmlspecialchars($motivo, ENT_QUOTES, 'UTF-8') . '</td></tr>';
                if (!empty($detalle)) {
                    $body .= '<tr><td>Detalle:</td><td>' . htmlspecialchars($detalle, ENT_QUOTES, 'UTF-8') . '</td></tr>';
                }
                $body .= '</table>';
                $body .= '<p style="text-align:center;margin-top:24px"><a class="btn" href="' . SITE_URL . '/admin/reportes">Revisar reporte</a></p>';
                sendAdminNotification('reportes', 'Nuevo reporte en Kimi', $body);
            } catch (\Throwable $e2) {
                error_log("reportes.php notify error: " . $e2->getMessage());
            }

            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (PDOException $e) {
            if ($e->getCode() === '42S02') {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Tabla de reportes no existe. Ejecute migrations/features-completas.sql'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            error_log("Error reportes.php INSERT: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error de base de datos'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        requireAdminAuth();

        $estado = $_GET['estado'] ?? 'pending';
        $search = trim($_GET['search'] ?? '');
        $page = max(1, intval($_GET['page'] ?? 1));
        $perPage = min(100, max(1, intval($_GET['per_page'] ?? 20)));
        try {
            $where = '';
            $params = [];

            if ($estado !== 'all') {
                $where = "r.estado = ?";
                $params = [$estado];
            }

            if (!empty($search)) {
                $where = ($where === '' ? '1=1' : $where) . " AND (r.id LIKE ? OR r.escort_id LIKE ? OR r.motivo LIKE ? OR r.detalle LIKE ? OR r.reportado_por LIKE ? OR e.nombre LIKE ?)";
                $like = '%' . $search . '%';
                array_push($params, $like, $like, $like, $like, $like, $like);
            }

            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM reportes r LEFT JOIN escorts e ON r.escort_id = e.id" . ($where === '' ? '' : " WHERE $where"));
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();
            $totalPages = (int)ceil($total / $perPage);

            $offset = ($page - 1) * $perPage;
            $selectExtra = $hasUsuarioId
                ? "e.nombre as escort_nombre,
                   COALESCE(u.nombre, '') as reportador_nombre,
                   COALESCE(u.email, '') as reportador_email,
                   COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal"
                : "e.nombre as escort_nombre,
                   COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal";
            $joinUsuarios = $hasUsuarioId ? "LEFT JOIN usuarios u ON u.id = r.usuario_id" : "";
            $stmt = $pdo->prepare("
                SELECT r.*, $selectExtra
                FROM reportes r
                LEFT JOIN escorts e ON r.escort_id = e.id
                $joinUsuarios
                LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
                " . ($where === '' ? '' : "WHERE $where") . "
                ORDER BY r.created_at DESC
                LIMIT $perPage OFFSET $offset
            ");
            $stmt->execute($params);
            $reportes = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($reportes as &$r) {
                $r['foto_principal'] = !empty($r['foto_principal'])
                    ? '/api/serve-upload.php?path=/' . ltrim($r['foto_principal'], '/')
                    : null;
            }
            unset($r);

            $stats = [
                'pending' => 0,
                'reviewed' => 0,
                'dismissed' => 0,
                'total' => 0,
            ];
            $statsStmt = $pdo->query("SELECT estado, COUNT(*) as cnt FROM reportes GROUP BY estado");
            foreach ($statsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if (isset($stats[$row['estado']])) {
                    $stats[$row['estado']] = (int)$row['cnt'];
                }
                $stats['total'] += (int)$row['cnt'];
            }

            echo json_encode([
                'success' => true,
                'data' => $reportes,
                'stats' => $stats,
                'pagination' => [
                    'total' => $total,
                    'total_pages' => $totalPages,
                    'page' => $page,
                    'per_page' => $perPage,
                ],
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (PDOException $e) {
            if ($e->getCode() === '42S02') {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Tabla de reportes no existe. Ejecute migrations/features-completas.sql'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            error_log("Error reportes.php GET: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error de base de datos'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
    exit;
} catch (PDOException $e) {
    error_log("Error reportes.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log("Error reportes.php: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}