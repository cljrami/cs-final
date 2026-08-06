<?php
require_once __DIR__ . '/config/mail.php';

function mailHeader(string $title): string
{
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$title}</title>
<style>
body{margin:0;padding:0;background-color:#0a0a0f;font-family:Arial,Helvetica,sans-serif}
p{color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 12px 0}
strong{color:#ffffff}
a{color:#ef4444;text-decoration:none;font-weight:600}
table.info{width:100%;background:#0f0f1a;border-radius:12px;padding:16px;margin:16px 0;border-collapse:collapse}
table.info td{color:#9ca3af;padding:4px 0}
table.info td:last-child{color:#ffffff;font-weight:600}
ul,ol{color:#d1d5db;padding-left:20px;margin:12px 0}
li{margin:4px 0}
.btn{display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px}
.fallback{color:#6b7280;font-size:12px;word-break:break-all;margin:8px 0 0 0}
.warning{color:#9ca3af;font-size:13px;margin:8px 0 0 0}
.text-center{text-align:center}
.text-green{color:#22c55e}
.text-red{color:#ef4444}
.text-amber{color:#fbbf24}
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background:#16161f;border-radius:16px;padding:40px;border:1px solid #2a2a3e">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;padding-bottom:24px">
<h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700">{$title}</h1>
</td></tr>
<tr><td style="color:#9ca3af;font-size:15px;line-height:1.6">
HTML;
}

function mailFooter(): string
{
    return <<<HTML
</td></tr></table>
</td></tr>
<tr><td style="text-align:center;padding-top:24px">
<p style="color:#6b7280;font-size:12px;margin:0">
&copy; 2026 Kimi. Todos los derechos reservados.<br>
Si no solicitaste este correo, ignóralo.
</p>
</td></tr></table></td></tr></table>
</body>
</html>
HTML;
}

function sendMail(string $to, string $subject, string $htmlBody): bool
{
    $from = MAIL_FROM;
    $fromName = MAIL_FROM_NAME;
    try {
        if (function_exists('getDBConnection')) {
            $pdo = getDBConnection();
            $stmt = $pdo->prepare("SELECT clave, valor FROM configuracion WHERE clave IN ('email_from', 'email_from_name')");
            $stmt->execute();
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if ($row['clave'] === 'email_from' && !empty($row['valor'])) $from = $row['valor'];
                if ($row['clave'] === 'email_from_name' && !empty($row['valor'])) $fromName = $row['valor'];
            }
        }
    } catch (\Throwable $e) {}

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=utf-8\r\n";
    $headers .= "From: " . $fromName . " <" . $from . ">\r\n";
    $headers .= "Reply-To: " . $from . "\r\n";
    $headers .= "X-Mailer: Kimi Mailer/1.0\r\n";
    $headers .= "Return-Path: " . $from . "\r\n";

    $subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        $headers = str_replace("\r\n", "\n", $headers);
        $htmlBody = str_replace("\r\n", "\n", $htmlBody);
    }

    return mail($to, $subject, $htmlBody, $headers, '-f ' . MAIL_FROM);
}

function sendWelcomeUsuario(string $nombre, string $email): bool
{
    $body = mailHeader('Bienvenido a Kimi');
    $body .= <<<HTML
<p>Hola <strong style="color:#ffffff">{$nombre}</strong>,</p>
<p>Tu cuenta ha sido creada exitosamente. Estos son tus datos:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border-radius:12px;padding:16px;margin:16px 0">
<tr><td style="color:#9ca3af;padding:4px 0">Email:</td><td style="color:#ffffff;padding:4px 0;font-weight:600">{$email}</td></tr>
</table>
<p>Con tu cuenta puedes:</p>
<ul style="color:#d1d5db;padding-left:20px">
<li>Guardar escorts en favoritos</li>
<li>Dejar valoraciones y comentarios</li>
<li>Recibir notificaciones de tus escorts favoritas</li>
</ul>
<p style="margin-top:20px">Explora nuestro directorio y encuentra la compañía perfecta para ti.</p>
HTML;
    $body .= mailFooter();
    return sendMail($email, 'Bienvenido a Kimi', $body);
}

function sendWelcomeEscort(string $email, string $nombre): bool
{
    $body = mailHeader('Bienvenida a Kimi - Panel de Escort');
    $body .= <<<HTML
<p>Hola <strong style="color:#ffffff">{$nombre}</strong>,</p>
<p>Tu cuenta de escort ha sido creada exitosamente. Tus datos de acceso:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border-radius:12px;padding:16px;margin:16px 0">
<tr><td style="color:#9ca3af;padding:4px 0">Email:</td><td style="color:#ffffff;padding:4px 0;font-weight:600">{$email}</td></tr>
</table>
<p>Pasos para comenzar:</p>
<ol style="color:#d1d5db;padding-left:20px">
<li>Completa tu perfil (fotos, descripción, servicios)</li>
<li>Selecciona un plan de suscripción</li>
<li>Espera la aprobación del administrador</li>
<li>Una vez aprobada, tu anuncio estará visible</li>
</ol>
<p style="margin-top:20px">Ingresa a tu panel desde <a href="https://kimi.zona8.cl/micuenta/login" style="color:#ef4444;text-decoration:none;font-weight:600">kimi.zona8.cl/micuenta/login</a></p>
HTML;
    $body .= mailFooter();
    return sendMail($email, 'Bienvenida a Kimi - Panel de Escort', $body);
}

function sendRecovery(string $email, string $token, string $tipo): bool
{
    $resetUrl = SITE_URL . '/recuperar-clave?token=' . urlencode($token) . '&tipo=' . urlencode($tipo);

    $body = mailHeader('Recuperación de Contraseña');
    $body .= <<<HTML
<p>Recibimos una solicitud para restablecer tu contraseña.</p>
<p style="text-align:center;margin:32px 0">
<a href="{$resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px">
Restablecer Contraseña
</a>
</p>
<p style="color:#9ca3af;font-size:13px">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
<p style="color:#9ca3af;font-size:13px">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
<p style="color:#6b7280;font-size:12px;word-break:break-all">{$resetUrl}</p>
HTML;
    $body .= mailFooter();
    return sendMail($email, 'Recuperación de Contraseña', $body);
}

function sendPasswordChanged(string $email, string $nombre): bool
{
    $body = mailHeader('Contraseña Actualizada');
    $body .= <<<HTML
<p>Hola <strong style="color:#ffffff">{$nombre}</strong>,</p>
<p>Tu contraseña ha sido cambiada exitosamente.</p>
<p>Si no realizaste este cambio, contacta al soporte de inmediato.</p>
HTML;
    $body .= mailFooter();
    return sendMail($email, 'Contraseña Actualizada', $body);
}

function sendVerificacionAprobada(int $escortId): void
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT email, nombre FROM escorts WHERE id = ?");
        $stmt->execute([$escortId]);
        $escort = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$escort) return;

        $stmt = $pdo->prepare("SELECT asunto, cuerpo_html FROM email_templates WHERE codigo = 'verificacion_aprobada'");
        $stmt->execute();
        $tmpl = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$tmpl) return;

        $body = str_replace('{{nombre}}', htmlspecialchars($escort['nombre'], ENT_QUOTES, 'UTF-8'), $tmpl['cuerpo_html']);
        $html = mailHeader($tmpl['asunto']) . $body . mailFooter();
        sendMail($escort['email'], $tmpl['asunto'], $html);
    } catch (\Throwable $e) {
        error_log("sendVerificacionAprobada error: " . $e->getMessage());
    }
}

function sendVerificacionRechazada(int $escortId, string $motivo): void
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT email, nombre FROM escorts WHERE id = ?");
        $stmt->execute([$escortId]);
        $escort = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$escort) return;

        $stmt = $pdo->prepare("SELECT asunto, cuerpo_html FROM email_templates WHERE codigo = 'verificacion_rechazada'");
        $stmt->execute();
        $tmpl = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$tmpl) return;

        $body = $tmpl['cuerpo_html'];
        $body = str_replace('{{nombre}}', htmlspecialchars($escort['nombre'], ENT_QUOTES, 'UTF-8'), $body);
        $body = str_replace('{{motivo}}', htmlspecialchars($motivo, ENT_QUOTES, 'UTF-8'), $body);
        $html = mailHeader($tmpl['asunto']) . $body . mailFooter();
        sendMail($escort['email'], $tmpl['asunto'], $html);
    } catch (\Throwable $e) {
        error_log("sendVerificacionRechazada error: " . $e->getMessage());
    }
}

function sendCuentaAprobada(int $escortId): void
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT email, nombre FROM escorts WHERE id = ?");
        $stmt->execute([$escortId]);
        $escort = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$escort) return;

        $stmt = $pdo->prepare("SELECT asunto, cuerpo_html FROM email_templates WHERE codigo = 'cuenta_aprobada'");
        $stmt->execute();
        $tmpl = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$tmpl) return;

        $body = $tmpl['cuerpo_html'];
        $body = str_replace('{{nombre}}', htmlspecialchars($escort['nombre'], ENT_QUOTES, 'UTF-8'), $body);
        $body = str_replace('{{site_url}}', SITE_URL, $body);
        $html = mailHeader($tmpl['asunto']) . $body . mailFooter();
        sendMail($escort['email'], $tmpl['asunto'], $html);
    } catch (\Throwable $e) {
        error_log("sendCuentaAprobada error: " . $e->getMessage());
    }
}

function sendCuentaRechazada(int $escortId, string $motivo): void
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT email, nombre FROM escorts WHERE id = ?");
        $stmt->execute([$escortId]);
        $escort = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$escort) return;

        $stmt = $pdo->prepare("SELECT asunto, cuerpo_html FROM email_templates WHERE codigo = 'cuenta_rechazada'");
        $stmt->execute();
        $tmpl = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$tmpl) return;

        $body = $tmpl['cuerpo_html'];
        $body = str_replace('{{nombre}}', htmlspecialchars($escort['nombre'], ENT_QUOTES, 'UTF-8'), $body);
        $body = str_replace('{{motivo}}', htmlspecialchars($motivo, ENT_QUOTES, 'UTF-8'), $body);
        $html = mailHeader($tmpl['asunto']) . $body . mailFooter();
        sendMail($escort['email'], $tmpl['asunto'], $html);
    } catch (\Throwable $e) {
        error_log("sendCuentaRechazada error: " . $e->getMessage());
    }
}

/**
 * Emails de destino para notificaciones a administradores.
 * Se guardan en la tabla `configuracion`, clave `admin_notify_emails` (separados por coma).
 */
function getAdminNotifyEmails(): array
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT valor FROM configuracion WHERE clave = 'admin_notify_emails'");
        $stmt->execute();
        $val = trim((string)$stmt->fetchColumn());
        if ($val === '') return [];
        $valid = [];
        foreach (array_map('trim', explode(',', $val)) as $email) {
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) $valid[] = $email;
        }
        return array_values(array_unique($valid));
    } catch (\Throwable $e) {
        return [];
    }
}

/**
 * Verifica si un tipo de notificación a admins está habilitado.
 * Si la clave no existe, está habilitado por defecto.
 */
function adminNotifyEnabled(string $evento): bool
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT valor FROM configuracion WHERE clave = ?");
        $stmt->execute(["notify_{$evento}"]);
        $valor = trim((string)$stmt->fetchColumn());
        if ($valor === '') return true;
        return in_array(strtolower($valor), ['1', 'true', 'si', 'sí', 'on']);
    } catch (\Throwable $e) {
        return true;
    }
}

/**
 * Envía una notificación por email a los administradores configurados.
 * $evento: reportes | inscripciones | verificaciones | pagos | comentarios | contacto
 */
function sendAdminNotification(string $evento, string $asunto, string $htmlBody): void
{
    try {
        if (!adminNotifyEnabled($evento)) return;
        $emails = getAdminNotifyEmails();
        if (empty($emails)) return;

        $html = mailHeader($asunto) . $htmlBody . mailFooter();
        $sent = false;
        foreach ($emails as $email) {
            if (sendMail($email, $asunto, $html)) $sent = true;
        }

        if ($sent) {
            $pdo = getDBConnection();
            $ahora = date('Y-m-d H:i:s');
            $stmt = $pdo->prepare("SELECT id FROM configuracion WHERE clave = 'admin_notify_last_sent'");
            $stmt->execute();
            if ($stmt->fetch()) {
                $pdo->prepare("UPDATE configuracion SET valor = ? WHERE clave = 'admin_notify_last_sent'")->execute([$ahora]);
            } else {
                $pdo->prepare("INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES ('admin_notify_last_sent', ?, 'string', 'Último envío de notificación a admins')")->execute([$ahora]);
            }
        }
    } catch (\Throwable $e) {
        error_log("sendAdminNotification error: " . $e->getMessage());
    }
}

/**
 * Construye las filas de contexto (Clave → Valor) para el cuerpo del correo.
 */
function filasMail(array $filas): string
{
    $html = '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border-radius:12px;padding:16px;margin:16px 0">';
    foreach ($filas as $clave => $valor) {
        $html .= '<tr><td style="color:#9ca3af;padding:4px 0">' . htmlspecialchars((string)$clave, ENT_QUOTES, 'UTF-8') . ':</td>'
              . '<td style="color:#ffffff;padding:4px 0;font-weight:600">' . htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8') . '</td></tr>';
    }
    return $html . '</table>';
}

/**
 * Envía una notificación genérica por email a los administradores.
 * El cuerpo se arma a partir de un título descriptivo y una lista clave→valor.
 * Nunca lanza excepciones: si falla, solo se registra en el log.
 */
function sendAdminEvento(string $evento, string $titulo, array $filas): void
{
    try {
        $body = '<p>' . htmlspecialchars($titulo, ENT_QUOTES, 'UTF-8') . '</p>';
        $body .= filasMail($filas);
        $body .= '<p class="warning">Recibido el ' . date('d/m/Y H:i:s') . '</p>';
        sendAdminNotification($evento, $titulo, $body);
    } catch (\Throwable $e) {
        error_log("sendAdminEvento error: " . $e->getMessage());
    }
}

/**
 * Notifica por email a los admins que una escort realizó una acción.
 */
function notificarAccionEscort(string $evento, int $escortId, string $titulo, array $filas = []): void
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT nombre, email, ciudad FROM escorts WHERE id = ?");
        $stmt->execute([$escortId]);
        $escort = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$escort) return;

        $datos = array_merge([
            'Escort' => $escort['nombre'] . ' (ID ' . $escortId . ')',
            'Email' => $escort['email'] ?: '—',
        ], $filas);
        if (!empty($escort['ciudad'])) $datos['Ciudad'] = $escort['ciudad'];

        sendAdminEvento($evento, $titulo, $datos);
    } catch (\Throwable $e) {
        error_log("notificarAccionEscort error: " . $e->getMessage());
    }
}

/**
 * Notifica por email a los admins que un usuario realizó una acción.
 */
function notificarAccionUsuario(string $evento, int $usuarioId, string $titulo, array $filas = []): void
{
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT nombre, email FROM usuarios WHERE id = ?");
        $stmt->execute([$usuarioId]);
        $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$usuario) return;

        $datos = array_merge([
            'Usuario' => $usuario['nombre'] . ' (ID ' . $usuarioId . ')',
            'Email' => $usuario['email'] ?: '—',
        ], $filas);

        sendAdminEvento($evento, $titulo, $datos);
    } catch (\Throwable $e) {
        error_log("notificarAccionUsuario error: " . $e->getMessage());
    }
}
