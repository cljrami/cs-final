<?php
require_once __DIR__ . '/bootstrap.php';

$pdo = getDBConnection();
$pass = 'admin123';
$hash = password_hash($pass, PASSWORD_DEFAULT);
echo json_encode([
    'password' => $pass,
    'hash' => $hash,
    'sql' => "UPDATE admins SET password_hash = '$hash' WHERE email = 'admin@kimi.cl';"
]);
