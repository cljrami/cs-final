// src/components/admin/EscortsData.tsx
import { useState, useEffect, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';

interface Stats {
  total: number;
  activas: number;
  pendientes: number;
  rechazadas: number;
  pausadas: number;
  verificadas: number;
  vip: number;
  vencen_hoy: number;
  papelera: number;
}

interface Escort {
  id: number;
  nombre: string;
  edad: number;
  ciudad: string;
  estado: string;
  verificado: number;
  vip: number;
  activa: number;
  eliminated?: number;
  eliminada?: number;
  created_at: string;
  email?: string;
  foto_principal?: string | null;
  slug?: string;
  suscripcion_estado?: string | null;
  plan_base_nombre?: string | null;
  plan_base_badge?: string | null;
  plan_base_color?: string | null;
  plan_base_estado?: string | null;
  plan_base_dias?: number;
  plan_extra_nombre?: string | null;
  plan_extra_tipo?: string | null;
  plan_extra_badge?: string | null;
  plan_extra_color?: string | null;
  plan_extra_estado?: string | null;
  plan_extra_dias?: number;
  rating?: number;
  total_valoraciones?: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

const API_URL = '/api/admin/escorts.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const subEstadoConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  aprobada: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-check-circle', label: 'Aprobada' },
  pendiente: { bg: '#3d3d1a', text: '#fbbf24', icon: 'fa-clock', label: 'Pendiente' },
  rechazada: { bg: '#2a1a1a', text: '#ef4444', icon: 'fa-times-circle', label: 'Rechazada' },
  pausada: { bg: '#1a2d3d', text: '#3b82f6', icon: 'fa-pause-circle', label: 'Pausado' },
  sin_suscripcion: { bg: '#1a1a2e', text: '#6b7280', icon: 'fa-minus-circle', label: 'Sin suscripción' },
};

const planEstadoConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  activa: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-check-circle', label: 'Activo' },
  pendiente_aprobacion: { bg: '#3d3d1a', text: '#fbbf24', icon: 'fa-clock', label: 'Pendiente' },
  pausada: { bg: '#1a2d3d', text: '#3b82f6', icon: 'fa-pause-circle', label: 'Pausado' },
  expirada: { bg: '#2a1a1a', text: '#ef4444', icon: 'fa-hourglass-end', label: 'Expirado' },
  cancelada: { bg: '#2a1a1a', text: '#ef4444', icon: 'fa-ban', label: 'Cancelado' },
  rechazada: { bg: '#2a1a1a', text: '#ef4444', icon: 'fa-times-circle', label: 'Rechazado' },
};

export default function EscortsData() {
  const [items, setItems] = useState<Escort[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activas: 0, pendientes: 0, rechazadas: 0, pausadas: 0, verificadas: 0, vip: 0, vencen_hoy: 0, papelera: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<Escort | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<Escort | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [approveConfirm, setApproveConfirm] = useState<Escort | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<Escort | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const paramsRef = useRef({ filter: 'todos', search: '', page: 1, limit: 50 });

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const fetchItems = async (f: string, s: string, p: number, l: number) => {
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ estado: f, search: s, page: p.toString(), limit: l.toString() });
      const res = await fetch(`${API_URL}?${qs}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setItems(data.escorts || []);
      setStats(data.stats || { total: 0, activas: 0, pendientes: 0, rechazadas: 0, pausadas: 0, verificadas: 0, vip: 0, vencen_hoy: 0, papelera: 0 });
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Carga inicial + cambios de filtro/página
  useEffect(() => {
    paramsRef.current = { filter, search, page: pagination.page, limit: pagination.limit };
    fetchItems(filter, search, pagination.page, pagination.limit);
  }, [filter, pagination.page, pagination.limit]);

  // Debounce de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => {
        if (prev.page !== 1) return { ...prev, page: 1 };
        fetchItems(filter, search, 1, prev.limit);
        return prev;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const refetch = () => {
    const p = paramsRef.current;
    fetchItems(p.filter, p.search, p.page, p.limit);
  };

  const callApi = async (endpoint: string, body: object, optimisticUpdate: (items: Escort[]) => Escort[], successMsg?: string) => {
    setActionLoading(body.id as number);
    setError('');

    setItems(prev => optimisticUpdate(prev));

    try {
      const res = await fetch(`/api/admin/${endpoint}`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (successMsg) showNotification(successMsg);
        refetch();
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error || 'Error del servidor');
        refetch();
      }
    } catch {
      setError('Error de conexión');
      refetch();
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = (item: Escort) =>
    callApi('escort-aprobar', { id: item.id }, (prev) => prev.map(e => e.id === item.id ? { ...e, activa: 1 } : e), 'Escort aprobada correctamente');

  const handleReject = (item: Escort) =>
    callApi('escort-rechazar', { id: item.id }, (prev) => prev.map(e => e.id === item.id ? { ...e, activa: -1 } : e), 'Escort rechazada correctamente');

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/escort-eliminar', {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ id: deleteConfirm.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      showNotification('Escort enviada a la papelera');
      setDeleteConfirm(null);
      refetch();
      window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreConfirm) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/admin/escort-restaurar', {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ id: restoreConfirm.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al restaurar');
      showNotification('Escort restaurada correctamente');
      setRestoreConfirm(null);
      refetch();
      window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const getActions = (item: Escort): ActionItem[] => {
    const isInTrash = item.eliminada === 1 || item.eliminada === '1' || item.eliminated === 1;
    if (isInTrash) {
      return [
        { label: 'Restaurar', icon: 'fa-undo', onClick: () => setRestoreConfirm(item) },
      ];
    }
    return [
      ...(item.suscripcion_estado !== 'pausada' && (item.activa === 0 || item.activa === -1) ? [
        { label: 'Aprobar', icon: 'fa-check', onClick: () => setApproveConfirm(item) },
      ] : []),
      ...(item.suscripcion_estado !== 'pausada' && (item.activa === 0 || item.activa === 1) ? [
        { label: 'Rechazar', icon: 'fa-times', danger: true, onClick: () => setRejectConfirm(item) },
      ] : []),
      {
        label: 'Editar', icon: 'fa-edit', onClick: async () => {
          const adminToken = localStorage.getItem('admin_token');
          if (!adminToken) { setError('Sesión de administrador no encontrada'); return; }
          try {
            const res = await fetch(`/api/admin/escort-login-as.php?id=${item.id}`, {
              headers: { Authorization: 'Bearer ' + adminToken },
            });
            const data = await res.json();
            if (data.success) {
              localStorage.setItem('escort_token', data.token);
              localStorage.setItem('escort_data', JSON.stringify(data.escort || { id: item.id }));
              window.open('/micuenta/perfil', '_blank');
            } else {
              setError(data.error || 'No se pudo abrir el editor');
            }
          } catch (err) {
            setError('Error de conexión');
          }
        },
      },
      {
        label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setDeleteConfirm(item),
      },
      {
        label: 'Ver perfil', icon: 'fa-eye', onClick: () => { window.open(`/${item.slug || item.id}`, '_blank'); },
      },
    ].filter(Boolean) as ActionItem[];
  };

  const columns: Column<Escort>[] = [
    {
      key: 'id', header: 'ID', width: '70', align: 'center',
      render: (item: Escort) => (
        <span className="text-gray-400 text-sm font-mono">#{item.id}</span>
      ),
    },
    {
      key: 'nombre', header: 'Escort', width: '220',
      render: (item: Escort) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 min-w-[40px] rounded-lg overflow-hidden bg-[#2a2a3e] shrink-0">
            {item.foto_principal ? (
              <img src={item.foto_principal} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <i className="fas fa-user text-black"></i>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium whitespace-nowrap text-sm">{item.nombre}</div>
            <div className="text-xs text-admin-muted">{item.ciudad}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'edad', header: 'Edad', width: '80',
      render: (item: Escort) => (
        <span className="text-admin-muted text-sm">{item.edad} años</span>
      ),
    },
    {
      key: 'rating', header: 'Puntuación', width: '120',
      render: (item: Escort) => {
        const r = item.rating != null ? Number(item.rating) : null;
        return r !== null && !isNaN(r) ? (
          <div className="flex items-center gap-1">
            <i className="fas fa-star text-yellow-400 text-xs"></i>
            <span className="text-white text-sm font-medium">{r.toFixed(1)}</span>
            <span className="text-gray-500 text-xs">({item.total_valoraciones || 0})</span>
          </div>
        ) : (
          <span className="text-gray-600 text-sm">—</span>
        );
      },
    },
    {
      key: 'plan_base', header: 'Plan base', width: '150',
      render: (item: Escort) => {
        if (!item.plan_base_nombre) return (
          <span className="inline-flex items-center gap-1 text-[0.6rem] font-medium bg-[#1a1a2e] text-gray-500 px-1.5 py-0.5 rounded self-start">
            <i className="fas fa-minus-circle text-[0.45rem]"></i>Sin plan
          </span>
        );
        const c = planEstadoConfig[item.plan_base_estado || ''] || { bg: '#1a1a2e', text: '#6b7280', icon: 'fa-minus-circle', label: 'Sin plan' };
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs px-1.5 py-0.5 rounded self-start" style={{ backgroundColor: (item.plan_base_color || '#6b7280') + '30', color: item.plan_base_color || '#6b7280' }}>
              {item.plan_base_badge || item.plan_base_nombre}
            </span>
            <span className={`inline-flex items-center gap-1 text-[0.6rem] font-medium ${c.bg} ${c.text} px-1.5 py-0.5 rounded self-start`}>
              <i className={`fas ${c.icon} text-[0.45rem]`}></i>{c.label}
              {item.plan_base_estado === 'activa' && item.plan_base_dias !== undefined && item.plan_base_dias > 0 && (
                <span className="opacity-60">({item.plan_base_dias}d)</span>
              )}
            </span>
          </div>
        );
      },
    },
    {
      key: 'plan_extra', header: 'Extra', width: '150',
      render: (item: Escort) => {
        if (!item.plan_extra_nombre) return (
          <span className="inline-flex items-center gap-1 text-[0.6rem] font-medium bg-[#1a1a2e] text-gray-500 px-1.5 py-0.5 rounded self-start">
            <i className="fas fa-minus-circle text-[0.45rem]"></i>Sin extra
          </span>
        );
        const extraIcon = item.plan_extra_tipo === 'sticky' ? 'fa-thumbtack' : item.plan_extra_tipo === 'destacado' ? 'fa-star' : 'fa-cube';
        const c = planEstadoConfig[item.plan_extra_estado || ''] || { bg: '#1a1a2e', text: '#6b7280', icon: 'fa-minus-circle', label: 'Sin plan' };
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs px-1.5 py-0.5 rounded self-start" style={{ backgroundColor: (item.plan_extra_color || '#a78bfa') + '30', color: item.plan_extra_color || '#a78bfa' }}>
              <i className={`fas ${extraIcon} mr-1 text-[0.55rem]`}></i>
              {item.plan_extra_badge || item.plan_extra_nombre}
            </span>
            <span className={`inline-flex items-center gap-1 text-[0.6rem] font-medium ${c.bg} ${c.text} px-1.5 py-0.5 rounded self-start`}>
              <i className={`fas ${c.icon} text-[0.45rem]`}></i>{c.label}
              {item.plan_extra_estado === 'activa' && item.plan_extra_dias !== undefined && item.plan_extra_dias > 0 && (
                <span className="opacity-60">({item.plan_extra_dias}d)</span>
              )}
            </span>
          </div>
        );
      },
    },
    {
      key: 'estado', header: 'Estado', width: '120',
      render: (item: Escort) => {
        const susEstado = item.suscripcion_estado || 'sin_suscripcion';
        const c = subEstadoConfig[susEstado] || subEstadoConfig.sin_suscripcion;
        return (
          <span 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: c.bg, color: c.text }}
          >
            <i className={`fas ${c.icon} text-[0.6rem]`}></i>
            {c.label}
          </span>
        );
      },
    },
    {
      key: 'verificado', header: 'Verif.', width: '80', align: 'center',
      render: (item: Escort) => (
        item.verificado ? (
          <i className="fas fa-check-circle text-green-500" title="Verificada"></i>
        ) : (
          <i className="fas fa-clock text-yellow-400" title="Pendiente"></i>
        )
      ),
    },
    {
      key: 'vip', header: 'VIP', width: '80', align: 'center',
      render: (item: Escort) => (
        item.vip ? (
          <i className="fas fa-crown text-yellow-400" title="VIP"></i>
        ) : (
          <span className="text-gray-700">—</span>
        )
      ),
    },
  ];

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const statCards = [
    { label: 'Total Escorts', value: stats.total, icon: 'fa-users', color: '#eab308' },
    { label: 'Activas', value: stats.activas, icon: 'fa-check-circle', color: '#22c55e' },
    { label: 'Pendientes', value: stats.pendientes, icon: 'fa-clock', color: '#fbbf24' },
    { label: 'Pausadas', value: stats.pausadas, icon: 'fa-pause-circle', color: '#3b82f6' },
    { label: 'Vencen hoy', value: stats.vencen_hoy, icon: 'fa-hourglass-half', color: '#f97316' },
    { label: 'Verificadas', value: stats.verificadas, icon: 'fa-check-double', color: '#8b5cf6' },
    { label: 'VIP', value: stats.vip, icon: 'fa-crown', color: '#eab308' },
    { label: 'Rechazadas', value: stats.rechazadas, icon: 'fa-times-circle', color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-user-shield text-yellow-400"></i> Escorts
          </h1>
          <p className="text-gray-400 mt-1">Administra las escorts registradas en la plataforma</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {statCards.map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color} loading={isLoading} />
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-check-circle"></i>
          {successMsg}
        </div>
      )}

      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nombre, ciudad o email..."
        filters={[
          { key: 'todos', label: 'Todas' },
          { key: 'activas', label: 'Activas' },
          { key: 'pendientes', label: 'Pendientes' },
          { key: 'pausadas', label: 'Pausadas' },
          { key: 'vencen_hoy', label: 'Vencen hoy' },
          { key: 'rechazadas', label: 'Rechazadas' },
          { key: 'papelera', label: 'Papelera' },
        ]}
        activeFilter={filter}
        onFilterChange={(key) => { setFilter(key); setPagination(prev => ({ ...prev, page: 1 })); }}
      />

      {isLoading ? (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-8 text-center">
          <i className="fas fa-circle-notch fa-spin text-yellow-400 text-3xl mb-3"></i>
          <p className="text-gray-400">Cargando escorts...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-8 text-center">
          <i className="fas fa-user-shield text-4xl mb-3 text-gray-600"></i>
          <p className="text-gray-400">No hay escorts para mostrar</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={false}
          skeletonRows={10}
          emptyMessage={search ? 'No se encontraron escorts' : 'No hay escorts registradas'}
          emptyIcon="fa-user-shield"
          getRowKey={(item) => item.id}
          getActions={getActions}
        />
      )}

      {pagination.pages > 1 && (
        <div className="bg-admin-card border border-admin-border rounded-xl px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Mostrando <span className="text-white font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> - <span className="text-white font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> de <span className="text-white font-medium">{pagination.total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1} className="p-2 rounded-lg bg-admin-border text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <i className="fas fa-chevron-left"></i>
            </button>
            {Array.from({ length: Math.min(pagination.pages, 10) }, (_, i) => {
              const start = Math.max(1, pagination.page - 5);
              const page = start + i;
              if (page > pagination.pages) return null;
              return (
                <button key={page} onClick={() => handlePageChange(page)} className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${pagination.page === page ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-admin-border text-gray-300 hover:bg-gray-700'}`}>
                  {page}
                </button>
              );
            })}
            <button onClick={() => handlePageChange(pagination.page + 1)} disabled={!pagination.hasMore} className="p-2 rounded-lg bg-admin-border text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      {/* Approve modal */}
      <ConfirmModal
        isOpen={approveConfirm !== null}
        title="Aprobar Escort"
        message={approveConfirm ? `¿Aprobar a ${approveConfirm.nombre}?` : ''}
        confirmText="Aprobar"
        variant="info"
        onConfirm={() => { if (approveConfirm) { const item = approveConfirm; setApproveConfirm(null); handleApprove(item); } }}
        onCancel={() => setApproveConfirm(null)}
      />

      {/* Reject modal */}
      <ConfirmModal
        isOpen={rejectConfirm !== null}
        title="Rechazar Escort"
        message={rejectConfirm ? `¿Rechazar a ${rejectConfirm.nombre}?` : ''}
        confirmText="Rechazar"
        variant="danger"
        onConfirm={() => { if (rejectConfirm) { const item = rejectConfirm; setRejectConfirm(null); handleReject(item); } }}
        onCancel={() => setRejectConfirm(null)}
      />

      {/* Delete modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Eliminar Escort"
        message={deleteConfirm ? `¿Enviar a ${deleteConfirm.nombre} a la papelera? Podrás restaurarla desde ahí con todos sus datos.` : ''}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Restore modal */}
      <ConfirmModal
        isOpen={restoreConfirm !== null}
        title="Restaurar Escort"
        message={restoreConfirm ? `¿Restaurar a ${restoreConfirm.nombre} desde la papelera? Se conservarán todos sus datos.` : ''}
        confirmText="Restaurar"
        variant="info"
        onConfirm={handleRestore}
        onCancel={() => setRestoreConfirm(null)}
      />
    </div>
  );
}