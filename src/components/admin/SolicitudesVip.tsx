import { useState, useEffect, useCallback } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';
import '@fancyapps/ui/dist/fancybox/fancybox.css';

interface SolicitudVip {
  id: number;
  escort: {
    id: number;
    nombre: string;
    email: string;
    telefono: string | null;
    ciudad: string | null;
    foto_principal: string | null;
    verificado: boolean;
  };
  plan_vip: string;
  estado: 'enviado' | 'aprobado' | 'rechazado' | 'pendientes';
  comprobante_pago: string;
  admin_notas: string | null;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
  plan_base: {
    nombre: string | null;
    color: string | null;
    vence: string | null;
    dias_restantes: number;
  };
  revisado_por: string | null;
}

interface Pagination {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

const API_URL = '/api/admin/vip-solicitudes.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const estadoConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  enviado: { bg: '#3d3d1a', text: '#fbbf24', icon: 'fa-clock', label: 'Pendiente' },

  aprobado: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-check-circle', label: 'Aprobado' },
  rechazado: { bg: '#3d1a1a', text: '#ef4444', icon: 'fa-times-circle', label: 'Rechazado' },
};

export default function SolicitudesVip() {
  const [items, setItems] = useState<SolicitudVip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, per_page: 20, total_pages: 1 });

  const [deleteConfirm, setDeleteConfirm] = useState<SolicitudVip | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [actionItem, setActionItem] = useState<SolicitudVip | null>(null);
  const [actionType, setActionType] = useState<'aprobar' | 'rechazar' | 'volver_revision' | null>(null);
  const [notas, setNotas] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ estado: filter, page: String(page), per_page: '20', search });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setItems(data.solicitudes || []);
      setPagination(data.pagination || { total: 0, page: 1, per_page: 20, total_pages: 1 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => { fetchItems(); }, [filter, page]);
  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    import('@fancyapps/ui').then((mod) => {
      const F = mod.Fancybox;
      F.bind('[data-fancybox="vip-solicitud"]', {
        compact: false,
        idle: false,
        Toolbar: { display: ['close'] },
        Thumbs: false,
      });
      F.bind('[data-fancybox="vip-avatar"]', {
        compact: false,
        idle: false,
        Toolbar: { display: ['close'] },
        Thumbs: false,
      });
    });
  }, []);

  useEffect(() => {
    if (!search && filter === 'pendientes') return;
    const timer = setTimeout(() => fetchItems(), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const stats = {
    total: pagination.total,
    pendientes: items.filter(i => i.estado === 'enviado').length,
    aprobado: items.filter(i => i.estado === 'aprobado').length,
    rechazado: items.filter(i => i.estado === 'rechazado').length,
  };

  const handleAction = async () => {
    if (!actionItem || !actionType) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/vip-solicitudes-accion.php', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          solicitud_id: actionItem.id,
          escort_id: actionItem.escort.id,
          accion: actionType,
          notas,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(
          actionType === 'aprobar'
            ? 'Solicitud VIP aprobada. La escort ahora tiene VIP activo.'
            : actionType === 'volver_revision'
              ? 'Solicitud VIP devuelta a estado de revisión.'
              : 'Solicitud VIP rechazada.'
        );
        setActionItem(null);
        setActionType(null);
        setNotas('');
        fetchItems();
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error || 'Error del servidor');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/vip-solicitudes-accion.php', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          solicitud_id: deleteConfirm.id,
          escort_id: deleteConfirm.escort.id,
          accion: 'borrar',
          notas: '',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      showNotification('Solicitud eliminada permanentemente.');
      setDeleteConfirm(null);
      fetchItems();
      window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getActions = (item: SolicitudVip): ActionItem[] => {
    const actions: ActionItem[] = [];
    const revisar = (type: 'aprobar' | 'rechazar' | 'volver_revision') => () => {
      setActionItem(item);
      setActionType(type);
      setNotas('');
    };

    if (item.estado === 'enviado' || item.estado === 'pendientes') {
      actions.push({ label: 'Aprobar', icon: 'fa-check', onClick: revisar('aprobar') });
      actions.push({ label: 'Rechazar', icon: 'fa-times', danger: true, onClick: revisar('rechazar') });
    }

    if (item.estado === 'rechazado') {
      actions.push({ label: 'Aprobar', icon: 'fa-check', onClick: revisar('aprobar') });
    }

    if (item.estado === 'aprobado' || item.estado === 'rechazado') {
      actions.push({ label: 'Volver a revisión', icon: 'fa-undo', onClick: revisar('volver_revision') });
    }

    actions.push({ label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setDeleteConfirm(item) });

    return actions;
  };

  const columns: Column<SolicitudVip>[] = [
    {
      key: 'escort', header: 'Escort', width: '240',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 min-w-[40px] rounded-xl bg-[#2a2a3e] overflow-hidden flex-shrink-0">
            {item.escort.foto_principal ? (
              <a href={item.escort.foto_principal} data-fancybox="vip-avatar">
                <img src={item.escort.foto_principal} alt="" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" />
              </a>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600">
                <i className="fas fa-user" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium whitespace-nowrap text-sm text-white flex items-center gap-1.5">
              {item.escort.nombre}
              {item.escort.verificado && <i className="fas fa-check-circle text-blue-400 text-xs" title="Verificada" />}
            </div>
            <div className="text-xs text-admin-muted">{item.escort.email}</div>
            {item.escort.telefono && <div className="text-xs text-gray-500"><i className="fas fa-phone mr-1"></i>{item.escort.telefono}</div>}
            {item.escort.ciudad && <div className="text-xs text-gray-600"><i className="fas fa-map-marker-alt mr-1"></i>{item.escort.ciudad}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'plan', header: 'Plan', width: '180',
      render: (item) => (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit">
            <i className="fas fa-crown text-[10px]"></i>
            {item.plan_vip}
          </span>
          {item.plan_base.nombre && (
            <span className="text-xs text-gray-500">{item.plan_base.nombre}</span>
          )}
          {item.plan_base.dias_restantes > 0 && (
            <span className="text-xs text-gray-600">{item.plan_base.dias_restantes} días restantes</span>
          )}
        </div>
      ),
    },
    {
      key: 'fecha', header: 'Fecha', width: '110',
      render: (item) => (
        <div className="text-sm text-gray-400">
          {item.fecha_solicitud ? new Date(item.fecha_solicitud).toLocaleDateString('es-CL') : '—'}
        </div>
      ),
    },
    {
      key: 'comprobante', header: 'Pago', width: '80', align: 'center',
      render: (item) => {
        if (!item.comprobante_pago) return <span className="text-gray-600 text-xs">—</span>;
        const src = item.comprobante_pago;
        const isPdf = src.match(/\.pdf$/i);
        if (isPdf) {
          return (
            <a href={src} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
              title="Ver comprobante PDF">
              <i className="fas fa-file-pdf text-red-400 text-lg"></i>
            </a>
          );
        }
        return (
          <a href={src} data-fancybox="vip-solicitud" className="block relative w-10 h-10 mx-auto">
            <img src={src} alt="Comprobante"
              className="w-10 h-10 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity border border-green-500/30"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <i className="fas fa-file-image text-green-400 text-lg absolute inset-0 flex items-center justify-center pointer-events-none" />
          </a>
        );
      },
    },
    {
      key: 'estado', header: 'Estado', width: '130', align: 'center',
      render: (item) => {
        const cfg = estadoConfig[item.estado] || estadoConfig.enviado;
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            <i className={`fas ${cfg.icon} text-[0.6rem]`}></i>
            {cfg.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-crown text-yellow-400"></i> Solicitudes VIP
        </h1>
        <p className="text-gray-400 mt-1">Gestiona las solicitudes de badge VIP de las escorts</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <StatCard label="Total" value={stats.total} icon="fa-list" color="#6b7280" loading={isLoading} />
        <StatCard label="Pendientes" value={stats.pendientes} icon="fa-clock" color="#fbbf24" loading={isLoading} />
        <StatCard label="Aprobados" value={stats.aprobado} icon="fa-check-circle" color="#10b981" loading={isLoading} />
        <StatCard label="Rechazados" value={stats.rechazado} icon="fa-times-circle" color="#ef4444" loading={isLoading} />
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error} <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><i className="fas fa-times"></i></button></div>}

      <SearchFilters
        search={search}
        onSearch={(val) => { setSearch(val); setPage(1); }}
        placeholder="Buscar por nombre o email..."
        filters={[
          { key: 'pendientes', label: 'Pendientes', icon: 'fa-clock' },
          { key: 'aprobado', label: 'Aprobados', icon: 'fa-check' },
          { key: 'rechazado', label: 'Rechazados', icon: 'fa-times' },
          { key: 'todos', label: 'Todos', icon: 'fa-list' },
        ]}
        activeFilter={filter}
        onFilterChange={(key) => { setFilter(key); setPage(1); }}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron solicitudes' : 'No hay solicitudes VIP'}
        emptyIcon="fa-crown"
        getRowKey={(item) => item.id}
        getActions={getActions}
      />

      {/* Pagination */}
      {pagination.total_pages > 1 && !isLoading && (
        <div className="flex items-center justify-between px-4 py-3 bg-admin-card border border-admin-border rounded-xl">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1">
            <i className="fas fa-chevron-left"></i> Anterior
          </button>
          <span className="text-gray-500 text-sm">Página {page} de {pagination.total_pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))} disabled={page === pagination.total_pages}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1">
            Siguiente <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}

      {/* Approve/Reject/Revision Modal */}
      {actionItem && actionType && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70" onClick={() => { setActionItem(null); setActionType(null); }}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full ${
                  actionType === 'aprobar' ? 'bg-emerald-500/20'
                  : actionType === 'volver_revision' ? 'bg-amber-500/20'
                  : 'bg-red-500/20'
                } flex items-center justify-center flex-shrink-0`}>
                  <i className={`fas ${
                    actionType === 'aprobar' ? 'fa-check'
                    : actionType === 'volver_revision' ? 'fa-undo'
                    : 'fa-times'
                  } ${
                    actionType === 'aprobar' ? 'text-emerald-400'
                    : actionType === 'volver_revision' ? 'text-amber-400'
                    : 'text-red-400'
                  } text-lg`}></i>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">
                    {actionType === 'aprobar'
                      ? '¿Aprobar solicitud VIP?'
                      : actionType === 'volver_revision'
                        ? '¿Volver a estado de revisión?'
                        : '¿Rechazar solicitud VIP?'}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mt-0.5">
                    Escort: <strong className="text-white">{actionItem.escort.nombre}</strong>
                  </p>
                </div>
              </div>

              {actionType === 'volver_revision' && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 text-xs text-amber-300/90">
                  <i className="fas fa-info-circle mr-1.5"></i>
                  {actionItem.estado === 'aprobado'
                    ? 'Se revocará el VIP de la escort y la solicitud quedará pendiente de revisión nuevamente.'
                    : 'La solicitud quedará pendiente de revisión nuevamente. La escort podrá re-subir su comprobante.'}
                </div>
              )}

              {/* Comprobante link */}
              {actionItem.comprobante_pago && (
                <div className="bg-[#13131a] border border-[#2a2a3e] rounded-lg p-3 mb-4">
                  <div className="text-gray-500 text-xs mb-1">Comprobante de pago</div>
                  <a href={actionItem.comprobante_pago} data-fancybox="vip-solicitud"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                    <i className="fas fa-image"></i>
                    Ver comprobante
                  </a>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">Notas {actionType === 'rechazar' && <span className="text-red-400">*</span>}</label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500 resize-none"
                  placeholder={actionType === 'rechazar' ? 'Motivo del rechazo...' : 'Notas adicionales...'} />
                {actionType === 'rechazar' && !notas.trim() && (
                  <p className="text-red-400 text-xs mt-1"><i className="fas fa-exclamation-circle mr-1"></i>Indica el motivo del rechazo</p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setActionItem(null); setActionType(null); }}
                  className="flex-1 px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <button onClick={handleAction} disabled={actionLoading || (actionType === 'rechazar' && !notas.trim())}
                  className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    actionType === 'aprobar' ? 'bg-emerald-600 hover:bg-emerald-700'
                    : actionType === 'volver_revision' ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-red-600 hover:bg-red-700'
                  }`}>
                  {actionLoading && <i className="fas fa-spinner fa-spin mr-1"></i>}
                  {actionType === 'aprobar' ? 'Aprobar VIP'
                    : actionType === 'volver_revision' ? 'Volver a revisión'
                    : 'Rechazar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="¿Eliminar solicitud?"
        message={`Estás a punto de eliminar la solicitud VIP de <strong>${deleteConfirm?.escort.nombre || ''}</strong>. Esta acción no se puede deshacer.`}
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        cancelText="Cancelar"
        variant="danger"
        confirmDisabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}