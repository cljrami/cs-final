import { useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { escortFileUrl } from '../../lib/fileUrl';

interface Props {
  url: string | null;
  open: boolean;
  onClose: () => void;
}

export default function DocSwiperViewer({ url, open, onClose }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !url) return null;

  const src = url.startsWith('http') || url.startsWith('/api/') ? url : escortFileUrl(url);
  const isPdf = /\.pdf(?:\?.*)?$/i.test(url) || url.toLowerCase().includes('pdf');

  return (
    <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-md flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition z-[401]" aria-label="Cerrar">
        <i className="fas fa-times text-lg" />
      </button>
      <div className="w-full max-w-5xl px-4" onClick={e => e.stopPropagation()}>
        <Swiper
          modules={[Navigation, Pagination]}
          navigation={{ nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }}
          pagination={{ clickable: true }}
          spaceBetween={20}
          slidesPerView={1}
          className="rounded-3xl overflow-hidden shadow-2xl"
        >
          <SwiperSlide>
            <div className="bg-[#0f0f18] rounded-3xl flex items-center justify-center min-h-[45vh] p-6">
              {isPdf ? (
                <iframe src={src} title="Documento" className="w-full h-[45vh] rounded-2xl border-0" />
              ) : (
                <img src={src} alt="Documento" className="max-h-[45vh] w-auto max-w-full object-contain rounded-2xl shadow-xl" />
              )}
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
    </div>
  );
}
