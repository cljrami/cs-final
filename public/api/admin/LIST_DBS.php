<?php
$host = 'localhost';
$user = 'consexvip_app';
$pass = 'bdNbHHaqrsbSmpLbLYsF';

try {
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    $token = $_GET['token'] ?? '';
    $secret = '55b8746e35321d4dd2895e8ba9217a5bbfa8827267eca9affe714e85aa3ff33c';
    if ($token !== $secret) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
    
    // List databases
    $dbs = $pdo->query("SHOW DATABASES")->fetchAll(PDO::FETCH_COLUMN);
    
    echo json_encode(['databases' => $dbs]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
