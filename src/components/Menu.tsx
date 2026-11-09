import { useState, useEffect } from 'react';

export default function Menu() {
  const [open, setOpen] = useState(false);
  const [pathname, setPathname] = useState('');
  const [ingresoOpen, setIngresoOpen] = useState(false);
  const [registroOpen, setRegistroOpen] = useState(false);
  const [mobileIngresoOpen, setMobileIngresoOpen] = useState(false);
  const [mobileRegistroOpen, setMobileRegistroOpen] = useState(false);

  useEffect(() => {
    const normalize = (p: string) => p.replace(/\/$/, '') || '/';
    setPathname(normalize(window.location.pathname));
  }, []);

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setIngresoOpen(false);
      setRegistroOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const close = () => setOpen(false);
  const toggle = () => setOpen(v => !v);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    const normHref = href.replace(/\/$/, '');
    return pathname === normHref || pathname.startsWith(normHref + '/');
  };

  const linkClass = (href: string) =>
    `transition py-2 md:py-0 ${isActive(href) ? 'text-red-400 font-medium' : 'text-gray-300 hover:text-white'}`;

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-1 shrink-0">
            <span className="text-red-500 font-bold text-xl">Consex</span>
            <span className="text-white font-bold text-xl">VIP</span>
          </a>
          <button
            onClick={toggle}
            className="md:hidden text-white text-xl p-2 cursor-pointer"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <i className={`fas ${open ? 'fa-times' : 'fa-bars'}`} />
          </button>
          <nav
            id="mobile-menu"
            className={`md:flex items-center gap-4 md:gap-6 text-sm ${open ? 'flex' : 'hidden'} md:flex absolute md:static top-full left-0 right-0 md:top-auto bg-[#0a0a0f]/98 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b md:border-0 border-white/5 p-4 md:p-0 flex-col md:flex-row`}
          >
            <a href="/" onClick={close} className={linkClass('/')} aria-current={isActive('/') ? 'page' : undefined}><i className="fas fa-home mr-1 text-xs text-red-400" />Inicio</a>
            <a href="/ciudades" onClick={close} className={linkClass('/ciudades')} aria-current={isActive('/ciudades') ? 'page' : undefined}><i className="fas fa-map-marker-alt mr-1 text-xs text-red-400" />Ciudades</a>
            <a href="/negocios" onClick={close} className={linkClass('/negocios')} aria-current={isActive('/negocios') ? 'page' : undefined}>Negocios</a>
            <a href="/publicidad" onClick={close} className={linkClass('/publicidad')} aria-current={isActive('/publicidad') ? 'page' : undefined}>Publicidad</a>
            <a href="/blog" onClick={close} className={linkClass('/blog')} aria-current={isActive('/blog') ? 'page' : undefined}>Blog</a>
            <div className="flex md:hidden flex-col gap-2 mt-2 pt-2 border-t border-white/10">
              <button
                onClick={() => { setMobileIngresoOpen(v => !v); setMobileRegistroOpen(false); }}
                className="flex items-center justify-between w-full text-xs uppercase tracking-wide text-white/70 px-1 py-1"
              >
                Ingreso
                <i className={`fas fa-chevron-down text-[10px] transition ${mobileIngresoOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileIngresoOpen && (
                <div className="flex flex-col gap-1 pl-3">
                  <a href="/ingresar" onClick={close} className="text-sm text-gray-300 hover:text-white transition">Ingresar como Usuario</a>
                  <a href="/micuenta/login" onClick={close} className="text-sm text-amber-300 hover:text-amber-200 transition">Ingresar como Escort</a>
                </div>
              )}

              <button
                onClick={() => { setMobileRegistroOpen(v => !v); setMobileIngresoOpen(false); }}
                className="flex items-center justify-between w-full text-xs uppercase tracking-wide text-white/70 px-1 py-1 mt-2"
              >
                Registro
                <i className={`fas fa-chevron-down text-[10px] transition ${mobileRegistroOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileRegistroOpen && (
                <div className="flex flex-col gap-1 pl-3">
                  <a href="/micuenta/registro" onClick={close} className="text-sm text-gray-300 hover:text-white transition">Registro de Escort</a>
                  <a href="/unirse" onClick={close} className="text-sm text-gray-300 hover:text-white transition">Registro de Usuario</a>
                </div>
              )}

              <a href="/micuenta/registro" onClick={close} className="mt-3 bg-red-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-900/20 w-fit inline-flex items-center"><i className="fas fa-plus mr-1" />Publicate como Escort</a>
            </div>
          </nav>
          <div className="hidden md:flex items-center gap-4 relative">
            {/* Ingreso Dropdown */}
            <div className="relative">
              <button
                onClick={() => { setIngresoOpen(v => !v); setRegistroOpen(false); }}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition"
                aria-expanded={ingresoOpen}
              >
                <span className="text-white/40 text-xs uppercase">Ingreso</span>
                <i className={`fas fa-chevron-down text-[10px] transition ${ingresoOpen ? 'rotate-180' : ''}`} />
              </button>
              {ingresoOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0f0f17] border border-white/10 rounded-lg shadow-lg py-2 z-50">
                  <a href="/ingresar" className="block px-4 py-2 text-sm text-gray-200 hover:bg-white/5">Ingresar como Usuario</a>
                  <a href="/micuenta/login" className="block px-4 py-2 text-sm text-amber-300 hover:bg-white/5">Ingresar como Escort</a>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-white/10 mx-1" />

            {/* Registro Dropdown */}
            <div className="relative">
              <button
                onClick={() => { setRegistroOpen(v => !v); setIngresoOpen(false); }}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition"
                aria-expanded={registroOpen}
              >
                <span className="text-white/40 text-xs uppercase">Registro</span>
                <i className={`fas fa-chevron-down text-[10px] transition ${registroOpen ? 'rotate-180' : ''}`} />
              </button>
              {registroOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0f0f17] border border-white/10 rounded-lg shadow-lg py-2 z-50">
                  <a href="/micuenta/registro" className="block px-4 py-2 text-sm text-gray-200 hover:bg-white/5">Registro de Escort</a>
                  <a href="/unirse" className="block px-4 py-2 text-sm text-gray-200 hover:bg-white/5">Registro de Usuario</a>
                </div>
              )}
            </div>

            {/* Publicate button fuera del dropdown */}
            <a href="/micuenta/registro" className="bg-red-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-900/20 inline-flex items-center"><i className="fas fa-plus mr-1" />Publicate como Escort</a>
          </div>
        </div>
      </div>
    </header>
  );
}
