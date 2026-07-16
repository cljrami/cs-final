-- Unificar sistema de extras en suscripciones
-- Paso 1: Agregar columna extra_tipo a planes
ALTER TABLE planes 
  ADD COLUMN extra_tipo VARCHAR(20) DEFAULT NULL 
  COMMENT 'destacado, sticky, otro (solo para tipo=extra)' 
  AFTER tipo;

-- Paso 2: Migrar extras desde tabla `extras` a `planes`
INSERT INTO planes (
  nombre, slug, descripcion, tipo, extra_tipo,
  duracion_dias, precio, moneda,
  max_fotos, max_videos,
  permite_vip, permite_destacado, uso_unico,
  badge, color_badge, color,
  max_pausas_permitidas, dias_pausa_maximos,
  orden, activo, creado_en, actualizado_en
)
SELECT 
  e.nombre,
  CONCAT('extra-', e.slug) AS slug,
  e.descripcion,
  'extra' AS tipo,
  e.tipo AS extra_tipo,
  e.duracion_dias,
  e.precio,
  e.moneda,
  0 AS max_fotos,
  0 AS max_videos,
  0 AS permite_vip,
  CASE WHEN e.tipo = 'destacado' THEN 1 ELSE 0 END AS permite_destacado,
  0 AS uso_unico,
  e.nombre AS badge,
  e.color_badge,
  COALESCE(e.color_badge, '#6b7280') AS color,
  0 AS max_pausas_permitidas,
  0 AS dias_pausa_maximos,
  e.orden,
  e.activo,
  e.creado_en,
  e.actualizado_en
FROM extras e;

-- Paso 3: Migrar escort_extras a suscripciones
INSERT INTO suscripciones (
  escort_id, plan_id,
  fecha_inicio, fecha_aprobacion, fecha_rechazo, fecha_fin,
  precio_pagado, moneda,
  estado,
  comprobante_pago, estado_pago, notas_pago,
  aprobado_por, rechazado_por, motivo_rechazo,
  creado_en, actualizado_en
)
SELECT 
  ee.escort_id,
  p.id AS plan_id,
  ee.fecha_inicio,
  COALESCE(ee.fecha_inicio, ee.creado_en) AS fecha_aprobacion,
  NULL AS fecha_rechazo,
  ee.fecha_fin,
  ee.precio_pagado,
  ee.moneda,
  ee.estado,
  ee.comprobante_pago,
  ee.estado_pago,
  ee.notas_pago,
  ee.aprobado_por,
  ee.rechazado_por,
  ee.motivo_rechazo,
  ee.creado_en,
  ee.actualizado_en
FROM escort_extras ee
JOIN extras e ON e.id = ee.extra_id
JOIN planes p ON p.slug = CONCAT('extra-', e.slug) AND p.tipo = 'extra'
WHERE p.id IS NOT NULL;

-- Paso 4: Actualizar flags destacado/sticky en escorts según suscripciones activas
UPDATE escorts e
JOIN suscripciones s ON s.escort_id = e.id AND s.estado = 'activa' AND s.fecha_fin >= CURDATE()
JOIN planes p ON p.id = s.plan_id AND p.tipo = 'extra'
SET e.destacado = CASE WHEN p.extra_tipo = 'destacado' THEN 1 ELSE e.destacado END,
    e.sticky = CASE WHEN p.extra_tipo = 'sticky' THEN 1 ELSE e.sticky END,
    e.fecha_destacado_expira = CASE WHEN p.extra_tipo = 'destacado' THEN s.fecha_fin ELSE e.fecha_destacado_expira END;

-- Paso 5: Eliminar tablas viejas
DROP TABLE IF EXISTS escort_extras;
DROP TABLE IF EXISTS extras;

-- Nota: Después de ejecutar esta migración, actualizar el sidebar admin
-- y eliminar solicitudes-extras.php, SolicitudesExtrasData.tsx
