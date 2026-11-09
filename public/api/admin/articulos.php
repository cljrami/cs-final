<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function generarSlug($str)
{
    $str = strtolower(trim($str));
    $str = str_replace(
        ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ñ', 'Ü', 'à', 'è', 'ì', 'ò', 'ù'],
        ['a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u', 'n', 'u', 'a', 'e', 'i', 'o', 'u'],
        $str
    );
    $str = preg_replace('/[^a-z0-9]+/', '-', $str);
    return trim($str, '-');
}

require_once __DIR__ . '/../bootstrap.php';

try {
    $tokenData = requireAuth();

    requireAdminRole($tokenData);
    $pdo = getDBConnection();

    $method = $_SERVER['REQUEST_METHOD'];

    // === GET ===
    if ($method === 'GET') {
        $action = isset($_GET['accion']) ? trim($_GET['accion']) : 'listar';

        // Categorías (para el selector del formulario)
        if ($action === 'categorias') {
            $cats = $pdo->query("SELECT id, nombre, slug FROM blog_categorias ORDER BY nombre ASC")->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'categorias' => $cats]);
            exit;
        }

        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $estado = isset($_GET['estado']) ? $_GET['estado'] : 'todos';
        $categoriaId = isset($_GET['categoria_id']) ? intval($_GET['categoria_id']) : 0;
        $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 50;
        $offset = ($page - 1) * $limit;

        $stats = [
            'total' => (int)$pdo->query("SELECT COUNT(*) FROM articulos")->fetchColumn(),
            'publicados' => (int)$pdo->query("SELECT COUNT(*) FROM articulos WHERE estado = 'publicado'")->fetchColumn(),
            'borradores' => (int)$pdo->query("SELECT COUNT(*) FROM articulos WHERE estado = 'borrador'")->fetchColumn(),
        ];

        $where = [];
        $params = [];

        if ($estado !== 'todos' && in_array($estado, ['borrador', 'publicado', 'archivado'])) {
            $where[] = 'a.estado = ?';
            $params[] = $estado;
        }

        if ($categoriaId > 0) {
            $where[] = 'a.categoria_id = ?';
            $params[] = $categoriaId;
        }

        if ($search !== '') {
            $where[] = '(a.titulo LIKE ? OR a.slug LIKE ? OR a.autor LIKE ?)';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
            $params[] = '%' . $search . '%';
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $countSql = "SELECT COUNT(*) FROM articulos a $whereClause";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $totalFiltered = (int)$countStmt->fetchColumn();

        $sql = "
            SELECT 
                a.id, a.titulo, a.slug, a.imagen, a.extracto, a.autor, a.estado,
                a.destacado, a.vistas, a.meta_titulo, a.meta_descripcion, a.meta_keywords,
                a.url_externa, a.robots, a.canonical,                 a.ciudad_id,
                a.published_at, a.created_at, a.updated_at,
                a.categoria_id, c.nombre AS categoria_nombre
            FROM articulos a
            LEFT JOIN blog_categorias c ON c.id = a.categoria_id
            $whereClause
            ORDER BY a.updated_at DESC, a.id DESC
            LIMIT ? OFFSET ?
        ";

        $stmt = $pdo->prepare($sql);
        $allParams = array_merge($params, [$limit, $offset]);
        $stmt->execute($allParams);
        $articulos = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'articulos' => $articulos,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalFiltered,
                'pages' => ceil($totalFiltered / $limit),
                'hasMore' => ($page * $limit) < $totalFiltered
            ]
        ]);
        exit;
    }

    // === POST (crear articulo o categoria) ===
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $tipo = isset($input['tipo']) ? trim($input['tipo']) : 'articulo';

        // Crear categoría de blog
        if ($tipo === 'categoria') {
            $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
            $slug = isset($input['slug']) ? trim($input['slug']) : '';
            $descripcion = isset($input['descripcion']) ? trim($input['descripcion']) : '';
            $activa = isset($input['activa']) ? (int)$input['activa'] : 1;

            if (empty($slug) && !empty($nombre)) $slug = generarSlug($nombre);

            $fieldErrors = [];
            if (empty($nombre)) {
                $fieldErrors['nombre'] = 'El nombre es obligatorio';
            } elseif (strlen($nombre) > 100) {
                $fieldErrors['nombre'] = 'Máximo 100 caracteres';
            }
            if (!empty($slug)) {
                $dup = $pdo->prepare("SELECT id FROM blog_categorias WHERE slug = ?");
                $dup->execute([$slug]);
                if ($dup->fetch()) $fieldErrors['slug'] = 'Ya existe ese slug';
            }
            if (!empty($fieldErrors)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors]);
                exit;
            }

            $stmt = $pdo->prepare("INSERT INTO blog_categorias (nombre, slug, descripcion, activa) VALUES (?, ?, ?, ?)");
            $stmt->execute([$nombre, $slug, $descripcion, $activa]);
            echo json_encode(['success' => true, 'message' => 'Categoría creada', 'id' => (int)$pdo->lastInsertId()]);
            exit;
        }

        // Crear artículo
        $titulo = isset($input['titulo']) ? trim($input['titulo']) : '';
        $slug = isset($input['slug']) ? trim($input['slug']) : '';
        $imagen = isset($input['imagen']) ? trim($input['imagen']) : '';
        $extracto = isset($input['extracto']) ? trim($input['extracto']) : '';
        $contenido = isset($input['contenido']) ? trim($input['contenido']) : '';
        $autor = isset($input['autor']) ? trim($input['autor']) : '';
        $categoriaId = isset($input['categoria_id']) ? intval($input['categoria_id']) : 0;
        $etiquetas = isset($input['etiquetas']) ? trim($input['etiquetas']) : '';
        $estado = isset($input['estado']) && in_array($input['estado'], ['borrador', 'publicado', 'archivado']) ? $input['estado'] : 'borrador';
        $destacado = isset($input['destacado']) ? (int)$input['destacado'] : 0;

        $metaTitulo = isset($input['meta_titulo']) ? trim($input['meta_titulo']) : '';
        $metaDescripcion = isset($input['meta_descripcion']) ? trim($input['meta_descripcion']) : '';
        $metaKeywords = isset($input['meta_keywords']) ? trim($input['meta_keywords']) : '';
        $urlExterna = isset($input['url_externa']) ? trim($input['url_externa']) : '';
        $robots = isset($input['robots']) && $input['robots'] === 'noindex' ? 'noindex' : 'index';
        $canonical = isset($input['canonical']) ? trim($input['canonical']) : '';

        if (empty($slug) && !empty($titulo)) $slug = generarSlug($titulo);

        $fieldErrors = [];
        if (empty($titulo)) {
            $fieldErrors['titulo'] = 'El título es obligatorio';
        } elseif (strlen($titulo) > 200) {
            $fieldErrors['titulo'] = 'Máximo 200 caracteres';
        }
        if (!empty($slug)) {
            $dup = $pdo->prepare("SELECT id FROM articulos WHERE slug = ?");
            $dup->execute([$slug]);
            if ($dup->fetch()) $fieldErrors['slug'] = 'Ya existe ese slug';
        }
        if (!empty($urlExterna) && !preg_match('#^https?://#i', $urlExterna)) {
            $fieldErrors['url_externa'] = 'Debe ser una URL válida (https://...)';
        }
        if (!empty($canonical) && !preg_match('#^https?://#i', $canonical)) {
            $fieldErrors['canonical'] = 'Debe ser una URL válida (https://...)';
        }
        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors]);
            exit;
        }

        $publishedAt = ($estado === 'publicado') ? date('Y-m-d H:i:s') : null;

        $stmt = $pdo->prepare("
            INSERT INTO articulos 
                (titulo, slug, imagen, extracto, contenido, autor, categoria_id, ciudad_id, etiquetas,
                 estado, destacado, meta_titulo, meta_descripcion, meta_keywords, url_externa,
                 robots, canonical, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $titulo, $slug, $imagen, $extracto, $contenido, $autor,
            $categoriaId > 0 ? $categoriaId : null,
            (isset($input['ciudad_id']) ? intval($input['ciudad_id']) : null),
            $etiquetas,
            $estado, $destacado, $metaTitulo, $metaDescripcion, $metaKeywords,
            $urlExterna, $robots, $canonical, $publishedAt
        ]);

        $nuevoId = (int)$pdo->lastInsertId();
        if ($estado === 'publicado') {
            indexnowPing(['https://www.consexvip.cl/blog/' . $slug]);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Artículo creado',
            'id' => $nuevoId
        ]);
        exit;
    }

    // === PUT ===
    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? intval($input['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no válido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT id FROM articulos WHERE id = ?");
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No encontrado']);
            exit;
        }

        $updates = [];
        $values = [];
        $fieldErrors = [];

        if (isset($input['titulo'])) {
            $titulo = trim($input['titulo']);
            if (empty($titulo)) {
                $fieldErrors['titulo'] = 'El título no puede estar vacío';
            } elseif (strlen($titulo) > 200) {
                $fieldErrors['titulo'] = 'Máximo 200 caracteres';
            } else {
                $updates[] = 'titulo = ?';
                $values[] = $titulo;
            }
        }

        if (isset($input['slug'])) {
            $slug = trim($input['slug']);
            if (!empty($slug)) {
                $dup = $pdo->prepare("SELECT id FROM articulos WHERE slug = ? AND id != ?");
                $dup->execute([$slug, $id]);
                if ($dup->fetch()) {
                    $fieldErrors['slug'] = 'Slug duplicado';
                } else {
                    $updates[] = 'slug = ?';
                    $values[] = $slug;
                }
            }
        }

        $mapCampos = [
            'imagen' => 'imagen', 'extracto' => 'extracto', 'contenido' => 'contenido',
            'autor' => 'autor', 'etiquetas' => 'etiquetas', 'meta_titulo' => 'meta_titulo',
            'meta_descripcion' => 'meta_descripcion', 'meta_keywords' => 'meta_keywords',
            'url_externa' => 'url_externa', 'canonical' => 'canonical',
        ];
        foreach ($mapCampos as $keyIn => $col) {
            if (isset($input[$keyIn])) {
                $updates[] = "$col = ?";
                $values[] = trim($input[$keyIn]);
            }
        }

        if (isset($input['robots']) && in_array($input['robots'], ['index', 'noindex'])) {
            $updates[] = 'robots = ?';
            $values[] = $input['robots'];
        }

        if (isset($input['destacado'])) {
            $updates[] = 'destacado = ?';
            $values[] = (int)$input['destacado'];
        }

        if (isset($input['categoria_id'])) {
            $updates[] = 'categoria_id = ?';
            $values[] = (int)$input['categoria_id'] > 0 ? (int)$input['categoria_id'] : null;
        }
        if (isset($input['ciudad_id'])) {
            $updates[] = 'ciudad_id = ?';
            $values[] = (int)$input['ciudad_id'] > 0 ? (int)$input['ciudad_id'] : null;
        }

        if (isset($input['estado']) && in_array($input['estado'], ['borrador', 'publicado', 'archivado'])) {
            $updates[] = 'estado = ?';
            $values[] = $input['estado'];
            if ($input['estado'] === 'publicado') {
                $updates[] = 'published_at = COALESCE(published_at, NOW())';
            }
        }

        if (!empty($fieldErrors)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'fieldErrors' => $fieldErrors]);
            exit;
        }

        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Sin cambios']);
            exit;
        }

        $values[] = $id;
        $sql = "UPDATE articulos SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        $slugFinal = $input['slug'] ?? $slug;
        if (($input['estado'] ?? '') === 'publicado') {
            indexnowPing(['https://www.consexvip.cl/blog/' . $slugFinal]);
        }

        echo json_encode(['success' => true, 'message' => 'Artículo actualizado']);
        exit;
    }

    // === DELETE ===
    if ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no válido']);
            exit;
        }

        $checkStmt = $pdo->prepare("SELECT id FROM articulos WHERE id = ?");
        $checkStmt->execute([$id]);
        if (!$checkStmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'No encontrado']);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM articulos WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Eliminado']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
} catch (PDOException $e) {
    error_log("Error articulos.php PDO: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de base de datos']);
} catch (Throwable $e) {
    error_log("Error articulos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error del servidor']);
}