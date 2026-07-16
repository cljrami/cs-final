<?php
// Migración: aprobación de cuenta de escort + ENUM de notificaciones
// Uso: subir a la raíz public_html y abrir vía navegador, luego borrar.
// Es idempotente: se puede ejecutar varias veces sin error.

header('Content-Type: text/plain; charset=utf-8');

try {
    require_once __DIR__ . '/api/bootstrap.php';
    $pdo = getDBConnection();

    function columnaExiste($pdo, string $tabla, string $col): bool {
        $st = $pdo->prepare(
            "SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?"
        );
        $st->execute([$tabla, $col]);
        return (int)$st->fetchColumn() > 0;
    }

    // 1) Columna aprobada
    if (!columnaExiste($pdo, 'escorts', 'aprobada')) {
        $pdo->exec("ALTER TABLE escorts ADD COLUMN aprobada TINYINT(1) NOT NULL DEFAULT 0 AFTER activa");
        echo "✔ Columna 'aprobada' agregada.\n";
    } else {
        echo "• Columna 'aprobada' ya existe.\n";
    }

    $pdo->exec("UPDATE escorts SET aprobada = 1 WHERE estado = 'aprobada' AND aprobada = 0");
    echo "✔ Cuentas ya aprobadas actualizadas.\n";

    // 2) Extender ENUM de notificaciones
    $pdo->exec("ALTER TABLE notificaciones MODIFY COLUMN tipo ENUM(
        'vip_aprobado','nueva_valoracion','mensaje_nuevo','promocion','sistema',
        'cuenta_aprobada','verificacion_aprobada','verificacion_rechazada','vip_rechazado',
        'fotos_actualizadas','plan_aprobado','plan_rechazado','suscripcion_aprobada','comprobante_aprobado'
    ) NOT NULL");
    echo "✔ ENUM de notificaciones extendido.\n";

    echo "\nMIGRACIÓN COMPLETADA. Elimina este archivo.\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
