import { useState, useEffect, useCallback, useRef } from 'react';
import { Skeleton } from '../ui/Skeleton';
import '@fancyapps/ui/dist/fancybox/fancybox.css';
import SearchFilters from './SearchFilters';
import StatCard from '../ui/StatCard';

interface Suscripcion {
  suscripcion_id: number;
  escort_id: number;
  escort_nombre: string;
  escort_email: string;
  escort_telefono: string | null;
  escort_activa: number;
  foto_principal: string | null;
  plan_id: number;
  plan_nombre: string;
  plan_slug: string;
  plan_tipo: string;
  duracion_dias: number;
  plan_precio: string;
  plan_badge: string | null;
  color_badge: string;
  uso_unico: number;
  permite_vip: number;
  permite_destacado: number;
  fecha_inicio: string | null;
  fecha_aprobacion: string | null;
  fecha_fin: string | null;
  fecha_pausa: string | null;
  fecha_reactivacion: string | null;
  fecha_rechazo: string | null;
  estado: string;
  precio_pagado: string;
  moneda: string;
  dias_pausados: number;
  contador_pausas: number;
  max_pausas_permitidas: number;
  comprobante_pago: string | null;
  notas_admin: string | null;
  aprobado_por: number | null;
  rechazado_por: number | null;
  aprobado_por_nombre: string | null;
  rechazado_por_nombre: string | null;
  creado_en: string;
  estado_calculado: string;
  dias_restantes_calculados: number | null;
}

interface Stats {
  total: number;
  pendientes: number;
  activas: number;
  pausadas: number;
  expiradas: number;
  rechazadas: number;
  canceladas: number;
}

interface HistorialPausa {
  id: number;
  accion: string;
  fecha_accion: string;
  dias_acumulados_pausa: number;
  notas: string | null;
  realizado_por_nombre: string | null;
}

interface ExtraInfo {
  suscripcion_id: number;
  plan_nombre: string;
  plan_slug: string;
  extra_tipo: string;
  plan_badge: string | null;
  color_badge: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  precio_pagado: string;
  moneda: string;
  estado: string;
  estado_calculado: string;
}

interface SuscripcionDetalle extends Suscripcion {
  historial_pausas: HistorialPausa[];
  dias_activo: number | null;
  dias_restantes: number | null;
  extras: ExtraInfo[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

const API_BASE = '/api/admin/suscripciones.php';

function getAdminToken(): string {
  return localStorage.getItem('admin_token') || '';
}

function formatDate(date: string | null): string {
  if (!date) return '-';
  const d = date.includes(' ') ? date.split(' ')[0] : date;
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CL');
}

function formatMoney(amount: string | number | null | undefined): string {
  if (amount == null) return '$0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0';
  return '$' + num.toLocaleString('es-CL');
}

const statConfig = [
  { key: 'total' as keyof Stats, icon: 'fa-layer-group', label: 'Total', color: '#3b82f6', bgColor: '#1e3a5f' },
  { key: 'pendientes' as keyof Stats, icon: 'fa-clock', label: 'Pendientes', color: '#f59e0b', bgColor: '#3d3d1a' },
  { key: 'activas' as keyof Stats, icon: 'fa-check-circle', label: 'Activas', color: '#10b981', bgColor: '#1a3d2e' },
  { key: 'expiradas' as keyof Stats, icon: 'fa-times-circle', label: 'Expiradas', color: '#ef4444', bgColor: '#3d1a1a' },
];

export default function SuscripcionesData() {
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Leer parámetros de la URL al montar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const estadoParam = params.get('estado');
    if (estadoParam && ['pendiente', 'activa', 'expirada', 'cancelada', 'pausada', 'rechazada'].includes(estadoParam)) {
      setFilterEstado(estadoParam === 'pendiente' ? 'pendientes' : estadoParam);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    import('@fancyapps/ui').then((mod) => {
      if (disposed) return;
      const F = mod.Fancybox;
      F.bind('[data-fancybox]', {
        compact: false,
        idle: false,
        Toolbar: { display: ['close'] },
      });
    });
    return () => { disposed = true; };
  }, []);

  const [detalleModal, setDetalleModal] = useState<SuscripcionDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [editModal, setEditModal] = useState<Suscripcion | null>(null);
  const [rechazarModal, setRechazarModal] = useState<Suscripcion | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const [aprobarModal, setAprobarModal] = useState<Suscripcion | null>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState('');
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const fileInputComprobante = useRef<HTMLInputElement>(null);

  const confirmAction = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const transformData = (items: any[]): Suscripcion[] => {
    return items.map((s: any) => ({
      suscripcion_id: s.suscripcion_id ?? 0,
      escort_id: s.escort?.id ?? 0,
      escort_nombre: s.escort?.nombre ?? '',
      escort_email: s.escort?.email ?? '',
      escort_telefono: s.escort?.telefono ?? null,
      escort_activa: 1,
      foto_principal: s.escort?.foto_principal ?? null,
      plan_id: s.plan?.id ?? 0,
      plan_nombre: s.plan?.nombre ?? '',
      plan_slug: s.plan?.slug ?? '',
      plan_tipo: s.plan?.tipo ?? 'base',
      duracion_dias: s.plan?.duracion_dias ?? 0,
      plan_precio: s.plan?.precio ?? 0,
      plan_badge: s.plan?.badge ?? null,
      color_badge: s.plan?.color ?? '#6b7280',
      uso_unico: 0,
      permite_vip: s.plan?.permite_vip ? 1 : 0,
      permite_destacado: s.plan?.permite_destacado ? 1 : 0,
      fecha_inicio: s.suscripcion?.fecha_inicio ?? null,
      fecha_aprobacion: s.suscripcion?.fecha_aprobacion ?? null,
      fecha_fin: s.suscripcion?.fecha_fin ?? null,
      fecha_pausa: null,
      fecha_reactivacion: null,
      fecha_rechazo: s.suscripcion?.fecha_rechazo ?? null,
      estado: s.suscripcion?.estado_raw ?? '',
      precio_pagado: s.suscripcion?.precio_pagado ?? 0,
      moneda: s.suscripcion?.moneda ?? 'CLP',
      dias_pausados: 0,
      contador_pausas: s.suscripcion?.contador_pausas ?? 0,
      max_pausas_permitidas: s.plan?.max_pausas_permitidas ?? 3,
      comprobante_pago: s.suscripcion?.comprobante_pago ?? null,
      notas_admin: null,
      aprobado_por: null,
      rechazado_por: null,
      aprobado_por_nombre: s.suscripcion?.aprobado_por ?? null,
      rechazado_por_nombre: s.suscripcion?.rechazado_por ?? null,
      creado_en: s.suscripcion?.creado_en ?? '',
      estado_calculado: s.suscripcion?.estado ?? '',
      dias_restantes_calculados: s.suscripcion?.dias_restantes ?? null,
    }));
  };

  const fetchData = useCallback(async (pageNum: number, append: boolean) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: '20',
        estado: filterEstado,
        search: search,
      });
      const res = await fetch(`${API_BASE}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        const flat = transformData(data.suscripciones ?? []);
        if (append) {
          setSuscripciones(prev => [...prev, ...flat]);
        } else {
          setSuscripciones(flat);
        }
        const c = data.counts ?? {};
        setStats({
          total: c.todos ?? 0,
          pendientes: c.pendientes ?? 0,
          activas: c.activas ?? 0,
          pausadas: c.pausadas ?? 0,
          expiradas: c.expiradas ?? 0,
          rechazadas: c.rechazadas ?? 0,
          canceladas: c.canceladas ?? 0,
        });
        setHasMore(data.pagination?.hasMore ?? data.pagination?.page < data.pagination?.total_pages);
      } else {
        setError(data.error || 'Error cargando datos');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  }, [filterEstado, search]);

  useEffect(() => {
    setPage(1);
    fetchData(1, false);
  }, [filterEstado, search]);

  const fetchDetalle = async (id: number) => {
    setDetalleLoading(true);
    try {
      const res = await fetch(`${API_BASE}?id=${id}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setDetalleModal(data.suscripcion);
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error cargando detalle');
    } finally {
      setDetalleLoading(false);
    }
  };

  const handleAprobar = async (id: number, comprobanteUrl?: string | null) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/suscripciones/aprobar.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ suscripcion_id: id, notas: 'Aprobado desde panel admin', comprobante_pago: comprobanteUrl || null }),
      });
      const data = await res.json();
      if (data.success) {
        setAprobarModal(null);
        setComprobanteFile(null);
        setComprobantePreview('');
        fetchData(page, false);
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRechazar = async () => {
    if (!rechazarModal) return;
    setActionLoading(rechazarModal.suscripcion_id);
    try {
      const res = await fetch('/api/admin/suscripciones/rechazar.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ suscripcion_id: rechazarModal.suscripcion_id, motivo: motivoRechazo }),
      });
      const data = await res.json();
      if (data.success) {
        setRechazarModal(null);
        setMotivoRechazo('');
        fetchData(page, false);
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditar = async () => {
    if (!editModal) return;
    setActionLoading(editModal.suscripcion_id);
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ action: 'update', suscripcion_id: editModal.suscripcion_id, precio_pagado: editModal.precio_pagado, fecha_inicio: editModal.fecha_inicio, fecha_fin: editModal.fecha_fin, notas_admin: editModal.notas_admin, max_pausas_permitidas: editModal.max_pausas_permitidas }),
      });
      const data = await res.json();
      if (data.success) {
        setEditModal(null);
        fetchData(page, false);
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEliminar = async (id: number) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/suscripciones/eliminar.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ suscripcion_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData(page, false);
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivar = async (id: number, notas?: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/suscripciones/reactivar.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ suscripcion_id: id, notas: notas || '' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData(page, false);
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelar = async (id: number) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/suscripciones/cancelar.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
        body: JSON.stringify({ suscripcion_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData(page, false);
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(null);
    }
  };

  const getEstadoBadge = (estado: string) => {
    const styles: Record<string, string> = {
      pendiente_aprobacion: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
      activa: 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50',
      pausada: 'bg-orange-900/40 text-orange-400 border-orange-800/50',
      expirada: 'bg-red-900/40 text-red-400 border-red-800/50',
      cancelada: 'bg-gray-900/40 text-gray-400 border-gray-700/50',
      rechazada: 'bg-rose-900/40 text-rose-400 border-rose-800/50',
      sin_plan: 'bg-gray-900/40 text-gray-500 border-gray-700/50',
    };
    const textos: Record<string, string> = {
      pendiente_aprobacion: 'Pendiente', activa: 'Activo', pausada: 'Pausado',
      expirada: 'Expirado', cancelada: 'Cancelado', rechazada: 'Rechazado',
      sin_plan: 'Sin plan',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[estado] || styles.expirada}`}>
        {textos[estado] || estado}
      </span>
    );
  };

  const getEstadoIcon = (estado: string) => {
    const icons: Record<string, string> = {
      pendiente_aprobacion: 'fa-clock', activa: 'fa-check-circle', pausada: 'fa-pause-circle',
      expirada: 'fa-times-circle', cancelada: 'fa-ban', rechazada: 'fa-times-circle',
      sin_plan: 'fa-question-circle',
    };
    return icons[estado] || 'fa-question-circle';
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-400">
        <i className="fas fa-exclamation-circle mr-2"></i>{error}
      </div>
    );
  }

  return (
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Gestión de Suscripciones</h1>
        <p className="text-admin-muted mb-8">Administra las suscripciones de escorts: aprueba, rechaza, pausa y reactiva</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {statConfig.map((stat) => (
            <StatCard key={stat.key} icon={stat.icon} value={stats?.[stat.key] ?? 0} label={stat.label} color={stat.color} loading={loading} />
          ))}
        </div>

        <SearchFilters
          search={search}
          onSearch={setSearch}
          placeholder="Buscar escort, email o plan..."
          filters={[
            { key: 'todos', label: 'Todos' },
            { key: 'pendientes', label: 'Pendientes' },
            { key: 'activas', label: 'Activas' },
            { key: 'pausadas', label: 'Pausadas' },
            { key: 'expiradas', label: 'Expiradas' },
            { key: 'rechazadas', label: 'Rechazadas' },
            { key: 'canceladas', label: 'Canceladas' },
          ]}
          activeFilter={filterEstado}
          onFilterChange={setFilterEstado}
        />
        {/* Table */}
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl overflow-hidden">
          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a2a3e] text-left text-xs text-gray-400 uppercase">
                    <th className="px-4 py-3">Escort</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-[#2a2a3e]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Skeleton width={40} height={40} circle />
                          <div className="flex-1">
                            <Skeleton width={150} height={20} className="mb-2" />
                            <Skeleton width={100} height={14} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Skeleton width={120} height={20} /></td>
                      <td className="px-4 py-3"><Skeleton width={80} height={20} /></td>
                      <td className="px-4 py-3"><Skeleton width={100} height={20} /></td>
                      <td className="px-4 py-3 text-right"><Skeleton width={80} height={32} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : suscripciones.length === 0 ? (
            <div className="p-12 text-center">
              <i className="fas fa-credit-card text-4xl text-gray-600 mb-4"></i>
              <p className="text-gray-400 mb-4">No hay suscripciones</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2a2a3e] text-left text-xs text-gray-400 uppercase">
                      <th className="px-4 py-3">Escort</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Estado</th>

                      <th className="px-4 py-3">Pago</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suscripciones.map((s) => (
                      <tr key={s.suscripcion_id} className={`border-b border-[#2a2a3e] last:border-0 hover:bg-[#252538] transition-colors ${s.estado_calculado === 'cancelada' || s.estado_calculado === 'rechazada' ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#2a2a3e] flex items-center justify-center text-gray-400 overflow-hidden flex-shrink-0">
                              {s.foto_principal ? (
                                <img src={s.foto_principal} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <i className="fas fa-user text-xs" />
                              )}
                            </div>
                            <div>
                              <div className="text-white font-medium text-sm">{s.escort_nombre}</div>
                              <div className="text-gray-500 text-xs">{s.escort_email}</div>
                              {s.escort_activa === 0 && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-red-900/40 text-red-400 text-[10px] rounded">Inactiva</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0" style={{ backgroundColor: s.color_badge }}>
                              {s.plan_badge ? s.plan_badge.charAt(0) : 'P'}
                            </div>
                            <div>
                              <div className="text-white text-sm">{s.plan_nombre}</div>
                              <div className="text-gray-500 text-xs">{s.duracion_dias}d · {formatMoney(s.plan_precio)}</div>
                              {s.uso_unico === 1 && <span className="inline-block mt-0.5 px-1 py-0.5 bg-purple-900/40 text-purple-300 text-[9px] rounded">Único</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <i className={`fas ${getEstadoIcon(s.estado_calculado)} text-[10px] ${s.estado_calculado === 'activa' ? 'text-emerald-400' : s.estado_calculado === 'pendiente_aprobacion' ? 'text-yellow-400' : s.estado_calculado === 'pausada' ? 'text-orange-400' : s.estado_calculado === 'rechazada' ? 'text-rose-400' : 'text-red-400'}`} />
                              {getEstadoBadge(s.estado_calculado)}
                            </div>
                            {s.dias_restantes_calculados !== null && s.estado_calculado === 'activa' && (
                              <span className="text-[11px] text-emerald-400 font-medium">{s.dias_restantes_calculados} días rest.</span>
                            )}

                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm text-white font-medium">{formatMoney(s.precio_pagado)}</div>
                          <div className="text-xs text-gray-500">{s.moneda}</div>
                          {s.comprobante_pago && (
                            <a href={s.comprobante_pago} data-fancybox="susc-comprobante"
                              className="text-[10px] text-rose-400 hover:text-rose-300 inline-flex items-center gap-0.5 mt-0.5">
                              {s.comprobante_pago.match(/\.pdf$/i) ? <i className="fas fa-file-pdf" /> : <i className="fas fa-file-image" />}Comprobante
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => fetchDetalle(s.suscripcion_id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2a2a3e] text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Ver detalle">
                              <i className="fas fa-eye text-sm"></i>
                            </button>
                            <button onClick={() => setEditModal(s)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2a2a3e] text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Editar">
                              <i className="fas fa-edit text-sm"></i>
                            </button>

                            {s.estado_calculado === 'pendiente_aprobacion' && (
                              <>
                                <button onClick={() => setAprobarModal(s)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] rounded-md font-medium transition-colors flex items-center gap-1">
                                  <i className="fas fa-check text-[10px]" />
                                  Aprobar
                                </button>
                                <button onClick={() => { setRechazarModal(s); setMotivoRechazo(''); }} disabled={actionLoading === s.suscripcion_id}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-1">
                                  <i className="fas fa-times text-[10px]" />Rechazar
                                </button>
                              </>
                            )}

                            {s.estado_calculado === 'activa' && (
                              <>
                                <button onClick={() => confirmAction('¿Cancelar esta suscripción?', () => handleCancelar(s.suscripcion_id))} disabled={actionLoading === s.suscripcion_id}
                                  className="px-2.5 py-1 bg-gray-600 hover:bg-gray-700 text-white text-[11px] rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-1">
                                  <i className="fas fa-ban text-[10px]" />Cancelar
                                </button>
                              </>
                            )}

                            {s.estado_calculado === 'pausada' && (
                              <button onClick={() => confirmAction('¿Reactivar esta suscripción?', () => handleReactivar(s.suscripcion_id))} disabled={actionLoading === s.suscripcion_id}
                                className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-[11px] rounded-md font-medium transition-colors disabled:opacity-50 flex items-center gap-1">
                                <i className="fas fa-play text-[10px]" />Reactivar
                              </button>
                            )}

                            <button onClick={() => confirmAction('¿Eliminar esta suscripción? Esta acción no se puede deshacer.', () => handleEliminar(s.suscripcion_id))} disabled={actionLoading === s.suscripcion_id}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2a2a3e] text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                              <i className="fas fa-trash-alt text-sm"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMore && (
                <div className="p-4 text-center border-t border-[#2a2a3e]">
                  <button onClick={() => { const nextPage = page + 1; setPage(nextPage); fetchData(nextPage, true); }} disabled={loading}
                    className="px-6 py-2 bg-[#2a2a3e] hover:bg-[#3d3d5c] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                    {loading ? <i className="fas fa-circle-notch fa-spin mr-2" /> : <i className="fas fa-chevron-down mr-2" />}
                    Cargar más
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal: Detalle */}
        {detalleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setDetalleModal(null)}>
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-[#2a2a3e]">
                <h3 className="text-lg font-semibold text-white">
                  <i className="fas fa-eye mr-2"></i>
                  {detalleModal.escort_nombre}
                </h3>
                <button onClick={() => setDetalleModal(null)} className="text-gray-400 hover:text-white transition-colors">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {detalleLoading ? (
                  <div className="text-center py-8"><i className="fas fa-circle-notch fa-spin text-2xl text-gray-400" /></div>
                ) : (
                  <>
                    <div className="bg-[#252538] rounded-lg p-4">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Escort</h4>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#2a2a3e] flex items-center justify-center overflow-hidden">
                          {detalleModal.foto_principal ? <img src={detalleModal.foto_principal} alt="" className="w-full h-full object-cover" /> : <i className="fas fa-user text-gray-400" />}
                        </div>
                        <div>
                          <div className="text-white font-medium">{detalleModal.escort_nombre}</div>
                          <div className="text-sm text-gray-500">{detalleModal.escort_email}</div>
                          {detalleModal.escort_telefono && <div className="text-sm text-gray-500">{detalleModal.escort_telefono}</div>}
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#252538] rounded-lg p-4">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Plan</h4>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: detalleModal.color_badge }}>
                          {detalleModal.plan_badge?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <div className="text-white font-medium">{detalleModal.plan_nombre}</div>
                          <div className="text-sm text-gray-500">{detalleModal.duracion_dias} días · {formatMoney(detalleModal.plan_precio)} {detalleModal.moneda}</div>
                          <div className="flex gap-2 mt-1">
                            {detalleModal.permite_vip === 1 && <span className="text-xs text-amber-400">VIP</span>}
                            {detalleModal.permite_destacado === 1 && <span className="text-xs text-purple-400">Destacado</span>}
                            {detalleModal.uso_unico === 1 && <span className="text-xs text-blue-400">Único uso</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#252538] rounded-lg p-4">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Estado</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getEstadoBadge(detalleModal.estado_calculado)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-gray-500">Creada: <span className="text-gray-300">{formatDate(detalleModal.creado_en)}</span></div>
                          <div className="text-gray-500">Aprobada: <span className="text-gray-300">{formatDate(detalleModal.fecha_aprobacion)}</span></div>
                          <div className="text-gray-500">Inicio: <span className="text-gray-300">{formatDate(detalleModal.fecha_inicio)}</span></div>
                          <div className="text-gray-500">Vence: <span className="text-gray-300">{formatDate(detalleModal.fecha_fin)}</span></div>
                          <div className="text-gray-500">Rechazo: <span className="text-rose-400">{formatDate(detalleModal.fecha_rechazo)}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-[#2a2a3e]">
                          <div className="flex items-center gap-2">
                            <i className="fas fa-calendar-alt text-emerald-400 text-xs" />
                            <span className="text-gray-500 text-xs">Días activo:</span>
                            <span className="text-emerald-400 font-medium text-sm">
                              {detalleModal.dias_activo ?? '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="fas fa-hourglass-half text-amber-400 text-xs" />
                            <span className="text-gray-500 text-xs">Días restantes:</span>
                            <span className="text-amber-400 font-medium text-sm">
                              {detalleModal.dias_restantes !== null ? detalleModal.dias_restantes : '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="fas fa-pause-circle text-orange-400 text-xs" />
                            <span className="text-gray-500 text-xs">Pausas:</span>
                            <span className="text-orange-400 font-medium text-sm">{detalleModal.contador_pausas}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#252538] rounded-lg p-4">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Pago</h4>
                      <div className="text-sm">
                        <div className="text-white font-medium">{formatMoney(detalleModal.precio_pagado)} {detalleModal.moneda}</div>
                        {detalleModal.comprobante_pago && (
                          <a href={detalleModal.comprobante_pago} data-fancybox="susc-comprobante" className="text-rose-400 hover:text-rose-300 text-xs mt-1 inline-block">
                            {detalleModal.comprobante_pago.match(/\.pdf$/i) ? <i className="fas fa-file-pdf mr-1" /> : <i className="fas fa-file-image mr-1" />}Ver comprobante
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#252538] rounded-lg p-4">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Pausas</h4>
                      <div className="flex items-center gap-3 text-sm mb-3">
                        <div className="bg-[#1a1a2e] rounded-lg px-3 py-2">
                          <span className="text-white font-medium">{detalleModal.contador_pausas}</span>
                          <span className="text-gray-500"> / {detalleModal.max_pausas_permitidas}</span>
                          <span className="text-gray-500 text-xs ml-1">usadas</span>
                        </div>
                        {detalleModal.dias_pausados > 0 && (
                          <div className="bg-[#1a1a2e] rounded-lg px-3 py-2">
                            <span className="text-orange-400 font-medium">{detalleModal.dias_pausados}</span>
                            <span className="text-gray-500 text-xs ml-1">días pausados acumulados</span>
                          </div>
                        )}
                      </div>
                      {detalleModal.historial_pausas && detalleModal.historial_pausas.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#2a2a3e] text-xs text-gray-500 uppercase">
                                <th className="py-2 pr-3 text-left">Acción</th>
                                <th className="py-2 pr-3 text-left">Fecha</th>
                                <th className="py-2 pr-3 text-right">Días acum.</th>
                                <th className="py-2 text-right">Realizado por</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalleModal.historial_pausas.map((h) => (
                                <tr key={h.id} className="border-b border-[#2a2a3e]/50 last:border-0 hover:bg-[#1a1a2e]/50 transition-colors">
                                  <td className="py-2 pr-3">
                                    <div className="flex items-center gap-2">
                                      <i className={`fas ${h.accion === 'pausa' ? 'fa-pause text-orange-400' : 'fa-play text-green-400'} text-[10px]`} />
                                      <span className={`font-medium capitalize ${h.accion === 'pausa' ? 'text-orange-300' : 'text-green-300'}`}>
                                        {h.accion}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-400">{formatDate(h.fecha_accion)}</td>
                                  <td className="py-2 pr-3 text-right text-gray-400">{h.dias_acumulados_pausa}</td>
                                  <td className="py-2 text-right text-gray-500">{h.realizado_por_nombre || 'Admin'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {detalleModal.extras && detalleModal.extras.length > 0 && (
                      <div className="bg-[#252538] rounded-lg p-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">
                          <i className="fas fa-star text-purple-400 mr-2" />
                          Planes Extra
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#2a2a3e] text-xs text-gray-500 uppercase">
                                <th className="py-2 pr-3 text-left">Plan</th>
                                <th className="py-2 pr-3 text-left">Tipo</th>
                                <th className="py-2 pr-3 text-left">Estado</th>
                                <th className="py-2 pr-3 text-left">Inicio</th>
                                <th className="py-2 pr-3 text-left">Vence</th>
                                <th className="py-2 text-right">Pago</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalleModal.extras.map((ex) => (
                                <tr key={ex.suscripcion_id} className="border-b border-[#2a2a3e]/50 last:border-0 hover:bg-[#1a1a2e]/50 transition-colors">
                                  <td className="py-2 pr-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0" style={{ backgroundColor: ex.color_badge }}>
                                        {ex.plan_badge?.charAt(0) || 'E'}
                                      </div>
                                      <span className="text-gray-200 font-medium">{ex.plan_nombre}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-400 capitalize">{ex.extra_tipo || 'Extra'}</td>
                                  <td className="py-2 pr-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                      ex.estado_calculado === 'activa' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50' :
                                      ex.estado_calculado === 'pendiente_aprobacion' ? 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50' :
                                      ex.estado_calculado === 'pausada' ? 'bg-orange-900/40 text-orange-400 border-orange-800/50' :
                                      'bg-gray-900/40 text-gray-400 border-gray-700/50'
                                    }`}>
                                      {ex.estado_calculado === 'activa' ? 'Activo' :
                                       ex.estado_calculado === 'pendiente_aprobacion' ? 'Pendiente' :
                                       ex.estado_calculado === 'pausada' ? 'Pausado' : 'Finalizado'}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-3 text-gray-400">{formatDate(ex.fecha_inicio)}</td>
                                  <td className="py-2 pr-3 text-gray-400">{formatDate(ex.fecha_fin)}</td>
                                  <td className="py-2 text-right">
                                    <div className="text-gray-300 font-medium">{formatMoney(ex.precio_pagado)}</div>
                                    <div className="text-gray-500 text-[10px]">{ex.moneda}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {detalleModal.notas_admin && (
                      <div className="bg-[#252538] rounded-lg p-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Notas Admin</h4>
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap">{detalleModal.notas_admin}</pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Editar */}
        {editModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setEditModal(null)}>
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-[#2a2a3e]">
                <h3 className="text-lg font-semibold text-white"><i className="fas fa-edit mr-2"></i>Editar Suscripción #{editModal.suscripcion_id}</h3>
                <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Precio pagado</label>
                  <input type="number" value={editModal.precio_pagado} onChange={(e) => setEditModal({ ...editModal, precio_pagado: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Fecha inicio</label>
                  <input type="date" value={editModal.fecha_inicio || ''} onChange={(e) => setEditModal({ ...editModal, fecha_inicio: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Fecha fin</label>
                  <input type="date" value={editModal.fecha_fin || ''} onChange={(e) => setEditModal({ ...editModal, fecha_fin: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max pausas permitidas</label>
                  <input type="number" value={editModal.max_pausas_permitidas} onChange={(e) => setEditModal({ ...editModal, max_pausas_permitidas: parseInt(e.target.value) })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Notas admin</label>
                  <textarea value={editModal.notas_admin || ''} onChange={(e) => setEditModal({ ...editModal, notas_admin: e.target.value })} rows={3}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setEditModal(null)} className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                  <button onClick={handleEditar} disabled={actionLoading !== null}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                    {actionLoading !== null && <i className="fas fa-spinner fa-spin"></i>} Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Rechazar */}
        {rechazarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setRechazarModal(null)}>
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-[#2a2a3e]">
                <h3 className="text-lg font-semibold text-white"><i className="fas fa-times-circle mr-2 text-rose-400"></i>Rechazar Suscripción</h3>
                <button onClick={() => setRechazarModal(null)} className="text-gray-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-400">{rechazarModal.escort_nombre} - {rechazarModal.plan_nombre}</p>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Motivo del rechazo (opcional)</label>
                  <textarea value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} rows={3}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Ej: Pago no verificado, datos incorrectos, etc." />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setRechazarModal(null)} className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                  <button onClick={handleRechazar} disabled={actionLoading !== null}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                    {actionLoading !== null && <i className="fas fa-spinner fa-spin"></i>} Rechazar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Aprobar */}
        {aprobarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => { setAprobarModal(null); setComprobanteFile(null); setComprobantePreview(''); }}>
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-check text-emerald-400 text-lg"></i>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">¿Aprobar suscripción?</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mt-0.5">
                      Escort: <strong className="text-white">{aprobarModal.escort_nombre}</strong>
                      <span className="mx-1">·</span>
                      Plan: <strong className="text-white">{aprobarModal.plan_nombre}</strong>
                    </p>
                  </div>
                </div>

                {/* Comprobante de pago (opcional) */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Comprobante de pago <span className="text-gray-600">(opcional)</span></label>
                  <input ref={fileInputComprobante} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { setError('El archivo no puede superar 5MB'); return; }
                      setComprobanteFile(file);
                      if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setComprobantePreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setComprobantePreview('');
                      }
                    }} />
                  {!comprobanteFile ? (
                    <div onClick={() => fileInputComprobante.current?.click()}
                      className="border-2 border-dashed border-[#2a2a3e] rounded-lg p-4 text-center cursor-pointer hover:border-gray-500 transition-colors">
                      <i className="fas fa-cloud-upload-alt text-gray-500 text-xl mb-1"></i>
                      <div className="text-gray-500 text-xs">Click para subir comprobante</div>
                      <div className="text-gray-600 text-[10px]">JPG, PNG, PDF · Max 5MB</div>
                    </div>
                  ) : (
                    <div className="bg-[#252538] rounded-lg p-3 flex items-center gap-3">
                      {comprobantePreview ? (
                        <img src={comprobantePreview} alt="Preview" className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-[#13131a] flex items-center justify-center text-gray-500"><i className="fas fa-file-pdf text-lg"></i></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate">{comprobanteFile.name}</div>
                        <div className="text-gray-500 text-xs">{(comprobanteFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button onClick={() => { setComprobanteFile(null); setComprobantePreview(''); }} className="text-red-400 hover:text-red-300 text-sm">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => { setAprobarModal(null); setComprobanteFile(null); setComprobantePreview(''); }}
                    className="flex-1 px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
                    Cancelar
                  </button>
                  <button onClick={async () => {
                    let comprobanteUrl = null;
                    if (comprobanteFile) {
                      setSubiendoComprobante(true);
                      const formData = new FormData();
                      formData.append('comprobante', comprobanteFile);
                      formData.append('escort_id', String(aprobarModal.escort_id));
                      const uploadRes = await fetch('/api/admin/subir-comprobante.php', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${getAdminToken()}` },
                        body: formData,
                      });
                      const uploadData = await uploadRes.json();
                      setSubiendoComprobante(false);
                      if (uploadData.success) {
                        comprobanteUrl = uploadData.path;
                      } else {
                        setError(uploadData.error || 'Error al subir comprobante');
                        return;
                      }
                    }
                    handleAprobar(aprobarModal.suscripcion_id, comprobanteUrl);
                  }} disabled={actionLoading !== null || subiendoComprobante}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    {(actionLoading !== null || subiendoComprobante) && <i className="fas fa-spinner fa-spin"></i>}
                    {subiendoComprobante ? 'Subiendo comprobante...' : 'Aprobar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirmación */}
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setConfirmModal(null)}>
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-question-circle text-yellow-400 text-lg"></i>
                  </div>
                  <p className="text-white text-sm leading-relaxed">{confirmModal.message}</p>
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setConfirmModal(null)}
                    className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
                    Cancelar
                  </button>
                  <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
