// src/components/Testimonios.tsx
import { useState, useEffect } from 'react';
import { Skeleton } from './ui/Skeleton';

interface Testimonio {
  id: number;
  comentario: string;
  puntuacion: number | null;
  cita_verificada: number;
  created_at: string;
  usuario_nombre: string;
  escort_id: number;
  escort_nombre: string;
  escort_foto: string | null;
}

export default function Testimonios() {
  const [items, setItems] = useState<Testimonio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/comentarios/recientes.php?limit=6')
      .then(r => r.json())
      .then(d => { if (d.success) setItems(d.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <section className="py-8">
      <div className="flex items-center gap-2 mb-6">
        <i className="fas fa-quote-left text-red-500"></i>
        <h2 className="text-ink font-bold text-lg">Opiniones de clientes</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface border border-white/5 rounded-xl p-5 animate-pulse space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))
        ) : (
          items.map(t => (
            <div key={t.id} className="bg-surface border border-white/5 rounded-xl p-5 flex flex-col">
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <i key={n} className={`fas fa-star text-xs ${t.puntuacion && n <= t.puntuacion ? 'text-amber-400' : 'text-gray-700'}`}></i>
                ))}
              </div>
              <p className="text-muted text-sm leading-relaxed flex-1">"{t.comentario}"</p>
              <a href={`/${t.escort_id}`} className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5 group">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-surface2 flex items-center justify-center flex-shrink-0">
                  {t.escort_foto ? (
                    <img src={t.escort_foto} alt={t.escort_nombre} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <i className="fas fa-user text-muted text-xs"></i>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-ink text-xs font-medium group-hover:text-red-400 transition-colors truncate">{t.escort_nombre}</div>
                  <div className="text-muted text-[0.65rem] truncate">{t.usuario_nombre}</div>
                </div>
              </a>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
