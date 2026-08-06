<?php
// migraciones/backfill_pausas.php (versión web desplegable)
// Reconstruye dias_pausados, fecha_pausa y fecha_fin de suscripciones base
// según el modelo unificado de pausas (días activos fijos).
//
//   fecha_fin = fecha_aprobacion (o fecha_inicio) + duracion_dias + dias_pausados
//   dias_pausados = suma de la duración REAL de cada pausa completada
//                   (emparejando 'pausa' → 'reactivacion' por fecha_accion).
//
// Cómo ejecutarlo en el sitio (tras el build/deploy):
//   https://tusitio.cl/migraciones/backfill_pausas.php?token=TU_TOKEN
//
// NOTA DE SEGURIDAD: cambia BACKFILL_TOKEN por un valor secreto.

define('BACKFILL_TOKEN', 'f2cadcdbfcf3aab6cf49ce6ec93cc997f5f7935219dfbdb0135e8ebc903cb6a0');

$esCLI = (PHP_SAPI === 'cli');

if (!$esCLI) {
    header('Content-Type: text/plain; charset=utf-8');
    if (!isset($_GET['token']) || $_GET['token'] !== BACKFILL_TOKEN) {
        http_response_code(403);
        echo "Acceso denegado. Token inválido.\n";
        exit(1);
    }
}

$bootstrapCandidates = array(
    __DIR__ . '/../api/bootstrap.php',
    __DIR__ . '/api/bootstrap.php',
    getcwd() . '/api/bootstrap.php'
);
$bootstrapFound = null;
foreach ($bootstrapCandidates as $c) {
    if (file_exists($c)) {
        $bootstrapFound = $c;
        break;
    }
}
if (!$bootstrapFound) {
    if ($esCLI) {
        fwrite(STDERR, "No se encontró bootstrap.php. Sube este script junto a la carpeta api/ o ejecútalo desde la raíz del proyecto.\n");
    } else {
        echo "No se encontró bootstrap.php. Sube este script junto a la carpeta api/.\n";
    }
    exit(1);
}
require_once $bootstrapFound;

function backfill_fecha_base($row)
{
    if (!empty($row['fecha_aprobacion'])) {
        return date('Y-m-d', strtotime($row['fecha_aprobacion']));
    }
    if (!empty($row['fecha_inicio'])) {
        return date('Y-m-d', strtotime($row['fecha_inicio']));
    }
    return null;
}

$pdo = getDBConnection();

$stmt = $pdo->query("
    SELECT s.id, s.estado, s.fecha_aprobacion, s.fecha_inicio, s.fecha_fin,
           COALESCE(s.dias_pausados, 0) as dias_pausados_actual,
           COALESCE(s.fecha_pausa, '') as fecha_pausa_actual,
           p.duracion_dias
    FROM suscripciones s
    LEFT JOIN planes p ON p.id = s.plan_id
    WHERE (p.tipo = 'base' OR p.tipo IS NULL)
");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$actualizadosDias = 0;
$actualizadosFecha = 0;
$actualizadosPausa = 0;

foreach ($rows as $r) {
    $id = (int)$r['id'];

    // ── Reconstruir dias_pausados emparejando pausa → reactivación ──
    $hp = $pdo->prepare("
        SELECT accion, fecha_accion
        FROM historial_pausas
        WHERE suscripcion_id = ?
        ORDER BY fecha_accion ASC, id ASC
    ");
    $hp->execute([$id]);
    $eventos = $hp->fetchAll(PDO::FETCH_ASSOC);

    $diasPausados = 0;
    $fechaPausaPendiente = null; // pausa sin reactivación (pausa vigente)
    foreach ($eventos as $ev) {
        if ($ev['accion'] === 'pausa') {
            $fechaPausaPendiente = $ev['fecha_accion'];
        } elseif ($ev['accion'] === 'reactivacion' && $fechaPausaPendiente) {
            $inicio = new DateTime(date('Y-m-d', strtotime($fechaPausaPendiente)));
            $fin = new DateTime(date('Y-m-d', strtotime($ev['fecha_accion'])));
            $diasPausados += (int)$inicio->diff($fin)->days;
            $fechaPausaPendiente = null;
        }
    }

    // ── Actualizar dias_pausados si difiere ──
    if ($diasPausados !== (int)$r['dias_pausados_actual']) {
        $upd = $pdo->prepare("UPDATE suscripciones SET dias_pausados = ? WHERE id = ?");
        $upd->execute([$diasPausados, $id]);
        $actualizadosDias++;
    }

    // ── Pausa vigente: fijar fecha_pausa si falta ──
    if ($r['estado'] === 'pausada' && $fechaPausaPendiente && empty($r['fecha_pausa_actual'])) {
        $fechaPausa = date('Y-m-d', strtotime($fechaPausaPendiente));
        $upd = $pdo->prepare("UPDATE suscripciones SET fecha_pausa = ? WHERE id = ?");
        $upd->execute([$fechaPausa, $id]);
        $actualizadosPausa++;
    }

    // ── Recalcular fecha_fin desde la base ──
    $base = backfill_fecha_base($r);
    if ($base) {
        $duracion = max(0, (int)$r['duracion_dias']);
        $nueva = date('Y-m-d', strtotime($base . " +" . ($duracion + $diasPausados) . " days"));
        if (date('Y-m-d', strtotime($r['fecha_fin'])) !== $nueva) {
            $upd = $pdo->prepare("UPDATE suscripciones SET fecha_fin = ? WHERE id = ?");
            $upd->execute([$nueva, $id]);
            $actualizadosFecha++;
        }
    }
}

echo "Backfill de pausas completado.\n";
echo "Suscripciones con dias_pausados actualizado: {$actualizadosDias}\n";
echo "Suscripciones con fecha_fin recalculada:      {$actualizadosFecha}\n";
echo "Suscripciones con fecha_pausa fijada:         {$actualizadosPausa}\n";
