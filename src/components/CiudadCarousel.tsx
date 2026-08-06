import { useState, useEffect } from 'react';
import { useSiteTexts } from '../hooks/useSiteTexts';
import type { Escort } from '../types/escort';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import EscortCard from './EscortCard';
import { Skeleton } from './ui/Skeleton';
import { AVISOS_CAROUSEL, CAROUSEL_DISPONIBLES } from '../lib/carousel';

interface CiudadCarouselProps {
  ciudad: string;
  modo?: 'disponibles' | 'valoradas' | 'nuevas';
  limit?: number;
}

const TITULOS_DEFAULT = {
  disponibles: 'Disponibles ahora en {ciudad}',
  valoradas: 'Más valoradas en {ciudad}',
  nuevas: 'Nuevas en {ciudad}',
};

const ICONOS = {
  disponibles: 'fas fa-fire text-red-500',
  valoradas: 'fas fa-star text-amber-400',
  nuevas: 'fas fa-bolt text-red-400',
};

export default function CiudadCarousel({ ciudad, modo = 'nuevas', limit = 12 }: CiudadCarouselProps) {
  const [escorts, setEscorts] = useState<Escort[]>([]);
  const [loading, setLoading] = useState(true);
  const [swiperRef, setSwiperRef] = useState<SwiperInstance | null>(null);
  const texts = useSiteTexts();

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams({ ciudad, limit: String(limit) });

    if (modo === 'disponibles') {
      params.set('disponible', '1');
    } else if (modo === 'valoradas') {
      params.set('sort', 'rating');
    } else {
      params.set('sort', 'nuevas');
    }

    fetch(`/api/escorts/por-ciudad.php?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        if (active && d.success && d.data && d.data.length > 0) {
          setEscorts(d.data);
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [ciudad, modo, limit]);

  if (!loading && escorts.length === 0) return null;

  const key = `seccion_ciudad_${modo}_titulo` as const;
  const titulo = (texts[key] || TITULOS_DEFAULT[modo]).replace('{ciudad}', ciudad);

  return (
    <section className="py-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-ink font-bold text-lg flex items-center gap-2">
          <i className={ICONOS[modo]}></i> {titulo}
        </h2>
        {!loading && <span className="text-muted text-sm">{escorts.length} escorts</span>}
      </div>

      <div className="relative">
        {loading ? (
          <div className="flex gap-2 pb-2 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-1 min-w-0 bg-surface rounded-xl overflow-hidden border border-white/5 animate-pulse">
                <Skeleton className="aspect-[3/4] w-full !rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="w-2/3 h-3 !rounded-md" />
                  <Skeleton className="w-1/2 h-2.5 !rounded-md" />
                  <Skeleton className="w-1/3 h-2.5 !rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Swiper
            modules={[FreeMode, Navigation]}
            onSwiper={setSwiperRef}
            freeMode={true}
            slidesPerView={modo === 'disponibles' ? CAROUSEL_DISPONIBLES.slidesPerView : AVISOS_CAROUSEL.slidesPerView}
            spaceBetween={8}
            grabCursor={true}
            navigation={true}
            className="pb-2 ciudad-carousel-swiper"
            breakpoints={modo === 'disponibles' ? CAROUSEL_DISPONIBLES.breakpoints : AVISOS_CAROUSEL.breakpoints}
          >
            {escorts.map((e) => (
              <SwiperSlide key={e.id}>
                {modo === 'disponibles' ? (
                  <div className="flex flex-col items-center">
                    <a
                      href={`/${e.id}`}
                      className="relative w-20 h-20 mx-auto rounded-full p-[3px] bg-gradient-to-tr from-red-500 via-pink-500 to-yellow-500 hover:brightness-110 block transition-all duration-300 hover:scale-105"
                    >
                      <span className="block w-full h-full rounded-full overflow-hidden bg-surface border-2 border-page">
                        {e.foto_principal ? (
                          <img
                            src={e.foto_principal}
                            alt={e.nombre}
                            className="w-full h-full object-cover rounded-full"
                            loading="lazy"
                            decoding="async"
                            onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-raised">
                            <i className="fas fa-user text-muted text-2xl"></i>
                          </div>
                        )}
                      </span>
                      {e.disponible_ahora === 1 && (
                        <span className="absolute -top-0.5 -right-0.5 z-10 w-4 h-4 rounded-full bg-green-500 border-2 border-page shadow-lg shadow-green-600/50 animate-pulse" title="Disponible"></span>
                      )}
                    </a>
                    <span className="inline-flex items-center gap-1 mt-2 w-full max-w-20 justify-center px-1">
                      <span className="text-ink text-xs font-medium leading-tight truncate">{e.nombre}</span>
                      {e.verificado === 1 && (
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center shrink-0" title="Verificada">
                          <i className="fas fa-check text-[0.3rem] text-white"></i>
                        </span>
                      )}
                      {e.vip === 1 && (
                        <span className="w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center shrink-0" title="VIP">
                          <i className="fas fa-crown text-[0.3rem] text-black"></i>
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <EscortCard escort={e} />
                )}
              </SwiperSlide>
            ))}
          </Swiper>
        )}
      </div>

      <style>{`
        .ciudad-carousel-swiper .swiper-button-next,
        .ciudad-carousel-swiper .swiper-button-prev {
          width: 36px;
          height: 36px;
          background: rgba(20, 20, 30, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 50%;
          color: #ef4444;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        .ciudad-carousel-swiper .swiper-button-next:hover,
        .ciudad-carousel-swiper .swiper-button-prev:hover {
          background: rgba(30, 30, 45, 0.95);
          border-color: rgba(239, 68, 68, 0.5);
        }
        .ciudad-carousel-swiper .swiper-button-next::after,
        .ciudad-carousel-swiper .swiper-button-prev::after {
          font-size: 14px;
          font-weight: 700;
        }
        .ciudad-carousel-swiper .swiper-button-prev { left: 4px; }
        .ciudad-carousel-swiper .swiper-button-next { right: 4px; }
      `}</style>
    </section>
  );
}
