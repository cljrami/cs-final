<?php
// public/api/blog/articulos.php
// API pública de lectura. Devuelve artículos para la sección
// del homepage (solo publicados). Sin autenticación.

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../bootstrap.php';

    $pdo = getDBConnection();

    // Homepage: últimos artículos publicados (los destacados van primero)
    $limit = isset($_GET['limit']) ? max(1, min(6, intval($_GET['limit']))) : 3;

    $where = "estado = 'publicado' AND robots IN ('index', 'noindex')";

    $sql = "
        SELECT 
            a.id, a.titulo, a.slug, a.imagen, a.extracto, a.autor,
            a.meta_titulo, a.meta_descripcion, a.url_externa, a.published_at,
            c.nombre AS categoria_nombre
        FROM articulos a
        LEFT JOIN blog_categorias c ON c.id = a.categoria_id
        WHERE $where
        ORDER BY a.destacado DESC, a.published_at DESC, a.id DESC
        LIMIT ?
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $articulos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'articulos' => $articulos]);
} catch (Throwable $e) {
    error_log("Error blog/articulos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}