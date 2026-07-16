-- Vista para consultar el estado del plan activo de la escort
-- Usada por estado.php y otros endpoints
CREATE OR REPLACE VIEW `v_escort_plan_activo` AS
SELECT 
    e.id AS escort_id,
    CASE 
        WHEN s.id IS NULL THEN NULL
        WHEN s.estado = 'pausada' THEN GREATEST(0, DATEDIFF(s.fecha_fin, CURDATE()) + COALESCE((
            SELECT SUM(hp.dias_acumulados_pausa) 
            FROM historial_pausas hp 
            WHERE hp.suscripcion_id = s.id AND hp.accion = 'pausa'
        ), 0))
        WHEN s.estado IN ('activa') THEN GREATEST(0, DATEDIFF(s.fecha_fin, CURDATE()))
        ELSE 0
    END AS dias_restantes_calculados,
    CASE 
        WHEN s.estado = 'activa' 
            AND s.fecha_aprobacion IS NOT NULL
            AND s.fecha_fin >= CURDATE()
            AND COALESCE((
                SELECT COUNT(*) 
                FROM historial_pausas hp 
                WHERE hp.suscripcion_id = s.id AND hp.accion = 'pausa'
            ), 0) < p.max_pausas_permitidas
            THEN 1
        ELSE 0
    END AS puede_pausar,
    CASE 
        WHEN s.estado = 'pausada' THEN 1
        ELSE 0
    END AS puede_reactivar,
    CASE 
        WHEN s.id IS NULL THEN 'No tienes un plan activo'
        WHEN s.fecha_aprobacion IS NULL AND s.fecha_rechazo IS NULL THEN 'Pendiente de aprobacion por el administrador'
        WHEN s.fecha_rechazo IS NOT NULL THEN 'Tu solicitud fue rechazada'
        WHEN s.estado = 'cancelada' THEN 'Tu plan fue cancelado'
        WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'Tu plan ha expirado'
        WHEN s.estado = 'activa' 
            AND COALESCE((
                SELECT COUNT(*) 
                FROM historial_pausas hp 
                WHERE hp.suscripcion_id = s.id AND hp.accion = 'pausa'
            ), 0) >= p.max_pausas_permitidas
            THEN CONCAT('Limite de ', p.max_pausas_permitidas, ' pausas alcanzado')
        WHEN s.estado = 'pausada' THEN NULL
        ELSE NULL
    END AS motivo_no_pausar,
    CASE 
        WHEN s.id IS NOT NULL AND s.fecha_fin >= CURDATE() AND s.estado IN ('activa', 'pausada') THEN 1
        ELSE 0
    END AS plan_vigente,
    CASE 
        WHEN s.id IS NULL THEN 'Sin plan'
        WHEN s.fecha_aprobacion IS NULL AND s.fecha_rechazo IS NULL THEN 'Pendiente de aprobacion'
        WHEN s.fecha_rechazo IS NOT NULL THEN 'Rechazado'
        WHEN s.estado = 'pausada' THEN 'Pausado'
        WHEN s.estado = 'activa' AND s.fecha_fin >= CURDATE() THEN 'Activo'
        WHEN s.estado = 'activa' AND s.fecha_fin < CURDATE() THEN 'Expirado'
        WHEN s.estado = 'cancelada' THEN 'Cancelado'
        ELSE 'Desconocido'
    END AS estado_texto
FROM escorts e
LEFT JOIN suscripciones s ON s.escort_id = e.id
LEFT JOIN planes p ON p.id = s.plan_id;
