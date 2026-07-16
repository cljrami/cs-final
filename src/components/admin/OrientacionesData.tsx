// src/components/admin/OrientacionesData.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataCell from '../ui/DataCell';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';

interface Stats {
  total: number;
  activas: number;
  inactivas: number;
}

const statConfig = [
  { key: 'total' as keyof Stats, icon: 'fa-venus-mars', label: 'Total', color: '#3b82f6' },
  { key: 'activas' as keyof Stats, icon: 'fa-toggle-on', label: 'Activas', color: '#10b981' },
  { key: 'inactivas' as keyof Stats, icon: 'fa-toggle-off', label: 'Inactivas', color: '#6b7280' },
];

interface Orientacion {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  orden: number;
  activa: number;
  total_escorts: number;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

interface FieldErrors {
  nombre?: string;
  descripcion?: string;
  orden?: string;
}

const API_URL = '/api/admin/orientaciones.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

export default function OrientacionesData() {
  const [orientaciones, setOrientaciones] = useState<Orientacion[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activas: 0, inactivas: 0 });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 50, total: 0, pages: 1, hasMore: false
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingOrientacion, setEditingOrientacion] = useState<Orientacion | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    orden: 0
  });
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Orientacion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(false);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const fetchData = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    setError('');
    try {
      const currentPage = pageOverride ?? pagination.page;
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pagination.limit.toString(),
        search
      });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');

      setOrientaciones(data.orientaciones || []);
      setStats(data.stats || { total: 0, activas: 0, inactivas: 0 });
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
    } catch (err: any) {
      setError(err.message);
      setOrientaciones([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    fetchData();
  }, []);

  useEffect(() => { fetchData(); }, [pagination.page, pagination.limit]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchData(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingOrientacion(null);
    setFormData({ nombre: '', descripcion: '', orden: 0 });
    setFieldErrors({});
    setShowModal(true);
  };

  const openEditModal = (ori: Orientacion) => {
    setModalMode('edit');
    setEditingOrientacion(ori);
    setFormData({
      nombre: ori.nombre,
      descripcion: ori.descripcion || '',
      orden: ori.orden
    });
    setFieldErrors({});
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSaving(true);

    try {
      const body = modalMode === 'edit'
        ? JSON.stringify({ ...formData, id: editingOrientacion?.id })
        : JSON.stringify(formData);

      const res = await fetch(API_URL, {
        method: modalMode === 'edit' ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body
      });
      const data = await res.json();

      if (!data.success) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          setSaving(false);
          return;
        }
        throw new Error(data.error || 'Error al guardar');
      }

      showNotification(modalMode === 'create' ? 'Orientación creada' : 'Orientación actualizada');
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActiva = async (ori: Orientacion) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: ori.id, activa: ori.activa ? 0 : 1 })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showNotification(`Orientación ${ori.activa ? 'desactivada' : 'activada'}`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const oriToDelete = deleteConfirm;
    setDeleteConfirm(null);
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}?id=${oriToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      showNotification('Orientación eliminada');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const getActions = (ori: Orientacion): ActionItem[] => [
    { label: 'Editar', icon: 'fa-pen', onClick: () => openEditModal(ori) },
    { label: 'Eliminar', icon: 'fa-trash-alt', onClick: () => setDeleteConfirm(ori) }
  ];

  const columns: Column<Orientacion>[] = [
    {
      key: 'orientacion',
      header: 'Orientación',
      width: '280',
      render: (ori: Orientacion) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-admin-border text-gray-400">
            <i className="fas fa-venus-mars"></i>
          </div>
          <div>
            <div className="font-medium text-white">{ori.nombre}</div>
            <div className="text-xs text-gray-500">{ori.descripcion || 'Sin descripción'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      width: '180',
      render: (ori: Orientacion) => (
        <DataCell value={ori.slug} loading={loading} />
      ),
    },
    {
      key: 'orden',
      header: 'Orden',
      width: '100',
      render: (ori: Orientacion) => (
        <DataCell value={ori.orden.toString()} loading={loading} />
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '120',
      align: 'center' as const,
      render: (ori: Orientacion) => (
        <button onClick={() => toggleActiva(ori)} className="inline-flex items-center justify-center" title={ori.activa ? 'Desactivar' : 'Activar'}>
          {ori.activa ? (
            <i className="fas fa-toggle-on text-2xl text-green-400 hover:text-green-300 transition-colors"></i>
          ) : (
            <i className="fas fa-toggle-off text-2xl text-gray-500 hover:text-gray-400 transition-colors"></i>
          )}
        </button>
      ),
    },
    {
      key: 'created_at',
      header: 'Creada',
      width: '150',
      render: (ori: Orientacion) => {
        const d = new Date(ori.created_at);
        return (
          <DataCell
            value={isNaN(d.getTime()) ? ori.created_at : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
            loading={loading}
          />
        );
      },
    },
    {
      key: 'total_escorts',
      header: 'Escorts',
      width: '80',
      align: 'center' as const,
      render: (ori: Orientacion) => (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2d2d44]">
          <i className="fas fa-users text-gray-400 text-xs"></i>
          <span className="text-sm font-medium text-gray-300">{ori.total_escorts ?? 0}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-venus-mars text-admin-primary"></i>
            Orientaciones Sexuales
          </h1>
          <p className="text-gray-400 mt-1">Gestiona las orientaciones sexuales disponibles</p>
        </div>
        <button onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-admin-primary hover:bg-admin-primary/90 text-white font-semibold rounded-lg transition-all shadow-lg shadow-admin-primary/20">
          <i className="fas fa-plus"></i>Nueva Orientación
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
          <button onClick={() => fetchData()} className="ml-auto text-sm underline">Reintentar</button>
        </div>
      )}

      {/* ═══ FILTERS ═══ */}
      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar orientación..."
        filters={[]}
        activeFilter=""
        onFilterChange={() => {}}
      />

      {/* ═══ DATATABLE ═══ */}
      <DataTable
        columns={columns}
        data={orientaciones}
        loading={loading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron orientaciones con esa búsqueda' : 'No hay orientaciones registradas. Crea una nueva.'}
        emptyIcon="fa-venus-mars"
        getRowKey={(ori) => ori.id}
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
          <div className="bg-admin-card border border-admin-border rounded-2xl w-full max-w-md shadow-2xl my-8 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <i className={`fas ${modalMode === 'create' ? 'fa-plus text-admin-primary' : 'fa-pen text-admin-primary'}`}></i>
                {modalMode === 'create' ? 'Nueva Orientación' : 'Editar Orientación'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-admin-border text-gray-400 hover:text-white transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre <span className="text-red-400">*</span></label>
                <input type="text" value={formData.nombre}
                  onChange={(e) => { setFormData(prev => ({ ...prev, nombre: e.target.value })); if (fieldErrors.nombre) setFieldErrors(prev => { const n = { ...prev }; delete n.nombre; return n; }); }}
                  placeholder="Ej: Heterosexual, Bisexual..."
                  className={`w-full px-4 py-2.5 bg-admin-bg border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-admin-primary transition-colors ${fieldErrors.nombre ? 'border-red-500' : 'border-admin-border'}`} />
                {fieldErrors.nombre && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.nombre}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción</label>
                <textarea value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción opcional..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-admin-primary transition-colors resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Orden</label>
                <input type="number" value={formData.orden}
                  onChange={(e) => setFormData(prev => ({ ...prev, orden: parseInt(e.target.value) || 0 }))}
                  min={0}
                  className="w-full px-4 py-2.5 bg-admin-bg border border-admin-border rounded-lg text-white focus:outline-none focus:border-admin-primary transition-colors" />
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
        title="¿Eliminar orientación?"
        message={`Vas a eliminar la orientación "${deleteConfirm?.nombre}".${(deleteConfirm?.total_escorts ?? 0) > 0 ? ` Esta orientación tiene ${deleteConfirm?.total_escorts} escort(s) asociada(s).` : ' Esta acción no se puede deshacer.'}`}
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        variant="danger"
        confirmDisabled={deleting || (deleteConfirm?.total_escorts ?? 0) > 0}
      />
    </div>
  );
}