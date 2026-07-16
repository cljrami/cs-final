<?php
/**
 * Migración: Unificar escorts con verificado=1 sin registro en verificaciones
 * 
 * Uso: php sql/migrations/007_migrar_verificado_legacy.php
 */

$envFile = __DIR__ . '/../../public/api/.env';
if (!file_exists($envFile)) {
    die("Error: No se encuentra .env en $envFile\n");
}

$env = parse_ini_file($envFile);
$required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'];
foreach ($required as $key) {
    if (empty($env[$key])) {
        die("Error: Falta $key en .env\n");
    }
}

try {
    $dsn = 'mysql:host=' . $env['DB_HOST'] . ';dbname=' . $env['DB_NAME'] . ';charset=utf8mb4';
    $pdo = new PDO($dsn, $env['DB_USER'], $env['DB_PASS'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec("SET NAMES utf8mb4");

    echo "Buscando escorts legacy (verificado=1 sin registro en verificaciones)...\n";

    $stmt = $pdo->query("
        SELECT e.id, e.nombre, e.email, e.updated_at
        FROM escorts e 
        WHERE e.verificado = 1 
        AND NOT EXISTS (SELECT 1 FROM verificaciones v WHERE v.escort_id = e.id)
    ");
    $legacyEscorts = $stmt->fetchAll();

    if (empty($legacyEscorts)) {
        echo "No hay escorts legacy pendientes de migrar.\n";
        exit(0);
    }

    echo "Se encontraron " . count($legacyEscorts) . " escorts legacy.\n\n";

    $insertStmt = $pdo->prepare("
        INSERT INTO verificaciones 
        (escort_id, foto_perfil_real, foto_documento, estado, notas_revision, revisado_en, creado_en) 
        VALUES (?, 'migracion_legacy', '', 'aprobada', 'Migrada automaticamente desde sistema legacy', NOW(), ?)
    ");

    $count = 0;
    foreach ($legacyEscorts as $escort) {
        $creadoEn = $escort['updated_at'] ?? date('Y-m-d H:i:s');
        $insertStmt->execute([$escort['id'], $creadoEn]);
        $count++;
        echo "  #{$escort['id']} {$escort['nombre']} ({$escort['email']})\n";
    }

    echo "\nMigracion completada: {$count} registros creados en verificaciones.\n";

} catch (PDOException $e) {
    echo "Error BD: " . $e->getMessage() . "\n";
    exit(1);
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
