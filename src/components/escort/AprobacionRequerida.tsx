// src/components/escort/AprobacionRequerida.tsx
// Mientras la cuenta de la escort no esté aprobada por el administrador
// (aprobación del plan), el contenido del panel se reemplaza por una
// tarjeta de "en moderación". Al aprobarse, se muestra el contenido normal.

import type { ReactNode } from 'react';
import { useAprobacion } from '../../hooks/useAprobacion';
import BloqueoAprobacion from './BloqueoAprobacion';
import CargaSeccion from './CargaSeccion';

interface Props {
  children: ReactNode;
}

 export default function AprobacionRequerida({ children }: Props) {
    const { aprobada, cargando } = useAprobacion();

    // Mientras se consulta el estado real no se muestra ninguna tarjeta de
    // bloqueo: evita el parpadeo de "en moderación" antes de saber si aplica.
    if (cargando) {
      return <CargaSeccion />;
    }

    if (!aprobada) {
     return <BloqueoAprobacion />;
   }

   return <>{children}</>;
 }
