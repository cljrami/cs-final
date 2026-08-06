<?php
// public/api/lib/plan_pausas.php
// Lógica unificada de pausas de planes base. PHP 7.4 compatible (sin match / arrow functions).
//
// Modelo: días activos fijos.
//   fecha_fin = fecha_aprobacion + duracion_dias + suscripciones.dias_pausados
// - Pausar: estado = 'pausada', fecha_pausa = CURDATE() (el reloj se congela; fecha_fin no cambia).
// - Reactivar: dias_esta_pausa = hoy - fecha_pausa; dias_pausados += dias_esta_pausa;
//              fecha_fin se recalcula desde la base.
// - Plazo para pausar: desde la 1ª pausa (MIN fecha_accion de historial_pausas) se puede pausar
//              hasta fecha_primer_pausa + duracion_dias (calendario real). Luego se pierden
//              las pausas no usadas. Antes de la 1ª pausa no hay límite.
// No existe "ventana" de expiración del plan por fecha_primer_pausa (el vencimiento nunca
// se adelanta por pausar).

/**
 * Cuenta las pausas usadas de una suscripción.
 */
function plan_pausas_usadas(PDO $pdo, $suscripcionId)
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM historial_pausas
        WHERE suscripcion_id = ? AND accion = 'pausa'
    ");
    $stmt->execute([(int)$suscripcionId]);
    return (int)$stmt->fetchColumn();
}

/**
 * Días que lleva la pausa actual (desde fecha_pausa hasta hoy).
 */
function plan_dias_esta_pausa($fechaPausa)
{
    if (empty($fechaPausa)) {
        return 0;
    }
    $inicio = new DateTime(date('Y-m-d', strtotime($fechaPausa)));
    return (int)$inicio->diff(new DateTime())->days;
}

/**
 * Calcula la fecha de vencimiento según el modelo de días activos fijos.
 * Devuelve 'Y-m-d' o null si falta la fecha base.
 */
function plan_fecha_fin_calculada($fechaBase, $duracionDias, $diasPausados)
{
    if (empty($fechaBase)) {
        return null;
    }
    $duracion = max(0, (int)$duracionDias);
    $pausados = max(0, (int)$diasPausados);
    $totalDias = $duracion + $pausados;
    return date('Y-m-d', strtotime(date('Y-m-d', strtotime($fechaBase)) . " +{$totalDias} days"));
}

/**
 * Fecha de la primera pausa de una suscripción (accion = 'pausa').
 * Devuelve 'Y-m-d' o null si nunca ha pausado.
 */
function plan_fecha_primer_pausa(PDO $pdo, $suscripcionId)
{
    $stmt = $pdo->prepare("
        SELECT MIN(DATE(fecha_accion))
        FROM historial_pausas
        WHERE suscripcion_id = ? AND accion = 'pausa'
    ");
    $stmt->execute([(int)$suscripcionId]);
    $fecha = $stmt->fetchColumn();
    return $fecha ?: null;
}

/**
 * Plazo para usar pausas (calendario real, no se congela).
 *   limite = primera_pausa + duracion_dias
 * Sin primera pausa => no hay límite.
 * Devuelve ['limite' => 'Y-m-d'|null, 'dias_restantes' => int|null, 'vencido' => bool].
 */
function plan_plazo_pausas(PDO $pdo, $suscripcionId, $duracionDias)
{
    $primera = plan_fecha_primer_pausa($pdo, $suscripcionId);
    if (empty($primera)) {
        return ['limite' => null, 'dias_restantes' => null, 'vencido' => false];
    }
    $duracion = max(0, (int)$duracionDias);
    $primera = date('Y-m-d', strtotime($primera));
    $limite = date('Y-m-d', strtotime($primera . " +{$duracion} days"));
    $hoy = date('Y-m-d');
    $diasRestantes = (int)floor((strtotime($limite) - strtotime($hoy)) / 86400);
    return [
        'limite' => $limite,
        'dias_restantes' => max(0, $diasRestantes),
        'vencido' => $hoy > $limite
    ];
}

/**
 * Recalcula y persiste la fecha_fin de una suscripción desde su base.
 * Devuelve la nueva fecha_fin ('Y-m-d') o null si no se pudo calcular.
 */
function plan_recalcular_fecha_fin(PDO $pdo, $suscripcionId)
{
    $stmt = $pdo->prepare("
        SELECT s.fecha_aprobacion, s.fecha_inicio, s.fecha_fin,
               COALESCE(s.dias_pausados, 0) as dias_pausados,
               p.duracion_dias
        FROM suscripciones s
        LEFT JOIN planes p ON p.id = s.plan_id
        WHERE s.id = ?
    ");
    $stmt->execute([(int)$suscripcionId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }

    $base = !empty($row['fecha_aprobacion']) ? $row['fecha_aprobacion'] : $row['fecha_inicio'];
    $nueva = plan_fecha_fin_calculada($base, $row['duracion_dias'], $row['dias_pausados']);
    if ($nueva === null) {
        return null;
    }

    if ((string)$row['fecha_fin'] !== $nueva) {
        $upd = $pdo->prepare("UPDATE suscripciones SET fecha_fin = ? WHERE id = ?");
        $upd->execute([$nueva, (int)$suscripcionId]);
    }
    return $nueva;
}
