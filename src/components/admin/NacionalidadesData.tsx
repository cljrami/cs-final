import { Skeleton } from '../ui/Skeleton';
import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataCell from '../ui/DataCell';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';

interface Nacionalidad {
  id: number;
  nombre: string;
  orden: number;
  activo: number;
  total_escorts: number;
  created_at: string;
}

interface Stats {
  total: number;
  activas: number;
  inactivas: number;
}

const statConfig = [
  { key: 'total' as keyof Stats, icon: 'fa-globe-americas', label: 'Total Nacionalidades', color: '#3b82f6' },
  { key: 'activas' as keyof Stats, icon: 'fa-toggle-on', label: 'Activas', color: '#10b981' },
  { key: 'inactivas' as keyof Stats, icon: 'fa-toggle-off', label: 'Inactivas', color: '#6b7280' },
];

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

const API_URL = '/api/admin/nacionalidades.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function NacionalidadesData() {
  const [nacionalidades, setNacionalidades] = useState<Nacionalidad[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activas: 0, inactivas: 0 });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 50, total: 0, pages: 1, hasMore: false
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingNacionalidad, setEditingNacionalidad] = useState<Nacionalidad | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    orden: 0,
    activo: 1
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Nacionalidad | null>(null);
  const [deleting, setDeleting] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(false);

  const fetchNacionalidades = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    setError('');
    try {
      const currentPage = pageOverride ?? pagination.page;
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pagination.limit.toString(),
        filtro,
        search
      });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');

      setNacionalidades(data.nacionalidades || []);
      setStats(data.stats || { total: 0, activas: 0, inactivas: 0 });
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
    } catch (err: any) {
      setError(err.message);
      setNacionalidades([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filtro, search]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    fetchNacionalidades();
  }, []);

  useEffect(() => { fetchNacionalidades(); }, [filtro, pagination.page, pagination.limit]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchNacionalidades(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ nombre: '', orden: 0, activo: 1 });
    setEditingNacionalidad(null);
    setFieldErrors({});
    setShowModal(true);
  };

  const openEditModal = (n: Nacionalidad) => {
    setModalMode('edit');
    setFormData({
      nombre: n.nombre,
      orden: n.orden ?? 0,
      activo: n.activo
    });
    setEditingNacionalidad(n);
    setFieldErrors({});
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSaving(true);

    try {
      const dataToSend: any = { ...formData };
      dataToSend.orden = parseInt(dataToSend.orden);
      dataToSend.activo = parseInt(dataToSend.activo);

      const body = modalMode === 'edit'
        ? JSON.stringify({ ...dataToSend, id: editingNacionalidad?.id })
        : JSON.stringify(dataToSend);

      const res = await fetch(API_URL, {
        method: modalMode === 'edit' ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body
      });
      const data = await res.json();

      if (!data.success) {
        if (data.fieldErrors) { setFieldErrors(data.fieldErrors); setSaving(false); return; }
        throw new Error(data.error || 'Error al guardar');
      }

      showNotification(modalMode === 'create' ? 'Nacionalidad creada' : 'Nacionalidad actualizada');
      setShowModal(false);
      fetchNacionalidades();
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
      showNotification('Nacionalidad eliminada');
      setDeleteConfirm(null);
      fetchNacionalidades();
    } catch (err: any) { setError(err.message); }
    finally { setDeleting(false); }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const toggleActivo = async (n: Nacionalidad) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: n.id, activo: n.activo ? 0 : 1 })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showNotification(`Nacionalidad ${n.activo ? 'desactivada' : 'activada'}`);
      fetchNacionalidades();
    } catch (err: any) { setError(err.message); }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // ─── Columns ────────────────────────────────────────────────────────

  const columns: Column<Nacionalidad>[] = [
    {
      key: 'nacionalidad',
      header: 'Nacionalidad',
      width: '280',
      render: (n: Nacionalidad, loading: boolean) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#3b82f620' }}>
            <i className="fas fa-globe" style={{ color: '#3b82f6' }}></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{n.nombre}</span>
            </div>
            <span className="text-xs text-gray-500">ID: {n.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'orden',
      header: 'Orden',
      width: '80',
      align: 'center' as const,
      render: (n: Nacionalidad, loading: boolean) => (
        <DataCell value={n.orden} loading={loading} />
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '80',
      align: 'center' as const,
      render: (n: Nacionalidad, loading: boolean) => (
        <button onClick={() => toggleActivo(n)} className="inline-flex items-center justify-center" title={n.activo ? 'Desactivar' : 'Activar'}>
          {n.activo ? (
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
      render: (n: Nacionalidad, loading: boolean) => (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2d2d44]">
          <i className="fas fa-users text-gray-400 text-xs"></i>
          <span className="text-sm font-medium text-gray-300">{n.total_escorts ?? 0}</span>
        </div>
      ),
    },
  ];

  const getActions = (n: Nacionalidad): ActionItem[] => [
    { label: 'Editar', icon: 'fa-edit', onClick: () => openEditModal(n) },
    { label: 'Eliminar', icon: 'fa-trash-alt', onClick: () => setDeleteConfirm(n) },
  ];

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-globe text-admin-primary"></i>
            Nacionalidades
          </h1>
          <p className="text-gray-400 mt-1">Administra las nacionalidades disponibles en la plataforma</p>
        </div>
        <button onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-admin-primary hover:bg-admin-primary/90 text-white font-semibold rounded-lg transition-all shadow-lg shadow-admin-primary/20">
          <i className="fas fa-plus"></i>Nueva Nacionalidad
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
          <button onClick={() => fetchNacionalidades()} className="ml-auto text-sm underline">Reintentar</button>
        </div>
      )}

      {/* ═══ FILTERS ═══ */}
      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar nacionalidad..."
        filters={[
          { key: 'todos', label: 'Todas' },
          { key: 'activas', label: 'Activas' },
          { key: 'inactivas', label: 'Inactivas' },
        ]}
        activeFilter={filtro}
        onFilterChange={setFiltro}
      />

      {/* ═══ DATATABLE ═══ */}
      <DataTable
        columns={columns}
        data={nacionalidades}
        loading={loading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron nacionalidades con esa búsqueda' : 'No hay nacionalidades registradas. Crea una nueva.'}
        emptyIcon="fa-globe"
        getRowKey={(n) => n.id}
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
          <div className="bg-admin-card border border-admin-border rounded-2xl w-full max-w-md shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border shrink-0">
              <h2 className="text-lg font-bold text-white">
                <i className={`fas fa-${modalMode === 'create' ? 'plus' : 'edit'} mr-2 text-admin-primary`}></i>
                {modalMode === 'create' ? 'Nueva Nacionalidad' : 'Editar Nacionalidad'}
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre <span className="text-red-400">*</span></label>
                <input type="text" value={formData.nombre}
                  onChange={(e) => { setFormData(prev => ({ ...prev, nombre: e.target.value })); if (fieldErrors.nombre) setFieldErrors(prev => { const n = { ...prev }; delete n.nombre; return n; }); }}
                  placeholder="Ej: Argentina"
                  className={`w-full px-4 py-2.5 bg-admin-bg border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-admin-primary transition-colors ${fieldErrors.nombre ? 'border-red-500' : 'border-admin-border'}`} />
                {fieldErrors.nombre && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.nombre}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Orden</label>
                  <input type="number" value={formData.orden}
                    onChange={(e) => setFormData(prev => ({ ...prev, orden: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label>
                  <select value={formData.activo}
                    onChange={(e) => setFormData(prev => ({ ...prev, activo: parseInt(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors">
                    <option value={1}>Activa</option>
                    <option value={0}>Inactiva</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-admin-border hover:bg-gray-700 text-white font-medium rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-admin-primary hover:bg-admin-primary/90 text-white font-semibold rounded-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-admin-primary/20">
                  {saving && <i className="fas fa-circle-notch fa-spin"></i>}
                  {saving ? 'Guardando...' : modalMode === 'create' ? 'Crear' : 'Guardar'}
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
        title="¿Eliminar nacionalidad?"
        message={`Vas a eliminar ${deleteConfirm?.nombre}.${(deleteConfirm?.total_escorts ?? 0) > 0 ? ` Esta nacionalidad tiene ${deleteConfirm?.total_escorts} escort(s) asociada(s).` : ' Esta acción no se puede deshacer.'}`}
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        variant="danger"
        confirmDisabled={deleting || (deleteConfirm?.total_escorts ?? 0) > 0}
      />
    </div>
  );
}