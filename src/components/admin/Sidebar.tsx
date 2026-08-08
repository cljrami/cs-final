import { useState, useEffect } from 'react';
import { getAdminRol, esAdminOSuperior } from '../../lib/adminRole';

interface SidebarProps {
  activePage?: string;
  loading?: boolean;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line', href: '/admin', countKey: null },
   { id: 'escorts', label: 'Escorts', icon: 'fa-users', href: '/admin/escorts', countKey: 'escorts' },
  { id: 'escorts-gira', label: 'Escorts en Gira', icon: 'fa-route', href: '/admin/escorts-gira', countKey: 'escortsEnGira' },
  { id: 'usuarios', label: 'Usuarios', icon: 'fa-user', href: '/admin/usuarios', countKey: null },
  { id: 'suscripciones', label: 'Suscripciones', icon: 'fa-calendar-check', href: '/admin/suscripciones', countKey: 'suscripcionesPendientes' },
  { id: 'verificaciones', label: 'Verificaciones', icon: 'fa-id-card', href: '/admin/verificaciones', countKey: 'verificaciones' },
  { id: 'solicitudes-vip', label: 'Solicitudes VIP', icon: 'fa-crown', href: '/admin/solicitudes-vip', countKey: 'solicitudesVip' },
  { id: 'vip-activos', label: 'VIP Activos', icon: 'fa-star', href: '/admin/vip-activos', countKey: null },
  { id: 'sticky', label: 'Sticky', icon: 'fa-thumbtack', href: '/admin/sticky', countKey: null },
  { id: 'solicitudes-extras', label: 'Solicitudes Extras', icon: 'fa-plus-circle', href: '/admin/solicitudes-extras', countKey: 'extrasPendientes' },
  { id: 'pagos', label: 'Pagos', icon: 'fa-receipt', href: '/admin/pagos', countKey: 'pagosPendientes' },
  { id: 'comentarios', label: 'Comentarios', icon: 'fa-comments', href: '/admin/comentarios', countKey: 'comentariosPendientes' },
  { id: 'reportes', label: 'Reportes', icon: 'fa-flag', href: '/admin/reportes', countKey: 'reportesPendientes' },
  { id: 'notificaciones', label: 'Notificaciones', icon: 'fa-bell', href: '/admin/notificaciones', countKey: null },
];

const configItems = [
  { id: 'categorias', label: 'Categorías', icon: 'fa-tags', href: '/admin/categorias', countKey: 'categorias' },
  { id: 'servicios', label: 'Servicios', icon: 'fa-concierge-bell', href: '/admin/servicios', countKey: 'servicios' },
  { id: 'ciudades', label: 'Ciudades', icon: 'fa-map-marker-alt', href: '/admin/ciudades', countKey: 'ciudades' },
  { id: 'nacionalidades', label: 'Nacionalidades', icon: 'fa-globe', href: '/admin/nacionalidades', countKey: 'nacionalidades' },
  { id: 'orientaciones', label: 'Orientaciones', icon: 'fa-heart', href: '/admin/orientaciones', countKey: 'orientaciones' },
  { id: 'etnias', label: 'Etnias', icon: 'fa-users', href: '/admin/etnias', countKey: 'etnias' },
  { id: 'colores', label: 'Colores', icon: 'fa-palette', href: '/admin/colores', countKey: 'colores' },
  { id: 'estilos', label: 'Estilos', icon: 'fa-magic', href: '/admin/estilos', countKey: 'estilos' },
  { id: 'idiomas', label: 'Idiomas', icon: 'fa-language', href: '/admin/idiomas', countKey: 'idiomas' },
  { id: 'planes', label: 'Planes', icon: 'fa-gem', href: '/admin/planes', countKey: 'planes' },
  { id: 'extras', label: 'Extras', icon: 'fa-puzzle-piece', href: '/admin/extras', countKey: 'extras' },
  { id: 'auditoria', label: 'Auditoría', icon: 'fa-history', href: '/admin/auditoria', countKey: null },
  { id: 'administradores', label: 'Administradores', icon: 'fa-user-shield', href: '/admin/administradores', countKey: null },
  { id: 'configuracion', label: 'Configuración', icon: 'fa-cog', href: '/admin/configuracion', countKey: null },
  { id: 'contenido', label: 'Contenido del sitio', icon: 'fa-file-lines', href: '/admin/contenido', countKey: null },
  { id: 'seo', label: 'SEO / Sitemap', icon: 'fa-sitemap', href: '/admin/seo', countKey: null },
  { id: 'configuracion-email', label: 'Email', icon: 'fa-envelope', href: '/admin/configuracion-email', countKey: null },
  { id: 'notificaciones-email', label: 'Notificaciones Email', icon: 'fa-bell', href: '/admin/notificaciones-email', countKey: null },
];

  export default function Sidebar({ activePage = 'dashboard', loading }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [adminUser, setAdminUser] = useState<{ nombre: string; rol: string } | null>(null);
  const [rol, setRol] = useState<'admin' | 'superadmin' | 'moderador' | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('admin_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAdminUser(parsed);
        setRol(parsed.rol);
      } catch {}
    }
  }, []);

  const isAdminOsuperior = esAdminOSuperior(rol);
  const esModerador = rol === 'moderador';

  // Menús visibles según rol
  const visibleMenuItems = menuItems.filter(item => {
    if (item.id === 'dashboard') return true;
    if (item.id === 'escorts') return true;
    if (item.id === 'escorts-gira') return true;
    if (item.id === 'verificaciones') return true;
    if (item.id === 'comentarios') return true;
    if (item.id === 'reportes') return true;
    if (item.id === 'auditoria') return true;
    if (item.id === 'notificaciones') return true;
    // Moderador: solo lectura
    if (item.id === 'suscripciones' || item.id === 'pagos') return true;
    return isAdminOsuperior;
  });

  const visibleConfigItems = configItems.filter(item => {
    if (item.id === 'auditoria') return true;
    return isAdminOsuperior;
  });


  // Guardar timestamp al visitar cada seccion
  useEffect(() => {
    const allItems = [...menuItems, ...configItems];
    const current = allItems.find(i => i.id === activePage);
    if (current?.countKey) {
      localStorage.setItem(`admin_last_visit_${current.countKey}`, new Date().toISOString());
    }
  }, [activePage]);

  // Cargar conteos desde la API al montar
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const token = localStorage.getItem('admin_token') || '';
        const allItems = [...menuItems, ...configItems];
        const params = new URLSearchParams();
        allItems.forEach(item => {
          if (item.countKey) {
            const ts = localStorage.getItem(`admin_last_visit_${item.countKey}`);
            if (ts) params.set(`since_${item.countKey}`, ts);
          }
        });
        const qs = params.toString();
        const url = qs ? `/api/admin/counts.php?${qs}` : '/api/admin/counts.php';
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
          console.error('counts.php error HTTP:', res.status);
          return;
        }

        const data = await res.json();

        if (data.success && data.counts) {
          setItemCounts(data.counts);
        } else {
          console.error('counts.php error:', data.error || 'Sin datos');
        }
      } catch (err) {
        console.error('Error cargando counts:', err);
      }
    };

    loadCounts();

    const interval = setInterval(loadCounts, 15000);
    const onRefresh = () => loadCounts();
    window.addEventListener('counts-refresh', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('counts-refresh', onRefresh);
    };
  }, []);

  const toggleMobile = () => setMobileOpen(!mobileOpen);
  const closeMobile = () => setMobileOpen(false);

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = async () => {
    const token = localStorage.getItem('admin_token');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');

    if (token) {
      try {
        await fetch('/api/admin/logout.php', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        });
      } catch (err) {}
    }
    window.location.href = '/admin/login';
  };

  const isActive = (id: string) => {
    if (activePage === 'dashboard') return id === 'dashboard';
    if (activePage === 'escorts') return id === 'escorts';
    return activePage === id;
  };

  const renderItem = (item: any, isConfig: boolean = false) => {
    const count = item.countKey ? itemCounts[item.countKey] : undefined;
    const showBadge = count !== undefined && count > 0;
    const isUrgent = showBadge;

    return (
      <a
        key={item.id}
        href={item.href}
        onClick={closeMobile}
        className={`
          flex items-center gap-3.5 px-3 py-2.5 rounded-lg mb-1 text-sm
          transition-all duration-200
          ${isActive(item.id) 
            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20' 
            : 'text-admin-muted hover:bg-[#2d2d44] hover:text-white'
          }
        `}
      >
        <i className={`fas ${item.icon} w-6 text-center`}></i>
        <span className="flex-1">{item.label}</span>
        {showBadge && (
          <span className={`text-xs font-bold min-w-[22px] h-[22px] flex items-center justify-center rounded-full px-1.5 shadow-lg ${isUrgent ? 'bg-red-500 text-white shadow-red-500/30' : 'bg-gray-600/50 text-gray-400'}`}>
            {count}
          </span>
        )}
      </a>
    );
  };

  return (
    <>
      {/* Overlay móvil */}
      {mobileOpen && (
        <div 
          onClick={closeMobile} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] md:hidden transition-opacity duration-300"
        />
      )}

      {/* Botón hamburguesa móvil */}
      <button
        onClick={toggleMobile}
        className="fixed top-3 left-3 z-[101] bg-[#1a1a2e] border border-admin-border text-white p-2.5 rounded-lg md:hidden shadow-lg shadow-black/30 active:scale-95 transition-transform"
        aria-label="Menu"
      >
        <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'} text-lg`}></i>
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-[100dvh] w-[260px] bg-[#1a1a2e] border-r border-admin-border
        flex flex-col z-[100] transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header - fijo */}
        <div className="p-4 md:p-5 border-b border-admin-border flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="fas fa-shield-alt text-black"></i>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base md:text-lg truncate">Admin Panel</div>
            <div className="text-xs text-admin-muted">Kimi</div>
          </div>
        </div>

        {/* Navegación - scrolleable */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          <div className="text-[0.7rem] text-gray-500 uppercase tracking-widest px-3 mb-2">
            Principal
          </div>
          {visibleMenuItems.map(item => renderItem(item))}

          <div className="text-[0.7rem] text-gray-500 uppercase tracking-widest px-3 mt-4 md:mt-6 mb-2">
            Configuración
          </div>
          {visibleConfigItems.map(item => renderItem(item, true))}
        </div>

        {/* Footer - fijo abajo */}
        <div className="p-3 md:p-4 border-t border-admin-border flex-shrink-0 bg-[#1a1a2e]">
          <a href="/admin/mi-perfil" onClick={closeMobile} className="flex items-center gap-3 p-2 rounded-lg bg-[#2d2d44] hover:bg-[#3d3d5c] transition-colors cursor-pointer">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
              <i className="fas fa-user"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{adminUser?.nombre || 'Admin'}</div>
              <div className="text-xs text-admin-muted capitalize">{adminUser?.rol || 'Administrador'}</div>
            </div>
            <i className="fas fa-chevron-right text-gray-600 text-xs"></i>
          </a>

          <button 
            onClick={handleLogoutClick}
            className="flex items-center gap-2 mt-2 md:mt-3 text-red-500 text-sm bg-transparent border-none cursor-pointer p-2 w-full text-left rounded-lg hover:bg-red-500/10 transition-colors active:scale-[0.98]"
          >
            <i className="fas fa-sign-out-alt"></i>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-[320px] md:max-w-sm shadow-2xl p-5 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-3 md:mb-4">
                <i className="fas fa-sign-out-alt text-red-400 text-lg md:text-xl"></i>
              </div>
              <h3 className="text-base md:text-lg font-bold text-white mb-1 md:mb-2">¿Cerrar sesión?</h3>
              <p className="text-gray-400 text-sm mb-4 md:mb-6">¿Estás seguro de que deseas salir del panel de administración?</p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-3 py-2 md:px-4 md:py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleLogoutConfirm}
                  className="flex-1 px-3 py-2 md:px-4 md:py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-red-500/20 text-sm"
                >
                  Salir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}