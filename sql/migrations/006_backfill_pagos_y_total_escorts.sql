-- ============================================================
-- Migration 006: Backfill pagos + total_escorts en tablas admin
-- ============================================================

-- 1. CREAR PAGOS PARA ESCORTS APROBADOS SIN PAGO
-- Usa el plan que cada escort seleccionó (de su suscripción), o fallback al plan base activo más barato
INSERT INTO pagos (escort_id, plan_id, concepto, monto, moneda, metodo_pago, estado_pago, notas, creado_en, pagado_en)
SELECT 
    e.id,
    COALESCE(
        (SELECT s.plan_id FROM suscripciones s 
         JOIN planes pl ON pl.id = s.plan_id AND pl.tipo = 'base' 
         WHERE s.escort_id = e.id 
         ORDER BY s.fecha_inicio DESC LIMIT 1),
        (SELECT id FROM planes WHERE activo = 1 AND precio > 0 AND tipo = 'base' ORDER BY precio ASC LIMIT 1)
    ),
    'plan',
    COALESCE(
        (SELECT pl.precio FROM suscripciones s 
         JOIN planes pl ON pl.id = s.plan_id AND pl.tipo = 'base' 
         WHERE s.escort_id = e.id 
         ORDER BY s.fecha_inicio DESC LIMIT 1),
        (SELECT precio FROM planes WHERE activo = 1 AND precio > 0 AND tipo = 'base' ORDER BY precio ASC LIMIT 1),
        0
    ),
    'CLP',
    'transferencia',
    'completado',
    'Backfill automático',
    NOW(),
    NOW()
FROM escorts e
WHERE (e.activa = 1 OR e.aprobada = 1 OR e.estado = 'aprobada')
AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.escort_id = e.id);

-- 2. AGREGAR total_escorts A TABLAS FALTANTES
ALTER TABLE estilos ADD COLUMN IF NOT EXISTS total_escorts INT DEFAULT 0;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS total_escorts INT DEFAULT 0;
ALTER TABLE nacionalidades ADD COLUMN IF NOT EXISTS total_escorts INT DEFAULT 0;
ALTER TABLE orientaciones_sexuales ADD COLUMN IF NOT EXISTS total_escorts INT DEFAULT 0;
ALTER TABLE etnias ADD COLUMN IF NOT EXISTS total_escorts INT DEFAULT 0;
ALTER TABLE colores_pelo ADD COLUMN IF NOT EXISTS total_escorts INT DEFAULT 0;
ALTER TABLE colores_ojos ADD COLUMN IF NOT EXISTS total_escorts INT DEFAULT 0;

-- 3. ACTUALIZAR CONTADORES
UPDATE estilos s SET total_escorts = (SELECT COUNT(*) FROM escorts WHERE estilo = s.nombre AND eliminada = 0);
UPDATE servicios s SET total_escorts = (SELECT COUNT(*) FROM escort_servicios es JOIN escorts e ON e.id = es.escort_id WHERE es.servicio_id = s.id AND e.eliminada = 0);
UPDATE nacionalidades n SET total_escorts = (SELECT COUNT(*) FROM escorts WHERE nacionalidad = n.nombre AND eliminada = 0);
UPDATE orientaciones_sexuales o SET total_escorts = (SELECT COUNT(*) FROM escorts WHERE orientacion = o.nombre AND eliminada = 0);
UPDATE etnias e SET total_escorts = (SELECT COUNT(*) FROM escorts WHERE etnia = e.nombre AND eliminada = 0);
UPDATE colores_pelo c SET total_escorts = (SELECT COUNT(*) FROM escorts WHERE color_pelo = c.nombre AND eliminada = 0);
UPDATE colores_ojos c SET total_escorts = (SELECT COUNT(*) FROM escorts WHERE color_ojos = c.nombre AND eliminada = 0);
