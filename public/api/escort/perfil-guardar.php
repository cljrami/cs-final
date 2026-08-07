<?php
// public/api/escort/perfil-guardar.php

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

    if (substr($authHeader, 0, 7) !== 'Bearer ') {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyToken($token);

    if (!$tokenData || (isset($tokenData['exp']) ? $tokenData['exp'] : 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = $tokenData['id'];

    // Verificar que la escort existe
    $checkStmt = $pdo->prepare("
        SELECT e.id, e.activa, s.id AS suscripcion_id, s.plan_id
        FROM escorts e
        LEFT JOIN suscripciones s ON s.escort_id = e.id
            AND s.estado IN ('activa', 'pausada', 'pendiente_aprobacion')
        WHERE e.id = ? AND e.eliminada = 0
        ORDER BY s.id DESC LIMIT 1
    ");
    $checkStmt->execute([$escortId]);
    $escortActual = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$escortActual) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Escort no encontrada']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
        exit;
    }

    $fieldErrors = [];

    // Validaciones
    $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
    if (empty($nombre)) {
        $fieldErrors['nombre'] = 'Nombre artístico requerido';
    } elseif (strlen($nombre) > 100) {
        $fieldErrors['nombre'] = 'Máximo 100 caracteres';
    }

    $edad = isset($input['edad']) ? (int)$input['edad'] : 0;
    if ($edad < 18) {
        $fieldErrors['edad'] = 'Debes ser mayor de 18';
    }

    $ciudadId = isset($input['ciudadId']) ? (int)$input['ciudadId'] : 0;
    if ($ciudadId <= 0) {
        $fieldErrors['ciudad'] = 'Selecciona una ciudad';
    }

    $servicios = isset($input['servicios']) && is_array($input['servicios']) ? $input['servicios'] : [];
    if (empty($servicios)) {
        $fieldErrors['servicios'] = 'Selecciona al menos un servicio';
    }

    if (!empty($fieldErrors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors]);
        exit;
    }

    // Validar gira
    $enGira = isset($input['enGira']) ? (int)$input['enGira'] : 0;
    $giraCiudadId = $enGira && isset($input['giraCiudadId']) && $input['giraCiudadId'] !== '' ? (int)$input['giraCiudadId'] : null;
    $giraFechaInicio = $enGira && isset($input['giraFechaInicio']) && $input['giraFechaInicio'] !== '' ? $input['giraFechaInicio'] : null;
    $giraFechaFin = $enGira && isset($input['giraFechaFin']) && $input['giraFechaFin'] !== '' ? $input['giraFechaFin'] : null;

    // Obtener nombre de ciudad
    $ciudadStmt = $pdo->prepare("SELECT nombre FROM ciudades WHERE id = ? AND activa = 1");
    $ciudadStmt->execute([$ciudadId]);
    $ciudadNombre = $ciudadStmt->fetchColumn();

    if (!$ciudadNombre) {
        $fieldErrors['ciudad'] = 'Ciudad no válida';
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors]);
        exit;
    }

    // Validar categoría
    $categoriaId = isset($input['categoriaId']) && $input['categoriaId'] !== '' ? (int)$input['categoriaId'] : null;

    // Privacidad (campos a ocultar)
    $privacidad = isset($input['privacidad']) && is_array($input['privacidad']) ? $input['privacidad'] : [];

    // Actualizar datos básicos + gira
    $updateStmt = $pdo->prepare("
        UPDATE escorts SET
            nombre = ?,
            edad = ?,
            altura = ?,
            peso = ?,
            medidas = ?,
            ciudad = ?,
            categoria_id = ?,
            nacionalidad = ?,
            etnia = ?,
            color_ojos = ?,
            color_pelo = ?,
            orientacion = ?,
            estilo = ?,
            whatsapp = ?,
            telefono = ?,
            descripcion_corta = ?,
            descripcion_larga = ?,
            privacidad = ?,
            en_gira = ?,
            gira_ciudad_id = ?,
            gira_fecha_inicio = ?,
            gira_fecha_fin = ?,
            updated_at = NOW()
        WHERE id = ?
    ");

    $updateStmt->execute([
        $nombre,
        $edad,
        isset($input['altura']) && $input['altura'] !== '' ? (int)$input['altura'] : null,
        isset($input['peso']) && $input['peso'] !== '' ? (int)$input['peso'] : null,
        isset($input['medidas']) ? trim($input['medidas']) : null,
        $ciudadNombre,
        $categoriaId,
        isset($input['nacionalidad']) ? trim($input['nacionalidad']) : null,
        isset($input['etnia']) ? trim($input['etnia']) : null,
        isset($input['color_ojos']) ? trim($input['color_ojos']) : null,
        isset($input['color_pelo']) ? trim($input['color_pelo']) : null,
        isset($input['orientacion']) ? trim($input['orientacion']) : null,
        isset($input['estilo']) ? trim($input['estilo']) : null,
        isset($input['whatsapp']) ? trim($input['whatsapp']) : null,
        isset($input['telefono']) ? trim($input['telefono']) : null,
        isset($input['descripcionCorta']) ? trim($input['descripcionCorta']) : null,
        isset($input['descripcionLarga']) ? trim($input['descripcionLarga']) : null,
        !empty($privacidad) ? json_encode($privacidad) : null,
        $enGira,
        $giraCiudadId,
        $giraFechaInicio,
        $giraFechaFin,
        $escortId
    ]);

    // Eliminar servicios actuales
    $pdo->prepare("DELETE FROM escort_servicios WHERE escort_id = ?")->execute([$escortId]);

    // Insertar nuevos servicios con tipo (incluido/adicional)
    if (!empty($servicios)) {
        $insertServicio = $pdo->prepare("
            INSERT INTO escort_servicios (escort_id, servicio_id, incluido)
            VALUES (?, ?, ?)
        ");
        foreach ($servicios as $servicio) {
            $servicioId = 0;
            $incluido = 1;

            if (is_array($servicio)) {
                $servicioId = isset($servicio['id']) ? (int)$servicio['id'] : 0;
                $incluido = isset($servicio['incluido']) ? (int)$servicio['incluido'] : 1;
            } else {
                $servicioId = (int)$servicio;
            }

            if ($servicioId > 0) {
                $insertServicio->execute([$escortId, $servicioId, $incluido]);
            }
        }
    }

    // Eliminar idiomas actuales y re-insertar los seleccionados
    $idiomas = isset($input['idiomas']) && is_array($input['idiomas']) ? $input['idiomas'] : [];
    $pdo->prepare("DELETE FROM escort_idiomas WHERE escort_id = ?")->execute([$escortId]);

    if (!empty($idiomas)) {
        $insertIdioma = $pdo->prepare("INSERT INTO escort_idiomas (escort_id, idioma_id) VALUES (?, ?)");
        foreach ($idiomas as $idiomaItem) {
            $idiomaId = is_array($idiomaItem) ? (int) ($idiomaItem['id'] ?? 0) : (int) $idiomaItem;
            if ($idiomaId > 0) {
                $insertIdioma->execute([$escortId, $idiomaId]);
            }
        }
    }

    // ───────────────────────────────────────────────
    // DETERMINAR ESTADO DE PUBLICACIÓN
    // ───────────────────────────────────────────────
    $estadoPublicacion = 'pendiente_perfil';
    $mensajeProximoPaso = 'Selecciona tu plan y realiza el pago para activar tu publicación';

    // Si tiene plan y suscripción, verificar si está aprobada
    if ($escortActual['plan_id'] && $escortActual['suscripcion_id']) {
        $susStmt = $pdo->prepare("
            SELECT fecha_aprobacion, estado, fecha_fin 
            FROM suscripciones 
            WHERE id = ? AND escort_id = ?
        ");
        $susStmt->execute([$escortActual['suscripcion_id'], $escortId]);
        $suscripcion = $susStmt->fetch(PDO::FETCH_ASSOC);

        if ($suscripcion) {
            if ($suscripcion['fecha_aprobacion'] === null) {
                $estadoPublicacion = 'pendiente_aprobacion';
                $mensajeProximoPaso = 'Tu pago está en revisión. Te notificaremos cuando sea aprobado.';
            } elseif ($suscripcion['estado'] === 'activa' && $suscripcion['fecha_fin'] >= date('Y-m-d')) {
                if ($escortActual['activa'] == 1) {
                    $estadoPublicacion = 'activa';
                    $mensajeProximoPaso = 'Tu publicación está activa y visible.';
                } else {
                    $estadoPublicacion = 'pendiente_aprobacion';
                    $mensajeProximoPaso = 'Esperando activación final del administrador.';
                }
            } else {
                $estadoPublicacion = 'expirada';
                $mensajeProximoPaso = 'Tu plan ha expirado. Renueva para volver a aparecer.';
            }
        }
    }

    // Notificar a administradores que la escort actualizó su perfil
    $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id) VALUES (NULL, 'sistema', 'Perfil actualizado', ?, '/admin/escorts', ?)")
        ->execute(["{$nombre} actualizó su perfil.", $escortId]);

    $pdo->prepare("INSERT INTO logs_auditoria (escort_id, accion, tabla_afectada, datos_nuevos, ip_address, user_agent, created_at) VALUES (?, 'perfil_actualizado', 'escorts', ?, ?, ?, NOW())")
        ->execute([
            $escortId,
            json_encode(['ciudad' => $ciudadNombre, 'edad' => $edad]),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

    require_once __DIR__ . '/../mail.php';
    notificarAccionEscort('perfil', $escortId, $nombre . ' actualizó su perfil', [
        'Ciudad' => $ciudadNombre,
        'Edad' => $edad > 0 ? $edad : '—',
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Perfil actualizado correctamente',
        'estado_publicacion' => $estadoPublicacion,
        'proximo_paso' => $mensajeProximoPaso
    ]);
} catch (Throwable $e) {
    error_log("Error perfil-guardar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
