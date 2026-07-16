// src/components/admin/ExtrasData.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataCell from '../ui/DataCell';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';

interface Extra {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  tipo: 'destacado' | 'sticky' | 'otro';
  duracion_dias: number;
  precio: number;
  moneda: string;
  color_badge: string;
  orden: number;
  activo: number;
  total_escorts: number;
  creado_en: string;
  actualizado_en: string;
}

interface Stats {
  total: number;
  activos: number;
  inactivos: number;
}

const statConfig = [
  { key: 'total' as keyof Stats, icon: 'fa-puzzle-piece', label: 'Total Extras', color: '#3b82f6' },
  { key: 'activos' as keyof Stats, icon: 'fa-toggle-on', label: 'Activos', color: '#10b981' },
  { key: 'inactivos' as keyof Stats, icon: 'fa-toggle-off', label: 'Inactivos', color: '#6b7280' },
];

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

const API_URL = '/api/admin/extras.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function formatNumberCLP(value: number): string {
  if (!value && value !== 0) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseNumberCLP(value: string): number {
  const clean = value.replace(/\./g, '').replace(/,/g, '');
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
}

function formatPrice(price: number, moneda: string): string {
  if (price === 0) return 'Gratis';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0
  }).format(price);
}

function getTipoIcon(tipo: string): string {
  switch (tipo) {
    case 'destacado': return 'fa-star';
    case 'sticky': return 'fa-thumbtack';
    default: return 'fa-puzzle-piece';
  }
}

function getTipoLabel(tipo: string): string {
  switch (tipo) {
    case 'destacado': return 'Destacado';
    case 'sticky': return 'Sticky';
    default: return 'Otro';
  }
}

export default function ExtrasData() {
  const [extras, setExtras] = useState<Extra[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activos: 0, inactivos: 0 });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 50, total: 0, pages: 1, hasMore: false
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingExtra, setEditingExtra] = useState<Extra | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    slug: '',
    descripcion: '',
    tipo: 'otro' as 'destacado' | 'sticky' | 'otro',
    duracion_dias: 7,
    precio: 0,
    moneda: 'CLP',
    color_badge: '#6b7280',
    orden: 0,
    activo: 1,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Extra | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [precioInput, setPrecioInput] = useState('');
  const [duracionInput, setDuracionInput] = useState('7');
  const [ordenInput, setOrdenInput] = useState('0');

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(false);

  const fetchExtras = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    setError('');
    try {
      const currentPage = pageOverride ?? pagination.page;
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pagination.limit.toString(),
        estado,
        tipo: tipoFilter,
        search
      });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');

      setExtras(data.extras || []);
      setStats(data.stats || { total: 0, activos: 0, inactivos: 0 });
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
    } catch (err: any) {
      setError(err.message);
      setExtras([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, estado, tipoFilter, search]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    fetchExtras();
  }, []);

  useEffect(() => { fetchExtras(); }, [estado, tipoFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchExtras(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const resetForm = () => {
    setFormData({
      nombre: '', slug: '', descripcion: '', tipo: 'otro',
      duracion_dias: 7, precio: 0, moneda: 'CLP',
      color_badge: '#6b7280', orden: 0, activo: 1,
    });
    setPrecioInput('');
    setDuracionInput('7');
    setOrdenInput('0');
    setFieldErrors({});
  };

  const openCreateModal = () => {
    setModalMode('create');
    resetForm();
    setEditingExtra(null);
    setShowModal(true);
  };

  const openEditModal = (extra: Extra) => {
    setModalMode('edit');
    setFormData({
      nombre: extra.nombre, slug: extra.slug, descripcion: extra.descripcion || '',
      tipo: extra.tipo, duracion_dias: extra.duracion_dias, precio: extra.precio,
      moneda: extra.moneda, color_badge: extra.color_badge || '#6b7280',
      orden: extra.orden, activo: extra.activo,
    });
    setPrecioInput(formatNumberCLP(extra.precio));
    setDuracionInput(extra.duracion_dias.toString());
    setOrdenInput(extra.orden.toString());
    setEditingExtra(extra);
    setFieldErrors({});
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSaving(true);

    const body = {
      ...formData,
      precio: parseNumberCLP(precioInput),
      duracion_dias: parseInt(duracionInput, 10) || 0,
      orden: parseInt(ordenInput, 10) || 0,
    };

    try {
      const payload = modalMode === 'edit' ? { ...body, id: editingExtra?.id } : body;
      const res = await fetch(API_URL, {
        method: modalMode === 'edit' ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        if (data.fieldErrors) { setFieldErrors(data.fieldErrors); setSaving(false); return; }
        throw new Error(data.error || 'Error al guardar');
      }

      showNotification(modalMode === 'create' ? 'Extra creado' : 'Extra actualizado');
      setShowModal(false);
      resetForm();
      fetchExtras();
    } catch (err: any) {
      setFieldErrors({ general: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}?id=${deleteConfirm.id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      showNotification('Extra eliminado');
      setDeleteConfirm(null);
      fetchExtras();
    } catch (err: any) { setError(err.message); }
    finally { setDeleting(false); }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const toggleActivo = async (extra: Extra) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: extra.id, activo: extra.activo ? 0 : 1 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showNotification(`Extra ${extra.activo ? 'desactivado' : 'activado'}`);
      fetchExtras();
    } catch (err: any) { setError(err.message); }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // ─── Columns ────────────────────────────────────────────────────────

  const columns: Column<Extra>[] = [
    {
      key: 'extra',
      header: 'Extra',
      width: '280',
      render: (extra: Extra, loading: boolean) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: extra.color_badge + '20' }}>
            <i className={`fas ${getTipoIcon(extra.tipo)}`} style={{ color: extra.color_badge }}></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{extra.nombre}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-admin-border text-gray-300 shrink-0">
                {getTipoLabel(extra.tipo)}
              </span>
            </div>
            <span className="text-xs text-gray-500">/{extra.slug}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'duracion',
      header: 'Duración',
      width: '120',
      render: (extra: Extra, loading: boolean) => (
        <span className="text-gray-300 text-sm">
          {extra.duracion_dias} días
        </span>
      ),
    },
    {
      key: 'precio',
      header: 'Precio',
      width: '120',
      align: 'center' as const,
      render: (extra: Extra, loading: boolean) => (
        <span className={`text-sm font-medium ${extra.precio === 0 ? 'text-gray-400 italic' : 'text-emerald-400'}`}>
          {formatPrice(extra.precio, extra.moneda)}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '80',
      align: 'center' as const,
      render: (extra: Extra, loading: boolean) => (
        <button onClick={() => toggleActivo(extra)} className="inline-flex items-center justify-center" title={extra.activo ? 'Desactivar' : 'Activar'}>
          {extra.activo ? (
            <i className="fas fa-toggle-on text-2xl text-green-400 hover:text-green-300 transition-colors"></i>
          ) : (
            <i className="fas fa-toggle-off text-2xl text-gray-500 hover:text-gray-400 transition-colors"></i>
          )}
        </button>
      ),
    },
    {
      key: 'total_escorts',
      header: 'Escorts',
      width: '80',
      align: 'center' as const,
      render: (extra: Extra, loading: boolean) => (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2d2d44]">
          <i className="fas fa-users text-gray-400 text-xs"></i>
          <span className="text-sm font-medium text-gray-300">{extra.total_escorts ?? 0}</span>
        </div>
      ),
    },
  ];

  const getActions = (extra: Extra): ActionItem[] => [
    { label: 'Editar', icon: 'fa-edit', onClick: () => openEditModal(extra) },
    { label: 'Eliminar', icon: 'fa-trash-alt', onClick: () => setDeleteConfirm(extra) },
  ];

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-puzzle-piece text-admin-primary"></i>
            Extras
          </h1>
          <p className="text-gray-400 mt-1">Administra los extras disponibles para las escorts</p>
        </div>
        <button onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-admin-primary hover:bg-admin-primary/90 text-white font-semibold rounded-lg transition-all shadow-lg shadow-admin-primary/20">
          <i className="fas fa-plus"></i>Nuevo Extra
        </button>
      </div>

      {/* ═══ STATS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statConfig.map((stat) => (
          <StatCard key={stat.key} icon={stat.icon} value={stats?.[stat.key] ?? 0} label={stat.label} color={stat.color} />
        ))}
      </div>

      {/* ═══ ALERTS ═══ */}
      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-check-circle"></i>{successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>{error}
          <button onClick={() => fetchExtras()} className="ml-auto text-sm underline">Reintentar</button>
        </div>
      )}

      {/* ═══ FILTERS ═══ */}
      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar extras..."
        filters={[
          { key: 'todos', label: 'Todos' },
          { key: 'activos', label: 'Activos' },
          { key: 'inactivos', label: 'Inactivos' },
        ]}
        activeFilter={estado}
        onFilterChange={setEstado}
      />
      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar extras..."
        hideSearch
        filters={[
          { key: 'todos', label: 'Todos tipos' },
          { key: 'destacado', label: 'Destacado' },
          { key: 'sticky', label: 'Sticky' },
          { key: 'otro', label: 'Otro' },
        ]}
        activeFilter={tipoFilter}
        onFilterChange={setTipoFilter}
      />

      {/* ═══ DATATABLE ═══ */}
      <DataTable
        columns={columns}
        data={extras}
        loading={loading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron extras con esa búsqueda' : 'No hay extras registrados. Crea uno nuevo.'}
        emptyIcon="fa-puzzle-piece"
        getRowKey={(extra) => extra.id}
        getActions={getActions}
      />

      {/* ═══ PAGINATION ═══ */}
      {pagination.pages > 1 && (
        <div className="bg-admin-card border border-admin-border rounded-xl px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Mostrando <span className="text-white font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> - <span className="text-white font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> de <span className="text-white font-medium">{pagination.total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1} className="p-2 rounded-lg bg-admin-border text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors">
              <i className="fas fa-chevron-left"></i>
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => handlePageChange(page)} className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${pagination.page === page ? 'bg-admin-primary text-white shadow-lg shadow-admin-primary/20' : 'bg-admin-border text-gray-300 hover:bg-gray-700'}`}>
                {page}
              </button>
            ))}
            <button onClick={() => handlePageChange(pagination.page + 1)} disabled={!pagination.hasMore} className="p-2 rounded-lg bg-admin-border text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      {/* ═══ MODAL CREAR/EDITAR (inline) ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-admin-card border border-admin-border rounded-2xl w-full max-w-lg shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border shrink-0">
              <h2 className="text-lg font-bold text-white">
                <i className={`fas fa-${modalMode === 'create' ? 'plus' : 'edit'} mr-2 text-admin-primary`}></i>
                {modalMode === 'create' ? 'Nuevo Extra' : 'Editar Extra'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-admin-border text-gray-400 hover:text-white transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              {fieldErrors.general && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                  <i className="fas fa-exclamation-circle"></i>{fieldErrors.general}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre <span className="text-red-400">*</span></label>
                  <input type="text" value={formData.nombre}
                    onChange={(e) => { setFormData(prev => ({ ...prev, nombre: e.target.value })); if (fieldErrors.nombre) setFieldErrors(prev => { const n = { ...prev }; delete n.nombre; return n; }); }}
                    placeholder="Ej: Sticky 7 días"
                    className={`w-full px-4 py-2.5 bg-admin-bg border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-admin-primary transition-colors ${fieldErrors.nombre ? 'border-red-500' : 'border-admin-border'}`} />
                  {fieldErrors.nombre && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.nombre}</p>}
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Slug <span className="text-gray-500 text-xs">(auto)</span></label>
                  <input type="text" value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="sticky-7-dias"
                    className={`w-full px-4 py-2.5 bg-admin-bg border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-admin-primary transition-colors ${fieldErrors.slug ? 'border-red-500' : 'border-admin-border'}`} />
                  {fieldErrors.slug && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.slug}</p>}
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo</label>
                  <select value={formData.tipo}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as 'destacado' | 'sticky' | 'otro' }))}
                    className="w-full px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors">
                    <option value="destacado">Destacado</option>
                    <option value="sticky">Sticky</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {/* Precio */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Precio</label>
                  <div className="flex gap-2">
                    <input type="text" inputMode="numeric" value={precioInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setPrecioInput(formatNumberCLP(parseInt(raw || '0', 10)));
                      }}
                      className="flex-1 px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors"
                      placeholder="0" />
                    <select value={formData.moneda}
                      onChange={(e) => setFormData(prev => ({ ...prev, moneda: e.target.value }))}
                      className="px-3 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors">
                      <option value="CLP">CLP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  {fieldErrors.precio && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.precio}</p>}
                </div>

                {/* Duración */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Duración (días)</label>
                  <input type="text" inputMode="numeric" value={duracionInput}
                    onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setDuracionInput(val); }}
                    className="w-full px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors"
                    placeholder="7" />
                </div>

                {/* Color Badge */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={formData.color_badge}
                      onChange={(e) => setFormData(prev => ({ ...prev, color_badge: e.target.value }))}
                      className="w-10 h-10 rounded-lg bg-transparent cursor-pointer shrink-0" />
                    <input type="text" value={formData.color_badge}
                      onChange={(e) => setFormData(prev => ({ ...prev, color_badge: e.target.value }))}
                      className="flex-1 px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors" />
                  </div>
                </div>

                {/* Orden */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Orden <span className="text-gray-500 text-xs">(posición)</span>
                  </label>
                  <input type="text" inputMode="numeric" value={ordenInput}
                    onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setOrdenInput(val); }}
                    className="w-full px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors"
                    placeholder="0" />
                </div>

                {/* Descripción */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción</label>
                  <textarea value={formData.descripcion}
                    onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors resize-none"
                    placeholder="Descripción del extra..." />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-admin-border hover:bg-gray-700 text-white font-medium rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-admin-primary hover:bg-admin-primary/90 text-white font-semibold rounded-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-admin-primary/20">
                  {saving && <i className="fas fa-circle-notch fa-spin"></i>}
                  {saving ? 'Guardando...' : modalMode === 'create' ? 'Crear Extra' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ CONFIRMMODAL ELIMINAR ═══ */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar extra?"
        message={`Vas a eliminar ${deleteConfirm?.nombre}.${(deleteConfirm?.total_escorts ?? 0) > 0 ? ` Este extra tiene ${deleteConfirm?.total_escorts} escort(s) asociada(s).` : ' Esta acción no se puede deshacer.'}`}
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        variant="danger"
        confirmDisabled={deleting || (deleteConfirm?.total_escorts ?? 0) > 0}
      />
    </div>
  );
}