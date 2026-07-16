<?php
// public/api/escorts/historias.php - Historias activas agrupadas por escort (publico)

header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();

    // Limpiar historias expiradas
    $pdo->prepare("DELETE FROM escort_historias WHERE expira_en < NOW()")->execute();

    $stmt = $pdo->query("
        SELECT
            h.id,
            h.escort_id,
            h.url,
            h.tipo,
            h.creado_en,
            e.nombre,
            e.foto_principal,
            e.vip,
            e.verificado
        FROM escort_historias h
        JOIN escorts e ON e.id = h.escort_id
        WHERE h.expira_en > NOW()
          AND e.activa = 1
          AND e.eliminada = 0
        ORDER BY e.vip DESC, h.creado_en DESC
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $escorts = [];
    foreach ($rows as $r) {
        $eid = (int)$r['escort_id'];

        $url = $r['url'];
        if (strpos($url, '/api/serve-upload.php') !== 0) {
            $url = '/api/serve-upload.php?path=/' . ltrim($url, '/');
        }

        $foto = $r['foto_principal'];
        if ($foto && strpos($foto, '/api/serve-upload.php') !== 0 && strpos($foto, 'http') !== 0) {
            $foto = '/api/serve-upload.php?path=/' . ltrim($foto, '/');
        }

        if (!isset($escorts[$eid])) {
            $escorts[$eid] = [
                'escort_id' => $eid,
                'nombre' => $r['nombre'],
                'foto_principal' => $foto,
                'vip' => (int)$r['vip'],
                'verificado' => (int)$r['verificado'],
                'historias' => [],
            ];
        }

        $escorts[$eid]['historias'][] = [
            'id' => (int)$r['id'],
            'url' => $url,
            'tipo' => $r['tipo'],
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => array_values($escorts),
        'total' => count($escorts),
    ]);
} catch (Throwable $e) {
    error_log("Error escorts/historias.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}
