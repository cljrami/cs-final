// src/hooks/useAprobacion.ts
// Devuelve si la cuenta de la escort ha sido aprobada por el administrador.
// Mientras no esté aprobada, los formularios del panel deben permanecer
// inhabilitados (ver AprobacionRequerida / BloqueoAprobacion).

import { useState, useEffect } from 'react';

interface AprobacionState {
  aprobada: boolean;
  cargando: boolean;
}

// Caché simple a nivel de módulo para no parpadear entre montajes.
let cache: { aprobada: boolean; ts: number } | null = null;

export function useAprobacion(): AprobacionState {
  const [state, setState] = useState<AprobacionState>({
    aprobada: cache ? cache.aprobada : false,
    cargando: !cache,
  });

  useEffect(() => {
    const token = localStorage.getItem('escort_token');
    if (!token) {
      setState({ aprobada: false, cargando: false });
      return;
    }

    let activo = true;

    const consultar = () => {
      fetch('/api/escort/micuenta-status.php?_t=' + Date.now(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
        .then((r) => r.json())
        .then((d) => {
          if (!activo) return;
          const aprobada = !!(d?.escort?.cuenta_aprobada);
          cache = { aprobada, ts: Date.now() };
          setState({ aprobada, cargando: false });
        })
        .catch(() => {
          if (activo) setState((s) => ({ ...s, cargando: false }));
        });
    };

    consultar();
    // Re-consulta cada 30s para que el panel se desbloquee solo al aprobar
    const intervalo = setInterval(consultar, 30000);
    window.addEventListener('sidebar-refresh', consultar);

    return () => {
      activo = false;
      clearInterval(intervalo);
      window.removeEventListener('sidebar-refresh', consultar);
    };
  }, []);

  return state;
}
