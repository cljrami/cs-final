// src/components/CTASection.tsx
import { useState, useEffect } from 'react';
import { useSiteTexts } from '../hooks/useSiteTexts';

interface EscortMini {
  id: number;
  foto_principal: string | null;
}

export default function CTASection() {
  const [escorts, setEscorts] = useState<EscortMini[]>([]);
  const texts = useSiteTexts();

  useEffect(() => {
    fetch('/api/escorts/listado.php?limit=3&sort=rating')
      .then(r => r.json())
      .then(d => { if (d.success) setEscorts(d.data || []); })
      .catch(() => {});
  }, []);

  const titulo = texts.cta_titulo || '¿Eres escort o agencia?';
  const subtitulo = texts.cta_subtitulo || 'Publica tu perfil y llega a miles de clientes potenciales';
  const boton1 = texts.cta_boton_1 || 'Publicar Ahora';
  const boton2 = texts.cta_boton_2 || 'Ver Planes';

  const avatars = escorts.slice(0, 3);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1026] via-[#1a1a2e] to-[#2a1420] p-8 md:p-14 text-center">
      {/* Glows decorativos */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[480px] h-[480px] bg-red-500/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-32 -right-24 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -left-24 w-72 h-72 bg-fuchsia-500/10 rounded-full blur-3xl"></div>

      {/* Círculos decorativos */}
      <div className="absolute top-6 left-8 w-14 h-14 rounded-full border border-white/10 bg-white/5 hidden sm:block"></div>
      <div className="absolute bottom-8 right-10 w-8 h-8 rounded-full border border-white/10 bg-white/5 hidden sm:block"></div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Avatares apilados */}
        {avatars.length > 0 && (
          <div className="flex justify-center mb-6">
            <div className="flex -space-x-4">
              {avatars.map((e) => (
                <div key={e.id} className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-red-500 via-pink-500 to-fuchsia-500 ring-2 ring-page">
                  {e.foto_principal ? (
                    <img src={e.foto_principal} alt="" className="w-full h-full rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-raised flex items-center justify-center">
                      <i className="fas fa-user text-muted text-sm"></i>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <span className="relative w-14 h-14 -ml-3 rounded-full p-[2.5px] bg-gradient-to-tr from-amber-400 to-yellow-500 ring-2 ring-page">
              <span className="w-full h-full rounded-full bg-surface flex items-center justify-center">
                <i className="fas fa-plus text-amber-400 text-sm"></i>
              </span>
            </span>
          </div>
        )}

        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium mb-5">
          <i className="fas fa-bullhorn text-red-400"></i>
          Publica tu anuncio
        </span>

        <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 leading-tight">
          {titulo}
        </h2>
        <p className="text-white/70 text-sm md:text-base mb-8 max-w-lg mx-auto">
          {subtitulo}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/micuenta/registro" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold text-sm rounded-xl hover:opacity-90 hover:shadow-lg hover:shadow-red-500/25 transition-all duration-200 shadow-lg shadow-red-500/20">
            <i className="fas fa-rocket"></i>
            {boton1}
          </a>
          <a href="/micuenta/planes" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/5 text-white font-medium text-sm rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200">
            <i className="fas fa-crown text-amber-400"></i>
            {boton2}
          </a>
        </div>
      </div>
    </section>
  );
}
