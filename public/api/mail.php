<?php
// public/api/mail.php
// Librería central de envío de correos. Todas las helpers son no-fatales:
// capturan sus propios errores y los registran con error_log() sin
// interrumpir el flujo del endpoint que las invoca.

if (!defined('MAIL_FROM')) define('MAIL_FROM', 'nocontestar@consexvip.cl');
if (!defined('MAIL_FROM_NAME')) define('MAIL_FROM_NAME', 'ConsexVIP - No responder');
if (!defined('SITE_NAME')) define('SITE_NAME', 'ConsexVIP');
if (!defined('SITE_URL')) define('SITE_URL', 'https://www.consexvip.cl');
if (!defined('SITE_LOGO_URL')) define('SITE_LOGO_URL', 'https://www.consexvip.cl/favicon.svg');

/**
 * Cabecera HTML compartida para todos los correos.
 */
function mailHeader(string $title = ''): string
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $logo = SITE_LOGO_URL;
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . $safeTitle . '</title><style>body{margin:0;padding:0;background-color:#0a0a0f;font-family:Arial,Helvetica,sans-serif}p{color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 12px 0}strong{color:#ffffff}a{color:#ef4444;text-decoration:none;font-weight:600}table.info{width:100%;background:#0f0f1a;border-radius:12px;padding:16px;margin:16px 0;border-collapse:collapse}table.info td{color:#9ca3af;padding:4px 0}table.info td:last-child{color:#ffffff;font-weight:600}ul,ol{color:#d1d5db;padding-left:20px;margin:12px 0}li{margin:4px 0}.btn{display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px}.fallback{color:#6b7280;font-size:12px;word-break:break-all;margin:8px 0 0 0}.warning{color:#9ca3af;font-size:13px;margin:8px 0 0 0}.text-center{text-align:center}.text-green{color:#22c55e}.text-red{color:#ef4444}.text-amber{color:#fbbf24}</style></head><body style="margin:0;padding:0;background-color:#0a0a0f;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%"><tr><td style="background:#16161f;border-radius:16px;padding:40px;border:1px solid #2a2a3e"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;padding-bottom:24px"><h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700">' . $safeTitle . '</h1></td></tr><tr><td style="color:#9ca3af;font-size:15px;line-height:1.6">';
}

/**
 * Pie HTML compartido para todos los correos.
 */
function mailFooter(): string
{
    $site = htmlspecialchars(SITE_URL, ENT_QUOTES, 'UTF-8');
    $siteName = htmlspecialchars(SITE_NAME, ENT_QUOTES, 'UTF-8');
    return '</td></tr><tr><td style="text-align:center;padding-top:32px;border-top:1px solid #2a2a3e;margin-top:24px"><p style="color:#6b7280;font-size:12px;margin:0">' . $siteName . ' &copy; ' . date('Y') . '</p><p style="color:#4b5563;font-size:11px;margin:4px 0 0 0"><a href="' . $site . '" style="color:#6b7280;">' . $site . '</a></p></td></tr></table></td></tr></table></body></html>';
}

/**
 * Remitente: primero configuracion (admin email-config), luego constantes.
 */
function mailSender(): array
{
    $from = MAIL_FROM;
    $fromName = MAIL_FROM_NAME;
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->query("SELECT clave, valor FROM configuracion WHERE clave IN ('email_from', 'email_from_name')");
        if ($stmt) {
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if ($row['clave'] === 'email_from' && filter_var($row['valor'], FILTER_VALIDATE_EMAIL)) $from = $row['valor'];
                elseif ($row['clave'] === 'email_from_name' && $row['valor'] !== '') $fromName = $row['valor'];
            }
        }
    } catch (Throwable $e) {
        error_log('mail.php mailSender error: ' . $e->getMessage());
    }
    return [$from, $fromName];
}

/**
 * Envío de bajo nivel. Devuelve true si el MTA aceptó el mensaje.
 * Nunca lanza excepciones.
 */
function sendMail(string $to, string $subject, string $html): bool
{
    try {
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            error_log("mail.php sendMail: email destino inválido: {$to}");
            return false;
        }
        [$from, $fromName] = mailSender();
        $encodedName = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
        $eol = "\r\n";
        $headers =
            'MIME-Version: 1.0' . $eol .
            'Content-type: text/html; charset=UTF-8' . $eol .
            'From: ' . $encodedName . ' <' . $from . '>' . $eol .
            'Reply-To: ' . $from . $eol .
            'X-Mailer: PHP/' . phpversion();
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $params = '-f' . $from;
        $ok = @mail($to, $encodedSubject, $html, $headers, $params);
        if (!$ok) {
            // Algunos hostings rechazan el parámetro additional_params
            $ok = @mail($to, $encodedSubject, $html, $headers);
        }
        if (!$ok) {
            error_log("mail.php sendMail: fallo al enviar a {$to} asunto: {$subject}");
        }
        return (bool)$ok;
    } catch (Throwable $e) {
        error_log('mail.php sendMail error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Emails de destino de las notificaciones de administración
 * (configuracion.admin_notify_emails, separados por coma).
 */
function getAdminNotifyEmails(): array
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT valor FROM configuracion WHERE clave = 'admin_notify_emails' LIMIT 1");
        $stmt->execute();
        $valor = $stmt->fetchColumn();
        if (!$valor) {
            // Fallback por defecto para reactivar notificaciones
            $valor = 'admin@consexvip.cl';
        }
        $emails = [];
        foreach (explode(',', $valor) as $e) {
            $e = trim($e);
            if ($e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL)) $emails[] = $e;
        }
        return array_values(array_unique($emails));
    } catch (Throwable $e) {
        error_log('mail.php getAdminNotifyEmails error: ' . $e->getMessage());
        // Fallback seguro
        return ['admin@consexvip.cl'];
    }
}

/**
 * Plantilla de la tabla email_templates (o null si no existe).
 */
function getMailTemplate(string $codigo): ?array
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT codigo, nombre, asunto, cuerpo_html FROM email_templates WHERE codigo = ? LIMIT 1");
        $stmt->execute([$codigo]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    } catch (Throwable $e) {
        error_log('mail.php getMailTemplate error: ' . $e->getMessage());
        return null;
    }
}

/**
 * Render de una plantilla con variables {{var}}. Si la plantilla no
 * existe en la BD usa el HTML de respaldo entregado como tercer parámetro.
 */
function applyMailTemplate(string $codigo, array $vars, ?string $fallbackHtml = null, array $fallback = ['asunto' => '', 'nombre' => '']): array
{
    $tpl = getMailTemplate($codigo);
    if ($tpl) {
        $html = $tpl['cuerpo_html'];
        foreach ($vars as $k => $v) {
            $html = str_replace('{{' . $k . '}}', $v, $html);
        }
        $subject = $tpl['asunto'];
    } else {
        $html = (string)$fallbackHtml;
        $subject = $fallback['asunto'];
    }
    return ['html' => $html, 'asunto' => $subject, 'encontrada' => (bool)$tpl];
}

/**
 * Notificación al equipo de administración.
 * $tipo: clave de evento (inscripciones, pagos, verificaciones, reportes,
 * comentarios, favoritos, contacto, perfiles, fotos, historias, planes,
 * disponibilidad, cuentas, codigos, usuarios).
 */
function sendAdminNotification(string $tipo, string $titulo, string $bodyHtml): bool
{
    try {
        $emails = getAdminNotifyEmails();
        if (empty($emails)) {
            error_log("mail.php sendAdminNotification: sin emails configurados para notificar '{$tipo}'");
            return false;
        }
        // Toggle por evento (configuracion.notify_{tipo}); por defecto activo.
        $toggleKey = 'notify_' . $tipo;
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->prepare("SELECT valor FROM configuracion WHERE clave = ? LIMIT 1");
            $stmt->execute([$toggleKey]);
            $valor = $stmt->fetchColumn();
            if ($valor !== false && $valor !== null && $valor !== '') {
                $activo = in_array(strtolower(trim($valor)), ['1', 'true', 'si', 'on'], true);
                if (!$activo) return false;
            }
        } catch (Throwable $e) {
            error_log('mail.php sendAdminNotification toggle error: ' . $e->getMessage());
        }

        $html = mailHeader($titulo);
        $html .= $bodyHtml;
        $html .= mailFooter();
        $ok = true;
        foreach ($emails as $email) {
            if (!sendMail($email, SITE_NAME . ' - ' . $titulo, $html)) $ok = false;
        }
        return $ok;
    } catch (Throwable $e) {
        error_log('mail.php sendAdminNotification error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Notificación generada a partir de un arreglo etiqueta => valor.
 */
function notificarAccionUsuario(string $tipo, ?int $usuarioId, string $titulo, array $datos = []): bool
{
    try {
        $body = '<p>Acción: <strong style="color:#ffffff">' . htmlspecialchars($titulo, ENT_QUOTES, 'UTF-8') . '</strong></p>';
        if (!empty($datos)) {
            $body .= '<table class="info"><tr><td style="width:140px">Detalle</td><td style="font-weight:normal"></td></tr>';
            foreach ($datos as $etiqueta => $valor) {
                $body .= '<tr><td>' . htmlspecialchars((string)$etiqueta, ENT_QUOTES, 'UTF-8') . '</td><td>' . htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8') . '</td></tr>';
            }
            $body .= '</table>';
        }
        if ($usuarioId !== null) {
            $body .= '<p class="fallback">Usuario ID: ' . (int)$usuarioId . '</p>';
        }
        return sendAdminNotification($tipo, $titulo, $body);
    } catch (Throwable $e) {
        error_log('mail.php notificarAccionUsuario error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Igual que notificarAccionUsuario pero para acciones realizadas por escorts.
 */
function notificarAccionEscort(string $tipo, ?int $escortId, string $titulo, array $datos = []): bool
{
    try {
        $body = '<p>Acción: <strong style="color:#ffffff">' . htmlspecialchars($titulo, ENT_QUOTES, 'UTF-8') . '</strong></p>';
        if (!empty($datos)) {
            $body .= '<table class="info"><tr><td style="width:140px">Detalle</td><td style="font-weight:normal"></td></tr>';
            foreach ($datos as $etiqueta => $valor) {
                $body .= '<tr><td>' . htmlspecialchars((string)$etiqueta, ENT_QUOTES, 'UTF-8') . '</td><td>' . htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8') . '</td></tr>';
            }
            $body .= '</table>';
        }
        if ($escortId !== null) {
            $body .= '<p class="fallback">Escort ID: ' . (int)$escortId . '</p>';
        }
        return sendAdminNotification($tipo, $titulo, $body);
    } catch (Throwable $e) {
        error_log('mail.php notificarAccionEscort error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Bienvenida a nueva escort (plantilla welcome_escort).
 */
function sendWelcomeEscort(string $email, string $nombre): bool
{
    try {
        $fallback = '<p>Hola <strong style="color:#ffffff">' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '</strong>,</p><p>Tu cuenta de escort ha sido creada exitosamente. Tus datos de acceso:</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border-radius:12px;padding:16px;margin:16px 0"><tr><td style="color:#9ca3af;padding:4px 0">Email:</td><td style="color:#ffffff;padding:4px 0;font-weight:600">' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</td></tr></table><p>Pasos para comenzar:</p><ol style="color:#d1d5db;padding-left:20px"><li>Completa tu perfil (fotos, descripción, servicios)</li><li>Selecciona un plan de suscripción</li><li>Espera la aprobación del administrador</li><li>Una vez aprobada, tu anuncio estará visible</li></ol><p style="margin-top:20px">Ingresa a tu panel desde <a href="' . SITE_URL . '/micuenta/login" style="color:#ef4444;text-decoration:none;font-weight:600">' . SITE_URL . '/micuenta/login</a></p>';
        $tpl = applyMailTemplate('welcome_escort', [
            'nombre' => htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8'),
            'email' => htmlspecialchars($email, ENT_QUOTES, 'UTF-8'),
            'site_url' => SITE_URL,
        ], $fallback, ['asunto' => 'Bienvenida a ConsexVIP - Panel de Escort', 'nombre' => 'Bienvenida Escort']);
        $full = mailHeader($tpl['asunto']) . $tpl['html'] . mailFooter();
        return sendMail($email, $tpl['asunto'], $full);
    } catch (Throwable $e) {
        error_log('mail.php sendWelcomeEscort error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Bienvenida a nuevo usuario (plantilla welcome_usuario).
 */
function sendWelcomeUsuario(string $nombre, string $email): bool
{
    try {
        $fallback = '<p>Hola <strong style="color:#ffffff">' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '</strong>,</p><p>Tu cuenta ha sido creada exitosamente. Estos son tus datos:</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border-radius:12px;padding:16px;margin:16px 0"><tr><td style="color:#9ca3af;padding:4px 0">Email:</td><td style="color:#ffffff;padding:4px 0;font-weight:600">' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</td></tr></table><p>Con tu cuenta puedes:</p><ul style="color:#d1d5db;padding-left:20px"><li>Guardar escorts en favoritos</li><li>Dejar valoraciones y comentarios</li><li>Recibir notificaciones de tus escorts favoritas</li></ul><p style="margin-top:20px">Explora nuestro directorio y encuentra la compañía perfecta para ti.</p>';
        $tpl = applyMailTemplate('welcome_usuario', [
            'nombre' => htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8'),
            'email' => htmlspecialchars($email, ENT_QUOTES, 'UTF-8'),
            'site_url' => SITE_URL,
        ], $fallback, ['asunto' => 'Bienvenido a ConsexVIP', 'nombre' => 'Bienvenida Usuario']);
        $full = mailHeader($tpl['asunto']) . $tpl['html'] . mailFooter();
        return sendMail($email, $tpl['asunto'], $full);
    } catch (Throwable $e) {
        error_log('mail.php sendWelcomeUsuario error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Enlace de recuperación de contraseña (tipos: usuario | escort).
 */
function sendRecovery(string $email, string $resetToken, string $tipo = 'usuario'): bool
{
    try {
        $resetUrl = SITE_URL . '/recuperar-clave?token=' . urlencode($resetToken) . '&tipo=' . urlencode($tipo);
        $fallback = '<p>Recibimos una solicitud para restablecer tu contraseña.</p><p style="text-align:center;margin:32px 0"><a href="' . htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8') . '" class="btn">Restablecer Contraseña</a></p><p class="warning">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p><p class="warning">Si el botón no funciona, copia y pega este enlace en tu navegador:</p><p class="fallback">' . htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8') . '</p>';
        $tpl = applyMailTemplate('recovery', [
            'reset_url' => htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8'),
            'site_url' => SITE_URL,
        ], $fallback, ['asunto' => 'Recuperación de Contraseña', 'nombre' => 'Recuperación de Contraseña']);
        $full = mailHeader($tpl['asunto']) . $tpl['html'] . mailFooter();
        return sendMail($email, $tpl['asunto'], $full);
    } catch (Throwable $e) {
        error_log('mail.php sendRecovery error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Aviso de cambio de contraseña (plantilla password_changed).
 */
function sendPasswordChanged(string $email, string $nombre): bool
{
    try {
        $fallback = '<p>Hola <strong style="color:#ffffff">' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '</strong>,</p><p>Tu contraseña ha sido cambiada exitosamente.</p><p>Si no realizaste este cambio, contacta al soporte de inmediato.</p>';
        $tpl = applyMailTemplate('password_changed', [
            'nombre' => htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8'),
        ], $fallback, ['asunto' => 'Contraseña Actualizada', 'nombre' => 'Contraseña Actualizada']);
        $full = mailHeader($tpl['asunto']) . $tpl['html'] . mailFooter();
        return sendMail($email, $tpl['asunto'], $full);
    } catch (Throwable $e) {
        error_log('mail.php sendPasswordChanged error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Datos de la escort por id (email y nombre) o null si no existe.
 */
function mailEscortById(int $escortId): ?array
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT id, email, nombre, usuario FROM escorts WHERE id = ? LIMIT 1");
        $stmt->execute([$escortId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    } catch (Throwable $e) {
        error_log('mail.php mailEscortById error: ' . $e->getMessage());
        return null;
    }
}

/**
 * Verificación de identidad aprobada (plantilla verificacion_aprobada).
 */
function sendVerificacionAprobada(int $escortId): bool
{
    try {
        $escort = mailEscortById($escortId);
        if (!$escort || empty($escort['email'])) return false;
        $nombre = $escort['nombre'] ?: ($escort['usuario'] ?? '');
        $fallback = '<p>Hola <strong style="color:#ffffff">' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '</strong>,</p><p>Tu verificación de identidad ha sido <strong style="color:#22c55e">aprobada</strong>.</p><p>Ahora cuentas con el badge de verificación en tu perfil, lo que genera mayor confianza en los clientes.</p>';
        $tpl = applyMailTemplate('verificacion_aprobada', [
            'nombre' => htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8'),
        ], $fallback, ['asunto' => 'Verificación Aprobada - ConsexVIP', 'nombre' => 'Verificación Aprobada']);
        $full = mailHeader($tpl['asunto']) . $tpl['html'] . mailFooter();
        return sendMail($escort['email'], $tpl['asunto'], $full);
    } catch (Throwable $e) {
        error_log('mail.php sendVerificacionAprobada error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Verificación de identidad rechazada (plantilla verificacion_rechazada).
 */
function sendVerificacionRechazada(int $escortId, string $motivo): bool
{
    try {
        $escort = mailEscortById($escortId);
        if (!$escort || empty($escort['email'])) return false;
        $nombre = $escort['nombre'] ?: ($escort['usuario'] ?? '');
        $fallback = '<p>Hola <strong style="color:#ffffff">' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '</strong>,</p><p>Tu verificación de identidad ha sido <strong style="color:#ef4444">rechazada</strong>.</p><p><strong style="color:#fbbf24">Motivo:</strong> ' . htmlspecialchars($motivo, ENT_QUOTES, 'UTF-8') . '</p><p>Puedes volver a intentarlo subiendo una nueva foto desde tu panel.</p>';
        $tpl = applyMailTemplate('verificacion_rechazada', [
            'nombre' => htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8'),
            'motivo' => htmlspecialchars($motivo, ENT_QUOTES, 'UTF-8'),
        ], $fallback, ['asunto' => 'Verificación Rechazada - ConsexVIP', 'nombre' => 'Verificación Rechazada']);
        $full = mailHeader($tpl['asunto']) . $tpl['html'] . mailFooter();
        return sendMail($escort['email'], $tpl['asunto'], $full);
    } catch (Throwable $e) {
        error_log('mail.php sendVerificacionRechazada error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Cuenta de escort aprobada (sin plantilla en BD: HTML fijo).
 */
function sendCuentaAprobada(int $escortId): bool
{
    try {
        $escort = mailEscortById($escortId);
        if (!$escort || empty($escort['email'])) return false;
        $nombre = $escort['nombre'] ?: ($escort['usuario'] ?? '');
        $fallback = '<p>Hola <strong style="color:#ffffff">' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '</strong>,</p><p>Tu cuenta ha sido <strong class="text-green">aprobada</strong> y tu anuncio ya está visible en el directorio.</p><p>Ingresa a tu panel para gestionar tu perfil, fotos y disponibilidad:</p><p style="text-align:center;margin:32px 0"><a href="' . SITE_URL . '/micuenta" class="btn">Ir a mi panel</a></p>';
        $tpl = applyMailTemplate('cuenta_aprobada', [
            'nombre' => htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8'),
            'email' => htmlspecialchars($escort['email'], ENT_QUOTES, 'UTF-8'),
            'site_url' => SITE_URL,
        ], $fallback, ['asunto' => 'Cuenta Aprobada - ConsexVIP', 'nombre' => 'Cuenta Aprobada']);
        $full = mailHeader($tpl['asunto']) . $tpl['html'] . mailFooter();
        return sendMail($escort['email'], $tpl['asunto'], $full);
    } catch (Throwable $e) {
        error_log('mail.php sendCuentaAprobada error: ' . $e->getMessage());
        return false;
    }
}

/**
 * Cuenta de escort rechazada (sin plantilla en BD: HTML fijo).
 */
function sendCuentaRechazada(int $escortId, string $motivo): bool
{
    try {
        $escort = mailEscortById($escortId);
        if (!$escort || empty($escort['email'])) return false;
        $nombre = $escort['nombre'] ?: ($escort['usuario'] ?? '');
        $motivoFinal = $motivo !== '' ? $motivo : 'No especificado';
        $fallback = '<p>Hola <strong style="color:#ffffff">' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '</strong>,</p><p>Lamentamos informarte que tu cuenta no fue aprobada en esta ocasión.</p><p><strong style="color:#fbbf24">Motivo:</strong> ' . htmlspecialchars($motivoFinal, ENT_QUOTES, 'UTF-8') . '</p><p>Si crees que esto es un error, contacta al soporte.</p>';
        $tpl = applyMailTemplate('cuenta_rechazada', [
            'nombre' => htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8'),
            'motivo' => htmlspecialchars($motivoFinal, ENT_QUOTES, 'UTF-8'),
            'site_url' => SITE_URL,
        ], $fallback, ['asunto' => 'Cuenta No Aprobada - ConsexVIP', 'nombre' => 'Cuenta Rechazada']);
        $full = mailHeader($tpl['asunto']) . $tpl['html'] . mailFooter();
        return sendMail($escort['email'], $tpl['asunto'], $full);
    } catch (Throwable $e) {
        error_log('mail.php sendCuentaRechazada error: ' . $e->getMessage());
        return false;
    }
}
