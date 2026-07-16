// src/components/escort/EscortSidebar.tsx
import { useState, useEffect, useCallback } from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface Props {
  activePage: string;
}

interface EscortData {
  id: number;
  nombre: string;
  nombre_artistico: string;
  foto_portada: string | null;
  plan_nombre: string | null;
  plan_color: string | null;
  plan_estado: string | null;
  extras_activos: number;
  pausas_usadas: number;
  pausas_maximas: number;
  pausas_restantes: number;
  verificado: number;
  vip: number;
  aprobada?: number;
  vip_solicitud_estado?: 'enviado' | 'en_revision' | 'rechazado' | null;
  verificacion_estado?: 'pendiente' | 'en_revision' | 'aprobada' | 'rechazada' | null;
}

export default function EscortSidebar({ activePage }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [escort, setEscort] = useState<EscortData | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [notifType, setNotifType] = useState<'error' | 'success'>('error');

  const fetchSidebar = useCallback(() => {
    const token = localStorage.getItem('escort_token');
    if (!token) return;

    const ts = Date.now();
    fetch(`/api/escort/perfil-sidebar.php?_=${ts}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEscort(data.escort);
        }
      })
      .catch(err => console.error('Sidebar fetch error:', err));
  }, []);

  useEffect(() => {
    fetchSidebar();
    const interval = setInterval(fetchSidebar, 15000);
    const onRefresh = () => fetchSidebar();
    window.addEventListener('sidebar-refresh', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('sidebar-refresh', onRefresh);
    };
  }, [fetchSidebar]);

  const toggleMobile = () => setMobileOpen(!mobileOpen);
  const closeMobile = () => setMobileOpen(false);

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    localStorage.removeItem('escort_token');
    window.location.href = '/micuenta/login';
  };

  const handlePauseToggle = async () => {
    if (pausing || !escort) return;
    const isPaused = escort.plan_estado === 'pausada';
    const endpoint = isPaused ? '/api/escort/reactivar-plan.php' : '/api/escort/pausar-plan.php';
    const confirmMsg = isPaused
      ? '¿Reactivar tu aviso? Volverá a ser visible para los clientes.'
      : '¿Pausar tu aviso? Dejará de mostrarse hasta que lo reactives.';
    if (!confirm(confirmMsg)) return;

    setPausing(true);
    try {
      const token = localStorage.getItem('escort_token');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchSidebar();
        window.dispatchEvent(new Event('sidebar-refresh'));
        setNotifType('success');
        setNotifMsg(data.message || 'Estado cambiado correctamente');
        setTimeout(() => setNotifMsg(''), 4000);
      } else {
        setNotifType('error');
        setNotifMsg(data.error || 'No se pudo cambiar el estado del aviso');
        setTimeout(() => setNotifMsg(''), 4000);
      }
    } catch {
      setNotifType('error');
      setNotifMsg('Error de conexión');
      setTimeout(() => setNotifMsg(''), 4000);
    } finally {
      setPausing(false);
    }
  };

  const menuItems = [
    { id: 'resumen', label: 'Resumen', icon: 'fa-chart-line', href: '/micuenta/resumen' },
    { id: 'perfil', label: 'Editar Perfil', icon: 'fa-user-edit', href: '/micuenta/perfil' },
    { id: 'fotos', label: 'Gestionar Fotos', icon: 'fa-images', href: '/micuenta/fotos' },
    { id: 'historias', label: 'Mis Historias', icon: 'fa-history', href: '/micuenta/historias' },
    { id: 'datos', label: 'Mis Datos', icon: 'fa-id-card', href: '/micuenta/datos' },
  ];

  // ── VERIFICACIÓN ──
  const getVerificacionData = () => {
    if (escort?.verificado === 1) {
      return {
        label: 'Verificación',
        statusText: 'Verificada',
        statusColor: 'text-green-400',
        iconColor: 'text-amber-400',
        href: '/micuenta/verificacion',
      };
    }
    if (escort?.verificacion_estado === 'pendiente' || escort?.verificacion_estado === 'en_revision') {
      return {
        label: 'Verificación',
        statusText: 'En proceso',
        statusColor: 'text-yellow-400',
        iconColor: 'text-amber-400',
        href: '/micuenta/verificacion',
      };
    }
    if (escort?.verificacion_estado === 'rechazada') {
      return {
        label: 'Verificación',
        statusText: 'Rechazada',
        statusColor: 'text-red-400',
        iconColor: 'text-red-400',
        href: '/micuenta/verificacion',
      };
    }
    return {
      label: 'Verificación',
      statusText: 'No verificada',
      statusColor: 'text-gray-500',
      iconColor: 'text-gray-500',
      href: '/micuenta/verificacion',
    };
  };

  // ── VIP ──
  const getVipData = () => {
    if (escort?.vip === 1) {
      return {
        label: 'VIP',
        statusText: 'Activo',
        statusColor: 'text-green-400',
        iconColor: 'text-amber-400',
        href: '/micuenta/vip',
      };
    }
    if (escort?.vip_solicitud_estado === 'enviado' || escort?.vip_solicitud_estado === 'en_revision') {
      return {
        label: 'VIP',
        statusText: 'En proceso',
        statusColor: 'text-yellow-400',
        iconColor: 'text-amber-400',
        href: '/micuenta/vip',
      };
    }
    if (escort?.vip_solicitud_estado === 'rechazado') {
      return {
        label: 'VIP',
        statusText: 'Rechazado',
        statusColor: 'text-red-400',
        iconColor: 'text-red-400',
        href: '/micuenta/vip',
      };
    }
    return {
      label: 'VIP',
      statusText: 'Solicitar',
      statusColor: 'text-amber-400',
      iconColor: 'text-amber-400',
      href: '/micuenta/vip',
      cta: true,
    };
  };

  // ── MI PLAN ──
  const getPlanData = () => {
    if (!escort?.plan_nombre) {
      return {
        label: 'Mi Plan',
        statusText: 'Sin plan',
        statusColor: 'text-gray-500',
        iconColor: 'text-gray-500',
        href: '/micuenta/mi-plan',
      };
    }
    const estado = escort.plan_estado;
    let statusColor = 'text-green-400';
    let iconColor = 'text-amber-400';
    let subText = '';
    let subTextColor = 'text-gray-500';
    if (estado === 'pausada' || estado === 'pendiente') {
      statusColor = 'text-yellow-400';
    } else if (estado === 'expirada' || estado === 'rechazada' || estado === 'cancelada') {
      statusColor = 'text-red-400';
      iconColor = 'text-red-400';
    }
    const usadas = escort.pausas_usadas ?? 0;
    const max = escort.pausas_maximas ?? 0;
    if (max > 0) {
      subText = `Pausas: ${usadas}/${max} usadas`;
      subTextColor = usadas >= max ? 'text-red-400' : 'text-gray-400';
    }
    return {
      label: 'Mi Plan',
      statusText: escort.plan_nombre,
      statusColor,
      iconColor,
      href: '/micuenta/mi-plan',
      subText,
      subTextColor,
    };
  };

  // ── EXTRAS AL PLAN ──
  const getExtrasData = () => {
    const extras = escort?.extras_activos ?? '';
    const hasExtras = extras.length > 0;
    return {
      label: 'Extras al Plan',
      statusText: hasExtras ? extras : 'Sin extras',
      statusColor: hasExtras ? 'text-green-400' : 'text-gray-500',
      iconColor: hasExtras ? 'text-amber-400' : 'text-gray-500',
      href: '/micuenta/extras',
      cta: !hasExtras,
    };
  };

  const verificacionData = getVerificacionData();
  const vipData = getVipData();
  const planData = getPlanData();
  const extrasData = getExtrasData();

  const isActive = (id: string) => activePage === id;

  const renderMenuItem = (item: { 
    id: string; 
    label: string; 
    icon: string; 
    href: string; 
    badge?: { text: string; color: string } | null;
  }) => {
    const active = isActive(item.id);
    return (
      <a
        key={item.id}
        href={item.href}
        onClick={closeMobile}
        className={`
          flex items-center gap-3.5 px-3 py-2.5 rounded-lg mb-1 text-sm
          transition-all duration-200
          ${active 
            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20' 
            : 'text-gray-400 hover:bg-[#2d2d44] hover:text-white'
          }
        `}
      >
        <i className={`fas ${item.icon} w-6 text-center`}></i>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span>{item.label}</span>
            {item.badge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.badge.color}`}>
                {item.badge.text}
              </span>
            )}
          </div>
        </div>
      </a>
    );
  };

  const skeletonBase = { baseColor: '#2d2d44', highlightColor: '#3d3d5c' };

  // ── CARD COMPACTO ──
  const renderStatusCard = (data: {
    label: string;
    statusText: string;
    statusColor: string;
    iconColor: string;
    href: string;
    icon: string;
    cta?: boolean;
    subText?: string;
    subTextColor?: string;
  }, loading?: boolean) => {
    const active = isActive(data.href.split('/').pop() || '');
    return (
      <a
        href={data.href}
        onClick={closeMobile}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1
          transition-all duration-200 group
          ${active 
            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20' 
            : data.cta 
              ? 'bg-[#252538] border border-amber-500/30 hover:border-amber-500/60' 
              : 'hover:bg-[#2d2d44]'
          }
        `}
      >
        <div className={`
          w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
          ${active ? 'bg-white/10' : data.cta ? 'bg-amber-500/10' : 'bg-[#252538]'}
        `}>
          <i className={`fas ${data.icon} ${active ? 'text-white' : data.iconColor} text-sm`}></i>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={`text-sm ${active ? 'text-white' : 'text-gray-300'}`}>
            {data.label}
          </div>
          <div className={`text-[11px] font-semibold tracking-wide ${active ? 'text-white/80' : data.statusColor}`}>
            {loading ? <Skeleton width={90} height={14} {...skeletonBase} /> : data.statusText}
          </div>
          {data.subText && (
            <div className={`text-[10px] ${active ? 'text-white/60' : data.subTextColor || 'text-gray-500'}`}>
              {data.subText}
            </div>
          )}
        </div>
      </a>
    );
  };

  return (
    <>
      {mobileOpen && (
        <div 
          onClick={closeMobile} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] lg:hidden transition-opacity duration-300"
        />
      )}

      <button
        onClick={toggleMobile}
        className="fixed top-3 left-3 z-[101] bg-[#1a1a2e] border border-[#2d2d44] text-white p-2.5 rounded-lg lg:hidden shadow-lg shadow-black/30 active:scale-95 transition-transform"
        aria-label="Menu"
      >
        <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'} text-lg`}></i>
      </button>

      <aside className={`
        fixed top-0 left-0 h-[100dvh] w-[260px] bg-[#1a1a2e] border-r border-[#2d2d44]
        flex flex-col z-[100] transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {notifMsg && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
            notifType === 'error'
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-green-500/10 border border-green-500/30 text-green-400'
          }`}>
            <i className={`fas ${notifType === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'} mr-2`}></i>
            {notifMsg}
          </div>
        )}
        <div className="p-4 lg:p-5 border-b border-[#2d2d44] flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="fas fa-shield-alt text-black"></i>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base lg:text-lg truncate">CS Panel</div>
            <div className="text-xs text-gray-500">Escort</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {/* ── PRINCIPAL ── */}
          <div className="text-[0.7rem] text-gray-500 uppercase tracking-widest px-3 mb-2">
            Principal
          </div>
          {menuItems.map(item => renderMenuItem(item))}

          {/* ── MI PLAN ── */}
          <div className="text-[0.7rem] text-gray-500 uppercase tracking-widest px-3 mt-4 lg:mt-6 mb-2">
            Mi Plan
          </div>
          {renderStatusCard({
            ...planData,
            icon: 'fa-credit-card',
          }, !escort)}
          {renderStatusCard({
            ...extrasData,
            icon: 'fa-plus-circle',
          }, !escort)}
          {renderMenuItem({ id: 'pagos', label: 'Historial de Pagos', icon: 'fa-receipt', href: '/micuenta/pagos' })}

          {/* ── PAUSAR / REACTIVAR AVISO ── */}
          {escort && (escort.plan_estado === 'activa' || escort.plan_estado === 'pausada') && (
            <button
              onClick={handlePauseToggle}
              disabled={pausing}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mt-1 transition-all duration-200
                disabled:opacity-60 disabled:cursor-wait
                ${escort.plan_estado === 'pausada'
                  ? 'bg-green-500/10 border border-green-500/30 hover:border-green-500/60 text-green-400'
                  : 'bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/60 text-amber-400'
                }
              `}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${escort.plan_estado === 'pausada' ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                <i className={`fas ${pausing ? 'fa-circle-notch fa-spin' : escort.plan_estado === 'pausada' ? 'fa-play' : 'fa-pause'} text-sm`}></i>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold">
                  {escort.plan_estado === 'pausada' ? 'Reactivar aviso' : 'Pausar aviso'}
                </div>
                <div className="text-[10px] opacity-70">
                  {escort.plan_estado === 'pausada' ? 'Tu aviso está pausado' : `Pausas: ${escort.pausas_usadas ?? 0}/${escort.pausas_maximas ?? 0}`}
                </div>
              </div>
            </button>
          )}

          {/* ── ESTADO DE CUENTA (Verificación + VIP como en la foto) ── */}
          <div className="text-[0.7rem] text-gray-500 uppercase tracking-widest px-3 mt-4 lg:mt-6 mb-2">
            Estado de Cuenta
          </div>
          {renderStatusCard({
            ...verificacionData,
            icon: 'fa-shield-alt',
          }, !escort)}
          {renderStatusCard({
            ...vipData,
            icon: 'fa-crown',
          }, !escort)}
        </div>

        {/* PERFIL ESCORT */}
        <div className="p-3 lg:p-4 border-t border-[#2d2d44] flex-shrink-0 bg-[#1a1a2e]">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-[#2d2d44]">
            <div className="w-8 h-8 lg:w-9 lg:h-9 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden relative">
              {escort?.foto_portada ? (
                <img src={escort.foto_portada} alt="" className="w-full h-full object-cover" />
              ) : (
                <i className="fas fa-user text-white text-xs"></i>
              )}
              {escort?.verificado === 1 && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#2d2d44] flex items-center justify-center">
                  <i className="fas fa-check text-[6px] text-white"></i>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {escort ? (escort.nombre_artistico || escort.nombre) : <Skeleton width={120} height={16} {...skeletonBase} />}
                {escort?.vip === 1 && (
                  <i className="fas fa-crown text-amber-400 text-[10px]"></i>
                )}
                {escort && !escort.aprobada && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
                    Pendiente
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                {escort ? `ID: #${escort.id}` : <Skeleton width={80} height={12} {...skeletonBase} />}
              </div>
              {escort?.plan_nombre ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span 
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: escort.plan_color || '#6b7280' }}
                  />
                  <span className="text-[11px] text-gray-400">{escort.plan_nombre}</span>
                </div>
              ) : escort ? (
                <div className="text-[11px] text-gray-500 mt-0.5">Sin plan activo</div>
              ) : (
                <div className="mt-0.5"><Skeleton width={100} height={12} {...skeletonBase} /></div>
              )}
            </div>
          </div>

          <button 
            onClick={handleLogoutClick}
            className="flex items-center gap-2 mt-2 lg:mt-3 text-red-500 text-sm bg-transparent border-none cursor-pointer p-2 w-full text-left rounded-lg hover:bg-red-500/10 transition-colors active:scale-[0.98]"
          >
            <i className="fas fa-sign-out-alt w-6 text-center"></i>
            Cerrar Sesion
          </button>
        </div>
      </aside>

      {showLogoutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 lg:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-[320px] lg:max-w-sm shadow-2xl p-5 lg:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-3 lg:mb-4">
                <i className="fas fa-sign-out-alt text-red-400 text-lg lg:text-xl"></i>
              </div>
              <h3 className="text-base lg:text-lg font-bold text-white mb-1 lg:mb-2">Cerrar sesion?</h3>
              <p className="text-gray-400 text-sm mb-4 lg:mb-6">Estas seguro de que deseas salir del panel?</p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-3 py-2 lg:px-4 lg:py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleLogoutConfirm}
                  className="flex-1 px-3 py-2 lg:px-4 lg:py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-red-500/20 text-sm"
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