<?php
// public/api/admin/banners.php
// CRUD de banners publicitarios + cola de solicitudes.
// Patrón: requireAuth() + requireAdminRole() + logs_auditoria.

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/banners.php';

try {
    $tokenData = requireAuth();
    requireAdminRole($tokenData);
    $pdo = getDBConnection();
    $method = $_SERVER['REQUEST_METHOD'];

    $PLACEMENTS = banners_placements();
    $CATEGORIAS = ['night_club', 'discoteca', 'sex_shop', 'bar', 'sauna', 'otro'];
    $ESTADOS = ['solicitud', 'presupuesto', 'pendiente_pago', 'activo', 'pausado', 'finalizado', 'rechazado'];
    $ESTADOS_PAGO = ['pendiente', 'pagado', 'gratis', 'reembolsado'];
    $FORMAS_PAGO = ['transferencia', 'webpay', 'efectivo', 'otro'];

    // ============ GET ============
    if ($method === 'GET') {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $placement = isset($_GET['placement']) ? $_GET['placement'] : '';
        $estado = isset($_GET['estado']) ? $_GET['estado'] : '';
        $ciudadId = isset($_GET['ciudad_id']) ? intval($_GET['ciudad_id']) : 0;
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 25;
        $offset = ($page - 1) * $limit;

        $stats = [
            'total'       => (int)$pdo->query("SELECT COUNT(*) FROM banners")->fetchColumn(),
            'activos'     => (int)$pdo->query("SELECT COUNT(*) FROM banners WHERE estado = 'activo'")->fetchColumn(),
            'solicitudes' => (int)$pdo->query("SELECT COUNT(*) FROM banners WHERE estado = 'solicitud'")->fetchColumn(),
            'pendientes_pago' => (int)$pdo->query("SELECT COUNT(*) FROM banners WHERE estado_pago = 'pendiente'")->fetchColumn(),
            'impresiones' => (int)$pdo->query("SELECT COALESCE(SUM(impresiones),0) FROM banners_stats")->fetchColumn(),
            'clicks'      => (int)$pdo->query("SELECT COALESCE(SUM(clicks),0) FROM banners_stats")->fetchColumn(),
        ];

        $where = [];
        $params = [];
        if ($placement !== '' && isset($PLACEMENTS[$placement])) {
            $where[] = 'b.placement = ?';
            $params[] = $placement;
        }
        if ($estado !== '' && in_array($estado, $ESTADOS, true)) {
            $where[] = 'b.estado = ?';
            $params[] = $estado;
        }
        if ($ciudadId > 0) {
            $where[] = 'b.ciudad_id = ?';
            $params[] = $ciudadId;
        }
        if ($search !== '') {
            $where[] = '(b.anunciante LIKE ? OR b.titulo LIKE ? OR b.contacto LIKE ? OR b.web LIKE ?)';
            $like = '%' . $search . '%';
            array_push($params, $like, $like, $like, $like);
        }
        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM banners b $whereClause");
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        $stmt = $pdo->prepare("
            SELECT b.*, c.nombre AS ciudad_nombre,
                   COALESCE(s.imp, 0) AS impresiones, COALESCE(s.clk, 0) AS clicks
            FROM banners b
            LEFT JOIN ciudades c ON c.id = b.ciudad_id
            LEFT JOIN (
                SELECT banner_id, SUM(impresiones) AS imp, SUM(clicks) AS clk
                FROM banners_stats GROUP BY banner_id
            ) s ON s.banner_id = b.id
            $whereClause
            ORDER BY b.estado = 'solicitud' DESC, b.actualizado_en DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute(array_merge($params, [$limit, $offset]));
        $banners = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Ciudades para el filtro
        $ciudades = $pdo->query("SELECT id, nombre FROM ciudades WHERE activa = 1 ORDER BY nombre ASC")->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'banners' => $banners,
            'placements' => banners_placements(),
            'ciudades' => $ciudades,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltered,
                'pages' => $limit > 0 ? (int)ceil($totalFiltered / $limit) : 1,
                'hasMore' => ($page * $limit) < $totalFiltered,
            ],
        ]);
        exit;
    }

    // ============ POST ============
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) $input = [];

        $errores = [];
        $anunciante = trim((string)($input['anunciante'] ?? ''));
        $categoria = in_array(($input['categoria'] ?? ''), $CATEGORIAS, true) ? $input['categoria'] : 'otro';
        $contacto = trim((string)($input['contacto'] ?? ''));
        $web = trim((string)($input['web'] ?? ''));
        $titulo = trim((string)($input['titulo'] ?? ''));
        $imagenUrl = trim((string)($input['imagen_url'] ?? ''));
        $imagenMobile = trim((string)($input['imagen_mobile_url'] ?? ''));
        $texto = trim((string)($input['texto'] ?? ''));
        $enlaceUrl = trim((string)($input['enlace_url'] ?? ''));
        $placement = isset($PLACEMENTS[$input['placement'] ?? '']) ? ($input['placement']) : '';
        $lane = max(1, intval($input['lane'] ?? 1));
        $ciudadId = intval($input['ciudad_id'] ?? 0);
        $fechaInicio = trim((string)($input['fecha_inicio'] ?? ''));
        $fechaFin = trim((string)($input['fecha_fin'] ?? ''));
        $peso = max(1, intval($input['peso'] ?? 10));
        $orden = intval($input['orden'] ?? 0);
        $precio = floatval($input['precio'] ?? 0);
        $moneda = substr(trim((string)($input['moneda'] ?? 'CLP')), 0, 3) ?: 'CLP';
        $estadoPago = in_array(($input['estado_pago'] ?? ''), $ESTADOS_PAGO, true) ? $input['estado_pago'] : 'pendiente';
        $formaPago = in_array(($input['forma_pago'] ?? ''), $FORMAS_PAGO, true) ? $input['forma_pago'] : 'transferencia';
        $referenciaPago = trim((string)($input['referencia_pago'] ?? ''));
        $estado = in_array(($input['estado'] ?? ''), $ESTADOS, true) ? $input['estado'] : 'solicitud';
        $notas = trim((string)($input['notas'] ?? ''));

        if (mb_strlen($anunciante) < 2) $errores['anunciante'] = 'Nombre del negocio obligatorio';
        if ($titulo === '') $titulo = $anunciante;
        if ($imagenUrl === '') $errores['imagen_url'] = 'Sube la imagen del banner';
        if (!preg_match('#^/uploads/banners/#', $imagenUrl) && !preg_match('#^https?://#i', $imagenUrl)) {
            $errores['imagen_url'] = 'Imagen inválida';
        }
        if ($enlaceUrl === '') $errores['enlace_url'] = 'Enlace de destino obligatorio';
        elseif (banners_url_segura($enlaceUrl) === '') $errores['enlace_url'] = 'El enlace debe empezar por http:// o https://';
        if ($placement === '') $errores['placement'] = 'Selecciona la ubicación';
        if ($placement !== '' && $lane > banners_lanes($placement)) $errores['lane'] = 'Ese carril no existe en esta ubicación';
        if ($fechaInicio === '' || $fechaFin === '') $errores['fecha_inicio'] = 'Define el período';
        elseif ($fechaFin < $fechaInicio) $errores['fecha_fin'] = 'La fecha fin no puede ser anterior a la de inicio';
        if ($web !== '' && banners_url_segura($web) === '') $errores['web'] = 'Sitio web inválido';

        if (!empty($errores)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Revisa los datos', 'fieldErrors' => $errores]);
            exit;
        }

        $codigo = ($estado === 'activo') ? banners_generar_codigo() : null;

        // Exclusividad por carril: si otra campaña ocupa ese carril en esas fechas, avisamos.
        // Con forzar=1 (botón "Tomar el lugar") se permite y se pausa la otra.
        $forzar = !empty($input['forzar']);
        if ($estado !== 'solicitud' && $estado !== 'rechazado') {
            $conflictos = banners_conflictos($placement, $lane, $fechaInicio, $fechaFin);
            if ($conflictos && !$forzar) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error' => 'Este espacio ya está ocupado en esas fechas',
                    'conflictos' => $conflictos,
                    'puedeForzar' => true,
                ]);
                exit;
            }
            if ($conflictos && $forzar) {
                foreach ($conflictos as $c) {
                    $pdo->prepare("UPDATE banners SET estado = 'pausado' WHERE id = ?")->execute([(int)$c['id']]);
                    $pdo->prepare("
                        INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address)
                        VALUES (?, 'tomar_lugar_banner', 'banners', ?, ?, ?)
                    ")->execute([
                        $tokenData['id'] ?? null, (int)$c['id'],
                        json_encode($c, JSON_UNESCAPED_UNICODE),
                        $_SERVER['REMOTE_ADDR'] ?? null,
                    ]);
                }
            }
        }


        $stmt = $pdo->prepare("
            INSERT INTO banners
                (anunciante, categoria, contacto, web, titulo, imagen_url, imagen_mobile_url, texto, enlace_url,
                 placement, lane, ciudad_id, fecha_inicio, fecha_fin, peso, orden, precio, moneda,
                 estado_pago, forma_pago, referencia_pago, pagado_en, estado, codigo_acceso, notas, creado_por)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $anunciante, $categoria,
            $contacto !== '' ? $contacto : null,
            $web !== '' ? banners_url_segura($web) : null,
            $titulo, $imagenUrl,
            $imagenMobile !== '' ? $imagenMobile : null,
            $texto !== '' ? $texto : null,
            banners_url_segura($enlaceUrl),
            $placement, $lane, $ciudadId > 0 ? $ciudadId : null,
            $fechaInicio, $fechaFin, $peso, $orden, $precio, $moneda,
            $estadoPago, $formaPago,
            $referenciaPago !== '' ? $referenciaPago : null,
            $estadoPago === 'pagado' ? date('Y-m-d H:i:s') : null,
            $estado, $codigo, $notas !== '' ? $notas : null,
            $tokenData['id'] ?? null,
        ]);

        $id = (int)$pdo->lastInsertId();

        $pdo->prepare("
            INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
            VALUES (?, 'crear_banner', 'banners', ?, ?, ?)
        ")->execute([
            $tokenData['id'] ?? null,
            $id,
            json_encode(['anunciante' => $anunciante, 'placement' => $placement, 'estado' => $estado], JSON_UNESCAPED_UNICODE),
            $_SERVER['REMOTE_ADDR'] ?? null,
        ]);

        echo json_encode(['success' => true, 'message' => 'Banner creado', 'id' => $id, 'codigo_acceso' => $codigo]);
        exit;
    }

    // ============ PUT ============
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no válido']);
            exit;
        }

        $check = $pdo->prepare("SELECT * FROM banners WHERE id = ?");
        $check->execute([$id]);
        $actual = $check->fetch(PDO::FETCH_ASSOC);
        if (!$actual) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No encontrado']);
            exit;
        }

        // Acciones especiales
        $accion = (string)($input['accion'] ?? '');

        if ($accion === 'tomar_lugar') {
            // Pausa la campaña que ocupa el mismo carril y activa esta
            $ocupante = banners_ocupacion($actual['placement'], (int)($actual['lane'] ?? 1));
            if ($ocupante && (int)$ocupante['id'] !== $id) {
                $pdo->prepare("UPDATE banners SET estado = 'pausado' WHERE id = ?")->execute([(int)$ocupante['id']]);
                $pdo->prepare("
                    INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address)
                    VALUES (?, 'tomar_lugar_banner', 'banners', ?, ?, ?)
                ")->execute([
                    $tokenData['id'] ?? null, (int)$ocupante['id'],
                    json_encode($ocupante, JSON_UNESCAPED_UNICODE),
                    $_SERVER['REMOTE_ADDR'] ?? null,
                ]);
                // Aviso al panel + notificación interna
                $pdo->prepare("
                    INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url)
                    VALUES (NULL, 'sistema', 'Espacio publicitario tomado', ?, '/admin/banners')
                ")->execute(["El espacio '{$actual['placement']}' fue reasignado a otra campaña."]);
            }
            $nuevoEstado = $actual['estado'] === 'activo' ? 'activo' : 'activo';
            $pdo->prepare("UPDATE banners SET estado = ?, orden = (SELECT COALESCE(MAX(orden), 0) + 1 FROM banners WHERE placement = ? AND lane = ? AND id <> ?) WHERE id = ?")
                ->execute([$nuevoEstado, $actual['placement'], (int)($actual['lane'] ?? 1), $id, $id]);
            echo json_encode(['success' => true, 'message' => 'Espacio tomado: la campaña anterior quedó pausada']);
            exit;
        }

        if ($accion === 'regenerar_codigo') {
            $codigo = banners_generar_codigo();
            $pdo->prepare("UPDATE banners SET codigo_acceso = ? WHERE id = ?")->execute([$codigo, $id]);
            $pdo->prepare("
                INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
                VALUES (?, 'regenerar_codigo_banner', 'banners', ?, ?, ?)
            ")->execute([$tokenData['id'] ?? null, $id, json_encode(['codigo_acceso' => $codigo]), $_SERVER['REMOTE_ADDR'] ?? null]);
            echo json_encode(['success' => true, 'message' => 'Código de acceso regenerado', 'codigo_acceso' => $codigo]);
            exit;
        }

        if ($accion === 'duplicar') {
            $stmt = $pdo->prepare("
                INSERT INTO banners
                    (anunciante, categoria, contacto, web, titulo, imagen_url, imagen_mobile_url, texto, enlace_url,
                     placement, lane, ciudad_id, fecha_inicio, fecha_fin, peso, orden, precio, moneda,
                     estado_pago, forma_pago, referencia_pago, estado, notas, creado_por)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?, ?)
            ");
            $stmt->execute([
                $actual['anunciante'], $actual['categoria'], $actual['contacto'], $actual['web'],
                $actual['titulo'] . ' (copia)', $actual['imagen_url'], $actual['imagen_mobile_url'],
                $actual['texto'], $actual['enlace_url'], $actual['placement'], $actual['lane'], $actual['ciudad_id'],
                $actual['fecha_inicio'], $actual['fecha_fin'], $actual['peso'], $actual['orden'],
                $actual['precio'], $actual['moneda'], $actual['estado_pago'], $actual['forma_pago'],
                $actual['referencia_pago'], $actual['notas'], $tokenData['id'] ?? null,
            ]);
            $nuevoId = (int)$pdo->lastInsertId();
            $pdo->prepare("
                INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address)
                VALUES (?, 'duplicar_banner', 'banners', ?, ?, ?)
            ")->execute([$tokenData['id'] ?? null, $nuevoId, json_encode(['origen' => $id]), $_SERVER['REMOTE_ADDR'] ?? null]);
            echo json_encode(['success' => true, 'message' => 'Banner duplicado', 'id' => $nuevoId]);
            exit;
        }

        $updates = [];
        $values = [];

        $setIf = function (string $column, $value, bool $isset) use (&$updates, &$values) {
            if ($isset) {
                $updates[] = "$column = ?";
                $values[] = $value;
            }
        };

        $setIf('anunciante', trim((string)($input['anunciante'] ?? $actual['anunciante'])), isset($input['anunciante']));
        $setIf('titulo', trim((string)($input['titulo'] ?? $actual['titulo'])), isset($input['titulo']));
        $setIf('contacto', trim((string)($input['contacto'] ?? '')), isset($input['contacto']));
        $setIf('web', banners_url_segura((string)($input['web'] ?? '')), isset($input['web']));
        $setIf('texto', trim((string)($input['texto'] ?? '')), isset($input['texto']));
        $setIf('imagen_url', trim((string)($input['imagen_url'] ?? $actual['imagen_url'])), isset($input['imagen_url']));
        $setIf('imagen_mobile_url', trim((string)($input['imagen_mobile_url'] ?? '')), isset($input['imagen_mobile_url']));
        $setIf('notas', trim((string)($input['notas'] ?? '')), isset($input['notas']));
        $setIf('referencia_pago', trim((string)($input['referencia_pago'] ?? '')), isset($input['referencia_pago']));
        $setIf('ciudad_id', intval($input['ciudad_id'] ?? 0) > 0 ? intval($input['ciudad_id']) : null, isset($input['ciudad_id']));
        $setIf('peso', max(1, intval($input['peso'] ?? 10)), isset($input['peso']));
        $setIf('orden', intval($input['orden'] ?? 0), isset($input['orden']));
        $setIf('precio', floatval($input['precio'] ?? 0), isset($input['precio']));
        $setIf('moneda', substr(trim((string)($input['moneda'] ?? 'CLP')), 0, 3) ?: 'CLP', isset($input['moneda']));
        $setIf('fecha_inicio', trim((string)($input['fecha_inicio'] ?? $actual['fecha_inicio'])), isset($input['fecha_inicio']));
        $setIf('fecha_fin', trim((string)($input['fecha_fin'] ?? $actual['fecha_fin'])), isset($input['fecha_fin']));

        if (isset($input['categoria']) && in_array($input['categoria'], $CATEGORIAS, true)) {
            $updates[] = 'categoria = ?';
            $values[] = $input['categoria'];
        }
        if (isset($input['placement']) && isset($PLACEMENTS[$input['placement']])) {
            $updates[] = 'placement = ?';
            $values[] = $input['placement'];
        }
        if (isset($input['lane'])) {
            $updates[] = 'lane = ?';
            $values[] = max(1, intval($input['lane']));
        }
        if (isset($input['forma_pago']) && in_array($input['forma_pago'], $FORMAS_PAGO, true)) {
            $updates[] = 'forma_pago = ?';
            $values[] = $input['forma_pago'];
        }
        if (isset($input['estado_pago']) && in_array($input['estado_pago'], $ESTADOS_PAGO, true)) {
            $updates[] = 'estado_pago = ?';
            $values[] = $input['estado_pago'];
            if ($input['estado_pago'] === 'pagado' && empty($actual['pagado_en'])) {
                $updates[] = 'pagado_en = ?';
                $values[] = date('Y-m-d H:i:s');
            }
        }
        if (isset($input['estado']) && in_array($input['estado'], $ESTADOS, true)) {
            $updates[] = 'estado = ?';
            $values[] = $input['estado'];
            // Al activar sin código, se genera
            if ($input['estado'] === 'activo' && empty($actual['codigo_acceso'])) {
                $updates[] = 'codigo_acceso = ?';
                $values[] = banners_generar_codigo();
            }
        }
        if (isset($input['enlace_url'])) {
            $url = banners_url_segura((string)$input['enlace_url']);
            if ($url === '') {
                http_response_code(422);
                echo json_encode(['success' => false, 'error' => 'Revisa los datos', 'fieldErrors' => ['enlace_url' => 'El enlace debe empezar por http:// o https://']]);
                exit;
            }
            $updates[] = 'enlace_url = ?';
            $values[] = $url;
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Sin cambios']);
            exit;
        }

        // Exclusividad por carril (al editar fechas/ubicación/carril)
        $placementFinal = isset($input['placement']) && isset($PLACEMENTS[$input['placement']]) ? $input['placement'] : $actual['placement'];
        $laneFinal = isset($input['lane']) ? max(1, intval($input['lane'])) : (int)($actual['lane'] ?? 1);
        $desdeFinal = isset($input['fecha_inicio']) ? trim((string)$input['fecha_inicio']) : $actual['fecha_inicio'];
        $hastaFinal = isset($input['fecha_fin']) ? trim((string)$input['fecha_fin']) : $actual['fecha_fin'];
        $estadoFinal = isset($input['estado']) && in_array($input['estado'], $ESTADOS, true) ? $input['estado'] : $actual['estado'];

        if ($estadoFinal !== 'solicitud' && $estadoFinal !== 'rechazado' && $laneFinal <= banners_lanes($placementFinal)) {
            $conflictos = banners_conflictos($placementFinal, $laneFinal, $desdeFinal, $hastaFinal, $id);
            if ($conflictos && empty($input['forzar'])) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error' => 'Este espacio ya está ocupado en esas fechas',
                    'conflictos' => $conflictos,
                    'puedeForzar' => true,
                ]);
                exit;
            }
            if ($conflictos && !empty($input['forzar'])) {
                foreach ($conflictos as $c) {
                    $pdo->prepare("UPDATE banners SET estado = 'pausado' WHERE id = ?")->execute([(int)$c['id']]);
                    $pdo->prepare("
                        INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address)
                        VALUES (?, 'tomar_lugar_banner', 'banners', ?, ?, ?)
                    ")->execute([
                        $tokenData['id'] ?? null, (int)$c['id'],
                        json_encode($c, JSON_UNESCAPED_UNICODE),
                        $_SERVER['REMOTE_ADDR'] ?? null,
                    ]);
                }
            }
        }


        $values[] = $id;
        $stmt = $pdo->prepare("UPDATE banners SET " . implode(', ', $updates) . " WHERE id = ?");
        $stmt->execute($values);

        $pdo->prepare("
            INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, ip_address)
            VALUES (?, 'actualizar_banner', 'banners', ?, ?, ?, ?)
        ")->execute([
            $tokenData['id'] ?? null,
            $id,
            json_encode($actual, JSON_UNESCAPED_UNICODE),
            json_encode($input, JSON_UNESCAPED_UNICODE),
            $_SERVER['REMOTE_ADDR'] ?? null,
        ]);

        $row = $pdo->prepare("SELECT codigo_acceso, estado FROM banners WHERE id = ?");
        $row->execute([$id]);
        $rowData = $row->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'message' => 'Banner actualizado',
            'codigo_acceso' => $rowData['codigo_acceso'] ?? null,
        ]);
        exit;
    }

    // ============ DELETE ============
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no válido']);
            exit;
        }

        $check = $pdo->prepare("SELECT * FROM banners WHERE id = ?");
        $check->execute([$id]);
        $fila = $check->fetch(PDO::FETCH_ASSOC);
        if (!$fila) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No encontrado']);
            exit;
        }

        $pdo->prepare("DELETE FROM banners_stats WHERE banner_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM banners WHERE id = ?")->execute([$id]);

        $pdo->prepare("
            INSERT INTO logs_auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, ip_address)
            VALUES (?, 'eliminar_banner', 'banners', ?, ?, ?)
        ")->execute([
            $tokenData['id'] ?? null,
            $id,
            json_encode($fila, JSON_UNESCAPED_UNICODE),
            $_SERVER['REMOTE_ADDR'] ?? null,
        ]);

        echo json_encode(['success' => true, 'message' => 'Banner eliminado']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log('Error banners.php PDO: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log('Error banners.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
