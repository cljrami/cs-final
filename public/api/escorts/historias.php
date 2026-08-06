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
    require_once __DIR__ . '/../lib/gira.php';

    $pdo = getDBConnection();

    // Limpiar historias expiradas
    $pdo->prepare("DELETE FROM escort_historias WHERE expira_en < NOW()")->execute();

    $where = "e.activa = 1 AND e.eliminada = 0";
    $params = [];

    if (!empty($_GET['ciudad'])) {
        $giraCond = gira_activa();
        $where .= " AND (({$giraCond} AND gc.nombre = ?) OR (NOT ({$giraCond}) AND e.ciudad = ?))";
        $params[] = $_GET['ciudad'];
        $params[] = $_GET['ciudad'];
    }

    $stmt = $pdo->prepare("
        SELECT
            h.id,
            h.escort_id,
            h.url,
            h.tipo,
            h.creado_en,
            e.nombre,
            e.foto_principal,
            (SELECT f.url FROM escort_fotos f WHERE f.escort_id = e.id AND f.es_portada = 1 LIMIT 1) as foto_portada,
            e.vip,
            e.verificado
        FROM escort_historias h
        JOIN escorts e ON e.id = h.escort_id
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE h.expira_en > NOW()
          AND $where
          AND EXISTS (SELECT 1 FROM suscripciones s WHERE s.escort_id = e.id AND s.fecha_aprobacion IS NOT NULL AND s.estado = 'activa' AND s.fecha_fin >= CURDATE())
        ORDER BY e.vip DESC, h.creado_en DESC
    ");
    $stmt->execute($params);
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

        $fotoPortada = $r['foto_portada'];
        if ($fotoPortada && strpos($fotoPortada, '/api/serve-upload.php') !== 0 && strpos($fotoPortada, 'http') !== 0) {
            $fotoPortada = '/api/serve-upload.php?path=/' . ltrim($fotoPortada, '/');
        }

        if (!isset($escorts[$eid])) {
            $escorts[$eid] = [
                'escort_id' => $eid,
                'nombre' => $r['nombre'],
                'foto_principal' => $foto,
                'foto_portada' => $fotoPortada,
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
