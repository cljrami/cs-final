<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../mail.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // ============================================
    // GET - LISTAR VERIFICACIONES
    // ============================================
    if ($method === 'GET') {
        $estado = $_GET['estado'] ?? 'todos';
        $search = trim($_GET['search'] ?? '');
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = max(1, min(100, intval($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;

        $where = [];
        $params = [];

        if ($estado !== 'todos') {
            $where[] = "v.estado = ?";
            $params[] = $estado;
        }

        if ($search !== '') {
            $escapedSearch = str_replace(['%', '_'], ['\\%', '\\_'], $search);
            $s = "%{$escapedSearch}%";
            $where[] = "(v.id LIKE ? OR e.id LIKE ? OR e.nombre LIKE ? OR e.email LIKE ? OR e.telefono LIKE ? OR e.ciudad LIKE ?)";
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // Total
        // Para el conteo usamos una subconsulta por cada origen con su propio WHERE,
        // ya que el branch legacy no tiene columna v.estado.
        $searchSql = '';
        $searchParams = [];
        $legacySearchSql = '';
        $legacySearchParams = [];
        if ($search !== '') {
            $escapedSearch = str_replace(['%', '_'], ['\\%', '\\_'], $search);
            $s = "%{$escapedSearch}%";
            $searchSql = " AND (v.id LIKE ? OR e.id LIKE ? OR e.nombre LIKE ? OR e.email LIKE ? OR e.telefono LIKE ? OR e.ciudad LIKE ?)";
            $searchParams = [$s, $s, $s, $s, $s, $s];
            $legacySearchSql = " AND (e.id LIKE ? OR e.nombre LIKE ? OR e.email LIKE ? OR e.telefono LIKE ? OR e.ciudad LIKE ?)";
            $legacySearchParams = [$s, $s, $s, $s, $s];
        }

        $estadoVerifSql = '';
        $estadoVerifParams = [];
        if ($estado !== 'todos') {
            $estadoVerifSql = " AND v.estado = ?";
            $estadoVerifParams = [$estado];
        }

        // Legacy solo aplica si se filtra por 'aprobada' (o todos)
        $legacyInclude = ($estado === 'todos' || $estado === 'aprobada');

        $countSql = "
            SELECT
                (SELECT COUNT(*) FROM verificaciones v JOIN escorts e ON v.escort_id = e.id WHERE 1=1 $estadoVerifSql $searchSql)
                +
                (SELECT COUNT(*) FROM escorts e
                 WHERE e.verificado = 1
                   AND NOT EXISTS (SELECT 1 FROM verificaciones v WHERE v.escort_id = e.id)
                   " . ($legacyInclude ? $legacySearchSql : " AND 1=0") . ")
            AS total
        ";
        $stmtCount = $pdo->prepare($countSql);
        $stmtCount->execute([...$estadoVerifParams, ...$searchParams, ...$legacySearchParams]);
        $total = $stmtCount->fetchColumn();

        // Stats para las tarjetas
        $stats = [
            'total' => 0,
            'pendientes' => 0,
            'aprobadas' => 0,
            'rechazadas' => 0,
        ];
        try {
            $statsStmt = $pdo->query("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE WHEN estado = 'aprobada' THEN 1 ELSE 0 END) as aprobadas,
                    SUM(CASE WHEN estado = 'rechazada' THEN 1 ELSE 0 END) as rechazadas
                FROM verificaciones
            ");
            $statsRow = $statsStmt->fetch(PDO::FETCH_ASSOC);
            if ($statsRow) {
                $stats['total'] = (int)$statsRow['total'];
                $stats['pendientes'] = (int)$statsRow['pendientes'];
                $stats['aprobadas'] = (int)$statsRow['aprobadas'];
                $stats['rechazadas'] = (int)$statsRow['rechazadas'];
            }
            // Incluir escorts legacy (verificado=1 sin registro en verificaciones)
            $legacyStmt = $pdo->query("
                SELECT COUNT(*) FROM escorts e 
                WHERE e.verificado = 1 
                AND NOT EXISTS (SELECT 1 FROM verificaciones v WHERE v.escort_id = e.id)
            ");
            $legacyCount = (int)$legacyStmt->fetchColumn();
            $stats['total'] += $legacyCount;
            $stats['aprobadas'] += $legacyCount;
        } catch (PDOException $e) {
            error_log("Error calculando stats verificaciones: " . $e->getMessage());
        }

        // Datos
        // 1) Verificaciones con registro en tabla
        $sql = "
            SELECT v.*, e.id as escort_id, e.nombre as escort_nombre, e.email as escort_email, e.telefono as escort_telefono, e.foto_principal, e.verificado, e.ciudad, e.edad,
                   0 as es_legacy
            FROM verificaciones v
            JOIN escorts e ON v.escort_id = e.id
            $whereSql
            ORDER BY v.creado_en DESC
            LIMIT ? OFFSET ?
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([...$params, $limit, $offset]);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 2) Escorts legacy (verificado=1 sin registro en tabla verificaciones)
        $legacySql = "
            SELECT 
                0 as id,
                e.id as escort_id,
                e.foto_principal as foto_perfil_real,
                e.foto_principal,
                'aprobada' as estado,
                '' as notas_revision,
                e.created_at as revisado_en,
                e.created_at as creado_en,
                e.nombre as escort_nombre,
                e.email as escort_email,
                e.foto_principal,
                e.verificado,
                e.ciudad,
                e.edad,
                1 as es_legacy
            FROM escorts e
            WHERE e.verificado = 1
              AND NOT EXISTS (SELECT 1 FROM verificaciones v WHERE v.escort_id = e.id)
              " . ($search !== '' ? " AND (e.id LIKE ? OR e.nombre LIKE ? OR e.email LIKE ? OR e.telefono LIKE ? OR e.ciudad LIKE ?)" : "") . "
        ";
        $legacyStmt = $pdo->prepare($legacySql);
        $legacyStmt->execute($search !== '' ? [$s, $s, $s, $s, $s] : []);
        $legacyData = $legacyStmt->fetchAll(PDO::FETCH_ASSOC);

        // Mezclar ambas listas
        $data = array_merge($data, $legacyData);

        // Transform file paths to proxy URLs (handles old upload location)
        foreach ($data as &$row) {
            $cb = !empty($row['creado_en']) ? '&_=' . strtotime($row['creado_en']) : '';
            if (!empty($row['foto_perfil_real'])) {
                $row['foto_perfil_real'] = '/api/serve-upload.php?path=' . urlencode($row['foto_perfil_real']) . $cb;
            }
            if (!empty($row['comprobante_pago'])) {
                $row['comprobante_pago'] = '/api/serve-upload.php?path=' . urlencode($row['comprobante_pago']) . $cb;
            }
        }
        unset($row);

        echo json_encode([
            'success' => true,
            'verificaciones' => $data,
            'stats' => $stats,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => intval($total),
                'pages' => ceil($total / $limit)
            ]
        ]);
        exit;
    }

    // ============================================
    // PUT - APROBAR / RECHAZAR
    // ============================================
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Body inválido']);
            exit;
        }

        $id = intval($input['id'] ?? 0);
        $estado = $input['estado'] ?? '';
        $notasRevision = $input['notas_revision'] ?? null;
        $comprobantePago = $input['comprobante_pago'] ?? null;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }

        if (!in_array($estado, ['aprobada', 'rechazada'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Estado debe ser "aprobada" o "rechazada"']);
            exit;
        }

        // Obtener verificación
        $checkStmt = $pdo->prepare("SELECT escort_id, estado FROM verificaciones WHERE id = ?");
        $checkStmt->execute([$id]);
        $verif = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$verif) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Verificación no encontrada']);
            exit;
        }

        $escortId = $verif['escort_id'];

        if ($estado === 'aprobada') {
            $sql = "UPDATE verificaciones SET estado = 'aprobada', revisado_en = NOW(), notas_revision = ?";
            $params = [$notasRevision];
            if ($comprobantePago !== null) {
                $sql .= ", comprobante_pago = ?";
                $params[] = $comprobantePago;
            }
            $sql .= " WHERE id = ?";
            $params[] = $id;
            $pdo->prepare($sql)->execute($params);
            $pdo->prepare("UPDATE escorts SET verificado = 1 WHERE id = ?")->execute([$escortId]);

            $pdo->prepare("
                INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) 
                VALUES (?, 'sistema', 'Verificación Aprobada', 'Tu cuenta ha sido verificada exitosamente.', '/micuenta/verificacion', NOW())
            ")->execute([$escortId]);

            sendVerificacionAprobada($escortId);
            echo json_encode(['success' => true, 'message' => 'Verificación aprobada correctamente']);
        } else { // rechazada
            $pdo->prepare("UPDATE verificaciones SET estado = 'rechazada', revisado_en = NOW(), notas_revision = ? WHERE id = ?")
                ->execute([$notasRevision, $id]);
            $pdo->prepare("UPDATE escorts SET verificado = 0 WHERE id = ?")->execute([$escortId]);

            $pdo->prepare("
                INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) 
                VALUES (?, 'sistema', 'Verificación Rechazada', ?, '/micuenta/verificacion', NOW())
            ")->execute([$escortId, $notasRevision ?? 'Tu solicitud de verificación fue rechazada.']);

            sendVerificacionRechazada($escortId, $notasRevision ?? 'No se especificó motivo');
            echo json_encode(['success' => true, 'message' => 'Verificación rechazada']);
        }
        exit;
    }

    // ============================================
    // DELETE - ELIMINAR VERIFICACIÓN
    // ============================================
    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Body inválido']);
            exit;
        }

        $id = isset($input['id']) ? intval($input['id']) : 0;
        $escortId = isset($input['escort_id']) ? intval($input['escort_id']) : 0;

        // === CASO 1: Legacy (id=0, escort_id > 0) ===
        if ($id === 0 && $escortId > 0) {
            $checkStmt = $pdo->prepare("SELECT id, nombre FROM escorts WHERE id = ? AND verificado = 1");
            $checkStmt->execute([$escortId]);
            $escort = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$escort) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Escort no encontrada o no verificada']);
                exit;
            }

            $pdo->prepare("UPDATE escorts SET verificado = 0 WHERE id = ?")->execute([$escortId]);
            $pdo->prepare("
                INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) 
                VALUES (?, 'sistema', 'Verificación Removida', 'Tu verificación ha sido removida.', '/micuenta/verificacion', NOW())
            ")->execute([$escortId]);

            echo json_encode(['success' => true, 'message' => 'Verificación removida']);
            exit;
        }

        // === CASO 2: Normal (id > 0) ===
        if ($id > 0) {
            $checkStmt = $pdo->prepare("SELECT escort_id FROM verificaciones WHERE id = ?");
            $checkStmt->execute([$id]);
            $verif = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$verif) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Verificación no encontrada']);
                exit;
            }

            $escortId = $verif['escort_id'];

            // Eliminar fotos
            $uploadDir = __DIR__ . '/../../uploads/verificaciones/' . $escortId . '/';
            if (is_dir($uploadDir)) {
                $files = glob($uploadDir . '*');
                foreach ($files as $file) {
                    if (is_file($file)) @unlink($file);
                }
                @rmdir($uploadDir);
            }

            $pdo->prepare("DELETE FROM verificaciones WHERE id = ?")->execute([$id]);
            $pdo->prepare("UPDATE escorts SET verificado = 0 WHERE id = ?")->execute([$escortId]);
            $pdo->prepare("
                INSERT INTO notificaciones (escort_id, tipo, titulo, mensaje, url, created_at) 
                VALUES (?, 'sistema', 'Verificación Eliminada', 'Tu verificación ha sido eliminada.', '/micuenta/verificacion', NOW())
            ")->execute([$escortId]);

            echo json_encode(['success' => true, 'message' => 'Verificación eliminada']);
            exit;
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Debes enviar id o escort_id']);
        exit;
    }

    // Método no permitido
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error verificaciones.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error verificaciones.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno del servidor']);
}

