<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
try {
    $pdo = getDBConnection();
    // Intentar tabla negocios_categorias
    $stmt = $pdo->query("SELECT id, nombre, slug, icono, color FROM negocios_categorias WHERE activa = 1 ORDER BY orden ASC, nombre ASC");
    $cats = $stmt->fetchAll();
    if ($cats) {
        jsonResponse(true, ['categorias' => $cats]);
        return;
    }
    // Fallback a enum
    $cats = [
        ['id'=>1,'nombre'=>'Night Club','slug'=>'night_club','icono'=>'fa-glass-cheers','color'=>'#ff3b30'],
        ['id'=>2,'nombre'=>'Discoteca','slug'=>'discoteca','icono'=>'fa-music','color'=>'#ff9500'],
        ['id'=>3,'nombre'=>'Sex Shop','slug'=>'sex_shop','icono'=>'fa-heart','color'=>'#ff2d55'],
        ['id'=>4,'nombre'=>'Bar','slug'=>'bar','icono'=>'fa-beer','color'=>'#0a84ff'],
        ['id'=>5,'nombre'=>'Sauna','slug'=>'sauna','icono'=>'fa-hot-tub','color'=>'#64d2ff'],
        ['id'=>6,'nombre'=>'Otro','slug'=>'otro','icono'=>'fa-store','color'=>'#64748b'],
    ];
    jsonResponse(true, ['categorias' => $cats]);
} catch (Throwable $e) {
    http_response_code(500);
    jsonResponse(false, ['error'=>$e->getMessage()]);
}
