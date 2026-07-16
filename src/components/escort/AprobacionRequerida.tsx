// src/components/escort/AprobacionRequerida.tsx
// Envuelve el contenido editable del panel de la escort. Si la cuenta aún no
// ha sido aprobada por el administrador, muestra BloqueoAprobacion en lugar
// de los formularios (fotos, datos, planes, etc.).

import type { ReactNode } from 'react';
import { useAprobacion } from '../../hooks/useAprobacion';
import BloqueoAprobacion from './BloqueoAprobacion';

interface Props {
  children: ReactNode;
}

export default function AprobacionRequerida({ children }: Props) {
  const { aprobada, cargando } = useAprobacion();

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!aprobada) {
    return <BloqueoAprobacion />;
  }

  return <>{children}</>;
}
