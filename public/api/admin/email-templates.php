<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    // Auto-crear tabla si no existe
    $pdo->exec("CREATE TABLE IF NOT EXISTS email_templates (
      id int(11) NOT NULL AUTO_INCREMENT,
      codigo varchar(50) NOT NULL,
      nombre varchar(100) NOT NULL,
      asunto varchar(200) NOT NULL,
      cuerpo_html text NOT NULL,
      variables_disponibles text DEFAULT NULL,
      updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (id),
      UNIQUE KEY uk_codigo (codigo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Sembrar datos por defecto si estíƒÂ¡ vacíƒÂ­a
    $stmt = $pdo->query("SELECT COUNT(*) FROM email_templates");
    if ((int)$stmt->fetchColumn() === 0) {
$pdo->exec("INSERT INTO email_templates (codigo, nombre, asunto, cuerpo_html, variables_disponibles) VALUES
        ('welcome_usuario', 'Bienvenida Usuario', 'Bienvenido a Kimi', '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta ha sido creada exitosamente. Estos son tus datos:</p><table class=\"info\"><tr><td>Email:</td><td>{{email}}</td></tr></table><p>Con tu cuenta puedes:</p><ul><li>Guardar escorts en favoritos</li><li>Dejar valoraciones y comentarios</li><li>Recibir notificaciones de tus escorts favoritas</li></ul><p>Explora nuestro directorio y encuentra la compaí±í­a perfecta para ti.</p>', '{\"nombre\":\"Nombre del usuario\",\"email\":\"Correo electrónico\"}'),
        ('welcome_escort', 'Bienvenida Escort', 'Bienvenida a Kimi - Panel de Escort', '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta de escort ha sido creada exitosamente. Tus datos de acceso:</p><table class=\"info\"><tr><td>Email:</td><td>{{email}}</td></tr></table><p>Pasos para comenzar:</p><ol><li>Completa tu perfil (fotos, descripción, servicios)</li><li>Selecciona un plan de suscripción</li><li>Espera la aprobación del administrador</li><li>Una vez aprobada, tu anuncio estará visible</li></ol><p>Ingresa a tu panel desde <a href=\"{{site_url}}/micuenta/login\">{{site_url}}/micuenta/login</a></p>', '{\"nombre\":\"Nombre de la escort\",\"email\":\"Correo electrónico\",\"site_url\":\"URL del sitio\"}'),
        ('recovery', 'Recuperación de Contraseí±a', 'Recuperación de Contraseí±a', '<p>Recibimos una solicitud para restablecer tu contraseí±a.</p><p class=\"text-center\"><a href=\"{{reset_url}}\" class=\"btn\">Restablecer Contraseí±a</a></p><p>Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p><p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p><p class=\"fallback\">{{reset_url}}</p>', '{\"reset_url\":\"Enlace para restablecer\",\"site_url\":\"URL del sitio\"}'),
        ('password_changed', 'Contraseí±a Actualizada', 'Contraseí±a Actualizada', '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu contraseí±a ha sido cambiada exitosamente.</p><p>Si no realizaste este cambio, contacta al soporte de inmediato.</p>', '{\"nombre\":\"Nombre del usuario/escort\"}'),
        ('verificacion_aprobada', 'Verificación Aprobada', 'Verificación Aprobada - Kimi', '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu verificación de identidad ha sido <strong class=\"text-green\">aprobada</strong>.</p><p>Ahora cuentas con el badge de verificación en tu perfil, lo que genera mayor confianza en los clientes.</p>', '{\"nombre\":\"Nombre de la escort\"}'),
        ('verificacion_rechazada', 'Verificación Rechazada', 'Verificación Rechazada - Kimi', '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu verificación de identidad ha sido <strong class=\"text-red\">rechazada</strong>.</p><p><strong class=\"text-amber\">Motivo:</strong> {{motivo}}</p><p>Puedes volver a intentarlo subiendo una nueva foto desde tu panel.</p>', '{\"nombre\":\"Nombre de la escort\",\"motivo\":\"Motivo del rechazo\"}'),
        ('cuenta_aprobada', 'Cuenta Aprobada', 'Cuenta Aprobada - Kimi', '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta ha sido <strong class=\"text-green\">aprobada</strong> por el administrador.</p><p>Ya puedes completar tu perfil, aí±adir fotos y publicar tu anuncio.</p><p>Ingresa a tu panel desde <a href=\"{{site_url}}/micuenta/perfil\">{{site_url}}/micuenta/perfil</a></p>', '{\"nombre\":\"Nombre de la escort\",\"site_url\":\"URL del sitio\"}'),
        ('cuenta_rechazada', 'Cuenta Rechazada', 'Cuenta Rechazada - Kimi', '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta ha sido <strong class=\"text-red\">rechazada</strong> por el administrador.</p><p><strong class=\"text-amber\">Motivo:</strong> {{motivo}}</p><p>Si crees que esto es un error, contacta al soporte.</p>', '{\"nombre\":\"Nombre de la escort\",\"motivo\":\"Motivo del rechazo\"}')");
    }

    // Migrar plantillas existentes con HTML antiguo (con inline styles) a HTML limpio
    $migrateTemplates = [
        'welcome_usuario'  => '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta ha sido creada exitosamente. Estos son tus datos:</p><table class="info"><tr><td>Email:</td><td>{{email}}</td></tr></table><p>Con tu cuenta puedes:</p><ul><li>Guardar escorts en favoritos</li><li>Dejar valoraciones y comentarios</li><li>Recibir notificaciones de tus escorts favoritas</li></ul><p>Explora nuestro directorio y encuentra la compaí±í­a perfecta para ti.</p>',
        'welcome_escort'   => '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta de escort ha sido creada exitosamente. Tus datos de acceso:</p><table class="info"><tr><td>Email:</td><td>{{email}}</td></tr></table><p>Pasos para comenzar:</p><ol><li>Completa tu perfil (fotos, descripción, servicios)</li><li>Selecciona un plan de suscripción</li><li>Espera la aprobación del administrador</li><li>Una vez aprobada, tu anuncio estará visible</li></ol><p>Ingresa a tu panel desde <a href="{{site_url}}/micuenta/login">{{site_url}}/micuenta/login</a></p>',
        'recovery'         => '<p>Recibimos una solicitud para restablecer tu contraseí±a.</p><p class="text-center"><a href="{{reset_url}}" class="btn">Restablecer Contraseí±a</a></p><p>Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p><p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p><p class="fallback">{{reset_url}}</p>',
        'password_changed' => '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu contraseí±a ha sido cambiada exitosamente.</p><p>Si no realizaste este cambio, contacta al soporte de inmediato.</p>',
        'verificacion_aprobada' => '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu verificación de identidad ha sido <strong class="text-green">aprobada</strong>.</p><p>Ahora cuentas con el badge de verificación en tu perfil, lo que genera mayor confianza en los clientes.</p>',
        'verificacion_rechazada' => '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu verificación de identidad ha sido <strong class="text-red">rechazada</strong>.</p><p><strong class="text-amber">Motivo:</strong> {{motivo}}</p><p>Puedes volver a intentarlo subiendo una nueva foto desde tu panel.</p>',
'cuenta_aprobada' => '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta ha sido <strong class="text-green">aprobada</strong> por el administrador.</p><p>Ya puedes completar tu perfil, aí±adir fotos y publicar tu anuncio.</p><p>Ingresa a tu panel desde <a href="{{site_url}}/micuenta/perfil">{{site_url}}/micuenta/perfil</a></p>',
        'cuenta_rechazada' => '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta ha sido <strong class="text-red">rechazada</strong> por el administrador.</p><p><strong class="text-amber">Motivo:</strong> {{motivo}}</p><p>Si crees que esto es un error, contacta al soporte.</p>',
    ];
    $stmt = $pdo->prepare("UPDATE email_templates SET cuerpo_html = ? WHERE codigo = ? AND (cuerpo_html LIKE '%style=%' OR cuerpo_html NOT LIKE '<p>%')");
    foreach ($migrateTemplates as $codigo => $cuerpo_html) {
        $stmt->execute([$cuerpo_html, $codigo]);
    }

    // Asegurar que las nuevas plantillas existan (insert si faltan)
    $ensureStmt = $pdo->prepare("INSERT IGNORE INTO email_templates (codigo, nombre, asunto, cuerpo_html, variables_disponibles) VALUES (?, ?, ?, ?, ?)");
    $ensureTemplates = [
        ['cuenta_aprobada', 'Cuenta Aprobada', 'Cuenta Aprobada - Kimi', '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta ha sido <strong class="text-green">aprobada</strong> por el administrador.</p><p>Ya puedes completar tu perfil, aí±adir fotos y publicar tu anuncio.</p><p>Ingresa a tu panel desde <a href="{{site_url}}/micuenta/perfil">{{site_url}}/micuenta/perfil</a></p>', '{"nombre":"Nombre de la escort","site_url":"URL del sitio"}'],
        ['cuenta_rechazada', 'Cuenta Rechazada', 'Cuenta Rechazada - Kimi', '<p>Hola <strong>{{nombre}}</strong>,</p><p>Tu cuenta ha sido <strong class="text-red">rechazada</strong> por el administrador.</p><p><strong class="text-amber">Motivo:</strong> {{motivo}}</p><p>Si crees que esto es un error, contacta al soporte.</p>', '{"nombre":"Nombre de la escort","motivo":"Motivo del rechazo"}'],
    ];
    foreach ($ensureTemplates as $t) {
        $ensureStmt->execute($t);
    }

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET - Listar plantillas ===
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT id, codigo, nombre, asunto, cuerpo_html, variables_disponibles, updated_at FROM email_templates ORDER BY nombre");
        $templates = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'templates' => $templates]);
        exit;
    }

    // === PUT - Actualizar plantilla ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);
        $asunto = trim($input['asunto'] ?? '');
        $cuerpo_html = $input['cuerpo_html'] ?? '';

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID invíƒÂ¡lido']);
            exit;
        }

        if (empty($asunto)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'El asunto es requerido']);
            exit;
        }

        if (empty($cuerpo_html)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'El cuerpo HTML es requerido']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE email_templates SET asunto = ?, cuerpo_html = ? WHERE id = ?");
        $stmt->execute([$asunto, $cuerpo_html, $id]);

        echo json_encode(['success' => true, 'message' => 'Plantilla actualizada correctamente']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'MíƒÂ©todo no permitido']);
} catch (PDOException $e) {
    error_log("Error email-templates.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error email-templates.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}

