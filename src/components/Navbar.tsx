// src/components/Navbar.tsx
import { useState, useEffect, useRef } from 'react';

interface Ciudad {
  id: number;
  nombre: string;
  region: string;
  escorts_activas: number;
}

interface SearchResult {
  id: number;
  nombre: string;
  slug: string;
  edad: number;
  ciudad: string;
  foto_principal: string | null;
  vip: number;
}

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ciudadesOpen, setCiudadesOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Usar any temporalmente para evitar problemas de tipos
  const [ciudades, setCiudades] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [usuario, setUsuario] = useState<{ nombre: string; email: string } | null>(null);
  const [escort, setEscort] = useState<{ nombre: string; email: string } | null>(null);
  
  const searchRef = useRef<any>(null);
  const loginRef = useRef<any>(null);

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
    fetch('/api/ciudades/listado.php')
      .then(r => r.json())
      .then(data => {
        if (data.success) setCiudades(data.data);
      });
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/escorts/buscar.php?q=${encodeURIComponent(searchQuery)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          if (data.success) setSearchResults(data.data);
          else setSearchResults([]);
        })
        .catch(() => setSearchResults([]));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) {
        setLoginOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f0f1a]/95 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-1 shrink-0">
            <span className="text-red-500 font-bold text-xl">CS</span>
            <span className="text-white font-semibold text-xl">Escorts</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20"
            >
              <i className="fas fa-home"></i>
              Inicio
            </a>
            
            {/* Dropdown Ciudades */}
            <div className="relative">
              <button
                onClick={() => setCiudadesOpen(!ciudadesOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <i className="fas fa-map-marker-alt"></i>
                Ciudades
                <i className={`fas fa-chevron-down text-xs transition-transform ${ciudadesOpen ? 'rotate-180' : ''}`}></i>
              </button>
              
              {ciudadesOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                  {ciudades.map((c: any) => (
                    <a
                      key={c.id}
                      href={`/ciudad?nombre=${encodeURIComponent(c.nombre.toLowerCase())}`}
                      className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <span>{c.nombre}</span>
                      <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{c.escorts_activas}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative" ref={searchRef}>
              <div className="flex items-center bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-1.5 focus-within:border-red-500/50 transition-colors w-64">
                <i className="fas fa-search text-gray-500 text-xs"></i>
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600 ml-2"
                />
              </div>

              {searchOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                  {searchResults.map((r: any) => (
                    <a
                      key={r.id}
                      href={`/${r.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#2a2a3e] flex items-center justify-center shrink-0">
                        {r.foto_principal ? (
                          <img src={r.foto_principal} alt={r.nombre} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <i className="fas fa-user text-gray-600 text-sm"></i>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{r.nombre}</div>
                        <div className="text-gray-500 text-xs">{r.ciudad} • {r.edad} años</div>
                      </div>
                      {r.vip === 1 && <i className="fas fa-crown text-yellow-400 text-xs"></i>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {escort ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm mr-1">
                  <i className="fas fa-user-shield mr-1.5 text-amber-400"></i>
                  {escort.nombre}
                </span>
                <a href="/micuenta/resumen" className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all" title="Mi Panel">
                  <i className="fas fa-tachometer-alt"></i>
                </a>
                <button onClick={() => { localStorage.removeItem('escort_token'); localStorage.removeItem('escort_data'); window.location.href = '/'; }}
                  className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-white/5 transition-all" title="Cerrar sesión">
                  <i className="fas fa-sign-out-alt"></i>
                </button>
              </div>
            ) : usuario ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm mr-1">
                  <i className="fas fa-user mr-1.5 text-red-400"></i>
                  {usuario.nombre}
                </span>
                <a href="/mi-cuenta" className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all" title="Mi Cuenta">
                  <i className="fas fa-tachometer-alt"></i>
                </a>
                <a href="/mis-favoritos" className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all" title="Mis Favoritos">
                  <i className="fas fa-heart"></i>
                </a>
                <a href="/mi-perfil" className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all" title="Mi Perfil">
                  <i className="fas fa-user-edit"></i>
                </a>
                <button onClick={() => { localStorage.removeItem('usuario_token'); localStorage.removeItem('usuario_data'); window.location.href = '/'; }}
                  className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-white/5 transition-all" title="Cerrar sesión">
                  <i className="fas fa-sign-out-alt"></i>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative" ref={loginRef}>
                  <button
                    onClick={() => setLoginOpen(!loginOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                  >
                    <i className="fas fa-user"></i>
                    Ingresar
                    <i className={`fas fa-chevron-down text-xs transition-transform ${loginOpen ? 'rotate-180' : ''}`}></i>
                  </button>
                  {loginOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                      <a href="/ingresar" onClick={() => setLoginOpen(false)}
                         className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                        <i className="fas fa-user text-red-400 w-5"></i>
                        <div>
                          <div className="font-medium">Entrar como Usuario</div>
                          <div className="text-xs text-gray-500">Guarda favoritos, valora</div>
                        </div>
                      </a>
                      <div className="border-t border-white/5"></div>
                      <a href="/micuenta/login" onClick={() => setLoginOpen(false)}
                         className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                        <i className="fas fa-user-shield text-amber-400 w-5"></i>
                        <div>
                          <div className="font-medium">Entrar como Escort</div>
                          <div className="text-xs text-gray-500">Administra tu perfil</div>
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
                  Publicar
                </a>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0f0f1a] border-t border-white/5 px-4 py-4 space-y-2">
          <a href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-red-500/10 text-red-400">
            <i className="fas fa-home w-5"></i>Inicio
          </a>
          
          <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">Ciudades</div>
          {ciudades.map((c: any) => (
            <a key={c.id} href={`/ciudad?nombre=${encodeURIComponent(c.nombre.toLowerCase())}`}
               className="flex items-center justify-between px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5">
              <span className="flex items-center gap-2"><i className="fas fa-map-marker-alt text-xs"></i>{c.nombre}</span>
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{c.escorts_activas}</span>
            </a>
          ))}
          
          <div className="pt-2 border-t border-white/5 space-y-2">
            {escort ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2 text-amber-400 text-sm">
                  <i className="fas fa-user-shield"></i>
                  {escort.nombre}
                </div>
                <a href="/micuenta/resumen" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                  <i className="fas fa-tachometer-alt w-5 text-amber-400"></i>Mi Panel
                </a>
                <button onClick={() => { localStorage.removeItem('escort_token'); localStorage.removeItem('escort_data'); window.location.href = '/'; }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-white/5">
                  <i className="fas fa-sign-out-alt w-5"></i>Cerrar sesión
                </button>
              </>
            ) : usuario ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2 text-gray-400 text-sm">
                  <i className="fas fa-user text-red-400"></i>
                  {usuario.nombre}
                </div>
                <a href="/mi-cuenta" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                  <i className="fas fa-tachometer-alt w-5 text-red-400"></i>Mi Cuenta
                </a>
                <a href="/mis-favoritos" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                  <i className="fas fa-heart w-5 text-red-400"></i>Mis Favoritos
                </a>
                <a href="/mi-perfil" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                  <i className="fas fa-user-edit w-5 text-red-400"></i>Mi Perfil
                </a>
                <button onClick={() => { localStorage.removeItem('usuario_token'); localStorage.removeItem('usuario_data'); window.location.href = '/'; }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-white/5">
                  <i className="fas fa-sign-out-alt w-5"></i>Cerrar sesión
                </button>
              </>
            ) : (
              <div className="space-y-1">
                <a href="/ingresar" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                  <i className="fas fa-user w-5 text-red-400"></i>Entrar como Usuario
                </a>
                <a href="/micuenta/login" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5">
                  <i className="fas fa-user-shield w-5 text-amber-400"></i>Entrar como Escort
                </a>
                <a href="/micuenta/registro" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold bg-red-500 text-white justify-center">
                  <i className="fas fa-plus"></i>Publicar
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}