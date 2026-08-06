import { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import type { Escort } from '../types/escort';

interface Props {
  ciudad: string;
  escortsEnGira: Escort[];
  open: boolean;
  onClose: () => void;
}

function formatFecha(fecha?: string | null): string {
  if (!fecha) return 'fecha por confirmar';
  const [y, m, d] = fecha.split('-');
  if (!y || !m || !d) return fecha;
  return `${d}-${m}-${y}`;
}

export default function GiraEnCiudadModal({ ciudad, escortsEnGira, open, onClose }: Props) {
  if (!open || escortsEnGira.length === 0) return null;

  const swiperRef = useRef<Swiper | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  // Handle autoplay manually for better control
  useEffect(() => {
    if (!swiperRef.current || escortsEnGira.length <= 1) return;
    
    const swiper = swiperRef.current;
    let timer: ReturnType<typeof setInterval>;
    
    const startAutoplay = () => {
      timer = setInterval(() => {
        if (swiper && !swiper.destroyed) {
          if (swiper.activeIndex >= escortsEnGira.length - 1) {
            swiper.slideTo(0);
          } else {
            swiper.slideNext();
          }
        }
      }, 5000);
    };
    
    const stopAutoplay = () => {
      if (timer) clearInterval(timer);
    };
    
    startAutoplay();
    
    // Pause on hover/interaction
    const el = swiper.el;
    if (el) {
      el.addEventListener('mouseenter', stopAutoplay);
      el.addEventListener('touchstart', stopAutoplay);
      el.addEventListener('mouseleave', startAutoplay);
      el.addEventListener('touchend', startAutoplay);
    }
    
    return () => {
      stopAutoplay();
      if (el) {
        el.removeEventListener('mouseenter', stopAutoplay);
        el.removeEventListener('touchstart', stopAutoplay);
        el.removeEventListener('mouseleave', startAutoplay);
        el.removeEventListener('touchend', startAutoplay);
      }
    };
  }, [escortsEnGira.length]);

  const nextSlide = () => {
    if (swiperRef.current && !swiperRef.current.destroyed) {
      if (slideIndex >= escortsEnGira.length - 1) {
        setSlideIndex(0);
        swiperRef.current.slideTo(0);
      } else {
        setSlideIndex(prev => prev + 1);
        swiperRef.current.slideNext();
      }
    }
  };

  const prevSlide = () => {
    if (swiperRef.current && !swiperRef.current.destroyed) {
      if (slideIndex <= 0) {
        setSlideIndex(escortsEnGira.length - 1);
        swiperRef.current.slideTo(escortsEnGira.length - 1);
      } else {
        setSlideIndex(prev => prev - 1);
        swiperRef.current.slidePrev();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface2 border border-purple-500/30 rounded-2xl p-6 md:p-8 w-full max-w-md mx-4 shadow-2xl shadow-purple-500/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <i className="fas fa-plane-departure text-ink text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">{ciudad}</h2>
              <p className="text-sm text-muted">Escorts de visita por tiempo limitado</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors p-1">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <Swiper
          ref={swiperRef}
          modules={[Pagination, Autoplay]}
          slidesPerView={1}
          spaceBetween={16}
          loop={false}
          autoplay={false}
          pagination={{ clickable: true }}
          onSlideChange={(swiper) => setSlideIndex(swiper.realIndex)}
        >
          {escortsEnGira.map((escort) => (
            <SwiperSlide key={escort.id}>
              <div className="flex items-start gap-4 mb-4">
                <a href={`/${escort.id}`} className="flex-shrink-0 w-32 h-32 md:w-36 md:h-36 rounded-xl overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
                  <img src={escort.foto_principal} alt={escort.nombre} className="w-full h-full object-cover" />
                </a>
                <div className="flex-1 min-w-0">
                  <h3 className="text-ink font-semibold text-base truncate">{escort.nombre}</h3>
                  {escort.gira_activa === 1 ? (
                    <p className="text-purple-300 text-sm flex items-center gap-1 mt-1">
                      <i className="fas fa-calendar-alt text-[0.6rem]"></i> Del {formatFecha(escort.gira_fecha_inicio)} al {formatFecha(escort.gira_fecha_fin)}
                    </p>
                  ) : (
                    <span className="inline-flex items-center gap-1 mt-1 text-fuchsia-300 text-xs font-medium">
                      <i className="fas fa-hourglass-half text-[0.6rem]"></i> Próximamente desde {formatFecha(escort.gira_fecha_inicio)} al {formatFecha(escort.gira_fecha_fin)}
                    </span>
                  )}
                  {escort.disponible_ahora === 1 && (
                    <span className="inline-flex items-center gap-1 mt-2 text-green-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Disponible ahora
                    </span>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-muted text-xs">
                    <span><i className="fas fa-birthday-cake mr-1"></i>{escort.edad} años</span>
                    {escort.verificado === 1 && <span className="text-blue-400 flex items-center gap-1"><i className="fas fa-check-circle text-[0.55rem]"></i> Verificada</span>}
                    {escort.vip === 1 && <span className="text-yellow-400 flex items-center gap-1"><i className="fas fa-crown text-[0.55rem]"></i> VIP</span>}
                  </div>
                </div>
              </div>
              <a href={`/${escort.id}`} className="block w-full py-3 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:opacity-90 text-white rounded-xl font-medium text-center text-sm transition-all">
                Ver perfil
              </a>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Manual navigation arrows */}
        {escortsEnGira.length > 1 && (
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={prevSlide}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-ink flex items-center justify-center transition-colors"
              aria-label="Anterior"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <div className="flex items-center gap-1">
              {escortsEnGira.map((_, index) => (
                <button
                  key={index}
                  onClick={() => swiperRef.current?.slideTo(index)}
                  className={`w-2 h-2 rounded-full transition-all ${index === slideIndex ? 'bg-purple-500' : 'bg-white/30 hover:bg-white/50'}`}
                  aria-label={`Ver escort ${index + 1}`}
                />
              ))}
            </div>
            <button
              onClick={nextSlide}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-ink flex items-center justify-center transition-colors"
              aria-label="Siguiente"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        )}

        <button onClick={onClose} className="w-full mt-6 py-2 text-muted hover:text-ink text-sm font-medium transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  );
}
