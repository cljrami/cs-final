// src/components/escort/AprobacionRequerida.tsx
// Ahora solo pasa hijos sin bloquear, para que la escort pueda editar
// su panel aunque no esté aprobada. La aprobación solo controla la
// visibilidad en el listado público (activa=1 en CRUD de escorts).

import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function AprobacionRequerida({ children }: Props) {
  return <>{children}</>;
}
