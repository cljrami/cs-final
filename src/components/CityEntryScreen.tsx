import { useState } from 'react';
import CiudadesModal from './CiudadesModal';
import BannerSlot from './BannerSlot';

export default function CityEntryScreen() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-[#1a1525] via-[#140f20] to-[#0a0a0f] pt-12 pb-8">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(220,38,38,0.15) 0%, transparent 70%)' }} />
        <div className="relative max-w-4xl mx-auto px-4 flex flex-col items-center">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-red-500/20 to-amber-500/20 border border-red-500/30 text-ink font-bold text-xl md:text-2xl shadow-2xl shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-1 transition-all"
            aria-label="Dónde te encuentras"
          >
            <i className="fas fa-map-marker-alt text-red-400 text-2xl"></i>
            <span>Dónde Te Encuentras</span>
            <i className="fas fa-chevron-right text-xs text-muted"></i>
          </button>
        </div>
        <BannerSlot placement="selector_ciudad" />
      </section>
      <CiudadesModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
