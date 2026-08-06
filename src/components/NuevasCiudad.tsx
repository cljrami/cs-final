// src/components/NuevasCiudad.tsx
import { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import EscortCard from './EscortCard';
import { Skeleton } from './ui/Skeleton';
import { useSiteTexts } from '../hooks/useSiteTexts';
import { AVISOS_CAROUSEL } from '../lib/carousel';
import type { Escort } from '../types/escort';

export default function NuevasCiudad() {
  const [escorts, setEscorts] = useState<Escort[]>([]);
  const [loading, setLoading] = useState(true);
  const texts = useSiteTexts();

  useEffect(() => {
    fetch('/api/escorts/listado.php?sort=created_at&limit=12')
      .then(r => r.json())
      .then(d => { if (d.success) setEscorts(d.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && escorts.length === 0) return null;

  const titulo = texts.seccion_nuevas_titulo || 'Nuevas en tu ciudad';

  return (
    <section className="py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-ink font-bold text-lg flex items-center gap-2">
          <i className="fas fa-bolt text-red-400"></i> {titulo}
        </h2>
        {!loading && <span className="text-muted text-sm">{escorts.length} nuevas</span>}
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
            freeMode={true}
slidesPerView={AVISOS_CAROUSEL.slidesPerView}
            spaceBetween={8}
            grabCursor={true}
            navigation={true}
            className="pb-2"
            breakpoints={AVISOS_CAROUSEL.breakpoints}
          >
            {escorts.map((e) => (
              <SwiperSlide key={e.id}>
                <EscortCard escort={e} />
              </SwiperSlide>
            ))}
          </Swiper>
        )}
      </div>

      <style>{`
        .nuevas-ciudad-swiper .swiper-button-next,
        .nuevas-ciudad-swiper .swiper-button-prev {
          width: 36px;
          height: 36px;
          background: rgba(20, 20, 30, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 50%;
          color: #ef4444;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        .nuevas-ciudad-swiper .swiper-button-next:hover,
        .nuevas-ciudad-swiper .swiper-button-prev:hover {
          background: rgba(30, 30, 45, 0.95);
          border-color: rgba(239, 68, 68, 0.5);
        }
        .nuevas-ciudad-swiper .swiper-button-next::after,
        .nuevas-ciudad-swiper .swiper-button-prev::after {
          font-size: 14px;
          font-weight: 700;
        }
        .nuevas-ciudad-swiper .swiper-button-prev { left: 4px; }
        .nuevas-ciudad-swiper .swiper-button-next { right: 4px; }
      `}</style>
    </section>
  );
}
