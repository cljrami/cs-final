<?php
/**
 * Bootstrap global para APIs PHP del proyecto Kimi.
 * Carga variables de entorno, conexión a BD y helpers de seguridad.
 */
date_default_timezone_set('UTC');

// Polyfills para compatibilidad
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool {
        return strpos($haystack, $needle) === 0;
    }
}
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (strpos($name, 'HTTP_') === 0) {
                $headers[str_replace('_', '-', substr($name, 5))] = $value;
            }
        }
        if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $headers['Authorization'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        return $headers;
    }
}

// Cargar variables de entorno desde .env (si existe)
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if ($key !== '' && !array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("{$key}={$value}");
        }
    }
}


/**
 * Obtiene una variable de entorno o un valor por defecto.
 */
function env($key, $default = null)
{
    $value = $_ENV[$key] ?? getenv($key);
    if ($value === false || $value === null || $value === '') {
        return $default;
    }
    return $value;
}

// Constantes de base de datos
define('DB_HOST', env('DB_HOST', 'localhost'));
define('DB_NAME', env('DB_NAME', 'kimi_app'));
define('DB_USER', env('DB_USER', 'kimi_app'));
define('DB_PASS', env('DB_PASS', ''));
define('DB_CHARSET', env('DB_CHARSET', 'utf8mb4'));

/**
 * Conexión PDO singleton.
 */
function getDBConnection(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . "; SET time_zone = '+00:00'"
        ];
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            throw new PDOException($e->getMessage(), (int)$e->getCode());
        }
    }
    return $pdo;
}

/**
 * Helpers de respuesta JSON.
 */
function jsonResponse(bool $success, array $data = []): void
{
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['success' => $success], $data), JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $code = 500): void
{
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Obtiene el token del header Authorization.
 */
function getBearerToken(): string
{
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    // Fallback: extraer de getallheaders() si lo anterior falló
    if (empty($authHeader) && function_exists('getallheaders')) {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (!empty($authHeader) && str_starts_with($authHeader, 'Bearer ')) {
        return substr($authHeader, 7);
    }
    return '';
}

/**
 * Firma un payload y devuelve un token base64.HMAC.
 */
function signToken(array $payload): string
{
    $secret = env('APP_SECRET');
    if (empty($secret)) {
        throw new Exception('APP_SECRET no configurado');
    }

    $header = json_encode(['alg' => 'HS256', 'typ' => 'KIMI']);
    $body = json_encode($payload);

    $encodedHeader = rtrim(strtr(base64_encode($header), '+/', '-_'), '=');
    $encodedBody = rtrim(strtr(base64_encode($body), '+/', '-_'), '=');
    $signature = hash_hmac('sha256', "$encodedHeader.$encodedBody", $secret, true);
    $encodedSignature = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

    return "$encodedHeader.$encodedBody.$encodedSignature";
}

/**
 * Verifica un token firmado. Devuelve el payload o false.
 */
function verifyToken($token)
{
    $secret = env('APP_SECRET');
    if (empty($secret)) {
        return false;
    }

    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }

    [$encodedHeader, $encodedBody, $encodedSignature] = $parts;

    // Verificar firma
    $expectedSignature = hash_hmac('sha256', "$encodedHeader.$encodedBody", $secret, true);
    $expectedEncodedSignature = rtrim(strtr(base64_encode($expectedSignature), '+/', '-_'), '=');

    if (!hash_equals($expectedEncodedSignature, $encodedSignature)) {
        return false;
    }

    $body = base64_decode(strtr($encodedBody, '-_', '+/') . str_repeat('=', (4 - strlen($encodedBody) % 4) % 4));
    $payload = json_decode($body, true);

    if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
        return false;
    }

    return $payload;
}

/**
 * Extrae y verifica el token del header. Devuelve el payload o responde 401.
 * Soporta admin actuando como escort vía query param ?acting_as=ID.
 */
function requireAuth(): array
{
    $token = getBearerToken();
    if (empty($token)) {
        jsonError('No autorizado', 401);
    }

    $payload = verifyToken($token);
    if (!$payload) {
        jsonError('Token inválido o expirado', 401);
    }

    // Admin actuando como escort
    if (in_array($payload['tipo'] ?? '', ['admin', 'superadmin', 'moderador'])) {
        $actingAs = (int)($_GET['acting_as'] ?? $_POST['acting_as'] ?? 0);
        if ($actingAs > 0) {
            try {
                $pdo = getDBConnection();
                $stmt = $pdo->prepare("SELECT id, eliminada FROM escorts WHERE id = ?");
                $stmt->execute([$actingAs]);
                $escort = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($escort) {
                    $payload['id'] = (int)$escort['id'];
                    $payload['tipo'] = 'escort';
                    $payload['email'] = '';
                    $payload['admin_acting'] = true;
                }
            } catch (Throwable $e) {
                error_log("requireAuth acting_as error: " . $e->getMessage());
            }
        }
    }

    return $payload;
}

/**
 * Requiere autenticación de administrador.
 */
function requireAdminAuth(): array
{
    $payload = requireAuth();
    $role = $payload['rol'] ?? $payload['role'] ?? '';
    if (!in_array($role, ['admin', 'superadmin', 'moderador'], true)) {
        jsonError('No tienes permisos de administrador', 403);
    }
    return $payload;
}

/**
 * Requiere un rol específico de administrador.
 */
function requireAdminRole(array $tokenData, array $allowedRoles = ['admin', 'superadmin', 'moderador']): void
{
    $role = $tokenData['rol'] ?? $tokenData['role'] ?? '';
    if (!in_array($role, $allowedRoles, true)) {
        jsonError('No tienes permisos para realizar esta acción', 403);
    }
}

/**
 * Requiere autenticación de usuario (cualquier token válido de usuario).
 * Además verifica que la cuenta no esté eliminada.
 */
function requireUsuarioAuth(): array
{
    $payload = requireAuth();

    if (!in_array($payload['tipo'] ?? '', ['usuario', 'admin', 'superadmin', 'moderador'])) {
        jsonError('Se requiere autenticación de usuario', 401);
    }

    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT eliminada FROM usuarios WHERE id = ?");
        $stmt->execute([$payload['id']]);
        $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$usuario || (int)$usuario['eliminada'] === 1) {
            jsonError('Cuenta eliminada', 401);
        }
    } catch (Throwable $e) {
        error_log("Error en requireUsuarioAuth: " . $e->getMessage());
        jsonError('Error del servidor', 500);
    }

    return $payload;
}

/**
 * Requiere autenticación de escort (cualquier token válido de escort).
 * Además verifica que la cuenta no esté eliminada.
 */
function requireEscortAuth(): array
{
    $payload = requireAuth();

    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT eliminada FROM escorts WHERE id = ?");
        $stmt->execute([$payload['id']]);
        $escort = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$escort || (int)$escort['eliminada'] === 1) {
            jsonError('Cuenta eliminada', 401);
        }
    } catch (Throwable $e) {
        error_log("Error en requireEscortAuth: " . $e->getMessage());
        jsonError('Error del servidor', 500);
    }

    return $payload;
}

function validarMIME(string $ruta, array $permitidos): bool {
    if (!file_exists($ruta) || !is_file($ruta)) return false;
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo === false) return false;
    $mime = finfo_file($finfo, $ruta);
    finfo_close($finfo);
    return in_array($mime, $permitidos, true);
}

/**
 * Rate limiting reutilizable (tabla `rate_limits`).
 * Registra el intento y devuelve ['blocked' => bool, 'remaining' => int].
 * Si el rate limit falla internamente, hace fail-open (nunca bloquea).
 *
 * @param string $endpoint      Identificador único del flujo (ej: 'login_admin')
 * @param int    $max           Máximo de intentos en la ventana
 * @param int    $windowMinutes Duración de la ventana en minutos
 * @param string $extraKey      Clave secundaria opcional (ej: email en minúsculas)
 */
function rateLimitCheck(string $endpoint, int $max, int $windowMinutes, string $extraKey = ''): array
{
    try {
        $pdo = getDBConnection();
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $key = $endpoint . ($extraKey !== '' ? ':' . $extraKey : '');
        $max = max(1, (int)$max);
        $windowMinutes = max(1, (int)$windowMinutes);

        $stmt = $pdo->prepare("SELECT id, contador, ventana_inicio FROM rate_limits WHERE ip = ? AND endpoint = ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([$ip, $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $now = date('Y-m-d H:i:s');
        if ($row) {
            $dentroVentana = strtotime($row['ventana_inicio']) >= (time() - $windowMinutes * 60);
            if ($dentroVentana) {
                $contador = (int)$row['contador'] + 1;
                if ($contador > $max) {
                    return ['blocked' => true, 'remaining' => 0];
                }
                $pdo->prepare("UPDATE rate_limits SET contador = ? WHERE id = ?")->execute([$contador, $row['id']]);
                return ['blocked' => false, 'remaining' => $max - $contador];
            }
            $pdo->prepare("UPDATE rate_limits SET contador = 1, ventana_inicio = ? WHERE id = ?")->execute([$now, $row['id']]);
            return ['blocked' => false, 'remaining' => $max - 1];
        }

        $pdo->prepare("INSERT INTO rate_limits (ip, endpoint, contador, ventana_inicio) VALUES (?, ?, 1, ?)")->execute([$ip, $key, $now]);

        // Limpieza ocasional de filas viejas (ventanas de 2 días)
        if (mt_rand(1, 100) === 1) {
            $pdo->prepare("DELETE FROM rate_limits WHERE ventana_inicio < DATE_SUB(NOW(), INTERVAL 2 DAY)")->execute();
        }

        return ['blocked' => false, 'remaining' => $max - 1];
    } catch (Throwable $e) {
        return ['blocked' => false, 'remaining' => $max]; // fail-open
    }
}

/**
 * Resetea el contador de rate limit de una IP+endpoint (tras un login exitoso).
 */
function rateLimitReset(string $endpoint, string $extraKey = ''): void
{
    try {
        $pdo = getDBConnection();
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $key = $endpoint . ($extraKey !== '' ? ':' . $extraKey : '');
        $pdo->prepare("DELETE FROM rate_limits WHERE ip = ? AND endpoint = ?")->execute([$ip, $key]);
    } catch (Throwable $e) {
        // no-op
    }
}

/**
 * Aplica rate limit a una respuesta de login: registra el intento, setea
 * cabeceras X-RateLimit-* y responde 429 si está bloqueado.
 *
 * @return bool true si el request debe detenerse (429 ya enviado), false si continúa.
 */
function rateLimitLogin(string $endpoint, int $max, int $windowMinutes, string $extraKey = ''): bool
{
    $rl = rateLimitCheck($endpoint, $max, $windowMinutes, $extraKey);
    header('X-RateLimit-Limit: ' . $max);
    header('X-RateLimit-Remaining: ' . $rl['remaining']);
    if ($rl['blocked']) {
        http_response_code(429);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.']);
        exit;
    }
    return false;
}
