// src/components/escort/PlanRequerido.tsx
// Mientras la escort no tenga un plan activo (aviso vencido o sin plan),
// el contenido de la sección se reemplaza por el aviso uniforme (BloqueoPlan).
// Al activar un plan, se muestra el contenido normal.
// Uso: dentro de <AprobacionRequerida>, envolviendo el componente de la sección.

import type { ReactNode } from 'react';
import { usePlanEstado } from '../../hooks/usePlanEstado';
import BloqueoPlan from './BloqueoPlan';
import BloqueoAprobacion from './BloqueoAprobacion';
import CargaSeccion from './CargaSeccion';

interface Props {
  children: ReactNode;
}

export default function PlanRequerido({ children }: Props) {
  const { bloqueado, cargando, planVencido, planVigente, planPendiente } = usePlanEstado();

  // Mientras se consulta el estado real no se muestra ninguna tarjeta de
  // bloqueo: evita el parpadeo de "sin plan" antes de saber si aplica.
  if (cargando) {
    return <CargaSeccion />;
  }

  if (bloqueado) {
    // Plan nuevo contratado pero aún no aprobado: espera al administrador.
    if (planPendiente && !planVigente) {
      return <BloqueoAprobacion />;
    }
    return <BloqueoPlan motivo={planVencido ? 'vencido' : 'sin-plan'} />;
  }

  return <>{children}</>;
}
