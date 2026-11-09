// src/components/admin/BannersData.tsx
// Panel de banners publicitarios: alta/edición, cola de solicitudes,
// métricas (impresiones / clicks / CTR), activación y código de acceso.

import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchAutocomplete from '../ui/SearchAutocomplete';
import { showToast } from '../ui/Toast';

interface Banner {
  id: number;
  anunciante: string;
  categoria: string;
  contacto: string | null;
  web: string | null;
  titulo: string;
  imagen_url: string;
  imagen_mobile_url: string | null;
  texto: string | null;
  enlace_url: string;
  placement: string;
  ciudad_id: number | null;
  ciudad_nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  peso: number;
  orden: number;
  precio: string | number;
  moneda: string;
  estado_pago: string;
  forma_pago: string;
  referencia_pago: string | null;
  pagado_en: string | null;
  estado: string;
  codigo_acceso: string | null;
  notas: string | null;
  impresiones: number;
  clicks: number;
}

interface Stats {
  total: number;
  activos: number;
  solicitudes: number;
  pendientes_pago: number;
  impresiones: number;
  clicks: number;
}

interface Ciudad { id: number; nombre: string; }

interface Pagination {
  page: number; limit: number; total: number; pages: number; hasMore: boolean;
}

const API_URL = '/api/admin/banners.php';
const STATS_URL = '/api/admin/banners-stats.php';

const PLACEMENTS: Record<string, string> = {
  home_top: 'Home · Banner superior',
  home_entre_secciones: 'Home · Entre secciones',
  ciudad_top: 'Ciudad · Banner superior',
  perfil_top: 'Perfil · Banner superior',
  perfil_pre_footer: 'Perfil · Antes del pie',
  blog_articulo: 'Blog · En el artículo',
  selector_ciudad: 'Entrada · Selector ciudad',
  footer: 'Footer',
};

/** Carriles disponibles por ubicación (el footer tiene 2 para vender 2 anunciantes) */
const LANES: Record<string, number> = {
  home_top: 1,
  home_entre_secciones: 1,
  ciudad_top: 1,
  perfil_top: 1,
  perfil_pre_footer: 1,
  blog_articulo: 1,
  footer: 2,
};

const LANE_LABEL: Record<number, string> = {
  1: 'Carril 1 (arriba)',
  2: 'Carril 2 (abajo)',
};

const CATEGORIAS: Record<string, string> = {
  night_club: 'Night club',
  discoteca: 'Discoteca',
  sex_shop: 'Sex shop',
  bar: 'Bar',
  sauna: 'Sauna',
  otro: 'Otro',
};

const ESTADOS: Record<string, string> = {
  solicitud: 'Solicitud',
  presupuesto: 'Presupuesto',
  pendiente_pago: 'Pendiente de pago',
  activo: 'Activo',
  pausado: 'Pausado',
  finalizado: 'Finalizado',
  rechazado: 'Rechazado',
};

const ESTADOS_PAGO: Record<string, string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  gratis: 'Gratis',
  reembolsado: 'Reembolsado',
};

const FORMAS_PAGO: Record<string, string> = {
  transferencia: 'Transferencia',
  webpay: 'Webpay',
  efectivo: 'Efectivo',
  otro: 'Otro',
};

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function getAuthHeadersForm(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Authorization': `Bearer ${token}` };
}

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(value);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  anunciante: '',
  categoria: 'night_club',
  contacto: '',
  web: '',
  titulo: '',
  imagen_url: '',
  imagen_mobile_url: '',
  texto: '',
  enlace_url: '',
  placement: 'home_top',
  lane: 1,
  ciudad_id: '',
  ciudad_nombre: '',
  fecha_inicio: today(),
  fecha_fin: inDays(30),
  peso: 10,
  orden: 0,
  precio: 0,
  moneda: 'CLP',
  estado_pago: 'pendiente',
  forma_pago: 'transferencia',
  referencia_pago: '',
  estado: 'solicitud',
  notas: '',
};

type FormData = typeof EMPTY_FORM;

export default function BannersData() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, activos: 0, solicitudes: 0, pendientes_pago: 0, impresiones: 0, clicks: 0
  });
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 25, total: 0, pages: 1, hasMore: false
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [placementFilter, setPlacementFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<{ ids: number[]; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  const [tab, setTab] = useState<'banners' | 'solicitudes' | 'metricas'>('banners');
  const [metricas, setMetricas] = useState<any[]>([]);
  const [serie, setSerie] = useState<any[]>([]);
  const [ocupacion, setOcupacion] = useState<any>(null);
  const [conflictos, setConflictos] = useState<any[]>([]);
  const [forzando, setForzando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const fetchBanners = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        search,
        placement: placementFilter,
        estado: estadoFilter,
      });
      const res = await fetch(`${API_URL}?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setBanners(data.banners || []);
        setStats(data.stats || stats);
        setCiudades(data.ciudades || []);
        setPagination(data.pagination || pagination);
      } else {
        setError(data.error || 'Error al cargar');
      }
    } catch (e: any) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [search, placementFilter, estadoFilter]);

  const fetchMetricas = useCallback(async () => {
    try {
      const res = await fetch(`${STATS_URL}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setMetricas(data.totales || []);
        setSerie(data.serie || []);
      }
    } catch { /* no-op */ }
  }, []);

  useEffect(() => { fetchBanners(1); }, [fetchBanners]);
  useEffect(() => { if (tab === 'metricas') fetchMetricas(); }, [tab, fetchMetricas]);

  // Aviso de ocupación: al cambiar ubicación/carril/fechas consulta si el espacio está libre
  useEffect(() => {
    if (!showModal) return;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          placement: form.placement,
          lane: String(form.lane || 1),
          desde: form.fecha_inicio,
          hasta: form.fecha_fin,
        });
        const res = await fetch(`/api/admin/banners-ocupacion.php?${params.toString()}`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (data.success) {
          setOcupacion(data.ocupacion || null);
          setConflictos(data.conflictos || []);
        }
      } catch { /* no-op */ }
    }, 400);
    return () => clearTimeout(t);
  }, [showModal, form.placement, form.lane, form.fecha_inicio, form.fecha_fin]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFieldErrors({});
    setShowModal(true);
  };

  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({
      anunciante: b.anunciante || '',
      categoria: b.categoria || 'otro',
      contacto: b.contacto || '',
      web: b.web || '',
      titulo: b.titulo || '',
      imagen_url: b.imagen_url || '',
      imagen_mobile_url: b.imagen_mobile_url || '',
      texto: b.texto || '',
      enlace_url: b.enlace_url || '',
      placement: b.placement || 'home_top',
      lane: (b.lane ?? 1),
      ciudad_id: b.ciudad_id ? String(b.ciudad_id) : '',
      ciudad_nombre: b.ciudad_nombre || '',
      fecha_inicio: (b.fecha_inicio || '').slice(0, 10),
      fecha_fin: (b.fecha_fin || '').slice(0, 10),
      peso: b.peso ?? 10,
      orden: b.orden ?? 0,
      precio: Number(b.precio || 0),
      moneda: b.moneda || 'CLP',
      estado_pago: b.estado_pago || 'pendiente',
      forma_pago: b.forma_pago || 'transferencia',
      referencia_pago: b.referencia_pago || '',
      estado: b.estado || 'solicitud',
      notas: b.notas || '',
    });
    setFieldErrors({});
    setShowModal(true);
  };

  const handleUpload = async (file: File, target: 'imagen_url' | 'imagen_mobile_url') => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const res = await fetch('/api/admin/banners-subir-imagen.php', {
        method: 'POST',
        headers: getAuthHeadersForm(),
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setForm((prev) => ({ ...prev, [target]: data.url }));
        showToast('Imagen subida');
      } else {
        showToast(data.error || 'Error al subir la imagen', 'error');
      }
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const guardar = async (forzar: boolean) => {
    setSaving(true);
    setFieldErrors({});
    try {
      const payload: any = { ...form, lane: form.lane || 1, ciudad_id: form.ciudad_id === '' ? 0 : Number(form.ciudad_id) };
      if (forzar) payload.forzar = 1;
      if (editing) payload.id = editing.id;
      const res = await fetch(API_URL, {
        method: editing ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Guardado');
        if (data.codigo_acceso) {
          showToast(`Código de acceso: ${data.codigo_acceso}`);
        }
        setShowModal(false);
        setOcupacion(null);
        setConflictos([]);
        fetchBanners(pagination.page);
      } else if (res.status === 409 && data.puedeForzar) {
        setConflictos(data.conflictos || []);
        showToast('Ese espacio ya está ocupado', 'error');
      } else {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        showToast(data.error || 'Error al guardar', 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await guardar(forzando);
  };

  const accionSimple = async (id: number, accion: string, mensaje: string) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, accion }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || mensaje);
        if (data.codigo_acceso) showToast(`Código de acceso: ${data.codigo_acceso}`);
        fetchBanners(pagination.page);
      } else {
        showToast(data.error || 'Error', 'error');
      }
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const cambiarEstado = async (b: Banner, nuevo: string) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: b.id, estado: nuevo }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Banner ${nuevo === 'activo' ? 'activado' : 'pausado'}`);
        if (nuevo === 'activo' && data.codigo_acceso) showToast(`Código de acceso: ${data.codigo_acceso}`);
        fetchBanners(pagination.page);
      } else {
        showToast(data.error || 'Error', 'error');
      }
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}?id=${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Banner eliminado');
        setDeleteTarget(null);
        fetchBanners(pagination.page);
      } else {
        showToast(data.error || 'Error', 'error');
      }
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = (ids: Set<string | number>) => {
    if (ids.size === 0) return;
    // Solo se abre la confirmación: el borrado ocurre en confirmBulkDelete()
    setBulkConfirm({
      ids: Array.from(ids).map(Number),
      message: `Estás a punto de eliminar ${ids.size} banner(s) seleccionado(s). Esta acción no se puede deshacer.`,
    });
  };

  const confirmBulkDelete = async () => {
    if (!bulkConfirm) return;
    const ids = bulkConfirm.ids;
    setBulkConfirm(null);
    setBulkDeleting(true);
    try {
      for (const id of ids) {
        await fetch(`${API_URL}?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      }
      showToast(`${ids.length} banner(s) eliminado(s)`);
      setSelected(new Set());
      fetchBanners(pagination.page);
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const getActions = (b: Banner): ActionItem[] => {
    const acciones: ActionItem[] = [
      { label: 'Editar', icon: 'fa-pen', onClick: () => openEdit(b) },
    ];
    if (b.estado === 'activo') {
      acciones.push({ label: 'Pausar', icon: 'fa-pause', onClick: () => cambiarEstado(b, 'pausado') });
    } else {
      acciones.push({ label: 'Activar', icon: 'fa-play', onClick: () => cambiarEstado(b, 'activo') });
    }
    if (b.codigo_acceso) {
      acciones.push({
        label: 'Copiar código de acceso',
        icon: 'fa-key',
        onClick: () => {
          navigator.clipboard?.writeText(b.codigo_acceso || '');
          showToast('Código copiado');
        },
      });
      acciones.push({
        label: 'Regenerar código',
        icon: 'fa-redo',
        onClick: () => accionSimple(b.id, 'regenerar_codigo', 'Código regenerado'),
      });
    }
    acciones.push({
      label: 'Duplicar',
      icon: 'fa-copy',
      onClick: () => accionSimple(b.id, 'duplicar', 'Banner duplicado'),
    });
    acciones.push({
      label: 'Tomar el lugar',
      icon: 'fa-hand-holding',
      onClick: () => accionSimple(b.id, 'tomar_lugar', 'Espacio tomado'),
    });
    acciones.push({
      label: 'Eliminar',
      icon: 'fa-trash',
      danger: true,
      onClick: () => setDeleteTarget(b),
    });
    return acciones;
  };

  const columns: Column<Banner>[] = [
    {
      key: 'anunciante',
      header: 'Anunciante',
      width: '220',
      render: (b) => (
        <div className="flex items-center gap-3">
          <img
            src={b.imagen_url}
            alt=""
            className="w-10 h-10 rounded-lg object-cover border border-white/10 bg-black/20"
            onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
          />
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{b.anunciante}</div>
            <div className="text-xs text-gray-500 truncate">{CATEGORIAS[b.categoria] || b.categoria}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'placement',
      header: 'Espacio',
      width: '200',
      render: (b) => (
        <div>
          <div className="text-gray-300 text-sm">{PLACEMENTS[b.placement] || b.placement}</div>
          <div className="text-xs text-gray-500">
            {LANES[b.placement] > 1 ? LANE_LABEL[b.lane || 1] : 'Carril 1'}
            {b.ciudad_nombre ? ` · ${b.ciudad_nombre}` : ' · todas las ciudades'}
          </div>
        </div>
      ),
    },
    {
      key: 'periodo',
      header: 'Período',
      width: '160',
      render: (b) => (
        <div className="text-xs text-gray-400">
          <div>{b.fecha_inicio}</div>
          <div>→ {b.fecha_fin}</div>
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '150',
      render: (b) => {
        const vence = new Date(b.fecha_fin + 'T23:59:59') < new Date();
        const porVencer = !vence && (new Date(b.fecha_fin + 'T23:59:59').getTime() - Date.now()) < 7 * 86400000;
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${
              b.estado === 'activo' ? 'bg-green-500/15 text-green-400 border-green-500/30'
                : b.estado === 'solicitud' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : b.estado === 'pausado' ? 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                : 'bg-red-500/15 text-red-400 border-red-500/30'
            }`}>{ESTADOS[b.estado] || b.estado}</span>
            {b.estado_pago === 'pendiente' && (
              <span className="px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">Sin pagar</span>
            )}
            {porVencer && b.estado === 'activo' && (
              <span className="px-2 py-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs">Vence pronto</span>
            )}
            {vence && b.estado === 'activo' && (
              <span className="px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs">Vencido</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'precio',
      header: 'Precio',
      width: '120',
      align: 'right',
      render: (b) => (
        <div>
          <div className="text-white text-sm">{b.precio ? formatCLP(Number(b.precio)) : '—'}</div>
          <div className="text-xs text-gray-500">{ESTADOS_PAGO[b.estado_pago] || b.estado_pago}</div>
        </div>
      ),
    },
    {
      key: 'metricas',
      header: 'Impresiones / Clicks',
      width: '170',
      render: (b) => {
        const imp = Number(b.impresiones || 0);
        const clk = Number(b.clicks || 0);
        const ctr = imp > 0 ? ((clk / imp) * 100).toFixed(1) : '0.0';
        return (
          <div className="text-xs text-gray-400">
            <div>{formatCLP(imp)} <span className="text-gray-600">/</span> {formatCLP(clk)} <span className="text-gray-600">·</span> {ctr}%</div>
            {b.codigo_acceso && <div className="text-gray-600 mt-0.5">código: {b.codigo_acceso}</div>}
          </div>
        );
      },
    },
  ];

  const solicitudes = banners.filter((b) => b.estado === 'solicitud');
  const listado = tab === 'solicitudes' ? solicitudes : banners;

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-400">
        <i className="fas fa-exclamation-circle mr-2"></i>{error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">Banners</h1>
          <p className="text-admin-muted text-sm">Publicidad para negocios del rubro (night clubs, discotecas, sex shops…)</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <i className="fas fa-plus"></i> Nuevo banner
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="fa-images" value={stats.total} label="Totales" color="#3b82f6" loading={loading} />
        <StatCard icon="fa-toggle-on" value={stats.activos} label="Activos" color="#10b981" loading={loading} />
        <StatCard icon="fa-inbox" value={stats.solicitudes} label="Solicitudes" color="#f59e0b" loading={loading} />
        <StatCard icon="fa-credit-card" value={stats.pendientes_pago} label="Sin pagar" color="#ef4444" loading={loading} />
      </div>

      <div className="flex gap-2 mb-4 border-b border-white/5">
        {([
          ['banners', 'Banners'],
          ['solicitudes', `Solicitudes${stats.solicitudes ? ` (${stats.solicitudes})` : ''}`],
          ['metricas', 'Métricas'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === id ? 'border-red-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'metricas' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchBanners(1); }}
                  placeholder="Buscar por anunciante, título o contacto…"
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <select
              value={placementFilter}
              onChange={(e) => { setPlacementFilter(e.target.value); setTimeout(() => fetchBanners(1), 0); }}
              className="bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Todas las ubicaciones</option>
              {Object.entries(PLACEMENTS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={estadoFilter}
              onChange={(e) => { setEstadoFilter(e.target.value); setTimeout(() => fetchBanners(1), 0); }}
              className="bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <DataTable
            columns={columns}
            data={listado}
            loading={loading}
            getRowKey={(b) => b.id}
            getActions={getActions}
            selectable
            selected={selected}
            onSelectionChange={setSelected}
            onBulkDelete={handleBulkDelete}
            bulkDeleteLabel="Eliminar seleccionados"
            emptyMessage={tab === 'solicitudes' ? 'No hay solicitudes pendientes' : 'No hay banners creados'}
            emptyIcon="fa-image"
          />
        </>
      )}

      {tab === 'metricas' && (
        <div className="bg-admin-card border border-admin-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Métricas por banner (30 días)</h3>
            <a
              href="/api/admin/banners-stats.php?formato=csv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <i className="fas fa-file-csv"></i> Exportar CSV
            </a>
          </div>
          {metricas.length === 0 ? (
            <p className="text-gray-500 text-sm">Todavía no hay métricas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/10">
                    <th className="py-2 pr-3">Banner</th>
                    <th className="py-2 pr-3">Ubicación</th>
                    <th className="py-2 pr-3 text-right">Impresiones</th>
                    <th className="py-2 pr-3 text-right">Clicks</th>
                    <th className="py-2 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {metricas.map((m: any) => (
                    <tr key={m.banner_id} className="border-b border-white/5">
                      <td className="py-2 pr-3 text-white">{m.anunciante}</td>
                      <td className="py-2 pr-3 text-gray-400">{PLACEMENTS[m.placement] || m.placement}</td>
                      <td className="py-2 pr-3 text-right text-gray-300">{formatCLP(m.impresiones)}</td>
                      <td className="py-2 pr-3 text-right text-gray-300">{formatCLP(m.clicks)}</td>
                      <td className="py-2 text-right text-gray-300">{m.ctr}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {serie.length > 0 && (
            <div className="mt-6">
              <h4 className="text-white text-sm font-semibold mb-3">Últimos días</h4>
              <div className="flex items-end gap-1 h-24">
                {serie.slice(-30).map((s: any, i: number) => {
                  const max = Math.max(...serie.map((x: any) => Number(x.impresiones) || 0), 1);
                  const h = Math.max(2, (Number(s.impresiones) / max) * 100);
                  return (
                    <div key={i} className="flex-1 bg-red-500/70 rounded-t" style={{ height: `${h}%` }} title={`${s.fecha}: ${s.impresiones} imp / ${s.clicks} clicks`} />
                  );
                })}
              </div>
              <p className="text-xs text-gray-600 mt-2">Impresiones por día (últimos 30 registros)</p>
            </div>
          )}
        </div>
      )}

      {/* Modal alta/edición */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 bg-black/70 overflow-y-auto">
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-3xl p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">{editing ? 'Editar banner' : 'Nuevo banner'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Negocio / anunciante *</label>
                  <input
                    type="text"
                    value={form.anunciante}
                    onChange={(e) => setForm({ ...form, anunciante: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  {fieldErrors.anunciante && <p className="text-red-400 text-xs mt-1">{fieldErrors.anunciante}</p>}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Categoría</label>
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Contacto (whatsapp / email)</label>
                  <input
                    type="text"
                    value={form.contacto}
                    onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sitio web del negocio</label>
                  <input
                    type="text"
                    value={form.web}
                    onChange={(e) => setForm({ ...form, web: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  {fieldErrors.web && <p className="text-red-400 text-xs mt-1">{fieldErrors.web}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Ubicación del banner *</label>
                <select
                  value={form.placement}
                  onChange={(e) => {
                    const pl = e.target.value;
                    setForm({ ...form, placement: pl, lane: 1 });
                  }}
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {Object.entries(PLACEMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Medida máxima: 970 x 125 px (formato horizontal). La imagen se muestra a escala real, sin deformar.
                </p>
                {fieldErrors.placement && <p className="text-red-400 text-xs mt-1">{fieldErrors.placement}</p>}
              </div>

              {(LANES[form.placement] || 1) > 1 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Carril *</label>
                  <select
                    value={form.lane}
                    onChange={(e) => setForm({ ...form, lane: Number(e.target.value) })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {[1, 2].slice(0, LANES[form.placement] || 1).map((n) => (
                      <option key={n} value={n}>{LANE_LABEL[n]}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Cada carril es un espacio independiente: puedes vender 2 anunciantes en el mismo lugar.</p>
                </div>
              )}

              {/* Aviso de ocupación del espacio */}
              {(ocupacion || conflictos.length > 0) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  <div className="flex items-start gap-2 text-amber-300">
                    <i className="fas fa-exclamation-triangle mt-0.5"></i>
                    <div className="flex-1">
                      {ocupacion && (
                        <p className="mb-1">
                          <strong>{PLACEMENTS[form.placement]}{form.lane > 1 ? ` · ${LANE_LABEL[form.lane]}` : ''}</strong> está ocupado por{' '}
                          <strong>{ocupacion.anunciante}</strong> ({ocupacion.fecha_inicio} → {ocupacion.fecha_fin}).
                        </p>
                      )}
                      {conflictos.length > 0 && (
                        <p className="mb-1">
                          {conflictos.length === 1 ? 'Hay una campaña que se solapa con tus fechas:' : `Hay ${conflictos.length} campañas que se solapan con tus fechas:`}
                          {conflictos.map((c: any) => ` ${c.anunciante} (${c.fecha_inicio}→${c.fecha_fin})`).join(',')}.
                        </p>
                      )}
                      <p className="text-amber-200/80 text-xs">
                        Al guardar, se mostrará la de mayor prioridad. Si quieres tomar el espacio, la otra quedará pausada.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setForzando(true); guardar(true); }}
                        className="mt-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        <i className="fas fa-hand-holding mr-1"></i> Tomar el lugar (pausar la otra)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Ciudad (buscar)</label>
                <SearchAutocomplete
                  label=""
                  icon="fa-map-marker-alt"
                  itemIcon="fa-city"
                  placeholder="Escribe para buscar ciudad (ej: La Serena)…"
                  options={ciudades.map((c) => ({ id: c.id, nombre: c.nombre }))}
                  value={form.ciudad_nombre}
                  onChange={(v) => setForm({ ...form, ciudad_nombre: v })}
                  onSelect={(opt) => setForm({ ...form, ciudad_id: String(opt.id), ciudad_nombre: opt.nombre })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Vacío = todas las ciudades. Con ciudad, el banner solo se muestra en esa ciudad (y en ninguna otra).
                </p>
                {form.ciudad_id && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, ciudad_id: '', ciudad_nombre: '' })}
                    className="mt-1 text-xs text-gray-500 hover:text-red-400"
                  >
                    Quitar filtro de ciudad
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Texto opcional</label>
                <input
                  type="text"
                  value={form.texto}
                  onChange={(e) => setForm({ ...form, texto: e.target.value })}
                  placeholder="Ej: Opens 8PM"
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Imagen del banner * (máx. 970x125 px)</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'imagen_url'); e.target.value = ''; }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-[#252538] border border-[#2a2a3e] rounded-lg text-white text-sm hover:border-blue-500 transition-colors"
                  >
                    {uploading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-upload"></i>} Subir
                  </button>
                  {form.imagen_url && (
                    <img src={form.imagen_url} alt="" className="w-16 h-10 object-cover rounded border border-white/10" />
                  )}
                </div>
                {fieldErrors.imagen_url && <p className="text-red-400 text-xs mt-1">{fieldErrors.imagen_url}</p>}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Enlace de destino *</label>
                <input
                  type="text"
                  value={form.enlace_url}
                  onChange={(e) => setForm({ ...form, enlace_url: e.target.value })}
                  placeholder="https://wa.me/569..."
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
                {fieldErrors.enlace_url && <p className="text-red-400 text-xs mt-1">{fieldErrors.enlace_url}</p>}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Desde *</label>
                  <input
                    type="date"
                    value={form.fecha_inicio}
                    onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hasta *</label>
                  <input
                    type="date"
                    value={form.fecha_fin}
                    onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  {fieldErrors.fecha_fin && <p className="text-red-400 text-xs mt-1">{fieldErrors.fecha_fin}</p>}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Precio</label>
                  <input
                    type="number"
                    min="0"
                    value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Estado del pago</label>
                  <select
                    value={form.estado_pago}
                    onChange={(e) => setForm({ ...form, estado_pago: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(ESTADOS_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Forma de pago</label>
                  <select
                    value={form.forma_pago}
                    onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(FORMAS_PAGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Prioridad</label>
                  <input
                    type="number"
                    min="0"
                    value={form.orden}
                    onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Mayor número = se muestra primero si hay solapes.</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Referencia de pago</label>
                  <input
                    type="text"
                    value={form.referencia_pago}
                    onChange={(e) => setForm({ ...form, referencia_pago: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Notas internas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  {saving && <i className="fas fa-spinner fa-spin"></i>}
                  <i className="fas fa-save"></i> {editing ? 'Guardar cambios' : 'Crear banner'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-[#252538] hover:bg-[#2a2a3e] text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Eliminar banner"
        message={`¿Eliminar "${deleteTarget?.anunciante}"? Se perderán sus métricas. Esta acción no se puede deshacer.`}
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        confirmDisabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        isOpen={!!bulkConfirm}
        title="Eliminar banners"
        message={bulkConfirm?.message || ''}
        confirmText={bulkDeleting ? 'Eliminando...' : 'Eliminar'}
        confirmDisabled={bulkDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkConfirm(null)}
      />
    </div>
  );
}
