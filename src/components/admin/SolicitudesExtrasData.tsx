import { useState, useEffect, useCallback } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';
import '@fancyapps/ui/dist/fancybox/fancybox.css';

interface ExtraSuscripcion {
  suscripcion_id: number;
  escort: {
    id: number; nombre: string; email: string;
    telefono: string; ciudad: string; foto_principal: string | null;
    verificado: boolean; vip: boolean;
  };
  plan: {
    id: number; nombre: string; slug: string;
    tipo: string; extra_tipo: string; duracion_dias: number;
    precio: number; badge: string; color: string;
    max_pausas_permitidas: number;
  };
  suscripcion: {
    fecha_inicio: string | null; fecha_aprobacion: string | null;
    fecha_rechazo: string | null; fecha_fin: string | null;
    precio_pagado: number; moneda: string;
    estado: string; estado_raw: string;
    dias_restantes: number;
    comprobante_pago: string | null; creado_en: string;
    contador_pausas: number;
    aprobado_por: string | null; rechazado_por: string | null;
  };
}

interface Counts {
  todos: number;
  pendientes: number;
  activas: number;
  pausadas: number;
  expiradas: number;
  rechazadas: number;
  vencen_hoy: number;
  por_vencer: number;
  recaudo: number;
}

const API_URL = '/api/admin/solicitudes-extras.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const extraTipoConfig: Record<string, { icon: string; label: string; color: string }> = {
  sticky: { icon: 'fa-thumbtack', label: 'Sticky', color: '#f59e0b' },
  destacado: { icon: 'fa-star', label: 'Destacado', color: '#a855f7' },
  otro: { icon: 'fa-puzzle-piece', label: 'Otro', color: '#3b82f6' },
};

const estadoConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  pendiente_aprobacion: { bg: '#3d3d1a', text: '#fbbf24', icon: 'fa-clock', label: 'Pendiente' },
  activa: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-check-circle', label: 'Activa' },
  expirada: { bg: '#2a1a1a', text: '#ef4444', icon: 'fa-hourglass-end', label: 'Expirada' },
  pausada: { bg: '#1a2d3d', text: '#3b82f6', icon: 'fa-pause-circle', label: 'Pausado' },
  cancelada: { bg: '#2a1a1a', text: '#ef4444', icon: 'fa-ban', label: 'Cancelada' },
  rechazada: { bg: '#2a1a1a', text: '#ef4444', icon: 'fa-times-circle', label: 'Rechazada' },
};

function formatMoney(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('es-CL');
}

export default function SolicitudesExtrasData() {
  const [items, setItems] = useState<ExtraSuscripcion[]>([]);
  const [counts, setCounts] = useState<Counts>({ todos: 0, pendientes: 0, activas: 0, pausadas: 0, expiradas: 0, rechazadas: 0, vencen_hoy: 0, por_vencer: 0, recaudo: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalAction, setModalAction] = useState<{ item: ExtraSuscripcion; action: 'aprobar' | 'rechazar' | 'cancelar' | 'eliminar' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    let disposed = false;
    import('@fancyapps/ui').then((mod) => {
      if (disposed) return;
      const F = mod.Fancybox;
      F.bind('[data-fancybox="extra-comprobante"]', {
        compact: false, idle: false, Toolbar: { display: ['close'] },
      });
    });
    return () => { disposed = true; };
  }, [items]);

  const fetchItems = async (p?: number) => {
    setIsLoading(true); setError('');
    const pg = p ?? page;
    try {
      const params = new URLSearchParams();
      if (filter !== 'todos') params.set('estado', filter);
      if (search) params.set('search', search);
      params.set('page', String(pg));
      params.set('per_page', '20');
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setItems(data.suscripciones || []);
      setCounts(data.counts || { todos: 0, pendientes: 0, activas: 0, pausadas: 0, expiradas: 0, rechazadas: 0, vencen_hoy: 0, por_vencer: 0, recaudo: 0 });
      setTotalPages(data.pagination?.total_pages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchItems(1); setPage(1); }, [filter]);
  useEffect(() => { fetchItems(); }, []);
  useEffect(() => {
    if (!search && filter === 'todos') { fetchItems(1); return; }
    const timer = setTimeout(() => { setPage(1); fetchItems(1); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAction = async () => {
    if (!modalAction) return;
    setActionLoading(true); setError(''); setSuccessMsg('');
    try {
      const body: any = { action: modalAction.action, suscripcion_id: modalAction.item.suscripcion_id };
      if (modalAction.action === 'rechazar') body.motivo = motivo;
      if (modalAction.action === 'eliminar') body.notas = motivo;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        const msgMap: Record<string, string> = {
          aprobar: 'Solicitud extra aprobada correctamente',
          rechazar: 'Solicitud extra rechazada',
          cancelar: 'Suscripción extra cancelada',
          eliminar: 'Suscripción extra eliminada',
        };
        setSuccessMsg(msgMap[modalAction.action] || 'Acción completada');
        setTimeout(() => setSuccessMsg(''), 3000);
        setModalAction(null); setMotivo('');
        fetchItems();
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error || 'Error del servidor');
      }
    } catch {
      setError('Error de conexión');
    } finally { setActionLoading(false); }
  };

  const getActions = (item: ExtraSuscripcion): ActionItem[] => {
    const acts: ActionItem[] = [];
    const est = item.suscripcion.estado;
    if (est === 'pendiente_aprobacion') {
      acts.push({ label: 'Aprobar', icon: 'fa-check', onClick: () => { setModalAction({ item, action: 'aprobar' }); } });
      acts.push({ label: 'Rechazar', icon: 'fa-times', danger: true, onClick: () => { setModalAction({ item, action: 'rechazar' }); setMotivo(''); } });
    }
    if (est === 'activa') {
      acts.push({ label: 'Cancelar', icon: 'fa-ban', danger: true, onClick: () => { setModalAction({ item, action: 'cancelar' }); } });
    }
    acts.push({ label: 'Eliminar', icon: 'fa-trash', danger: true, onClick: () => { setModalAction({ item, action: 'eliminar' }); setMotivo(''); } });
    return acts;
  };

  const columns: Column<ExtraSuscripcion>[] = [
    {
      key: 'escort', header: 'Escort', width: '220',
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.escort.foto_principal ? (
            <img src={item.escort.foto_principal} alt=""
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
              {item.escort.nombre.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium whitespace-nowrap text-sm text-white">{item.escort.nombre}</div>
            <div className="text-xs text-admin-muted">{item.escort.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'plan', header: 'Extra', width: '140',
      render: (item) => {
        const cfg = extraTipoConfig[item.plan.extra_tipo] || extraTipoConfig.otro;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-white">{item.plan.nombre}</span>
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: cfg.color }}>
              <i className={`fas ${cfg.icon}`}></i>{cfg.label}
            </span>
          </div>
        );
      },
    },
    {
      key: 'duracion', header: 'Duración', width: '80', align: 'center',
      render: (item) => <span className="text-sm text-gray-400">{item.plan.duracion_dias} días</span>,
    },
    {
      key: 'precio', header: 'Precio', width: '100',
      render: (item) => (
        <span className="text-sm font-medium text-gray-300">
          {new Intl.NumberFormat('es-CL', { style: 'currency', currency: item.suscripcion.moneda, minimumFractionDigits: 0 }).format(item.plan.precio)}
        </span>
      ),
    },
    {
      key: 'monto', header: 'Pagado', width: '100',
      render: (item) => (
        <span className={`text-sm font-medium ${item.suscripcion.estado === 'activa' ? 'text-emerald-400' : 'text-gray-500'}`}>
          {item.suscripcion.precio_pagado > 0
            ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: item.suscripcion.moneda, minimumFractionDigits: 0 }).format(item.suscripcion.precio_pagado)
            : '—'}
        </span>
      ),
    },
    {
      key: 'comprobante', header: 'Comprobante', width: '70', align: 'center',
      render: (item) => {
        if (!item.suscripcion.comprobante_pago) return <span className="text-gray-600 text-xs">—</span>;
        const isPdf = item.suscripcion.comprobante_pago.match(/\.pdf$/i);
        return (
          <a href={item.suscripcion.comprobante_pago} data-fancybox="extra-comprobante"
            className="hover:opacity-80 transition-opacity">
            <i className={`fas ${isPdf ? 'fa-file-pdf text-red-400' : 'fa-file-image text-emerald-400'} text-lg`}></i>
          </a>
        );
      },
    },
    {
      key: 'estado', header: 'Estado', width: '110', align: 'center',
      render: (item) => {
        const cfg = estadoConfig[item.suscripcion.estado] || estadoConfig.pendiente_aprobacion;
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            <i className={`fas ${cfg.icon} text-[0.6rem]`}></i>{cfg.label}
            {item.suscripcion.estado === 'activa' && item.suscripcion.dias_restantes > 0 && (
              <span className="text-[0.6rem] opacity-70">({item.suscripcion.dias_restantes}d)</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'fecha', header: 'Fecha', width: '90',
      render: (item) => (
        <div className="text-xs text-gray-400">
          {item.suscripcion.creado_en ? new Date(item.suscripcion.creado_en).toLocaleDateString('es-CL') : '—'}
        </div>
      ),
    },
  ];

  const filterOptions = [
    { key: 'todos', label: 'Todos', icon: 'fa-list' },
    { key: 'pendiente_aprobacion', label: 'Pendientes', icon: 'fa-clock' },
    { key: 'activa', label: 'Activas', icon: 'fa-check-circle' },
    { key: 'pausada', label: 'Pausadas', icon: 'fa-pause-circle' },
    { key: 'vencen_hoy', label: 'Vencen hoy', icon: 'fa-hourglass-half' },
    { key: 'expirada', label: 'Expiradas', icon: 'fa-hourglass-end' },
    { key: 'rechazada', label: 'Rechazadas', icon: 'fa-times-circle' },
  ];

  const getModalConfig = () => {
    if (!modalAction) return { title: '', message: '', confirmText: '', variant: 'danger' as const };
    const item = modalAction.item;
    switch (modalAction.action) {
      case 'aprobar':
        return { title: 'Aprobar extra', message: `¿Aprobar "${item.plan.nombre}" para ${item.escort.nombre}?`, confirmText: 'Aprobar', variant: 'primary' as const };
      case 'rechazar':
        return { title: 'Rechazar extra', message: `¿Rechazar "${item.plan.nombre}" para ${item.escort.nombre}?`, confirmText: 'Rechazar', variant: 'danger' as const };
      case 'cancelar':
        return { title: 'Cancelar suscripción extra', message: `¿Cancelar "${item.plan.nombre}" de ${item.escort.nombre}? Se limpiarán los flags sticky/destacado.`, confirmText: 'Cancelar', variant: 'danger' as const };
      case 'eliminar':
        return { title: 'Eliminar suscripción extra', message: `¿Eliminar permanentemente "${item.plan.nombre}" de ${item.escort.nombre}?`, confirmText: 'Eliminar', variant: 'danger' as const };
    }
  };

  const renderActionModal = () => {
    if (!modalAction) return null;
    const cfg = getModalConfig();
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70" onClick={() => { setModalAction(null); setMotivo(''); }}>
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full ${modalAction.action === 'aprobar' ? 'bg-emerald-500/20' : 'bg-red-500/20'} flex items-center justify-center flex-shrink-0`}>
                <i className={`fas ${modalAction.action === 'aprobar' ? 'fa-check' : 'fa-times'} ${modalAction.action === 'aprobar' ? 'text-emerald-400' : 'text-red-400'} text-lg`}></i>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">{cfg.title}</h3>
                <p className="text-gray-400 text-sm mt-0.5">{cfg.message}</p>
              </div>
            </div>

            {(modalAction.action === 'rechazar' || modalAction.action === 'eliminar') && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">
                  {modalAction.action === 'rechazar' ? 'Motivo del rechazo' : 'Notas'}
                  <span className="text-red-400">*</span>
                </label>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500 resize-none"
                  placeholder={modalAction.action === 'rechazar' ? 'Indica por qué se rechaza...' : 'Notas sobre la eliminación...'} />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setModalAction(null); setMotivo(''); }}
                className="flex-1 px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleAction} disabled={actionLoading || ((modalAction.action === 'rechazar' || modalAction.action === 'eliminar') && !motivo.trim())}
                className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${modalAction.action === 'aprobar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {actionLoading && <i className="fas fa-spinner fa-spin mr-1"></i>}
                {cfg.confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-plus-circle text-amber-400"></i> Solicitudes Extras
        </h1>
        <p className="text-gray-400 mt-1">Gestiona las solicitudes de extras contratados por las escorts</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4">
        <StatCard label="Total" value={counts.todos} icon="fa-list" color="#6b7280" loading={isLoading} />
        <StatCard label="Pendientes" value={counts.pendientes} icon="fa-clock" color="#fbbf24" loading={isLoading} />
        <StatCard label="Activas" value={counts.activas} icon="fa-check-circle" color="#10b981" loading={isLoading} />
        <StatCard label="Pausadas" value={counts.pausadas} icon="fa-pause-circle" color="#3b82f6" loading={isLoading} />
        <StatCard label="Vencen hoy" value={counts.vencen_hoy} icon="fa-hourglass-half" color="#f97316" loading={isLoading} />
        <StatCard label="Por vencer (7d)" value={counts.por_vencer} icon="fa-hourglass-start" color="#f59e0b" loading={isLoading} />
        <StatCard label="Rechazadas" value={counts.rechazadas} icon="fa-times-circle" color="#ef4444" loading={isLoading} />
        <StatCard label="Expiradas" value={counts.expiradas} icon="fa-hourglass-end" color="#7f1d1d" loading={isLoading} />
        <StatCard label="Recaudado" value={formatMoney(counts.recaudo)} icon="fa-money-bill-wave" color="#10b981" loading={isLoading} />
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-check-circle"></i>{successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>{error}
          <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><i className="fas fa-times"></i></button>
        </div>
      )}

      <SearchFilters
        search={search}
        onSearch={(val) => { setSearch(val); setPage(1); }}
        placeholder="Buscar por nombre o email..."
        filters={filterOptions}
        activeFilter={filter}
        onFilterChange={(key) => { setFilter(key); setPage(1); }}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage="No hay solicitudes extras"
        emptyIcon="fa-plus-circle"
        getRowKey={(item) => item.suscripcion_id}
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

      {renderActionModal()}
    </div>
  );
}
