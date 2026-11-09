<?php
require_once __DIR__ . '/../bootstrap.php'; // early bootstrap para verifyToken
// public/api/escort/solicitar-verificacion.php
header('Content-Type: application/json');

if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return strpos($haystack, $needle) === 0;
    }
}

try {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'No autorizado']);
        exit;
    }

    $token = substr($authHeader, 7);
    $tokenData = verifyEscortToken($token);

    if (!$tokenData || ($tokenData['exp'] ?? 0) < time()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token expirado']);
        exit;
    }

    $escortId = $tokenData['id'] ?? 0;
    if ($escortId <= 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Token inválido']);
        exit;
    }

require_once __DIR__ . '/../bootstrap.php';

$pdo = getDBConnection();

    // === VERIFICAR PERMISO POR PLAN ===
    // Manda la ÚLTIMA suscripción base (igual que resumen/panel). Mensaje
    // específico por caso para no confundir "plan sin permiso" con
    // "plan no vigente".
    $verifPlanStmt = $pdo->prepare("
        SELECT p.permite_verificacion, s.estado, s.fecha_fin
        FROM suscripciones s
        JOIN planes p ON p.id = s.plan_id
        WHERE s.escort_id = ? AND (p.tipo = 'base' OR p.tipo IS NULL)
        ORDER BY s.creado_en DESC, s.id DESC
        LIMIT 1
    ");
    $verifPlanStmt->execute([$escortId]);
    $verifPlan = $verifPlanStmt->fetch(PDO::FETCH_ASSOC);

    if (!$verifPlan) {
        echo json_encode(['success' => false, 'error' => 'No tienes un plan base. Contrata un plan primero.']);
        exit;
    }

    if ($verifPlan['estado'] === 'pendiente_aprobacion') {
        echo json_encode(['success' => false, 'error' => 'Tu plan base está pendiente de aprobación. Espera la aprobación antes de solicitar la verificación.']);
        exit;
    }

    if ($verifPlan['estado'] === 'pausada') {
        echo json_encode(['success' => false, 'error' => 'Tu plan está pausado. Reactívalo antes de solicitar la verificación.']);
        exit;
    }

    if (empty($verifPlan['fecha_fin']) || $verifPlan['fecha_fin'] < date('Y-m-d') || $verifPlan['estado'] !== 'activa') {
        echo json_encode(['success' => false, 'error' => 'Tu plan base ha vencido. Contrata un nuevo plan para solicitar la verificación.']);
        exit;
    }

    if ((int)$verifPlan['permite_verificacion'] !== 1) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Tu plan actual no permite solicitar la verificación.']);
        exit;
    }

    // === PROCESAR ARCHIVOS ===
    $tiposImg = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    $esJson = stripos($contentType, 'application/json') !== false;

    if ($esJson) {
        $rawInput = file_get_contents('php://input');
        $decodedInput = json_decode($rawInput, true);
        if (!is_array($decodedInput)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'JSON invalido']);
            exit;
        }

        $rutaPerfilRaw = $decodedInput['foto_perfil'] ?? null;
        $rutaPerfilRel = verificacion_foto_path(is_string($rutaPerfilRaw) ? $rutaPerfilRaw : null, $escortId);
        $rutaPerfilFs = $rutaPerfilRel ? __DIR__ . '/../../' . $rutaPerfilRel : '';

        if (!$rutaPerfilRel || !is_file($rutaPerfilFs) || !validarMIME($rutaPerfilFs, $tiposImg)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Debes subir la foto de perfil (selfie)']);
            exit;
        }

        $rutaPerfil = '/' . $rutaPerfilRel;
    } else {
        $fotoPerfil = $_FILES['foto_perfil'] ?? null;

        if (!$fotoPerfil || $fotoPerfil['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(['success' => false, 'error' => 'Debes subir la foto de perfil (selfie)']);
            exit;
        }

        if ($fotoPerfil['size'] > 5 * 1024 * 1024) {
            echo json_encode(['success' => false, 'error' => 'El archivo no puede superar 5MB']);
            exit;
        }

        if (!validarMIME($fotoPerfil['tmp_name'], $tiposImg)) {
            echo json_encode(['success' => false, 'error' => 'El archivo debe ser una imagen (JPG, PNG, WebP o GIF)']);
            exit;
        }

        // === CREAR CARPETA POR ESCORT ID ===
        $uploadDir = __DIR__ . '/../../uploads/verificaciones/' . $escortId . '/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Generar nombres (extension restringida a tipos de imagen validados)
        $extPermitidas = ['jpg' => 'jpg', 'jpeg' => 'jpg', 'png' => 'png', 'webp' => 'webp', 'gif' => 'gif'];
        $extPerfil = $extPermitidas[strtolower(pathinfo($fotoPerfil['name'], PATHINFO_EXTENSION))] ?? '';
        if ($extPerfil === '') {
            echo json_encode(['success' => false, 'error' => 'Extension de imagen no permitida']);
            exit;
        }

        $nombrePerfil = date('Ymd_His') . '_perfil_' . uniqid() . '.' . $extPerfil;
        $rutaPerfilFs = $uploadDir . $nombrePerfil;
        $rutaPerfil = '/uploads/verificaciones/' . $escortId . '/' . $nombrePerfil;

        if (!move_uploaded_file($fotoPerfil['tmp_name'], $rutaPerfilFs)) {
            throw new Exception('Error subiendo foto de perfil');
        }
    }

    // === GUARDAR EN BD ===

    $stmt = $pdo->prepare("SELECT id, estado, foto_perfil_real FROM verificaciones WHERE escort_id = ? AND estado IN ('pendiente', 'en_revision', 'rechazada', 'aprobada') ORDER BY FIELD(estado, 'pendiente', 'en_revision', 'rechazada', 'aprobada') LIMIT 1");
    $stmt->execute([$escortId]);
    $existente = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existente) {
        $nuevoEstado = ($existente['estado'] === 'aprobada') ? 'aprobada' : 'pendiente';
        $stmt = $pdo->prepare("
            UPDATE verificaciones 
            SET estado = ?,
                foto_perfil_real = ?,
                notas_revision = NULL,
                revisado_por = NULL,
                revisado_en = NULL,
                creado_en = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$nuevoEstado, $rutaPerfil, $existente['id']]);
        $verifId = $existente['id'];
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO verificaciones 
            (escort_id, foto_perfil_real, foto_documento, estado, creado_en) 
            VALUES (?, ?, '', 'pendiente', NOW())
        ");
        $stmt->execute([$escortId, $rutaPerfil]);
        $verifId = $pdo->lastInsertId();
    }

    $fotoAnterior = ($existente ? (string)($existente['foto_perfil_real'] ?? '') : '');
    $rutaAnterior = ltrim($fotoAnterior, '/');
    $rutaNueva = ltrim($rutaPerfil, '/');
    if ($rutaAnterior !== '' && $rutaAnterior !== $rutaNueva) {
        $archivoAnterior = __DIR__ . '/../../' . $rutaAnterior;
        $carpetaEscort = realpath(__DIR__ . '/../../uploads/verificaciones/' . $escortId);
        $archivoAnteriorReal = realpath($archivoAnterior);
        if ($carpetaEscort && $archivoAnteriorReal) {
            $carpetaNormalizada = str_replace('\\', '/', $carpetaEscort) . '/';
            if (str_starts_with(str_replace('\\', '/', $archivoAnteriorReal), $carpetaNormalizada)) {
                @unlink($archivoAnteriorReal);
            }
        }
    }

    require_once __DIR__ . '/../mail.php';
    try {
        $esc = $pdo->prepare("SELECT nombre FROM escorts WHERE id = ?");
        $esc->execute([$escortId]);
        $escName = $esc->fetchColumn() ?: "ID {$escortId}";
        $body = '<p>Una escort ha enviado una <strong style="color:#ffffff">solicitud de verificación de identidad</strong>:</p>';
        $body .= '<table class="info">';
        $body .= '<tr><td>Escort:</td><td>' . htmlspecialchars($escName, ENT_QUOTES, 'UTF-8') . '</td></tr>';
        $body .= '</table>';
        $body .= '<p>Revisa la foto de perfil real y aprueba o rechaza la solicitud.</p>';
        $body .= '<p style="text-align:center;margin-top:24px"><a class="btn" href="' . SITE_URL . '/admin/verificaciones">Revisar solicitud</a></p>';
        sendAdminNotification('verificaciones', 'Nueva solicitud de verificación', $body);
    } catch (\Throwable $e2) {
        error_log("solicitar-verificacion notify error: " . $e2->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => 'Solicitud enviada correctamente',
        'verificacion_id' => $verifId
    ]);
} catch (Exception $e) {
    error_log("Error solicitar-verificacion: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
