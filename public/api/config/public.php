<?php
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/../bootstrap.php';
try {
    $pdo = getDBConnection();
    $stmt = $pdo->query("SELECT clave, valor FROM configuracion WHERE clave IN ('share_site_name','share_whatsapp_template','share_twitter_template','share_telegram_template','chat_whatsapp_template')");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $config = [];
    foreach ($rows as $r) { $config[$r['clave']] = $r['valor']; }
    // defaults
    $defaults = [
        'share_site_name' => 'Consexvip',
        'share_whatsapp_template' => 'Te recomiendo el perfil de {nombre} en {site_name}',
        'share_twitter_template' => 'Te recomiendo el perfil de {nombre} en {site_name}',
        'share_telegram_template' => 'Te recomiendo el perfil de {nombre} en {site_name}',
        'chat_whatsapp_template' => 'Hola, vi tu perfil en {site_name}. Me interesa conocer más sobre {nombre}.',
    ];
    $config = array_merge($defaults, $config);
    echo json_encode(['success'=>true,'config'=>$config]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>'Error servidor']);
}
