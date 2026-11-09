// src/components/MasValoradas.tsx
import { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation } from 'swiper/modules';
import swiperCssUrl from 'swiper/css?url';
import swiperNavCssUrl from 'swiper/css/navigation?url';
import EscortCircleCard from './EscortCircleCard';
import { useSiteTexts } from '../hooks/useSiteTexts';
import { AVISOS_CAROUSEL } from '../lib/carousel';
import type { Escort } from '../types/escort';

interface Props {
  initialTexts?: Record<string, string> | null;
}

export default function MasValoradas({ initialTexts = null }: Props) {
  const [escorts, setEscorts] = useState<Escort[]>([]);
  const [loading, setLoading] = useState(true);
  const texts = useSiteTexts(initialTexts);

  useEffect(() => {
    // El CSS de Swiper no debe viajar en el <head> de la home: se inyecta
    // cuando este island se hidrata (client:visible), fuera de la ruta crítica.
    [swiperCssUrl, swiperNavCssUrl].forEach((href) => {
      if (document.querySelector(`link[data-swiper-css="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.swiperCss = href;
      document.head.appendChild(link);
    });

    fetch('/api/escorts/listado.php?sort=rating&limit=12')
      .then(r => r.json())
      .then(d => { if (d.success) setEscorts(d.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Sin datos no renderizamos un skeleton que luego desaparece: ese colapso
  // era una de las fuentes de CLS. Si hay perfiles, la sección aparece al
  // cargar; si no, la página no reserva espacio para un carrusel vacío.
  if (loading || escorts.length === 0) return null;

  const titulo = texts?.seccion_valoradas_titulo || 'Más valoradas';

  return (
    <section className="py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-ink font-bold text-lg flex items-center gap-2">
          <i className="fas fa-star text-amber-400"></i> {titulo}
        </h2>
        <span className="text-muted text-sm">{(texts?.contador_escorts || '{cantidad} escorts').replace('{cantidad}', String(escorts.length))}</span>
      </div>

      <div className="relative">
        <Swiper
          modules={[FreeMode, Navigation]}
          freeMode={true}
          slidesPerView={AVISOS_CAROUSEL.slidesPerView}
          spaceBetween={8}
          grabCursor={true}
          navigation={true}
          className="pb-2 mas-valoradas-swiper"
          breakpoints={AVISOS_CAROUSEL.breakpoints}
        >
          {escorts.map((e) => (
            <SwiperSlide key={e.id}>
              <EscortCircleCard escort={e} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <style>{`
        .mas-valoradas-swiper .swiper-button-next,
        .mas-valoradas-swiper .swiper-button-prev {
          width: 36px;
          height: 36px;
          background: rgba(20, 20, 30, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 50%;
          color: #ef4444;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        .mas-valoradas-swiper .swiper-button-next:hover,
        .mas-valoradas-swiper .swiper-button-prev:hover {
          background: rgba(30, 30, 45, 0.95);
          border-color: rgba(239, 68, 68, 0.5);
        }
        .mas-valoradas-swiper .swiper-button-next::after,
        .mas-valoradas-swiper .swiper-button-prev::after {
          font-size: 14px;
          font-weight: 700;
        }
        .mas-valoradas-swiper .swiper-button-prev { left: 4px; }
        .mas-valoradas-swiper .swiper-button-next { right: 4px; }
      `}</style>
    </section>
  );
}
