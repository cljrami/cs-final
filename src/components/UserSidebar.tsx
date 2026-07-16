import { useState, useEffect } from 'react';

interface UserSidebarProps {
  activePage?: string;
}

const menuItems = [
  { id: 'dashboard', label: 'Mi Cuenta', icon: 'fa-tachometer-alt', href: '/mi-cuenta' },
  { id: 'favoritos', label: 'Mis Favoritos', icon: 'fa-heart', href: '/mis-favoritos' },
  { id: 'perfil', label: 'Mi Perfil', icon: 'fa-user-edit', href: '/mi-perfil' },
  { id: 'valoraciones', label: 'Mis Valoraciones', icon: 'fa-star', href: '/mis-valoraciones' },
];

export default function UserSidebar({ activePage = 'dashboard' }: UserSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('usuario_data');
    if (raw) {
      try { setUserName(JSON.parse(raw).nombre || ''); } catch {}
    }
  }, []);

  return (
    <>
      {/* Hamburger button for mobile */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-xl bg-escort-card border border-escort-border flex items-center justify-center text-escort-muted hover:text-white transition-all"
      >
        <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'} text-sm`}></i>
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-[45]" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-escort-card border-r border-escort-border z-50 flex flex-col transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Header */}
        <div className="p-5 border-b border-escort-border">
          <a href="/mi-cuenta" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-sm font-bold">
              <i className="fas fa-user"></i>
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold text-sm truncate">{userName || 'Mi Cuenta'}</div>
              <div className="text-escort-muted text-xs">Usuario</div>
            </div>
          </a>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <a
              key={item.id}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activePage === item.id
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'text-escort-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <i className={`fas ${item.icon} w-5 text-center ${activePage === item.id ? 'text-red-400' : ''}`}></i>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-escort-border">
          <button
            onClick={() => {
              localStorage.removeItem('usuario_token');
              localStorage.removeItem('usuario_data');
              window.location.href = '/ingresar';
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/5 w-full transition-all"
          >
            <i className="fas fa-sign-out-alt w-5 text-center"></i>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
