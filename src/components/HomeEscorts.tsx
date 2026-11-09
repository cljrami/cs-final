import { useState, useEffect, useCallback, useRef } from 'react';
import { Skeleton } from './ui/Skeleton';
import EscortCard from './EscortCard';
import { useSiteTexts } from '../hooks/useSiteTexts';

interface Escort {
  id: number;
  nombre: string;
  edad: number;
  ciudad: string;
  foto_principal: string | null;
  vip: number;
  verificado: number;
  en_gira: number;
  gira_ciudad: string | null;
  gira_activa: number;
  likes: number;
  descripcion_corta: string;
  slug: string;
  sticky_orden: number;
  destacado: number;
  disponible_ahora?: number;
  rating: number;
  total_valoraciones: number;
  tarifa_1h: number;
  servicios: { nombre: string; icono: string | null }[];
  // Estados efectivos
  verificado_vigente?: number;
  vip_vigente?: number;
  destacado_vigente?: number;
  sticky_vigente?: number;
  activa_vigente?: number;
  plan_vencido?: boolean;
}

interface ListadoResponse {
  success: boolean;
  data: Escort[];
  pagination: {
    total: number;
    has_more: boolean;
  };
}

interface InitialData {
  escorts: Escort[];
  total: number;
  hasMore: boolean;
}

interface Props {
  initialData?: InitialData | null;
  initialTexts?: Record<string, string> | null;
}

export default function HomeEscorts({ initialData = null, initialTexts = null }: Props) {
  const [escorts, setEscorts] = useState<Escort[]>(initialData?.escorts ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const texts = useSiteTexts(initialTexts);

  const fetchEscorts = useCallback(async (pageNum: number, append = false, silent = false) => {
    if (append) setLoadingMore(true);
    else if (!silent) setLoading(true);
    setError('');

    try {
      const q = new URLSearchParams(window.location.search).get('q') || '';
      const res = await fetch(`/api/escorts/listado.php?page=${pageNum}&limit=40${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      const data: ListadoResponse = await res.json();
      
      if (!data.success) throw new Error('Error al cargar');
      
      if (append) {
        setEscorts(prev => [...prev, ...data.data]);
      } else {
        setEscorts(data.data);
      }
      setTotal(data.pagination.total);
      setHasMore(data.pagination.has_more);
      setPage(pageNum);
    } catch {
      setError('Error al cargar escorts');
    } finally {
      if (!silent) setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    // Con datos de build el primer render ya coincide con el HTML; refrescamos
    // en segundo plano para no volver a mostrar el skeleton (CLS).
    fetchEscorts(1, false, Boolean(initialData));
  }, [fetchEscorts, initialData]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        fetchEscorts(page + 1, true);
      }
    }, { rootMargin: '200px' });
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchEscorts]);

  return (
    <section className="py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-ink font-bold text-lg flex items-center gap-2">
          <i className="fas fa-users text-muted"></i>{texts?.seccion_escorts_titulo || 'Escorts'}
        </h2>
        {total > 0 && (
          <span className="text-muted text-sm">
            {(texts?.contador_escorts || '{cantidad} escorts').replace('{cantidad}', String(total))}
          </span>
        )}
      </div>

      <div id="escorts-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {escorts.length > 0 ? (
          escorts.map((escort, i) => (
            <EscortCard key={escort.id} escort={escort} skeleton={loading} priority={i === 0} />
          ))
        ) : loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <EscortCard key={i} escort={{} as Escort} skeleton={true} />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <i className="fas fa-users text-muted text-4xl mb-4"></i>
            <p className="text-muted text-lg">{texts?.seccion_escorts_vacia || 'No hay escorts disponibles'}</p>
          </div>
        )}
      </div>

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {loadingMore ? (
            <Skeleton className="h-4 w-48 mx-auto" />
          ) : (
            <button
              onClick={() => fetchEscorts(page + 1, true)}
              className="px-8 py-3 bg-surface2 hover:bg-red-500/10 text-ink rounded-xl border border-white/10 hover:border-red-500/30 transition-all duration-200 text-sm font-medium"
            >
              Cargar más <i className="fas fa-chevron-down ml-1.5 text-[0.65rem]"></i>
            </button>
          )}
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-8 text-red-400">
          <p>{error}</p>
          <button onClick={() => fetchEscorts(1, false)} className="mt-2 text-sm text-red-400 hover:text-red-300 underline">
            Reintentar
          </button>
        </div>
      )}
    </section>
  );
}