// src/components/CTASection.tsx
import { useState, useEffect } from 'react';

export default function CTASection() {
  const [precio, setPrecio] = useState<number>(15000);

  useEffect(() => {
    fetch('/api/config/site.php')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data.precio_destacado_semanal) {
          setPrecio(data.data.precio_destacado_semanal);
        }
      });
  }, []);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500 to-red-600 p-8 md:p-12 text-center">
      <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-16 -translate-y-16"></div>
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/5 rounded-full translate-x-20 translate-y-20"></div>

      <div className="relative z-10">
        <h2 className="text-white font-bold text-xl md:text-2xl mb-3">¿Eres escort o agencia?</h2>
        <p className="text-red-100 text-sm md:text-base mb-2 max-w-md mx-auto">
          Publica tu perfil y llega a miles de clientes potenciales
        </p>
        <p className="text-red-200/70 text-xs mb-6">
          Destacados desde ${precio.toLocaleString('es-CL')} CLP/semana
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/publicar" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-red-500 font-semibold text-sm rounded-lg hover:bg-gray-100 transition-colors shadow-lg">
            Publicar Ahora
          </a>
          <a href="/planes" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-medium text-sm rounded-lg hover:bg-white/20 transition-colors">
            Ver Planes
          </a>
        </div>
      </div>
    </section>
  );
}