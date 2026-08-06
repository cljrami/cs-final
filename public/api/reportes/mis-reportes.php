<?php
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();
    if (($tokenData['tipo'] ?? '') !== 'usuario') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Solo usuarios pueden consultar sus reportes']);
        exit;
    }
    $usuarioId = (int)($tokenData['id'] ?? 0);
    if ($usuarioId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    $hasUsuarioId = false;
    try {
        $hasUsuarioId = (bool)$pdo->query("SHOW COLUMNS FROM reportes LIKE 'usuario_id'")->fetch();
    } catch (\Throwable $e) {
        $hasUsuarioId = false;
    }
    if (!$hasUsuarioId) {
        echo json_encode([
            'success' => true,
            'reportes' => [],
            'warning' => 'La tabla reportes no tiene la columna usuario_id. Ejecuta migrations/reportes-usuario.sql',
        ]);
        exit;
    }

    if ($method === 'GET') {
        $stmt = $pdo->prepare("
            SELECT r.id, r.escort_id, r.motivo, r.detalle, r.estado, r.created_at,
                   e.nombre as escort_nombre,
                   COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal
            FROM reportes r
            LEFT JOIN escorts e ON e.id = r.escort_id
            LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
            WHERE r.usuario_id = ?
            ORDER BY r.created_at DESC
        ");
        $stmt->execute([$usuarioId]);
        $reportes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($reportes as &$r) {
            $r['foto_principal'] = !empty($r['foto_principal'])
                ? '/api/serve-upload.php?path=/' . ltrim($r['foto_principal'], '/')
                : null;
        }
        unset($r);

        echo json_encode(['success' => true, 'reportes' => $reportes], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id FROM reportes WHERE id = ? AND usuario_id = ?");
        $stmt->execute([$id, $usuarioId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Reporte no encontrado']);
            exit;
        }

        $pdo->prepare("DELETE FROM reportes WHERE id = ? AND usuario_id = ?")->execute([$id, $usuarioId]);

        echo json_encode(['success' => true, 'message' => 'Reporte eliminado']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (Throwable $e) {
    error_log("Error mis-reportes.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
