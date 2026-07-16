<?php
/**
 * DIAGNÓSTICO DE BASE DE DATOS
 * 
 * Instrucciones:
 * 1. Sube este archivo al servidor (ej: public_html/sql/diagnosticar-bd.php)
 * 2. Accede via navegador: https://tudominio.com/sql/diagnosticar-bd.php
 * 3. Los resultados se muestran en pantalla
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../api/bootstrap.php';

echo "<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'>";
echo "<title>Diagnóstico BD - Sistema de Pausas</title>";
echo "<style>
    body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
    h1 { color: #ff6b6b; }
    h2 { color: #ffa502; margin-top: 30px; }
    table { border-collapse: collapse; margin: 10px 0; width: 100%; max-width: 900px; }
    th, td { border: 1px solid #2d2d44; padding: 8px 12px; text-align: left; }
    th { background: #2d2d44; color: #ffa502; }
    .ok { color: #2ed573; font-weight: bold; }
    .fail { color: #ff4757; font-weight: bold; }
    .warn { color: #ffa502; font-weight: bold; }
    .code { background: #2d2d44; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px; }
</style></head><body>";

echo "<h1>🔍 Diagnóstico BD - Sistema de Pausas</h1>";
echo "<p>Servidor: " . php_uname() . "</p>";
echo "<p>PHP: " . phpversion() . " | MySQL: " . DB_HOST . "/" . DB_NAME . "</p>";

try {
    $pdo = getDBConnection();
    echo "<p class='ok'>✅ Conexión a BD exitosa</p>";
} catch (Exception $e) {
    echo "<p class='fail'>❌ Error de conexión: " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "</body></html>";
    exit;
}

// ─── 1. TABLAS ───
echo "<h2>1. Tablas requeridas</h2>";
$tablas = ['suscripciones', 'planes', 'historial_pausas', 'escorts'];
echo "<table><tr><th>Tabla</th><th>Estado</th><th>Filas</th></tr>";

foreach ($tablas as $tabla) {
    $stmt = $pdo->query("SHOW TABLES LIKE '$tabla'");
    $existe = $stmt->fetch() ? true : false;
    $count = $existe ? $pdo->query("SELECT COUNT(*) FROM `$tabla`")->fetchColumn() : '-';
    $status = $existe ? "<span class='ok'>✅ Existe</span>" : "<span class='fail'>❌ NO existe</span>";
    echo "<tr><td><strong>$tabla</strong></td><td>$status</td><td>$count</td></tr>";
}
echo "</table>";

// ─── 2. VISTAS ───
echo "<h2>2. Vistas requeridas</h2>";
$vistas = ['v_escort_plan_activo'];
echo "<table><tr><th>Vista</th><th>Estado</th></tr>";

foreach ($vistas as $vista) {
    $stmt = $pdo->query("SHOW FULL TABLES WHERE TABLE_TYPE LIKE 'VIEW' AND Tables_in_" . DB_NAME . " = '$vista'");
    $existe = $stmt->fetch() ? true : false;
    $status = $existe ? "<span class='ok'>✅ Existe</span>" : "<span class='fail'>❌ NO existe</span>";
    echo "<tr><td><strong>$vista</strong></td><td>$status</td></tr>";
    
    if ($existe) {
        $def = $pdo->query("SHOW CREATE VIEW `$vista`")->fetch();
        echo "<tr><td colspan='2'><div class='code'>" . htmlspecialchars($def['Create View'] ?? '?') . "</div></td></tr>";
    }
}
echo "</table>";

// ─── 3. COLUMNAS ───
echo "<h2>3. Columnas críticas en suscripciones</h2>";
$columnas = ['eliminada', 'contador_pausas', 'max_pausas_permitidas', 'dias_pausados', 'fecha_pausa', 'fecha_reactivacion', 'fecha_rechazo'];
echo "<table><tr><th>Columna</th><th>Estado</th></tr>";

foreach ($columnas as $col) {
    $stmt = $pdo->query("SHOW COLUMNS FROM suscripciones LIKE '$col'");
    $existe = $stmt->fetch() ? true : false;
    $status = $existe ? "<span class='ok'>✅ Existe</span>" : "<span class='warn'>⚠️ NO existe</span>";
    echo "<tr><td><code>$col</code></td><td>$status</td></tr>";
}
echo "</table>";

// ─── 4. ESTRUCTURA COMPLETA DE suscripciones ───
echo "<h2>4. Estructura completa de suscripciones</h2>";
$stmt = $pdo->query("SHOW COLUMNS FROM suscripciones");
echo "<table><tr><th>Campo</th><th>Tipo</th><th>Null</th><th>Default</th></tr>";
while ($row = $stmt->fetch()) {
    echo "<tr><td><code>" . htmlspecialchars($row['Field']) . "</code></td><td>" . htmlspecialchars($row['Type']) . "</td><td>" . $row['Null'] . "</td><td>" . htmlspecialchars($row['Default'] ?? 'NULL') . "</td></tr>";
}
echo "</table>";

// ─── 5. DATOS DE PLANES ───
echo "<h2>5. Planes disponibles</h2>";
$stmt = $pdo->query("SELECT id, nombre, tipo, duracion_dias, precio, moneda, max_pausas_permitidas, dias_pausa_maximos FROM planes WHERE activo = 1");
echo "<table><tr><th>ID</th><th>Nombre</th><th>Tipo</th><th>Duración</th><th>Precio</th><th>Max Pausas</th><th>Días Pausa Max</th></tr>";
while ($row = $stmt->fetch()) {
    echo "<tr><td>{$row['id']}</td><td>" . htmlspecialchars($row['nombre']) . "</td><td>{$row['tipo']}</td><td>{$row['duracion_dias']}d</td><td>\${$row['precio']}</td><td>{$row['max_pausas_permitidas']}</td><td>{$row['dias_pausa_maximos']}</td></tr>";
}
echo "</table>";

// ─── 6. HISTORIAL DE PAUSAS (últimas 10) ───
echo "<h2>6. Últimas pausas registradas</h2>";
$stmt = $pdo->query("SELECT hp.*, e.nombre FROM historial_pausas hp JOIN escorts e ON e.id = hp.escort_id ORDER BY hp.id DESC LIMIT 10");
if ($stmt->rowCount() > 0) {
    echo "<table><tr><th>ID</th><th>Escort</th><th>Acción</th><th>Suscripción</th><th>Días Acum.</th><th>Fecha</th></tr>";
    while ($row = $stmt->fetch()) {
        echo "<tr><td>{$row['id']}</td><td>" . htmlspecialchars($row['nombre']) . "</td><td>{$row['accion']}</td><td>{$row['suscripcion_id']}</td><td>{$row['dias_acumulados_pausa']}</td><td>{$row['fecha_accion']}</td></tr>";
    }
    echo "</table>";
} else {
    echo "<p class='warn'>⚠️ No hay pausas registradas</p>";
}

// ─── 7. RESUMEN ───
echo "<h2>7. Resumen</h2>";
echo "<table><tr><th>Ítem</th><th>¿Ok?</th></tr>";

$checks = [
    'Tabla historial_pausas' => (bool)$pdo->query("SHOW TABLES LIKE 'historial_pausas'")->fetch(),

    'Vista v_escort_plan_activo' => (bool)$pdo->query("SHOW FULL TABLES WHERE TABLE_TYPE LIKE 'VIEW' AND Tables_in_" . DB_NAME . " = 'v_escort_plan_activo'")->fetch(),
    'Columna suscripciones.eliminada' => (bool)$pdo->query("SHOW COLUMNS FROM suscripciones LIKE 'eliminada'")->fetch(),
    'Columna suscripciones.contador_pausas' => (bool)$pdo->query("SHOW COLUMNS FROM suscripciones LIKE 'contador_pausas'")->fetch(),
    'Columna suscripciones.fecha_rechazo' => (bool)$pdo->query("SHOW COLUMNS FROM suscripciones LIKE 'fecha_rechazo'")->fetch(),
];

foreach ($checks as $item => $ok) {
    $icon = $ok ? "<span class='ok'>✅</span>" : "<span class='fail'>❌</span>";
    echo "<tr><td>$item</td><td>$icon</td></tr>";
}
echo "</table>";

echo "<hr><p>📌 Si falta <strong>v_escort_plan_activo</strong>, ejecuta la migración en <code>sql/migrations/004_create_v_escort_plan_activo.sql</code></p>";
echo "<p>📌 Si falta <code>suscripciones.eliminada</code>, ejecuta: <code>ALTER TABLE suscripciones ADD eliminada tinyint(1) DEFAULT 0;</code></p>";

echo "</body></html>";
