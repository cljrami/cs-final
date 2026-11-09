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
    // Suplantar escort es privilegio alto: solo admin/superadmin (no moderador).
    requireAdminRole($tokenData, ['admin', 'superadmin']);
    $pdo = getDBConnection();
    compatEnsureTokenVersion();

    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonError('ID de escort requerido', 400);
    }

    $stmt = $pdo->prepare("SELECT id, usuario, nombre, primer_login, eliminada, token_version FROM escorts WHERE id = ?");
    $stmt->execute([$id]);
    $escort = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$escort) {
        jsonError('Escort no encontrada', 404);
    }
    if ((int)$escort['eliminada'] === 1) {
        jsonError('La cuenta de la escort está eliminada', 403);
    }

    $token = signToken([
        'id' => (int)$escort['id'],
        'usuario' => $escort['usuario'],
        'tipo' => 'escort',
        'tv' => (int)($escort['token_version'] ?? 0),
        'primer_login' => (int)$escort['primer_login'],
        'admin_acting' => (int)($tokenData['id'] ?? 0),
        'exp' => time() + (7 * 24 * 60 * 60)
    ]);

    // Auditoría: quién suplantó a quién.
    try {
        $pdo->prepare("INSERT INTO logs_auditoria (usuario_id, escort_id, accion, tabla_afectada, registro_id, datos_nuevos, ip_address) VALUES (?, ?, 'login_as_escort', 'escorts', ?, ?, ?)")
            ->execute([(int)($tokenData['id'] ?? 0), (int)$escort['id'], (int)$escort['id'], json_encode(['escort_nombre' => $escort['nombre']]), $_SERVER['REMOTE_ADDR'] ?? null]);
    } catch (Throwable $auditErr) {
        error_log('escort-login-as audit error: ' . $auditErr->getMessage());
    }

    echo json_encode([
        'success' => true,
        'token' => $token,
        'escort' => [
            'id' => (int)$escort['id'],
            'usuario' => $escort['usuario'],
            'nombre' => $escort['nombre']
        ]
    ]);
} catch (Throwable $e) {
    error_log("Error escort-login-as.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
