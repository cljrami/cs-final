// src/components/StatsStrip.tsx
import { useState, useEffect } from 'react';
import { Skeleton } from './ui/Skeleton';

interface Stats {
  escorts: number;
  ciudades: number;
  verificadas: number;
  valoraciones: number;
}

const STATS_DEF = [
  { key: 'escorts', label: 'Escorts activas', icon: 'fa-users' },
  { key: 'ciudades', label: 'Ciudades', icon: 'fa-map-marker-alt' },
  { key: 'verificadas', label: 'Perfiles verificados', icon: 'fa-shield-alt' },
  { key: 'valoraciones', label: 'Valoraciones', icon: 'fa-star' },
] as const;

export default function StatsStrip() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats.php')
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS_DEF.map(s => (
          <div key={s.key} className="bg-surface border border-white/5 rounded-xl p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center">
              <i className={`fas ${s.icon} text-red-500 text-sm`}></i>
            </div>
            {loading ? (
              <Skeleton className="w-16 h-7 mx-auto" />
            ) : (
              <div className="text-2xl font-bold text-ink">
                {(stats?.[s.key] ?? 0).toLocaleString('es-CL')}
              </div>
            )}
            <div className="text-muted text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
