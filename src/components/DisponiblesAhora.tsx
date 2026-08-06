// src/components/DisponiblesAhora.tsx
import { useState, useEffect } from 'react';
import EscortCard from './EscortCard';
import { Skeleton } from './ui/Skeleton';
import { useSiteTexts } from '../hooks/useSiteTexts';
import type { Escort } from '../types/escort';

export default function DisponiblesAhora() {
  const [escorts, setEscorts] = useState<Escort[]>([]);
  const [loading, setLoading] = useState(true);
  const texts = useSiteTexts();

  useEffect(() => {
    fetch('/api/escorts/listado.php?disponible=1&limit=12')
      .then(r => r.json())
      .then(d => { if (d.success) setEscorts(d.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && escorts.length === 0) return null;

  const titulo = texts.seccion_disponibles_titulo || 'Disponibles ahora';

  return (
    <section className="py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-ink font-bold text-lg flex items-center gap-2">
          <i className="fas fa-fire text-red-500"></i> {titulo}
        </h2>
        {!loading && <span className="text-muted text-sm">{escorts.length} disponibles</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl overflow-hidden border border-white/5 animate-pulse">
              <Skeleton className="aspect-[3/4] w-full !rounded-none" />
              <div className="p-2.5 space-y-2">
                <Skeleton className="w-2/3 h-3 !rounded-md" />
                <Skeleton className="w-1/2 h-2.5 !rounded-md" />
              </div>
            </div>
          ))
        ) : (
          escorts.map(e => <EscortCard key={e.id} escort={e} />)
        )}
      </div>
    </section>
  );
}
