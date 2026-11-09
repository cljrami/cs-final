import { useState, useEffect, useRef } from 'react';
import { useSiteTexts } from '../hooks/useSiteTexts';
import type { Escort } from '../types/escort';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import EscortCircleCard from './EscortCircleCard';
import { Skeleton } from './ui/Skeleton';
import { CAROUSEL_DISPONIBLES } from '../lib/carousel';

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
  const knownCountRef = useRef(0);
  const texts = useSiteTexts();

  useEffect(() => {
    if (!loading && escorts.length > 0) knownCountRef.current = escorts.length;
  }, [loading, escorts.length]);

  const maxSkeletonCount = Math.ceil(CAROUSEL_DISPONIBLES.slidesPerView);

  const skeletonCount = loading && knownCountRef.current > 0
    ? Math.min(knownCountRef.current, maxSkeletonCount)
    : maxSkeletonCount;

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
  const titulo = ((texts?.[key] as string | undefined) || TITULOS_DEFAULT[modo]).replace('{ciudad}', ciudad);

  return (
    <section className="py-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-ink font-bold text-lg flex items-center gap-2">
          <i className={ICONOS[modo]}></i> {texts ? titulo : <Skeleton width={150} height={18} inline />}
        </h2>
        {!loading && <span className="text-muted text-sm">{escorts.length} escorts</span>}
      </div>

      <div className="relative">
        {loading ? (
          <div className="flex gap-2 pb-2 overflow-hidden">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} className="flex-1 min-w-0 flex flex-col items-center animate-pulse">
                <div className="w-20 h-20 rounded-full bg-raised shrink-0"></div>
                <div className="mt-2 w-12 h-3 bg-surface rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <Swiper
            modules={[FreeMode, Navigation]}
            onSwiper={setSwiperRef}
            freeMode={true}
            slidesPerView={CAROUSEL_DISPONIBLES.slidesPerView}
            spaceBetween={8}
            grabCursor={true}
            navigation={true}
            className="pb-2 ciudad-carousel-swiper"
            breakpoints={CAROUSEL_DISPONIBLES.breakpoints}
          >
            {escorts.map((e) => (
              <SwiperSlide key={e.id}>
                <EscortCircleCard escort={e} />
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
