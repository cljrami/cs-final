<?php
// public/api/escorts/buscar.php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/gira.php';

try {
    $pdo = getDBConnection();
    $q = $_GET['q'] ?? '';
    $limit = min(20, max(1, intval($_GET['limit'] ?? 10)));

    if (strlen($q) < 2) {
        echo json_encode(['success' => true, 'data' => []]);
        exit;
    }

    // Normalizar: quitar acentos para búsqueda
    function normalize($str) {
        $str = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str);
        return strtolower($str);
    }

    $qNorm = normalize($q);
    $words = preg_split('/\s+/', $qNorm, -1, PREG_SPLIT_NO_EMPTY);

    // Construir condiciones: cada palabra debe coincidir en ALGÚN campo
    $conditions = [];
    $params = [];

    // Campos de texto del perfil
    $fields = [
        'e.nombre', 'e.usuario', 'e.ciudad', 'gc.nombre', 'e.descripcion_corta', 'e.descripcion_larga',
        'e.nacionalidad', 'e.etnia', 'e.color_ojos', 'e.color_pelo',
        'e.orientacion', 'e.estilo', 'e.telefono', 'e.whatsapp',
        'e.medidas', 'e.altura', 'e.peso'
    ];

    // Para cada palabra del query, crear OR entre todos los campos
    $whereParts = [];
    foreach ($words as $word) {
        $term = '%' . $word . '%';
        $fieldConditions = [];
        foreach ($fields as $f) {
            $fieldConditions[] = "LOWER($f) LIKE ?";
            $params[] = $term;
        }
        // Servicios
        $fieldConditions[] = "EXISTS (
            SELECT 1 FROM escort_servicios es2 
            JOIN servicios s2 ON s2.id = es2.servicio_id 
            WHERE es2.escort_id = e.id AND LOWER(s2.nombre) LIKE ?
        )";
        $params[] = $term;

        $whereParts[] = '(' . implode(' OR ', $fieldConditions) . ')';
    }

    // Todas las palabras deben coincidir (AND entre palabras)
    $whereClause = implode(' AND ', $whereParts);
    $params[] = $limit;

    $stmt = $pdo->prepare("
        SELECT 
            e.id,
            e.nombre,
            e.slug,
            e.edad,
            e.ciudad,
            COALESCE(NULLIF(e.foto_principal, ''), pf.url) as foto_principal,
            e.vip,
            e.verificado,
            e.estado
        FROM escorts e
        LEFT JOIN escort_fotos pf ON pf.escort_id = e.id AND pf.es_portada = 1
        LEFT JOIN ciudades gc ON gc.id = e.gira_ciudad_id
        WHERE e.activa = 1 
          AND e.eliminada = 0
          AND EXISTS (
              SELECT 1 FROM suscripciones s 
              WHERE s.escort_id = e.id 
                AND s.fecha_aprobacion IS NOT NULL 
                AND s.estado = 'activa' 
                AND s.fecha_fin >= CURDATE()
          )
          AND $whereClause
        ORDER BY e.visitas_perfil DESC
        LIMIT ?
    ");

    $stmt->execute($params);
    $escorts = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => $escorts,
        'query' => $q
    ]);
} catch (Exception $e) {
    error_log("Error buscar.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error del servidor'
    ]);
}
