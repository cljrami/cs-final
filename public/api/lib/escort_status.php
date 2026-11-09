<?php
// public/api/lib/escort_status.php
// Helper centralizado para calcular estados efectivos de escort considerando plan vencido

if (!function_exists('getEscortEffectiveStatus')) {
    function getEscortEffectiveStatus(array $escort, bool $planVencido, bool $tienePlanBase = true): array
    {
        $verificadoVigente = $planVencido ? 0 : (int)($escort['verificado'] ?? 0);
        $vipVigente = $planVencido ? 0 : (int)($escort['vip'] ?? 0);

        // VIP también expira por fecha propia
        if ($vipVigente && !empty($escort['fecha_vip_expira']) && strtotime($escort['fecha_vip_expira']) < time()) {
            $vipVigente = 0;
        }

        // Destacado expira por fecha
        $destacadoVigente = (int)($escort['destacado'] ?? 0);
        if ($destacadoVigente && !empty($escort['fecha_destacado_expira']) && strtotime($escort['fecha_destacado_expira']) < time()) {
            $destacadoVigente = 0;
        }

        // Sticky expira por fecha
        $stickyVigente = (int)($escort['sticky'] ?? 0);
        if ($stickyVigente && !empty($escort['sticky_expira']) && strtotime($escort['sticky_expira']) < time()) {
            $stickyVigente = 0;
        }

        $activaVigente = $planVencido ? 0 : (int)($escort['activa'] ?? 0);

        return [
            // Valores CRUDOS (para admin/auditoría)
            'verificado' => (int)($escort['verificado'] ?? 0),
            'vip' => (int)($escort['vip'] ?? 0),
            'destacado' => (int)($escort['destacado'] ?? 0),
            'sticky' => (int)($escort['sticky'] ?? 0),
            // Valores EFECTIVOS (para frontend/directorio)
            'verificado_vigente' => $verificadoVigente,
            'vip_vigente' => $vipVigente,
            'destacado_vigente' => $destacadoVigente,
            'sticky_vigente' => $stickyVigente,
            'activa_vigente' => $activaVigente,
            'plan_vencido' => $planVencido,
            'tiene_plan_base' => $tienePlanBase,
        ];
    }
}

if (!function_exists('getPlanVencidoFromSubscription')) {
    function getPlanVencidoFromSubscription(?array $suscripcion): bool
    {
        if (!$suscripcion) {
            return true; // sin suscripción = plan vencido
        }

        if ($suscripcion['estado'] === 'pausada') {
            return false; // pausado no es vencido, está congelado
        }

        if ($suscripcion['estado'] !== 'activa') {
            return true; // pendiente, rechazada, cancelada = vencido para efectos de badges
        }

        if (empty($suscripcion['fecha_fin'])) {
            return true;
        }

        return strtotime($suscripcion['fecha_fin']) < time();
    }
}

if (!function_exists('getPlanBaseSuscripcion')) {    function getPlanBaseSuscripcion(PDO $pdo, int $escortId): ?array
    {
        $stmt = $pdo->prepare("
            SELECT s.*, p.duracion_dias
            FROM suscripciones s
            JOIN planes p ON p.id = s.plan_id
            WHERE s.escort_id = ? AND p.tipo = 'base'
            ORDER BY s.creado_en DESC
            LIMIT 1
        ");
        $stmt->execute([$escortId]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }
}

if (!function_exists('attachVigenciaBadges')) {
    // Agrega verificado_vigente / vip_vigente a cada fila de un listado
    // (las tarjetas públicas los exigen). Una sola consulta extra en total:
    // última suscripción base por escort + flags de la escort.
    // Sin plan base vigente => vencido (fail-closed, igual que el panel).
    function attachVigenciaBadges(PDO $pdo, array &$rows, string $idKey = 'id'): void
    {
        $ids = [];
        foreach ($rows as $r) {
            $id = (int)($r[$idKey] ?? 0);
            if ($id > 0) {
                $ids[$id] = $id;
            }
        }
        if (!$ids) {
            return;
        }
        $list = implode(',', $ids);

        $subs = [];
        $stmt = $pdo->query("
            SELECT s.escort_id, s.estado, s.fecha_fin
            FROM suscripciones s
            JOIN planes p ON p.id = s.plan_id AND (p.tipo = 'base' OR p.tipo IS NULL)
            WHERE s.escort_id IN ($list)
            ORDER BY s.creado_en DESC, s.id DESC
        ");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $s) {
            $eid = (int)$s['escort_id'];
            if (!isset($subs[$eid])) {
                $subs[$eid] = $s;
            }
        }

        $flags = [];
        $stmt2 = $pdo->query("SELECT id, vip, verificado, fecha_vip_expira FROM escorts WHERE id IN ($list)");
        foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $e) {
            $flags[(int)$e['id']] = $e;
        }

        foreach ($rows as &$r) {
            $eid = (int)($r[$idKey] ?? 0);
            $planVencido = getPlanVencidoFromSubscription($subs[$eid] ?? null);
            $f = $flags[$eid] ?? ['vip' => 0, 'verificado' => 0, 'fecha_vip_expira' => null];
            $ef = getEscortEffectiveStatus($f, $planVencido);
            $r['verificado_vigente'] = $ef['verificado_vigente'];
            $r['vip_vigente'] = $ef['vip_vigente'];
        }
        unset($r);
    }
}