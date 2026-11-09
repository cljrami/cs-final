// src/components/StatsStrip.tsx
import { useState, useEffect } from 'react';
import { Skeleton } from './ui/Skeleton';
import { useSiteTexts } from '../hooks/useSiteTexts';

interface Stats {
  escorts: number;
  ciudades: number;
  verificadas: number;
  valoraciones: number;
}

const STATS_DEF = [
  { key: 'escorts', labelKey: 'stat_escorts_label', icon: 'fa-users', fallback: 'Escorts activas' },
  { key: 'ciudades', labelKey: 'stat_ciudades_label', icon: 'fa-map-marker-alt', fallback: 'Ciudades' },
  { key: 'verificadas', labelKey: 'stat_verificadas_label', icon: 'fa-shield-alt', fallback: 'Perfiles verificados' },
  { key: 'valoraciones', labelKey: 'stat_valoraciones_label', icon: 'fa-star', fallback: 'Valoraciones' },
] as const;

export default function StatsStrip() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const texts = useSiteTexts();

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
            {stats === null && loading ? (
              <Skeleton className="w-16 h-7 mx-auto" />
            ) : (
              <div className="text-2xl font-bold text-ink">
                {(stats?.[s.key] ?? 0).toLocaleString('es-CL')}
              </div>
            )}
            <div className="text-muted text-xs mt-1">{texts ? (texts[s.labelKey] || s.fallback) : <Skeleton width={80} height={12} inline />}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
