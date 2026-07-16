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

    fetch('/api/escort/micuenta-status.php?_t=' + Date.now(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((d) => {
        const aprobada = !!(d?.escort?.cuenta_aprobada);
        cache = { aprobada, ts: Date.now() };
        setState({ aprobada, cargando: false });
      })
      .catch(() => setState({ aprobada: false, cargando: false }));
  }, []);

  return state;
}
