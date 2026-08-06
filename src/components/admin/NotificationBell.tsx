import { useState, useEffect, useRef } from 'react';

interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  url: string | null;
  created_at: string;
  actor_foto: string;
  actor_nombre: string;
}

const tipoIcon: Record<string, string> = {
  vip_aprobado: 'fa-crown text-amber-400',
  nueva_valoracion: 'fa-star text-yellow-400',
  mensaje_nuevo: 'fa-envelope text-blue-400',
  promocion: 'fa-gem text-purple-400',
  sistema: 'fa-cog text-gray-400',
  cuenta_aprobada: 'fa-user-check text-green-400',
  plan_aprobado: 'fa-credit-card text-green-400',
  plan_rechazado: 'fa-credit-card text-red-400',
  plan_pausado: 'fa-pause-circle text-blue-400',
  plan_reactivado: 'fa-play-circle text-green-400',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotificaciones = async (unreadOnly = false) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token') || '';
      const params = new URLSearchParams();
      params.set('limit', '10');
      if (unreadOnly) params.set('unread_only', '1');
      const res = await fetch(`/api/admin/notificaciones.php?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotificaciones(data.notificaciones);
        setUnreadCount(data.unread_count);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem('admin_token') || '';
      await fetch('/api/admin/notificaciones.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'mark_read' }),
      });
      setUnreadCount(0);
      setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
      setError('Error al marcar como leídas');
    }
  };

  const markRead = async (id: number) => {
    try {
      const token = localStorage.getItem('admin_token') || '';
      await fetch('/api/admin/notificaciones.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'mark_read', id }),
      });
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotificaciones(prev =>
        prev.map(n => (n.id === id ? { ...n, leida: true } : n))
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError('Error al marcar notificación');
    }
  };

  const deleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('admin_token') || '';
      await fetch('/api/admin/notificaciones.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete', id }),
      });
      setNotificaciones(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - (notificaciones.find(n => n.id === id)?.leida ? 0 : 1)));
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Error al eliminar notificación');
    }
  };

  useEffect(() => {
    fetchNotificaciones();

    const interval = setInterval(() => {
      fetchNotificaciones(true);
    }, 30000);

    const onRefresh = () => fetchNotificaciones(true);
    window.addEventListener('notifications-refresh', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications-refresh', onRefresh);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `hace ${diffD}d`;
    return date.toLocaleDateString('es-CL');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { console.log('🔔 NotificationBell click', { open }); setOpen(!open); if (!open) fetchNotificaciones(); }}
        className="bg-transparent border border-admin-border text-admin-muted w-10 h-10 rounded-lg hover:text-admin-text hover:border-admin-muted transition-all duration-200 flex items-center justify-center relative"
        aria-label="Notificaciones"
      >
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 border-2 border-admin-card shadow-lg shadow-red-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 md:w-96 bg-admin-card border border-admin-border rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden animate-fadeIn">
          {error && (
            <div className="mx-4 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>{error}
              <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300"><i className="fas fa-times"></i></button>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 border-b border-admin-border">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <i className="fas fa-bell text-admin-muted"></i>
              Notificaciones
              {unreadCount > 0 && (
                <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
                  {unreadCount} nuevas
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-admin-muted hover:text-white transition-colors"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && notificaciones.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <i className="fas fa-spinner fa-spin text-admin-muted text-lg"></i>
              </div>
            ) : notificaciones.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-admin-muted">
                <i className="fas fa-bell-slash text-2xl mb-2"></i>
                <p className="text-sm">No hay notificaciones</p>
              </div>
            ) : (
              notificaciones.map((n) => (
                <div
                  key={n.id}
                  className={`group px-4 py-3 border-b border-admin-border last:border-0 hover:bg-[#2a2a3e] transition-colors cursor-pointer ${!n.leida ? 'bg-red-500/5' : ''}`}
                  onClick={() => { if (!n.leida) markRead(n.id); if (n.url) window.location.href = n.url; }}
                >
                  <div className="flex items-start gap-3">
                    {n.actor_foto ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-admin-border">
                        <img src={n.actor_foto} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#2a2a3e] flex items-center justify-center flex-shrink-0 border border-admin-border">
                        <i className={`fas ${tipoIcon[n.tipo] || 'fa-bell text-gray-400'} text-sm`}></i>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        {n.actor_nombre ? (
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${!n.leida ? 'text-white' : 'text-gray-300'}`}>
                              {n.actor_nombre}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{n.titulo}</p>
                          </div>
                        ) : (
                          <p className={`text-sm truncate flex-1 min-w-0 ${!n.leida ? 'text-white font-medium' : 'text-gray-300'}`}>
                            {n.titulo}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 flex-shrink-0 self-start mt-0.5">
                          {!n.leida && (
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          )}
                          <button
                            onClick={(e) => deleteNotification(n.id, e)}
                            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Eliminar"
                          >
                            <i className="fas fa-times text-[10px]"></i>
                          </button>
                        </div>
                      </div>
                      {n.mensaje && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.mensaje}</p>
                      )}
                      <p className="text-[10px] text-gray-600 mt-1">{formatTimeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
