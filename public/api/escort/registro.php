<?php
// public/api/escort/registro.php

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function generarSlug($str)
{
    $str = strtolower(trim($str));
    $str = str_replace(
        ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ñ', 'Ü'],
        ['a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u', 'n', 'u'],
        $str
    );
    $str = preg_replace('/[^a-z0-9]+/', '-', $str);
    return trim($str, '-');
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();

    $input = json_decode(file_get_contents('php://input'), true);

    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $passwordConfirm = $input['password_confirm'] ?? '';

    $errors = [];

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Email inválido';
    if (strlen($password) < 8) $errors['password'] = 'Mínimo 8 caracteres';
    if ($password !== $passwordConfirm) $errors['confirmPassword'] = 'Las contraseñas no coinciden';

    // Generar usuario automáticamente desde el email
    $usuario = strstr($email, '@', true);
    $usuarioBase = $usuario;
    $suffix = 1;
    while (true) {
        $check = $pdo->prepare("SELECT id FROM escorts WHERE usuario = ?");
        $check->execute([$usuario]);
        if (!$check->fetch()) break;
        $usuario = $usuarioBase . $suffix;
        $suffix++;
    }

    // Verificar duplicado de email en ambas tablas
    $reactivarId = 0;
    $check = $pdo->prepare("SELECT id, usuario, eliminada FROM escorts WHERE email = ?");
    $check->execute([$email]);
    $escortExistente = $check->fetch(PDO::FETCH_ASSOC);
    if ($escortExistente) {
        if ((int)$escortExistente['eliminada'] === 1) {
            // Cuenta eliminada: se permite el re-registro reactivando la cuenta.
            // El plan gratuito queda bloqueado por email (planes_usados), por lo que
            // la escort deberá seleccionar un plan base de pago para volver a publicar.
            $reactivarId = (int)$escortExistente['id'];
            $usuario = $escortExistente['usuario'];
        } else {
            $errors['general'] = 'Email ya registrado';
        }
    }
    $checkUsr = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
    $checkUsr->execute([$email]);
    if ($checkUsr->fetch()) { $errors['general'] = 'Email ya registrado como usuario'; }

    if (!empty($errors)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'fieldErrors' => $errors]);
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $slug = generarSlug($usuario);

    if ($reactivarId > 0) {
        // Reactivar cuenta eliminada conservando su historial. La escort deberá
        // contratar un plan base de pago para volver a publicar (el gratis está bloqueado).
        $stmt = $pdo->prepare("
            UPDATE escorts
            SET eliminada = 0,
                activa = 0,
                aprobada = 0,
                estado = 'pendiente',
                primer_login = 1,
                verificado = 0,
                vip = 0,
                destacado = 0,
                sticky = 0,
                sticky_orden = 0,
                sticky_expira = NULL,
                fecha_vip_expira = NULL,
                fecha_destacado_expira = NULL,
                disponible_ahora = 0,
                en_gira = 0,
                gira_ciudad_id = NULL,
                gira_fecha_inicio = NULL,
                gira_fecha_fin = NULL,
                password_hash = ?,
                updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$hashedPassword, $reactivarId]);

        // Red de seguridad: cancelar planes activos/pendientes heredados del registro
        // anterior. El plan gratuito queda bloqueado por email y deberá contratar uno de pago.
        $pdo->prepare("UPDATE suscripciones SET estado = 'cancelada', actualizado_en = NOW() WHERE escort_id = ? AND estado IN ('activa', 'pendiente_aprobacion')")->execute([$reactivarId]);

        // Invalidar la verificación de identidad previa: al volver debe re-solicitarla
        // con una selfie/documento nuevos. Se conserva el historial (verificaciones) para auditoría.
        $pdo->prepare("
            UPDATE verificaciones
            SET estado = 'rechazada', notas_revision = COALESCE(CONCAT(notas_revision, ' | Reactivación de cuenta: se solicita nueva verificación.'), 'Reactivación de cuenta: se solicita nueva verificación.')
            WHERE escort_id = ? AND estado IN ('pendiente', 'en_revision', 'aprobada')
        ")->execute([$reactivarId]);

        // El tour guiado vuelve a mostrarse al reingresar (solo si la columna existe)
        $colTour = $pdo->prepare("
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escorts' AND COLUMN_NAME = 'tour_completado'
        ");
        $colTour->execute();
        if ((int)$colTour->fetchColumn() > 0) {
            $pdo->prepare("UPDATE escorts SET tour_completado = 0 WHERE id = ?")->execute([$reactivarId]);
        }

        $newId = $reactivarId;
        $esReactivacion = true;
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO escorts (usuario, email, password_hash, nombre, slug, edad, activa, aprobada, estado, primer_login, created_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'pendiente', 1, NOW())
        ");
        $stmt->execute([$usuario, $email, $hashedPassword, $usuario, $slug]);
        $newId = $pdo->lastInsertId();
        $esReactivacion = false;
    }

    $tokenData = [
        'id' => $newId,
        'usuario' => $usuario,
        'tipo' => 'escort',
        'exp' => time() + (7 * 24 * 60 * 60)
    ];
    $token = signToken($tokenData);

    $af = $pdo->prepare("SELECT foto_principal FROM escorts WHERE id = ?");
    $af->execute([$newId]);

    $notifMsg = $esReactivacion
        ? "Escort reactivada al re-registrarse: {$usuario} (" . ($af->fetchColumn() ?: 'sin foto') . ")"
        : "Nueva escort registrada: {$usuario} (" . ($af->fetchColumn() ?: 'sin foto') . ")";
    $notif = $pdo->prepare("INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url, escort_id) VALUES (NULL, 'sistema', '" . ($esReactivacion ? 'Escort reactivada' : 'Nueva escort registrada') . "', ?, '/admin/escorts', ?)");
    $notif->execute([$notifMsg, $newId]);

    $pdo->prepare("INSERT INTO logs_auditoria (escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address, user_agent, created_at) VALUES (?, ?, 'escorts', ?, ?, ?, ?, NOW())")
        ->execute([
            $newId,
            $esReactivacion ? 'reactivar_escort_registro' : 'nueva_escort',
            $newId,
            json_encode(['nombre' => $usuario, 'reactivacion' => $esReactivacion]),
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

    require_once __DIR__ . '/../mail.php';
    try {
        $body = $esReactivacion
            ? '<p>Se ha reactivado una escort al re-registrarse en la plataforma:</p>'
            : '<p>Se ha registrado una nueva escort en la plataforma:</p>';
        $body .= '<table class="info">';
        $body .= '<tr><td>Usuario:</td><td>' . htmlspecialchars($usuario, ENT_QUOTES, 'UTF-8') . '</td></tr>';
        $body .= '<tr><td>Email:</td><td>' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</td></tr>';
        $body .= '</table>';
        $body .= '<p>La cuenta está pendiente de aprobación. Revisa sus datos y activa su anuncio cuando corresponda.</p>';
        $body .= '<p style="text-align:center;margin-top:24px"><a class="btn" href="' . SITE_URL . '/admin/escorts">Ver escorts</a></p>';
        sendAdminNotification('inscripciones', $esReactivacion ? 'Escort reactivada' : 'Nueva escort registrada', $body);
    } catch (\Throwable $e2) {
        error_log("registro.php notify error: " . $e2->getMessage());
    }

    sendWelcomeEscort($email, $usuario);

    echo json_encode([
        'success' => true,
        'token' => $token,
        'escort' => [
            'id' => (int)$newId,
            'usuario' => $usuario,
            'email' => $email,
        ],
        'message' => $esReactivacion
            ? 'Cuenta reactivada. Ya usaste tu plan gratuito, así que deberás seleccionar un plan de pago para publicar tu anuncio.'
            : 'Cuenta creada. Completa tu perfil para activar tu anuncio.'
    ]);
} catch (Throwable $e) {
    error_log("Error registro.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
