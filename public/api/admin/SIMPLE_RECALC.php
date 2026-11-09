<?php
// Simple SQL executor - minimal
$host = 'localhost';
$dbname = 'consexvip_app';
$user = 'consexvip_app';
$pass = 'bdNbHHaqrsbSmpLbLYsF';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Check token
    $token = $_GET['token'] ?? '';
    $secret = '55b8746e35321d4dd2895e8ba9217a5bbfa8827267eca9affe714e85aa3ff33c';
    if ($token !== $secret) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
    
    $pdo->exec("SET NAMES utf8mb4");
    
    $sql = "UPDATE escorts e SET
        e.rating = (SELECT COALESCE(AVG(c.puntuacion), 0) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1),
        e.total_valoraciones = (SELECT COUNT(*) FROM comentarios c WHERE c.escort_id = e.id AND c.aprobado = 1)";
    
    $affected = $pdo->exec($sql);
    
    $stats = $pdo->query("SELECT COUNT(*) as total FROM escorts")->fetch();
    
    echo json_encode([
        'success' => true,
        'affected' => $affected,
        'total_escorts' => $stats['total'],
        'message' => 'Recálculo completado'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
