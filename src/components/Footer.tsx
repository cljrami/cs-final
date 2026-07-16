// src/components/Footer.tsx
import { useState, useEffect } from 'react';

interface SiteConfig {
  site_nombre: string;
  site_descripcion: string;
}

export default function Footer() {
  const [config, setConfig] = useState<SiteConfig | null>(null);

  useEffect(() => {
    fetch('/api/config/site.php')
      .then(r => r.json())
      .then(data => {
        if (data.success) setConfig(data.data);
      });
  }, []);

  const siteName = config?.site_nombre ?? 'CSEscorts';

  return (
    <footer className="bg-[#0a0a12] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-1 mb-4">
              <span className="text-red-500 font-bold text-lg">CS</span>
              <span className="text-white font-semibold text-lg">ESCORTS</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              {config?.site_descripcion ?? 'Portal sobre escorts y masajistas para mayores de 18 años.'}
            </p>
          </div>

          <div>
            <h3 className="text-red-400 font-semibold text-sm uppercase tracking-wider mb-4">Páginas</h3>
            <ul className="space-y-3">
              <li><a href="/panel" className="text-gray-500 hover:text-white text-sm transition-colors">Panel Escort</a></li>
              <li><a href="/registro" className="text-gray-500 hover:text-white text-sm transition-colors">Registro</a></li>
              <li><a href="/login" className="text-gray-500 hover:text-white text-sm transition-colors">Iniciar Sesión</a></li>
              <li><a href="/ciudades" className="text-gray-500 hover:text-white text-sm transition-colors">Ciudades</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-red-400 font-semibold text-sm uppercase tracking-wider mb-4">Contacto</h3>
            <a href={`mailto:contacto@${siteName.toLowerCase()}.cl`} className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors">
              <i className="fas fa-envelope text-gray-600"></i>
              contacto@{siteName.toLowerCase()}.cl
            </a>
            <div className="mt-4 flex gap-3">
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <i className="fab fa-twitter text-sm"></i>
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <i className="fab fa-instagram text-sm"></i>
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <i className="fab fa-telegram text-sm"></i>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-xs">© {new Date().getFullYear()} {siteName.toLowerCase()}.cl - Todos los derechos reservados.</p>
          <p className="text-gray-700 text-xs">Solo para mayores de 18 años.</p>
        </div>
      </div>
    </footer>
  );
}