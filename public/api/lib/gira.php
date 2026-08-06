<?php
// public/api/lib/gira.php
// Lógica de modo "En Gira" (visita temporal a otra ciudad). PHP 7.4 compatible.
//
// Concepto de ciudad efectiva:
//   Mientras la gira está activa (en_gira = 1 y hoy entre gira_fecha_inicio y gira_fecha_fin),
//   la escort "vive" en la ciudad destino; si no, en su ciudad base (e.ciudad).
// - Todas las consultas públicas de ciudad deben filtrar por ciudad efectiva.
// - Al pasar gira_fecha_fin, limpiar_gira_vencida() auto-revierte a su ciudad base.

/**
 * Expresión SQL booleana: ¿la gira está activa hoy?
 * Asume que la tabla escorts tiene alias "e".
 */
function gira_activa()
{
    return "(e.en_gira = 1 AND (e.gira_fecha_inicio IS NULL OR e.gira_fecha_inicio <= CURDATE()) AND (e.gira_fecha_fin IS NULL OR e.gira_fecha_fin >= CURDATE()))";
}

/**
 * Expresión SQL de ciudad efectiva.
 *   CASE WHEN <gira activa> THEN gc.nombre ELSE e.ciudad END
 * Requiere JOIN ciudades gc ON gc.id = e.gira_ciudad_id en la consulta.
 */
function efectiva_ciudad()
{
    return "CASE WHEN " . gira_activa() . " THEN gc.nombre ELSE e.ciudad END";
}

/**
 * Auto-revert: limpia giras vencidas.
 * Devuelve el número de filas actualizadas.
 */
function limpiar_gira_vencida(PDO $pdo)
{
    $stmt = $pdo->prepare("
        UPDATE escorts
        SET en_gira = 0,
            gira_ciudad_id = NULL,
            gira_fecha_inicio = NULL,
            gira_fecha_fin = NULL
        WHERE en_gira = 1
          AND gira_fecha_fin IS NOT NULL
          AND gira_fecha_fin < CURDATE()
    ");
    $stmt->execute();
    return $stmt->rowCount();
}
