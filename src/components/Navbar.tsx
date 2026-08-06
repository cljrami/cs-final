// src/components/Navbar.tsx
import { useState, useEffect, useRef } from 'react';
import CiudadesModal from './CiudadesModal';

interface NavConfig {
  nav_logo_1?: string;
  nav_logo_2?: string;
  nav_inicio?: string;
  nav_ciudades?: string;
  nav_ingresar?: string;
  nav_publicar?: string;
  nav_entrar_usuario?: string;
  nav_entrar_usuario_desc?: string;
  nav_entrar_escort?: string;
  nav_entrar_escort_desc?: string;
  nav_mi_panel?: string;
  nav_mi_cuenta?: string;
  nav_mis_favoritos?: string;
  nav_mi_perfil?: string;
  nav_cerrar_sesion?: string;
}

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ciudadesModalOpen, setCiudadesModalOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [cfg, setCfg] = useState<NavConfig | null>(null);

  const [usuario, setUsuario] = useState<{ nombre: string; email: string } | null>(null);
  const [escort, setEscort] = useState<{ nombre: string; email: string } | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const loginRef = useRef<any>(null);

  useEffect(() => {
    const t = document.documentElement.dataset.theme || 'dark';
    setTheme(t === 'light' ? 'light' : 'dark');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  };

  useEffect(() => {
    fetch('/api/config/site.php')
      .then(r => r.json())
      .then(d => { if (d.success) setCfg(d.data); })
      .catch(() => {});
  }, []);

  const T = {
    logo1: cfg?.nav_logo_1 || 'CS',
    logo2: cfg?.nav_logo_2 || 'Escorts',
    inicio: cfg?.nav_inicio || 'Inicio',
    ciudades: cfg?.nav_ciudades || 'Ciudades',
    ingresar: cfg?.nav_ingresar || 'Ingresar',
    publicar: cfg?.nav_publicar || 'Publicar',
    entrarUsuario: cfg?.nav_entrar_usuario || 'Entrar como Usuario',
    entrarUsuarioDesc: cfg?.nav_entrar_usuario_desc || 'Guarda favoritos, valora',
    entrarEscort: cfg?.nav_entrar_escort || 'Entrar como Escort',
    entrarEscortDesc: cfg?.nav_entrar_escort_desc || 'Administra tu perfil',
    miPanel: cfg?.nav_mi_panel || 'Mi Panel',
    miCuenta: cfg?.nav_mi_cuenta || 'Mi Cuenta',
    misFavoritos: cfg?.nav_mis_favoritos || 'Mis Favoritos',
    miPerfil: cfg?.nav_mi_perfil || 'Mi Perfil',
    cerrarSesion: cfg?.nav_cerrar_sesion || 'Cerrar sesión',
  };

  useEffect(() => {
    const escortRaw = localStorage.getItem('escort_data');
    if (escortRaw) {
      try { setEscort(JSON.parse(escortRaw)); return; } catch {}
    }
    const usuarioRaw = localStorage.getItem('usuario_data');
    if (usuarioRaw) {
      try { setUsuario(JSON.parse(usuarioRaw)); } catch {}
    }
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) {
        setLoginOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-50 bg-page/95 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-1 shrink-0">
            <span className="text-red-500 font-bold text-xl">{T.logo1}</span>
            <span className="text-ink font-semibold text-xl">{T.logo2}</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20"
            >
              <i className="fas fa-home"></i>
              {T.inicio}
            </a>
            
            {/* Ciudades Modal */}
            <button
              onClick={() => setCiudadesModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5 transition-all"
            >
              <i className="fas fa-map-marker-alt"></i>
              {T.ciudades}
            </button>

          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label="Cambiar tema"
              className="p-2 rounded-lg text-muted hover:text-ink hover:bg-white/5 transition-all shrink-0"
            >
              <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} text-base`}></i>
            </button>
            {escort ? (
              <div className="flex items-center gap-2">
                <span className="text-muted text-sm mr-1">
                  <i className="fas fa-user-shield mr-1.5 text-amber-400"></i>
                  {escort.nombre}
                </span>
                <a href="/micuenta/resumen" className="px-3 py-2 rounded-lg text-sm text-muted hover:text-ink hover:bg-white/5 transition-all" title={T.miPanel}>
                  <i className="fas fa-tachometer-alt"></i>
                </a>
                <button onClick={() => { localStorage.removeItem('escort_token'); localStorage.removeItem('escort_data'); window.location.href = '/'; }}
                  className="px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-white/5 transition-all" title={T.cerrarSesion}>
                  <i className="fas fa-sign-out-alt"></i>
                </button>
              </div>
            ) : usuario ? (
              <div className="flex items-center gap-2">
                <span className="text-muted text-sm mr-1">
                  <i className="fas fa-user mr-1.5 text-red-400"></i>
                  {usuario.nombre}
                </span>
                <a href="/mi-cuenta" className="px-3 py-2 rounded-lg text-sm text-muted hover:text-ink hover:bg-white/5 transition-all" title={T.miCuenta}>
                  <i className="fas fa-tachometer-alt"></i>
                </a>
                <a href="/mis-favoritos" className="px-3 py-2 rounded-lg text-sm text-muted hover:text-ink hover:bg-white/5 transition-all" title={T.misFavoritos}>
                  <i className="fas fa-heart"></i>
                </a>
                <a href="/mi-perfil" className="px-3 py-2 rounded-lg text-sm text-muted hover:text-ink hover:bg-white/5 transition-all" title={T.miPerfil}>
                  <i className="fas fa-user-edit"></i>
                </a>
                <button onClick={() => { localStorage.removeItem('usuario_token'); localStorage.removeItem('usuario_data'); window.location.href = '/'; }}
                  className="px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-white/5 transition-all" title={T.cerrarSesion}>
                  <i className="fas fa-sign-out-alt"></i>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative" ref={loginRef}>
                  <button
                    onClick={() => setLoginOpen(!loginOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-ink border border-white/10 hover:border-white/20 transition-all"
                  >
                    <i className="fas fa-user"></i>
                    {T.ingresar}
                    <i className={`fas fa-chevron-down text-xs transition-transform ${loginOpen ? 'rotate-180' : ''}`}></i>
                  </button>
                  {loginOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-surface border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                      <a href="/ingresar" onClick={() => setLoginOpen(false)}
                         className="flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-ink hover:bg-white/5 transition-colors">
                        <i className="fas fa-user text-red-400 w-5"></i>
                        <div>
                          <div className="font-medium">{T.entrarUsuario}</div>
                          <div className="text-xs text-muted">{T.entrarUsuarioDesc}</div>
                        </div>
                      </a>
                      <div className="border-t border-white/5"></div>
                      <a href="/micuenta/login" onClick={() => setLoginOpen(false)}
                         className="flex items-center gap-3 px-4 py-3 text-sm text-muted hover:text-ink hover:bg-white/5 transition-colors">
                        <i className="fas fa-user-shield text-amber-400 w-5"></i>
                        <div>
                          <div className="font-medium">{T.entrarEscort}</div>
                          <div className="text-xs text-muted">{T.entrarEscortDesc}</div>
                        </div>
                      </a>
                    </div>
                  )}
                </div>
                <a
                  href="/micuenta/registro"
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg shadow-red-500/25"
                >
                  <i className="fas fa-plus"></i>
                  {T.publicar}
                </a>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-muted hover:text-ink hover:bg-white/5"
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
          <button
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            className="md:hidden p-2 rounded-lg text-muted hover:text-ink hover:bg-white/5"
          >
            <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} text-base`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-page border-t border-white/5 px-4 py-4 space-y-2">
          <a href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-red-500/10 text-red-400">
            <i className="fas fa-home w-5"></i>{T.inicio}
          </a>
          <button onClick={() => { setCiudadesModalOpen(true); setMobileMenuOpen(false); }}
             className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5">
            <i className="fas fa-map-marker-alt w-5"></i>{T.ciudades}
          </button>

          
          <div className="pt-2 border-t border-white/5 space-y-2">
            {escort ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2 text-amber-400 text-sm">
                  <i className="fas fa-user-shield"></i>
                  {escort.nombre}
                </div>
                <a href="/micuenta/resumen" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5">
                  <i className="fas fa-tachometer-alt w-5 text-amber-400"></i>{T.miPanel}
                </a>
                <button onClick={() => { localStorage.removeItem('escort_token'); localStorage.removeItem('escort_data'); window.location.href = '/'; }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-red-400 hover:bg-white/5">
                  <i className="fas fa-sign-out-alt w-5"></i>{T.cerrarSesion}
                </button>
              </>
            ) : usuario ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2 text-muted text-sm">
                  <i className="fas fa-user text-red-400"></i>
                  {usuario.nombre}
                </div>
                <a href="/mi-cuenta" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5">
                  <i className="fas fa-tachometer-alt w-5 text-red-400"></i>{T.miCuenta}
                </a>
                <a href="/mis-favoritos" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5">
                  <i className="fas fa-heart w-5 text-red-400"></i>{T.misFavoritos}
                </a>
                <a href="/mi-perfil" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5">
                  <i className="fas fa-user-edit w-5 text-red-400"></i>{T.miPerfil}
                </a>
                <button onClick={() => { localStorage.removeItem('usuario_token'); localStorage.removeItem('usuario_data'); window.location.href = '/'; }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-red-400 hover:bg-white/5">
                  <i className="fas fa-sign-out-alt w-5"></i>{T.cerrarSesion}
                </button>
              </>
            ) : (
              <div className="space-y-1">
                <a href="/ingresar" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5">
                  <i className="fas fa-user w-5 text-red-400"></i>{T.entrarUsuario}
                </a>
                <a href="/micuenta/login" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-white/5">
                  <i className="fas fa-user-shield w-5 text-amber-400"></i>{T.entrarEscort}
                </a>
                <a href="/micuenta/registro" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold bg-red-500 text-white justify-center">
                  <i className="fas fa-plus"></i>{T.publicar}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>

    <CiudadesModal isOpen={ciudadesModalOpen} onClose={() => setCiudadesModalOpen(false)} />
    </>
  );
}
