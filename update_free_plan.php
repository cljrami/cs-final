<?php
require_once 'bootstrap.php';

$pdo = new PDO(
    'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
    DB_USER,
    DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

// Update the free plan (ID 7) to set es_gratis = true
$stmt = $pdo->prepare("UPDATE planes SET es_gratis = true WHERE id = 7");
$stmt->execute();

echo "Free plan updated successfully";