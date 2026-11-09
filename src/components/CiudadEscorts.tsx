import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import { Skeleton } from './ui/Skeleton';
import EscortCard from './EscortCard';
import EscortCircleCard from './EscortCircleCard';
import CiudadCarousel from './CiudadCarousel';
import HistoriasCiudad from './HistoriasCiudad';
import GiraEnCiudadModal from './escort/GiraEnCiudadModal';
import { useSiteTexts } from '../hooks/useSiteTexts';
import BannerSlot from './BannerSlot';
import { AVISOS_CAROUSEL } from '../lib/carousel';
import type { Escort, Filters } from '../types/escort';

interface PorCiudadResponse {
  success: boolean;
  ciudad: string;
  total: number;
  data: Escort[];
  page: number;
  has_more: boolean;
}

function CiudadSeccion({ ciudad, disponible = false, limit = 6 }: { ciudad: string; disponible?: boolean; limit?: number }) {
  const [escorts, setEscorts] = useState<Escort[]>([]);
  const [loading, setLoading] = useState(true);
  const texts = useSiteTexts();

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ ciudad, limit: String(limit) });
    if (disponible) params.set('disponible', '1');
    else params.set('sort', 'created_at');

    fetch(`/api/escorts/por-ciudad.php?${params.toString()}`)
      .then(r => r.json())
      .then(d => { if (active && d.success) setEscorts(d.data || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ciudad, disponible, limit]);

  if (!loading && escorts.length === 0) return null;

  const plantilla = disponible
    ? (texts?.seccion_ciudad_disponibles_titulo || 'Disponibles ahora en {ciudad}')
    : (texts?.seccion_ciudad_nuevas_titulo || 'Nuevas en {ciudad}');
  const titulo = plantilla.replace('{ciudad}', ciudad);

  return (
    <section className="py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-ink font-bold text-lg flex items-center gap-2">
          <i className={`${disponible ? 'fas fa-fire text-red-500' : 'fas fa-bolt text-red-400'}`}></i> {texts ? titulo : <Skeleton width={140} height={18} inline />}
        </h2>
        {!loading && <span className="text-muted text-sm">{disponible
                  ? (texts?.contador_disponibles || '{cantidad} disponibles').replace('{cantidad}', String(escorts.length))
                  : (texts?.contador_nuevas || '{cantidad} nuevas').replace('{cantidad}', String(escorts.length))}</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: limit }).map((_, i) => (
            <EscortCard key={i} escort={{} as Escort} skeleton />
          ))
        ) : (
          escorts.map(e => <EscortCard key={e.id} escort={e} />)
        )}
      </div>
    </section>
  );
}

interface Props {
  ciudadInicial?: string;
}

export default function CiudadEscorts({ ciudadInicial = '' }: Props) {
  const [escorts, setEscorts] = useState<Escort[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [skeletonCount, setSkeletonCount] = useState(0);
  const texts = useSiteTexts();
  const [ciudad, setCiudad] = useState('');
  const [filters, setFilters] = useState<Filters>({
    vip: false,
    verificado: false,
    ciudad: '',
    edad_min: '',
    edad_max: '',
  });
  const [q, setQ] = useState('');
  const searchIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showGiraModal, setShowGiraModal] = useState(false);
  const [escortsEnGira, setEscortsEnGira] = useState<Escort[]>([]);
  const giraModalShownRef = useRef<string>('');

  useEffect(() => {
    if (ciudadInicial) {
      setCiudad(ciudadInicial);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const ciudadParam = params.get('ciudad') || params.get('nombre') || '';
    if (ciudadParam) {
      setCiudad(ciudadParam);
    } else {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2 && pathParts[0] === 'ciudad') {
        setCiudad(decodeURIComponent(pathParts[1]));
      }
    }
    // Initialize filters from URL
    const initialFilters: Filters = {
      vip: params.get('vip') === '1',
      verificado: params.get('verificado') === '1',
      ciudad: '',
      edad_min: '',
      edad_max: '',
    };
    setFilters(initialFilters);
    setQ(params.get('q') || '');
  }, []);

  const updateURL = useCallback((newQ: string, newFilters: Filters) => {
    const url = new URL(window.location.href);
    if (newQ) url.searchParams.set('q', newQ); else url.searchParams.delete('q');
    if (newFilters.vip) url.searchParams.set('vip', '1'); else url.searchParams.delete('vip');
    if (newFilters.verificado) url.searchParams.set('verificado', '1'); else url.searchParams.delete('verificado');
    history.replaceState(null, '', url.toString());
  }, []);

  const doSearch = useCallback(async (pageNum: number, append = false) => {
    if (!ciudad) return;
    const id = ++searchIdRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    setHasSearched(Boolean(q || filters.vip || filters.verificado));

    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('ciudad', ciudad);
    params.set('page', String(pageNum));
    params.set('limit', '40');
    if (filters.vip) params.set('vip', '1');
    if (filters.verificado) params.set('verificado', '1');

    try {
      const res = await fetch(`/api/escorts/por-ciudad.php?${params.toString()}`);
      const data: PorCiudadResponse = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      if (id !== searchIdRef.current) return;
      setTotal(data.total);
      setSkeletonCount(Math.min(data.total, 24));
      setHasMore(data.has_more);
      if (!append) await new Promise(r => setTimeout(r, 150));
      if (append) setEscorts(prev => [...prev, ...data.data]);
      else {
        setEscorts(data.data);
      }
    } catch { setError('Error al buscar'); setSkeletonCount(0); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [ciudad, q, filters]);

  const triggerSearch = useCallback((searchQ: string, f: Filters) => {
    setPage(1);
    updateURL(searchQ, f);
    doSearch(1, false);
  }, [doSearch, updateURL]);

  useEffect(() => {
    if (!ciudad) return;
    let active = true;
    fetch(`/api/escorts/gira-ciudad.php?ciudad=${encodeURIComponent(ciudad)}&_t=${Date.now()}`)
      .then(r => r.json())
      .then((d: { success: boolean; data?: Escort[] }) => {
        if (!active || !d.success) return;
        const enGira = d.data || [];
        setEscortsEnGira(enGira);
        if (enGira.length > 0 && !sessionStorage.getItem(`gira_modal_shown_${ciudad}`)) {
          setTimeout(() => {
            setShowGiraModal(true);
            sessionStorage.setItem(`gira_modal_shown_${ciudad}`, '1');
          }, 1500);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [ciudad]);

  useEffect(() => {
    if (!ciudad) return;
    if (!q && !filters.vip && !filters.verificado) {
      triggerSearch('', filters);
    }
  }, [ciudad]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q !== undefined) triggerSearch(q, filters);
      else if (!filters.ciudad) { setEscorts([]); setTotal(0); setHasMore(false); setHasSearched(false); }
      else triggerSearch('', filters);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, filters]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        doSearch(page + 1, true);
      }
    }, { rootMargin: '200px' });
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, page, doSearch]);

  const handleFilterChange = (updates: Partial<Filters>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    triggerSearch(q, newFilters);
  };

  const handleClear = () => {
    setQ('');
    setFilters({ vip: false, verificado: false, ciudad: '', edad_min: '', edad_max: '' });
    setEscorts([]);
    setTotal(0);
    setHasMore(false);
    setHasSearched(false);
    const url = new URL(window.location.href);
    url.search = '';
    history.replaceState(null, '', url.toString());
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    doSearch(next, true);
  };

  const toggleClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 cursor-pointer select-none ${active ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-surface text-muted border-white/10 hover:border-white/20'}`;

  const hasActiveFilters = q || filters.vip || filters.verificado;

  if (!ciudad) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-ink mb-4">Ciudad no especificada</h1>
        <p className="text-muted">Selecciona una ciudad para ver las escorts disponibles.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 text-center">
        {/* El H1 (título de la ciudad) lo imprime el HTML estático de la página.
            Aquí solo queda el contador de resultados. */}
        {total > 0 && (
          <p className="text-lg text-muted">
            {(texts?.ciudad_contador_resultados || '{cantidad} resultados').replace('{cantidad}', String(total))}
          </p>
        )}
      </div>

      {/* Search Bar */}
      <div className="max-w-xl mx-auto mb-6 relative">
        <form onSubmit={e => { e.preventDefault(); triggerSearch(q, filters); }}>
          <div className="flex items-center bg-surface border border-white/10 rounded-xl px-4 py-3 focus-within:border-red-500/50 transition-all duration-300 shadow-lg shadow-black/20">
            <i className="fas fa-search text-muted mr-3"></i>
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nombre, servicio..."
              className="flex-1 bg-transparent text-ink text-sm outline-none placeholder-gray-600"
              autoComplete="off"
            />
            <button type="submit" className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 shadow-lg shadow-red-500/20">
              <i className="fas fa-search"></i>Buscar
            </button>
            {q && (
              <button type="button" onClick={() => setQ('')} className="ml-2 text-muted hover:text-ink transition-colors">
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 justify-center mb-8">
        <button onClick={() => handleFilterChange({ vip: !filters.vip })} className={toggleClass(filters.vip)}>
          <i className="fas fa-crown mr-1.5 text-[0.6rem]"></i>VIP
        </button>
        <button onClick={() => handleFilterChange({ verificado: !filters.verificado })} className={toggleClass(filters.verificado)}>
          <i className="fas fa-check-circle mr-1.5 text-[0.6rem]"></i>Verificado
        </button>

        {hasActiveFilters && (
          <button onClick={handleClear} className="text-xs text-muted hover:text-ink transition-colors ml-2">
            <i className="fas fa-undo mr-1"></i>Limpiar
          </button>
        )}
      </div>

      {/* Banner superior de ciudad (ciudad_top) */}
      <div className="mb-6">
        <BannerSlot placement="ciudad_top" ciudad={ciudad} />
      </div>

      {/* Historias (solo si hay y no se está buscando) */}
      {!hasSearched && <HistoriasCiudad ciudad={ciudad} />}

      {/* Disponibles ahora (carousel antes del grid) — solo si no se está buscando */}
      {!hasSearched && <CiudadCarousel ciudad={ciudad} modo="disponibles" />}

      {/* Results */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
            <h2 className="text-ink font-bold text-lg flex items-center gap-2 mb-4">
            <i className="fas fa-th-large text-red-500"></i> {`Resultados en ${ciudad}`}
          </h2>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <EscortCard key={i} escort={{} as Escort} skeleton />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-surface border border-white/5 flex items-center justify-center mb-4">
                <i className="fas fa-exclamation-triangle text-red-400 text-xl"></i>
              </div>
              <p className="text-muted font-medium">{error}</p>
              <button onClick={() => doSearch(1, false)} className="inline-flex items-center gap-1.5 mt-4 text-sm text-red-400 hover:text-red-300 transition-colors">
                <i className="fas fa-redo"></i>Reintentar
              </button>
            </div>
          ) : escorts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-surface border border-white/5 flex items-center justify-center mb-4">
                <i className="fas fa-search text-red-400 text-xl"></i>
              </div>
              <p className="text-muted font-medium">
                {hasSearched
                  ? <>{texts?.ciudad_sin_resultados || 'Sin resultados'}{filters.vip || filters.verificado ? <>{texts?.ciudad_sin_resultados_filtros || ' con esos filtros'}</> : ''}</>
                  : <>{(texts?.ciudad_sin_escorts || 'No hay escorts en {ciudad} por ahora').replace('{ciudad}', ciudad)}</>}
              </p>
              <p className="text-muted text-sm mt-1">
                {hasSearched ? (texts?.ciudad_hint_filtros || 'Prueba con otros filtros o término de búsqueda') : (texts?.ciudad_hint_vuelve || 'Vuelve más tarde para ver nuevas publicaciones')}
              </p>
              {hasSearched && hasActiveFilters && (
                <button onClick={handleClear} className="inline-flex items-center gap-1.5 mt-4 text-sm text-red-400 hover:text-red-300 transition-colors">
                  <i className="fas fa-undo"></i>{texts?.ciudad_limpiar_filtros || 'Limpiar filtros'}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {escorts.map(escort => <EscortCard key={escort.id} escort={escort} />)}
              </div>

              {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-8">
                  {loadingMore ? (
                    <div className="flex items-center gap-2 text-muted">
                      <i className="fas fa-circle-notch fa-spin text-red-500"></i>
                      {texts?.seccion_cargando_mas || 'Cargando más...'}
                    </div>
                  ) : (
                    <button
                      onClick={handleLoadMore}
                      className="bg-surface hover:bg-red-500/10 text-ink px-8 py-3 rounded-xl border border-white/10 hover:border-red-500/30 transition-all duration-200 text-sm font-medium"
                    >
                      Cargar más <i className="fas fa-chevron-down ml-1.5 text-[0.65rem]"></i>
                    </button>
                  )}
                </div>
              )}
</>
              )}

              {/* Te podría interesar - carrusel con los resultados de la búsqueda */}
              {hasSearched && escorts.length > 0 && (
                <section className="py-8">
                  <h2 className="text-ink font-bold text-lg flex items-center gap-2 mb-4">
                    <i className="fas fa-lightbulb text-amber-400"></i> Te podría interesar
                  </h2>
                  <Swiper
                    modules={[FreeMode, Navigation]}
                    freeMode={true}
                    slidesPerView={AVISOS_CAROUSEL.slidesPerView}
                    spaceBetween={8}
                    grabCursor={true}
                    navigation={true}
                    className="pb-2 resultados-swiper"
                    breakpoints={AVISOS_CAROUSEL.breakpoints}
                  >
                    {escorts.map((e) => (
                      <SwiperSlide key={e.id}>
                        <EscortCircleCard escort={e} />
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </section>
              )}
        </div>
      </div>

      {/* Más valoradas + Nuevas (carousel con Swiper) — solo si no se está buscando */}
      {!hasSearched && <CiudadCarousel ciudad={ciudad} modo="valoradas" />}
      {!hasSearched && <CiudadCarousel ciudad={ciudad} modo="nuevas" />}

      {/* Modal Escorts en Gira */}
      <GiraEnCiudadModal
        ciudad={ciudad}
        escortsEnGira={escortsEnGira}
        open={showGiraModal}
        onClose={() => setShowGiraModal(false)}
      />
    </div>
  );
}
