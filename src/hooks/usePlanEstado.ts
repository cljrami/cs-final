// src/hooks/usePlanEstado.ts
// Devuelve si la escort tiene un plan base vigente (activo y no vencido).
// Cuando el aviso venció o la escort volvió sin plan activo, las secciones
// del panel deben mostrar el bloqueo uniforme (ver PlanRequerido/BloqueoPlan)
// en lugar de su pantalla, hasta que active un plan desde Mi Plan.
// Fuente: /api/escort/resumen.php (planVigente, planVencido, planSinPlan, planPausado).

import { useState, useEffect } from 'react';

interface PlanEstado {
  planVigente: boolean;
  planVencido: boolean;
  planSinPlan: boolean;
  planPausado: boolean;
  planPendiente: boolean;
  bloqueado: boolean;
  cargando: boolean;
}

// Caché simple a nivel de módulo para no parpadear entre montajes.
let cache: { bloqueado: boolean; planVigente: boolean; planVencido: boolean; planSinPlan: boolean; planPausado: boolean; planPendiente: boolean; ts: number } | null = null;

export function usePlanEstado(): PlanEstado {
  const [state, setState] = useState<PlanEstado>({
    planVigente: cache?.planVigente ?? false,
    planVencido: cache?.planVencido ?? false,
    planSinPlan: cache?.planSinPlan ?? false,
    planPausado: cache?.planPausado ?? false,
    planPendiente: cache?.planPendiente ?? false,
    bloqueado: cache?.bloqueado ?? true,
    cargando: !cache,
  });

  useEffect(() => {
    const token = localStorage.getItem('escort_token');
    if (!token) {
      setState((s) => ({ ...s, bloqueado: true, cargando: false }));
      return;
    }

    let activo = true;

    const consultar = () => {
      fetch('/api/escort/resumen.php?_t=' + Date.now(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
        .then((r) => r.json())
        .then((d) => {
          if (!activo) return;
          const data = d?.data ?? {};
          const planVigente = !!data.planVigente;
          const planVencido = !!data.planVencido || (data.planDiasRestantes ?? 1) <= 0;
          const planSinPlan = !!data.planSinPlan;
          const planPausado = !!data.planPausado;
          const planPendiente = !!data.planPendiente;
          // Regla simple y a prueba de todo: bloqueado salvo plan vigente
          // explícito. Vencido, sin plan, pendiente de aprobación, error de
          // red o dato vacío → bloqueado. Solo pausado sigue su flujo propio.
          const bloqueado = !planVigente && !planPausado;
          cache = { bloqueado, planVigente, planVencido, planSinPlan, planPausado, planPendiente, ts: Date.now() };
          setState({ planVigente, planVencido, planSinPlan, planPausado, planPendiente, bloqueado, cargando: false });
        })
        .catch(() => {
          if (activo) setState((s) => ({ ...s, cargando: false }));
        });
    };

    consultar();
    const intervalo = setInterval(consultar, 30000);
    window.addEventListener('sidebar-refresh', consultar);
    // Seguro: nunca quedarse cargando para siempre (el intervalo corrige al reintentar).
    const tope = setTimeout(() => {
      if (activo) setState((s) => (s.cargando ? { ...s, cargando: false } : s));
    }, 12000);

    return () => {
      activo = false;
      clearInterval(intervalo);
      clearTimeout(tope);
      window.removeEventListener('sidebar-refresh', consultar);
    };
  }, []);

  return state;
}
