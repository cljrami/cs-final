// src/components/escort/AprobacionRequerida.tsx
// Mientras la cuenta de la escort no esté aprobada por el administrador
// (aprobación del plan), el contenido del panel se reemplaza por una
// tarjeta de "en moderación". Al aprobarse, se muestra el contenido normal.

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
      <div className="w-full max-w-full my-10">
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-8">
          <div className="w-16 h-16 mx-auto mb-5 bg-gray-800 rounded-2xl animate-pulse"></div>
          <div className="w-48 h-6 mx-auto bg-gray-800 rounded mb-3 animate-pulse"></div>
          <div className="w-72 max-w-full h-4 mx-auto bg-gray-800 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!aprobada) {
    return <BloqueoAprobacion />;
  }

  return <>{children}</>;
}
