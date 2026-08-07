<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? ($_GET['id'] ?? null);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID requerido']);
            exit;
        }
        $stmt = $pdo->prepare("DELETE FROM logs_auditoria WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);
        exit;
    }

    $accionFilter = $_GET['accion'] ?? 'todos';
    $search = trim($_GET['search'] ?? '');
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, min(200, intval($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    $where = [];
    $params = [];

    if ($accionFilter !== 'todos') {
        $where[] = "la.accion = ?";
        $params[] = $accionFilter;
    }

    if ($search !== '') {
        $where[] = "(a.nombre LIKE ? OR u.nombre LIKE ? OR e.nombre LIKE ? OR la.tabla_afectada LIKE ? OR la.accion LIKE ?)";
        $s = "%{$search}%";
        for ($i = 0; $i < 5; $i++) { $params[] = $s; }
    }

    $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

    // Stats
    $statsStmt = $pdo->query("
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN accion = 'crear' THEN 1 ELSE 0 END) as crear,
            SUM(CASE WHEN accion = 'editar' THEN 1 ELSE 0 END) as editar,
            SUM(CASE WHEN accion = 'eliminar' THEN 1 ELSE 0 END) as eliminar,
            SUM(CASE WHEN accion = 'aprobar' THEN 1 ELSE 0 END) as aprobar,
            SUM(CASE WHEN accion = 'rechazar' THEN 1 ELSE 0 END) as rechazar
        FROM logs_auditoria
    ");
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
    foreach ($stats as &$v) { $v = (int)$v; }
    unset($v);

    // Total count
    $countSql = "SELECT COUNT(*) FROM logs_auditoria la LEFT JOIN admins a ON a.id = la.usuario_id LEFT JOIN usuarios u ON u.id = la.usuario_id LEFT JOIN escorts e ON e.id = la.escort_id $whereClause";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $sql = "
        SELECT 
            la.id,
            la.usuario_id,
            la.escort_id,
            a.nombre as admin_nombre,
            a.avatar as admin_foto,
            u.nombre as user_nombre,
            u.avatar as user_foto,
            e.nombre as escort_nombre,
            e.foto_principal as escort_foto,
            la.accion,
            la.tabla_afectada as entidad,
            la.registro_id as entidad_id,
            COALESCE(la.datos_nuevos, la.datos_anteriores) as detalle,
            la.created_at as creado_en
        FROM logs_auditoria la
        LEFT JOIN admins a ON a.id = la.usuario_id
        LEFT JOIN usuarios u ON u.id = la.usuario_id
        LEFT JOIN escorts e ON e.id = la.escort_id
        $whereClause
        ORDER BY la.created_at DESC
        LIMIT $limit OFFSET $offset
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Humaniza el detalle según la acción y el JSON almacenado
    $humanizar = function ($accion, $tabla, $detalleJson) {
        $d = json_decode($detalleJson, true);
        if (!is_array($d)) { $d = []; }

        $estadoLabel = function ($e) {
            $map = [
                'pausada' => 'Pausada', 'pausado' => 'Pausado', 'activa' => 'Activa', 'activo' => 'Activo',
                'pendiente_aprobacion' => 'Pendiente de aprobación', 'pendiente' => 'Pendiente',
                'rechazada' => 'Rechazada', 'rechazado' => 'Rechazado',
                'cancelada' => 'Cancelada', 'cancelado' => 'Cancelado',
                'expirada' => 'Expirada', 'expirado' => 'Expirado',
                'completado' => 'Completado', 'aprobada' => 'Aprobada', 'aprobado' => 'Aprobado',
                'eliminada' => 'Eliminada', 'eliminado' => 'Eliminado',
            ];
            return $map[$e] ?? ucfirst(str_replace('_', ' ', (string)$e));
        };

        $motivo = !empty($d['motivo']) ? ": " . $d['motivo'] : '';
        $plan = !empty($d['plan_nombre']) ? $d['plan_nombre'] : '';
        if (empty($plan) && !empty($d['nombre'])) { $plan = $d['nombre']; }
        if (empty($plan) && !empty($d['plan'])) { $plan = $d['plan']; }

        $map = [
            'cambio_estado' => (function () use ($d, $estadoLabel) {
                $e = $d['estado_nuevo'] ?? '';
                if ($e === 'pausada' || $e === 'pausado') return 'Pausó su aviso';
                return 'Cambió su estado a ' . (($e !== '' ) ? $estadoLabel($e) : 'Activa');
            }),
            'pausar_suscripcion' => "Pausó la suscripción" . ($plan ? " de {$plan}" : ""),
            'reactivar_suscripcion' => "Reactivó la suscripción" . ($plan ? " de {$plan}" : "") . (!empty($d['nueva_fecha_fin']) ? ", vence el " . date('d/m/Y', strtotime($d['nueva_fecha_fin'])) : ''),
            'aprobar_suscripcion' => "Aprobó la suscripción" . ($plan ? " de {$plan}" : ""),
            'rechazar_suscripcion' => "Rechazó la solicitud/el plan" . $motivo,
            'cancelar_suscripcion' => "Canceló la suscripción" . ($plan ? " de {$plan}" : ""),
            'eliminar_suscripcion' => "Eliminó la suscripción" . ($plan ? " de {$plan}" : ""),
            'pago_creado' => "Registró un pago" . (!empty($d['monto']) ? " de {$d['monto']}" : ""),
            'pago_aprobado' => "Aprobó el pago",
            'pago_eliminado' => "Eliminó un registro de pago",
            'crear_extra' => "Creó el plan extra " . ($d['nombre'] ?? ($d['plan_nombre'] ?? '')),
            'actualizar_extra' => "Editó el plan extra " . ($d['nombre'] ?? ($d['plan_nombre'] ?? '')),
            'eliminar_extra' => "Eliminó el plan extra " . ($d['nombre'] ?? ($d['plan_nombre'] ?? '')),
            'crear_orientacion' => "Creó una orientación",
            'actualizar_orientacion' => "Editó una orientación",
            'eliminar_orientacion' => "Eliminó una orientación",
            'eliminar_escort' => "Eliminó a la escort " . ($d['nombre'] ?? ''),
            'restaurar_escort' => "Restauró a la escort " . ($d['nombre'] ?? ''),
            'galeria_actualizada' => "Actualizó su galería de fotos (" . ($d['archivos'] ?? 0) . " foto(s) subida(s))",
            'fotos_portada' => "Cambió su foto de portada",
            'fotos_eliminar' => "Eliminó una foto de su galería",
            'historia_publicada' => "Publicó una nueva historia (" . ($d['historias'] ?? 0) . " historia(s))",
            'historia_eliminar' => "Eliminó una historia",
            'perfil_actualizado' => "Actualizó su perfil",
            'disponibilidad' => ((isset($d['disponible']) && (int)$d['disponible'] === 1) ? "Se marcó como disponible ahora" : ((isset($d['disponible']) && (int)$d['disponible'] === 0) ? "Se marcó como no disponible" : "Cambió su disponibilidad")),
            'solicitar_plan' => "Solicitó el plan " . ($d['plan_nombre'] ?? ''),
            'solicitar_extra' => "Solicitó el extra " . ($d['plan_nombre'] ?? ''),
            'solicitar_vip' => "Solicitó estado VIP",
            'verificacion_solicitud' => "Envió su documentación de verificación",
            'nueva_escort' => "Se registró como nueva escort",
        ];

        if (isset($map[$accion])) {
            $out = $map[$accion];
            return is_string($out) ? $out : $out();
        }

        // Fallback genérico según acción base
        $v = [
            'crear' => 'creó', 'editar' => 'editó', 'actualizar' => 'actualizó',
            'aprobar' => 'aprobó', 'rechazar' => 'rechazó', 'eliminar' => 'eliminó',
            'cancelar' => 'canceló', 'pausar' => 'pausó', 'reactivar' => 'reactivó',
        ];
        $acc = 'realizó una acción';
        if (preg_match('/^(crear|editar|actualizar|aprobar|rechazar|eliminar|cancelar|pausar|reactivar)/', (string)$accion, $m)) {
            $acc = ($v[$m[1]] ?? 'registró');
        } elseif (isset($v[$accion])) {
            $acc = $v[$accion];
        }
        $entidad = ucwords(str_replace('_', ' ', (string)$tabla));
        return ucfirst($acc) . ($plan ? " {$plan}" : '') . " en {$entidad}";
    };

    // Format detalle + resolver nombre/foto del actor
    foreach ($data as &$row) {
        $row['detalle'] = $humanizar($row['accion'], $row['entidad'], $row['detalle']);
        $nombre = null;
        $foto = null;
        if (!empty($row['admin_nombre'])) {
            $nombre = $row['admin_nombre'];
            $foto = $row['admin_foto'];
        } elseif (!empty($row['user_nombre'])) {
            $nombre = $row['user_nombre'];
            $foto = $row['user_foto'];
        } elseif (!empty($row['escort_nombre'])) {
            $nombre = $row['escort_nombre'];
            $foto = $row['escort_foto'];
        } elseif ($row['usuario_id'] !== null) {
            $nombre = 'Usuario #' . $row['usuario_id'];
        } elseif ($row['escort_id'] !== null) {
            $nombre = 'Escort #' . $row['escort_id'];
        }
        $row['usuario_nombre'] = $nombre;
        $row['usuario_foto'] = empty($foto) ? null : '/api/serve-upload.php?path=/' . ltrim($foto, '/');
        unset($row['admin_nombre'], $row['admin_foto'], $row['user_nombre'], $row['user_foto'], $row['escort_nombre'], $row['escort_foto']);
    }
    unset($row);

    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'data' => $data,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => max(1, ceil($total / $limit))
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

