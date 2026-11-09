<?php
require_once __DIR__ . '/../bootstrap.php';
$tokenData = requireAuth();
requireAdminRole($tokenData);
header('Content-Type: application/json; charset=utf-8');
$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Asegurar tabla global
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `negocios_planes_global` (
      `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
      `nombre` varchar(150) NOT NULL,
      `duracion` enum('semanal','quincenal','mensual','trimestral','semestral','anual') NOT NULL DEFAULT 'mensual',
      `valor` decimal(10,2) NOT NULL DEFAULT 0.00,
      `activo` tinyint(1) NOT NULL DEFAULT 1,
      `orden` int(11) NOT NULL DEFAULT 0,
      `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
      `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch(Throwable $e){}

try {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT id, nombre, duracion, valor, activo, orden FROM negocios_planes_global ORDER BY orden ASC, nombre ASC");
        $planes = $stmt->fetchAll();
        jsonResponse(true, ['planes' => $planes]);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $nombre = trim($input['nombre'] ?? '');
    $duracion = $input['duracion'] ?? 'mensual';
    $valor = floatval($input['valor'] ?? 0);
    $activo = intval($input['activo'] ?? 1);
    $orden = intval($input['orden'] ?? 0);

    if ($nombre === '') { jsonResponse(false, ['error' => 'Nombre requerido']); return; }
    if (!in_array($duracion, ['semanal','quincenal','mensual','trimestral','semestral','anual'], true)) {
        jsonResponse(false, ['error' => 'Duración inválida']); return;
    }

    if ($method === 'POST') {
        $stmt = $pdo->prepare("INSERT INTO negocios_planes_global (nombre, duracion, valor, activo, orden) VALUES (?,?,?,?,?)");
        $stmt->execute([$nombre, $duracion, $valor, $activo, $orden]);
        jsonResponse(true, ['message' => 'Plan creado']);
        return;
    }

    if ($method === 'PUT') {
        $id = intval($input['id'] ?? 0);
        if (!$id) { jsonResponse(false, ['error' => 'ID requerido']); return; }
        $stmt = $pdo->prepare("UPDATE negocios_planes_global SET nombre=?, duracion=?, valor=?, activo=?, orden=? WHERE id=?");
        $stmt->execute([$nombre, $duracion, $valor, $activo, $orden, $id]);
        jsonResponse(true, ['message' => 'Plan actualizado']);
        return;
    }

    if ($method === 'DELETE') {
        $id = intval($_GET['id'] ?? 0);
        if (!$id) { jsonResponse(false, ['error' => 'ID requerido']); return; }
        $stmt = $pdo->prepare("DELETE FROM negocios_planes_global WHERE id=?");
        $stmt->execute([$id]);
        jsonResponse(true, ['message' => 'Plan eliminado']);
        return;
    }

    jsonResponse(false, ['error' => 'Método no soportado']);
} catch (Throwable $e) {
    http_response_code(500);
    jsonResponse(false, ['error' => $e->getMessage()]);
}
