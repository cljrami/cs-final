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

// Fallback: si no hay .env, usar credenciales hardcodeadas
if (env('DB_PASS') === null) {
    $_ENV['DB_PASS'] = 'bdNbHHaqrsbSmpLbLYsF';
    putenv('DB_PASS=bdNbHHaqrsbSmpLbLYsF');
}
if (env('APP_SECRET') === null) {
    $_ENV['APP_SECRET'] = 'mnS5EYHqv6RfLETl5C5fenhnrbcUcPbRMxLC5BHItVyECxROWgXGkr57XT1KFCHr';
    putenv('APP_SECRET=mnS5EYHqv6RfLETl5C5fenhnrbcUcPbRMxLC5BHItVyECxROWgXGkr57XT1KFCHr');
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
    header('Content-Type: application/json');
    echo json_encode(array_merge(['success' => $success], $data));
    exit;
}

function jsonError(string $message, int $code = 500): void
{
    http_response_code($code);
    jsonResponse(false, ['error' => $message]);
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

    return $payload;
}

/**
 * Requiere un rol específico de administrador.
 */
function requireAdminRole(array $tokenData, array $allowedRoles = ['admin', 'superadmin']): void
{
    $role = $tokenData['rol'] ?? $tokenData['role'] ?? '';
    if (!in_array($role, $allowedRoles, true)) {
        jsonError('No tienes permisos para realizar esta acción', 403);
    }
}

/**
 * Requiere autenticación de escort (cualquier token válido de escort).
 */
function requireEscortAuth(): array
{
    return requireAuth();
}
