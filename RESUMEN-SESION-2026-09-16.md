# Resumen de sesión — 2026-09-16

## 1. Bloqueo por plan no activo (panel escort)
- Nuevo `src/hooks/usePlanEstado.ts`: lee `resumen.php`, regla **fail-closed** (`bloqueado = !planVigente && !planPausado`) + timeout 12s + reintento 30s.
- Nuevo `src/components/escort/BloqueoPlan.tsx`: **pantalla única** para todas las secciones. Variantes `vencido` ("Tu plan está vencido, no puedes modificar nada... Contratar un nuevo plan") y `sin-plan`.
- Nuevo `src/components/escort/PlanRequerido.tsx`: wrapper; pendiente-aprobación muestra tarjeta ámbar.
- Nuevo `src/components/escort/CargaSeccion.tsx`: skeleton neutro mientras carga (evita parpadeo de tarjetas).
- Envuelto en 10 páginas: perfil, fotos, historias, comentarios, estadísticas, datos, extras, vip, verificación, pausar-aviso (+ `client:only` en `PlanRequerido` — sin eso quedaba pegado cargando).
- `ResumenData`: sin plan vigente muestra Bienvenida + Pendiente + `BloqueoPlan` (sin datos/plan/extras/disponible/stats). Pausado sigue su flujo.
- `MiPlan`: con plan expirado/cancelado/rechazado oculta el detalle antiguo, solo aviso + CTA. Vista activa intacta.
- `ExtrasPlan`: extras antiguos solo con plan base activo.

## 2. Backend plan (`public/api/escort/resumen.php`, `mi-plan.php` intacto en lógica)
- Regla **"manda la última"**: la suscripción efectiva es la última base creada (no cualquiera activa con fecha lejana). Si hay plan previo vigente al contratar, se sigue con ese hasta aprobar.
- Motivo `vencido` correcto aunque la fila no sea `activa`; días restantes firmados (antes `diff()` absoluto daba días fantasma).
- `aprobar.php`: **reset completo** al aprobar tras vencimiento (verificado, vip, destacado, sticky+posiciones, disponible_ahora, extras viejos→expirada, VIP/verificación pendientes→rechazadas con nota). Pausas parten en 0 por suscripción nueva (lógica intacta).
- `solicitar-verificacion.php`: misma regla última-base + errores específicos por caso.
- `perfil-sidebar.php`: exige fecha vigente para plan/extras; sidebar muestra "Sin plan · Seleccionar plan" con CTA ámbar.

## 3. VIP unificado con Verificación (`SolicitarVip.tsx` ~1256→~740 líneas)
- Misma UI/proceso: header + tarjeta estado + beneficios + 1 modal (solicitar/re-subir/ver). Sin selector de duración (el VIP dura lo del plan base; backend ya era así). Cancelar solicitud dentro de detalles. Lógica/endpoints intactos.

## 4. Admin pagos (`public/api/admin/pagos.php` + `PagosData.tsx`)
- `LEFT JOIN` escorts/planes: pagos de escorts eliminadas **visibles** ("Escort eliminada #ID" + badge) y **eliminables**.
- Fix borrado suscripciones: `pago_id = -(100000 + s.id)` → `$subId = -$id - 100000`.
- Normalizados mensajes con encoding roto.

## 5. Badges públicos (portada/ciudades/perfil)
- Endpoints listados devuelven `verificado_vigente`/`vip_vigente` (inline donde hay filtro de plan; helper `attachVigenciaBadges()` en `lib/escort_status.php` para sticky/gira/favoritos/historias).
- Perfil público: pills VIP/Verificada bajo el nombre (antes no tenía nada).
- Iconos de cards agrandados (eran de 3-5px, invisibles). Se probaron pills sobre la foto y se **revirtieron** a pedido: solo iconos junto al nombre.

## 6. Stats admin escorts (`admin/escorts.php`)
- `activas` = último plan base en `activa` + fecha futura (las vencidas van a expiradas, nunca a activas). Filtro `activas` con la misma regla. Al reactivar vuelven solas.

## 7. Limpieza servidor + deploy
- Borrados del servidor: `debug_sticky.php`, `migraciones/`, `upload-debug.php`, sondas. Podados **583 chunks `_astro` huérfanos** (690→107) + poda automática en cada deploy.
- `health/cleanup/notificaciones` en `api/` pedían `../bootstrap.php` (500 siempre) → corregido; health con mensaje genérico.
- Secretos fuera del código: FTP por env/`.ftp-pass` (gitignored), `_ftp-download.js` y `sftp.json` limpios, `planes.sql` fuera de `public/`.
- **Rotación hecha por el usuario**: FTP, DB_PASS y APP_SECRET nuevos (todas las sesiones se cerraron, re-login general).

## 8. Seguridad Fase 1 (desplegado y verificado en vivo)
- `sanitize.ts`: fuera `iframe`/`style`, bloqueo `javascript:`/`data:`.
- Escape `innerHTML` en mis-comentarios/valoraciones/reportes/cuenta-eliminada.
- `serve-upload`: comprobantes/verificaciones con token (dueña o admin); `.htaccess` bloquea acceso directo (401/403 verificados, fotos públicas 200).
- Admin: PUT administradores restringido, `verify-token`/`verify` exigen rol, `escort-login-as` sin moderador + auditoría.
- Fuera token por URL y override de `fetch`; `acting_as` audita y no hereda rol; `requireEscortAuth` exige tipo; IDOR borrado comentarios por rol.

## 9. Seguridad Fase 2 (desplegado)
- Login genérico anti-enumeración (escort/usuarios) + hash dummy anti-timing.
- Revocación: `token_version` en escorts/usuarios/admins, `tv` en tokens nuevos, `POST /api/auth/logout.php` cableado (navbar, sidebars, helpers); `admin/logout.php` revoca de verdad.
- CORS sin `localhost`; cookies `Secure+SameSite=Lax`; rate-limit fail-closed; `mail.php` anti-CRLF; HSTS activo.
- **Incidente:** comilla extra en HSTS tumbó el sitio en 500 minutos → detectado, corregido, verificado (home/health 200).

## Pendientes / a tener en cuenta
- CSP diferido (rompería scripts inline; evaluar con reporte-only).
- Historial git aún contiene claves viejas (rotadas, sin valor; reescribir solo si el repo se hace público).
- `pendientes` admin = `activa=0` (por aprobar + suspendidas); avisar si algún caso no cuadra.
- Probar flujos tras rotación: login escort/usuario/admin, solicitar plan/VIP/verificación, ver comprobantes, logout.
