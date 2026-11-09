<?php
require_once __DIR__ . '/../bootstrap.php';
$tokenData = requireAuth();
requireAdminRole($tokenData);

header('Content-Type: application/json; charset=utf-8');
$pdo = getDBConnection();

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'POST' || $method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $nombre = trim($input['nombre'] ?? '');
        $categoria = $input['categoria'] ?? 'otro';
        $ciudad_id = intval($input['ciudad_id'] ?? 0);
        $direccion = trim($input['direccion'] ?? '');
        $telefono = trim($input['telefono'] ?? '');
        $whatsapp = trim($input['whatsapp'] ?? '');
        $web = trim($input['web'] ?? '');
        $instagram = trim($input['instagram'] ?? '');
        $activo = intval($input['activo'] ?? 1);
        $destacado = intval($input['destacado'] ?? 0);
        $descripcion = trim($input['descripcion'] ?? '');
        $seo_title = trim($input['seo_title'] ?? '');
        $seo_description = trim($input['seo_description'] ?? '');
        $seo_keywords = trim($input['seo_keywords'] ?? '');
        $seo_og_image = trim($input['seo_og_image'] ?? '');
        $plan_id = intval($input['plan_id'] ?? 0);

        if ($nombre === '') {
            jsonResponse(false, ['error'=>'Nombre requerido','fieldErrors'=>['nombre'=>'Nombre requerido']]);
            return;
        }

        $slug = strtolower(preg_replace('/[^a-z0-9]+/i','-', $nombre));
        $slug = trim($slug,'-');

        if ($method === 'POST') {
            $stmt = $pdo->prepare("INSERT INTO negocios (nombre,slug,categoria,ciudad_id,direccion,telefono,whatsapp,web,instagram,activo,destacado,descripcion,seo_title,seo_description,seo_keywords,seo_og_image,plan_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
            $stmt->execute([$nombre,$slug,$categoria,$ciudad_id ?: null,$direccion,$telefono,$whatsapp,$web,$instagram,$activo,$destacado,$descripcion,$seo_title,$seo_description,$seo_keywords,$seo_og_image,$plan_id ?: null]);
            $id = $pdo->lastInsertId();
        } else {
            $id = intval($input['id'] ?? 0);
            if (!$id) { jsonResponse(false, ['error'=>'ID requerido']); return; }
            $stmt = $pdo->prepare("UPDATE negocios SET nombre=?, slug=?, categoria=?, ciudad_id=?, direccion=?, telefono=?, whatsapp=?, web=?, instagram=?, activo=?, destacado=?, descripcion=?, seo_title=?, seo_description=?, seo_keywords=?, seo_og_image=?, plan_id=? WHERE id=?");
            $stmt->execute([$nombre,$slug,$categoria,$ciudad_id ?: null,$direccion,$telefono,$whatsapp,$web,$instagram,$activo,$destacado,$descripcion,$seo_title,$seo_description,$seo_keywords,$seo_og_image,$plan_id ?: null,$id]);
        }
        jsonResponse(true, ['message'=>'Guardado']);
        return;
    }

    if ($method === 'DELETE') {
        $id = intval($_GET['id'] ?? 0);
        if (!$id) { jsonResponse(false, ['error'=>'ID requerido']); return; }
        $stmt = $pdo->prepare("DELETE FROM negocios WHERE id=?");
        $stmt->execute([$id]);
        jsonResponse(true, ['message'=>'Eliminado']);
        return;
    }

    // GET
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, min(200, intval($_GET['limit'] ?? 50)));
    $offset = ($page-1)*$limit;
    $search = trim($_GET['search'] ?? '');
    $categoria = trim($_GET['categoria'] ?? '');
    $estado = trim($_GET['estado'] ?? 'todos');

    $where = [];
    $params = [];
    if ($search !== '') { $where[] = "(n.nombre LIKE ? OR n.descripcion LIKE ?)"; $like='%'.$search.'%'; $params[]=$like; $params[]=$like; }
    if ($categoria !== '') { $where[] = "LOWER(n.categoria) = LOWER(?)"; $params[]=$categoria; }
    if ($estado === 'activos') { $where[] = "n.activo = 1"; }
    if ($estado === 'inactivos') { $where[] = "n.activo = 0"; }

    $whereSql = $where ? 'WHERE '.implode(' AND ', $where) : '';

    // stats
    $statsStmt = $pdo->query("SELECT COUNT(*) as total, SUM(activo) as activos, SUM(destacado) as destacados FROM negocios");
    $stats = $statsStmt->fetch();

    $stmt = $pdo->prepare("SELECT n.id, n.nombre, n.slug, n.categoria, n.activo, n.destacado, c.nombre AS ciudad_nombre FROM negocios n LEFT JOIN ciudades c ON c.id=n.ciudad_id $whereSql ORDER BY n.id DESC LIMIT ? OFFSET ?");
    $params[] = $limit; $params[] = $offset;
    $stmt->execute($params);
    $negocios = $stmt->fetchAll();

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM negocios n $whereSql");
    $countParams = array_slice($params, 0, -2);
    $countStmt->execute($countParams);
    $total = (int)$countStmt->fetchColumn();

    jsonResponse(true, [
        'negocios'=>$negocios,
        'stats'=>[
            'total'=> $stats['total'] ?? 0,
            'activos'=> $stats['activos'] ?? 0,
            'destacados'=> $stats['destacados'] ?? 0
        ],
        'pagination'=>[
            'page'=>$page,
            'limit'=>$limit,
            'total'=>$total,
            'pages'=>ceil($total/$limit)
        ]
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    jsonResponse(false, ['error'=>$e->getMessage()]);
}
