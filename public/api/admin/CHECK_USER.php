<?php
$host = 'localhost';
$dbname = 'consexvip_app';
$user = 'kimi';
$pass = 'CUERAzzCX2FZ9xRDfFUR';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    $token = $_GET['token'] ?? '';
    $secret = '55b8746e35321d4dd2895e8ba9217a5bbfa8827267eca9affe714e85aa3ff33c';
    if ($token !== $secret) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
    
    $count = $pdo->query("SELECT COUNT(*) FROM escorts")->fetchColumn();
    
    // Sample a few
    $sample = $pdo->query("SELECT id, nombre FROM escorts ORDER BY id DESC LIMIT 10")->fetchAll();
    
    echo json_encode([
        'user' => $user,
        'db' => $dbname,
        'total_escorts' => (int)$count,
        'sample' => $sample
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage(), 'user' => $user]);
}
