import { useState, useEffect, useCallback } from 'react';
import { esAdminOSuperior } from '../../lib/adminRole';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';
import '@fancyapps/ui/dist/fancybox/fancybox.css';

interface Stats {
  total: number;
}

interface Pago {
  pago_id: number;
  escort_id: number;
  escort_nombre: string;
  escort_email: string;
  escort_telefono: string | null;
  escort_foto: string | null;
  escort_activa: number;
  suscripcion_id: number | null;
  plan_id: number | null;
  plan_nombre: string;
  plan_tipo: string;
  duracion_dias: number;
  uso_unico: number;
  concepto: string;
  monto: number;
  moneda: string;
  metodo_pago: string | null;
  estado_pago: string;
  comprobante_url: string | null;
  notas: string;
  creado_en: string;
  pagado_en: string | null;
  origen: string;
}

const API_URL = '/api/admin/pagos.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const estadoConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  pendiente: { bg: '#3d3d1a', text: '#fbbf24', icon: 'fa-clock', label: 'Pendiente' },
  completado: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-check-circle', label: 'Completado' },
  rechazado: { bg: '#3d1a1a', text: '#ef4444', icon: 'fa-times-circle', label: 'Rechazado' },
};

const conceptoConfig: Record<string, { icon: string; label: string; color: string }> = {
  plan: { icon: 'fa-box', label: 'Plan', color: '#3b82f6' },
  vip: { icon: 'fa-crown', label: 'VIP', color: '#a855f7' },
  destacado: { icon: 'fa-star', label: 'Destacado', color: '#f59e0b' },
  sticky: { icon: 'fa-thumbtack', label: 'Sticky', color: '#f97316' },
  verificacion: { icon: 'fa-id-card', label: 'Verificación', color: '#22d3ee' },
};

export default function PagosData() {
  const [items, setItems] = useState<Pago[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionItem, setActionItem] = useState<Pago | null>(null);
  const [actionType, setActionType] = useState<'aprobar' | 'rechazar' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notas, setNotas] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<Pago | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fancybox
  useEffect(() => {
    let disposed = false;
    import('@fancyapps/ui').then((mod) => {
      if (disposed) return;
      const F = mod.Fancybox;
      F.bind('[data-fancybox="pago-comprobante"]', {
        compact: false,
        idle: false,
        Toolbar: { display: ['close'] },
      });
    });
    return () => { disposed = true; };
  }, [items]);

  const fetchItems = async (p?: number) => {
    setIsLoading(true);
    setError('');
    const pg = p ?? page;
    try {
      const params = new URLSearchParams();
      if (filter !== 'todos') params.set('estado', filter);
      if (search) params.set('search', search);
      params.set('page', String(pg));
      params.set('limit', '20');

      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');

      setItems(data.pagos || []);
      setStats(data.stats || { total: 0 });
      setTotalPages(data.pagination?.pages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchItems(1); setPage(1); }, [filter]);

  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    if (!search && filter === 'todos') {
      fetchItems(1);
      return;
    }
    const timer = setTimeout(() => { setPage(1); fetchItems(1); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAction = async () => {
    if (!actionItem || !actionType) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: actionItem.pago_id,
          estado: actionType === 'aprobar' ? 'completado' : 'rechazado',
          notas,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(actionType === 'aprobar' ? 'Pago aprobado. La escort ahora está activa.' : 'Pago rechazado.');
        setTimeout(() => setSuccessMsg(''), 3000);
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
    setDeleteLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}?id=${deleteConfirm.pago_id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Pago eliminado correctamente');
        setTimeout(() => setSuccessMsg(''), 3000);
        setDeleteConfirm(null);
        fetchItems();
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error || 'Error del servidor');
      }
    } catch {
      setError('Error de conexión');
    } finally { setDeleteLoading(false); }
  };

  const getActions = (item: Pago): ActionItem[] => {
    const acts: ActionItem[] = [];
    if (item.origen === 'vip') {
      acts.push({
        label: 'Ver solicitud', icon: 'fa-external-link-alt',
        onClick: () => window.open('/admin/solicitudes-vip', '_blank'),
      });
      return acts;
    }
    const isAdminOsuperior = esAdminOSuperior();
    if (isAdminOsuperior && item.origen === 'pago' && item.estado_pago === 'pendiente') {
      acts.push({
        label: 'Aprobar', icon: 'fa-check',
        onClick: () => { setActionItem(item); setActionType('aprobar'); setNotas(''); },
      });
      acts.push({
        label: 'Rechazar', icon: 'fa-times', danger: true,
        onClick: () => { setActionItem(item); setActionType('rechazar'); setNotas(''); },
      });
    }
    if (isAdminOsuperior) {
      acts.push({
        label: 'Eliminar', icon: 'fa-trash', danger: true,
        onClick: () => { setDeleteConfirm(item); },
      });
    }
    return acts;
  };

  const columns: Column<Pago>[] = [
    {
      key: 'escort', header: 'Escort', width: '240',
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.escort_foto ? (
            <img src={item.escort_foto} alt=""
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
              {item.escort_nombre.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium whitespace-nowrap text-sm text-white">
              {item.escort_nombre}
              {item.escort_activa === 1 && <i className="fas fa-check-circle text-emerald-400 text-xs ml-1" />}
            </div>
            <div className="text-xs text-admin-muted">{item.escort_email}</div>
            {item.escort_telefono && <div className="text-xs text-gray-500">{item.escort_telefono}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'plan', header: 'Plan', width: '140',
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-white">{item.plan_nombre || '—'}</span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <i className={`fas ${conceptoConfig[item.concepto]?.icon || 'fa-circle'}`}
              style={{ color: conceptoConfig[item.concepto]?.color || '#6b7280' }}></i>
            {conceptoConfig[item.concepto]?.label || item.concepto}
          </span>
        </div>
      ),
    },
    {
      key: 'tipo', header: 'Tipo', width: '90', align: 'center',
      render: (item) => {
        const styles: Record<string, { bg: string; text: string; icon: string; label: string }> = {
          base: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: 'fa-box', label: 'Base' },
          extra: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: 'fa-puzzle-piece', label: 'Extra' },
          vip: { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400', icon: 'fa-crown', label: 'VIP' },
          verificacion: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', icon: 'fa-id-card', label: 'Verif.' },
          pago: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: 'fa-receipt', label: 'Pago' },
        };
        const s = styles[item.plan_tipo] || styles.pago;
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
            <i className={`fas ${s.icon} text-[0.6rem]`}></i>
            {s.label}
          </span>
        );
      },
    },
    {
      key: 'monto', header: 'Monto', width: '120',
      render: (item) => (
        <span className={`text-sm font-medium ${item.estado_pago === 'completado' ? 'text-emerald-400' : 'text-gray-400'}`}>
          {new Intl.NumberFormat('es-CL', { style: 'currency', currency: item.moneda, minimumFractionDigits: 0 }).format(item.monto)}
        </span>
      ),
    },
    {
      key: 'comprobante', header: 'Comprobante', width: '80', align: 'center',
      render: (item) => {
        if (!item.comprobante_url) return <span className="text-gray-600 text-xs">—</span>;
        const isPdf = item.comprobante_url.match(/\.pdf$/i);
        if (isPdf) {
          return (
            <a href={item.comprobante_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
              title="Ver comprobante PDF">
              <i className="fas fa-file-pdf text-red-400 text-lg"></i>
            </a>
          );
        }
        return (
          <a href={item.comprobante_url} data-fancybox="pago-comprobante" className="block relative w-10 h-10 mx-auto">
            <img src={item.comprobante_url} alt="Comprobante"
              className="w-10 h-10 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity border border-emerald-500/30"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <i className="fas fa-file-image text-emerald-400 text-lg absolute inset-0 flex items-center justify-center pointer-events-none" />
          </a>
        );
      },
    },
    {
      key: 'estado', header: 'Estado', width: '120', align: 'center',
      render: (item) => {
        const cfg = estadoConfig[item.estado_pago] || estadoConfig.pendiente;
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            <i className={`fas ${cfg.icon} text-[0.6rem]`}></i>
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'fecha', header: 'Fecha', width: '100',
      render: (item) => (
        <div className="text-xs text-gray-400">
          {item.creado_en ? new Date(item.creado_en).toLocaleDateString('es-CL') : '—'}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-receipt text-blue-400"></i> Historial de Pagos
          </h1>
          <p className="text-gray-400 mt-1">Gestiona los pagos realizados por las escorts</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} icon="fa-receipt" color="#3b82f6" loading={isLoading} />
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-check-circle"></i>{successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>{error}
          <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <SearchFilters
        search={search}
        onSearch={(val) => { setSearch(val); setPage(1); }}
        placeholder="Buscar por nombre o email..."
        filters={[
          { key: 'todos', label: 'Todos', icon: 'fa-list' },
          { key: 'pendiente', label: 'Pendientes', icon: 'fa-clock' },
          { key: 'completado', label: 'Completados', icon: 'fa-check' },
          { key: 'rechazado', label: 'Rechazados', icon: 'fa-times' },
        ]}
        activeFilter={filter}
        onFilterChange={(key) => { setFilter(key); setPage(1); }}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage="No hay pagos registrados"
        emptyIcon="fa-receipt"
        getRowKey={(item) => item.pago_id}
        getActions={getActions}
      />

      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-between px-4 py-3 bg-admin-card border border-admin-border rounded-xl">
          <button onClick={() => setPage(p => { const np = Math.max(1, p - 1); fetchItems(np); return np; })} disabled={page === 1}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1">
            <i className="fas fa-chevron-left"></i> Anterior
          </button>
          <span className="text-gray-500 text-sm">Página {page} de {totalPages}</span>
          <button onClick={() => setPage(p => { const np = Math.min(totalPages, p + 1); fetchItems(np); return np; })} disabled={page === totalPages}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1">
            Siguiente <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}

      {/* Approve/Reject Modal */}
      {actionItem && actionType && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70" onClick={() => { setActionItem(null); setActionType(null); }}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full ${actionType === 'aprobar' ? 'bg-emerald-500/20' : 'bg-red-500/20'} flex items-center justify-center flex-shrink-0`}>
                  <i className={`fas fa-${actionType === 'aprobar' ? 'check' : 'times'} ${actionType === 'aprobar' ? 'text-emerald-400' : 'text-red-400'} text-lg`}></i>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">{actionType === 'aprobar' ? '¿Aprobar pago?' : '¿Rechazar pago?'}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mt-0.5">
                    Escort: <strong className="text-white">{actionItem.escort_nombre}</strong>
                  </p>
                  <p className="text-gray-500 text-xs">
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: actionItem.moneda, minimumFractionDigits: 0 }).format(actionItem.monto)} — {actionItem.plan_nombre}
                  </p>
                </div>
              </div>

              {actionItem.comprobante_url && (
                <div className="bg-[#13131a] border border-[#2a2a3e] rounded-lg p-3 mb-4">
                  <div className="text-gray-500 text-xs mb-1">Comprobante de pago</div>
                  <a href={actionItem.comprobante_url} data-fancybox="pago-comprobante"
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
                  className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${actionType === 'aprobar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  {actionLoading && <i className="fas fa-spinner fa-spin mr-1"></i>}
                  {actionType === 'aprobar' ? 'Aprobar Pago' : 'Rechazar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Eliminar pago"
        message={deleteConfirm ? `¿Eliminar el pago de ${deleteConfirm.escort_nombre} por ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: deleteConfirm.moneda, minimumFractionDigits: 0 }).format(deleteConfirm.monto)}?` : ''}
        confirmText={deleteLoading ? 'Eliminando...' : 'Eliminar'}
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />


    </div>
  );
}
