<?php
require_once 'bootstrap.php';

$pdo = new PDO(
    "mysql:host=" . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
    DB_USER,
    DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

// Check if free plan exists and its properties
$stmt = $pdo->prepare("SELECT id, nombre, precio, tipo, max_fotos, max_videos, permite_vip, permite_destacado, permite_audio, uso_unico, max_pausas_permitidas FROM planes WHERE id = 7");
$stmt->execute();
$plan = $stmt->fetch(PDO::FETCH_ASSOC);

if ($plan) {
    echo "Plan ID 7 (Gratis por 7 Días):\n";
    echo "Nombre: " . $plan['nombre'] . "\n";
    echo "Precio: " . $plan['precio'] . "\n";
    echo "Tipo: " . $plan['tipo'] . "\n";
    echo "Max Fotos: " . $plan['max_fotos'] . "\n";
    echo "Max Videos: " . $plan['max_videos'] . "\n";
    echo "Permite VIP: " . ($plan['permite_vip'] ? 'Yes' : 'No') . "\n";
    echo "Permite Destacado: " . ($plan['permite_destacado'] ? 'Yes' : 'No') . "\n";
    echo "Permite Audio: " . ($plan['permite_audio'] ? 'Yes' : 'No') . "\n";
    echo "Uso Único: " . ($plan['uso_unico'] ? 'Yes' : 'No') . "\n";
    echo "Max Pausas Permitidas: " . $plan['max_pausas_permitidas'] . "\n";
    echo "Es Gratis: " . ($plan['es_gratis'] ? 'Yes' : 'No') . "\n";
} else {
    echo "Plan ID 7 not found\n";
}