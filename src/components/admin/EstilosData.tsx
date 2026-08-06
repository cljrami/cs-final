import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';
import IconPicker from '../ui/IconPicker';

interface Estilo {
  id: number;
  nombre: string;
  icono: string;
  orden: number;
  activo: number;
  total_escorts: number;
  created_at: string;
}

interface Stats {
  total: number;
  activos: number;
  inactivos: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

const API_URL = '/api/admin/estilos.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

export default function EstilosData() {
  const [items, setItems] = useState<Estilo[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activos: 0, inactivos: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Estilo | null>(null);
  const [formData, setFormData] = useState({ nombre: '', icono: 'fa-wand-magic-sparkles', orden: 0, activo: 1 });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Estilo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const initialLoadRef = useRef(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: pagination.page.toString(), limit: pagination.limit.toString(), filtro, search });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setItems(data.estilos || []);
      setStats(data.stats || { total: 0, activos: 0, inactivos: 0 });
      setPagination(data.pagination || pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filtro, search]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    fetchItems();
  }, []);

  useEffect(() => {
    if (!initialLoadRef.current) return;
    fetchItems();
  }, [filtro, pagination.page, pagination.limit]);

  useEffect(() => {
    if (!initialLoadRef.current) return;
    const timer = setTimeout(() => { setPagination(prev => ({ ...prev, page: 1 })); fetchItems(); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ nombre: '', icono: 'fa-wand-magic-sparkles', orden: 0, activo: 1 });
    setEditingItem(null);
    setFieldErrors({});
    setShowModal(true);
  };

  const openEditModal = (item: Estilo) => {
    setModalMode('edit');
    setFormData({ nombre: item.nombre, icono: item.icono || 'fa-wand-magic-sparkles', orden: item.orden || 0, activo: item.activo });
    setEditingItem(item);
    setFieldErrors({});
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSaving(true);
    try {
      const body = modalMode === 'edit' ? JSON.stringify({ ...formData, id: editingItem?.id }) : JSON.stringify(formData);
      const res = await fetch(API_URL, { method: modalMode === 'edit' ? 'PUT' : 'POST', headers: getAuthHeaders(), body });
      const data = await res.json();
      if (!data.success) {
        if (data.fieldErrors) { setFieldErrors(data.fieldErrors); setSaving(false); return; }
        throw new Error(data.error || 'Error al guardar');
      }
      showNotification(modalMode === 'create' ? 'Estilo creado correctamente' : 'Estilo actualizado correctamente');
      setShowModal(false);
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setFieldErrors({ general: err.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}?id=${deleteConfirm.id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      showNotification('Estilo eliminado correctamente');
      setDeleteConfirm(null);
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setError(err.message); }
    finally { setDeleting(false); }
  };

  const toggleActivo = async (item: Estilo) => {
    try {
      const res = await fetch(API_URL, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ id: item.id, activo: item.activo ? 0 : 1 }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showNotification(`Estilo ${item.activo ? 'desactivado' : 'activado'} correctamente`);
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setError(err.message); }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getActions = (item: Estilo): ActionItem[] => [
    { label: 'Editar', icon: 'fa-edit', onClick: () => openEditModal(item) },
    { label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setDeleteConfirm(item) },
  ];

  const columns: Column<Estilo>[] = [
    {
      key: 'nombre',
      header: 'Estilo',
      width: '220',
      render: (item: Estilo) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
            <i className={`fas ${item.icono || 'fa-wand-magic-sparkles'} text-pink-400`}></i>
          </div>
          <div>
            <div className="font-medium text-white text-sm">{item.nombre}</div>
            <div className="text-xs text-gray-500">ID: {item.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'orden',
      header: 'Orden',
      width: '100',
      align: 'center',
      render: (item: Estilo) => <span className="text-sm text-gray-400">{item.orden}</span>,
    },
    {
      key: 'activo',
      header: 'Estado',
      width: '100',
      align: 'center',
      render: (item: Estilo) => (
        <button onClick={() => toggleActivo(item)} className="inline-flex items-center justify-center" title={item.activo ? 'Desactivar' : 'Activar'}>
          <i className={`fas fa-toggle-on text-2xl ${item.activo ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-400'} transition-colors`}></i>
        </button>
      ),
    },
    {
      key: 'total_escorts',
      header: 'Escorts',
      width: '80',
      align: 'center',
      render: (item: Estilo) => (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2d2d44]">
          <i className="fas fa-users text-gray-400 text-xs"></i>
          <span className="text-sm font-medium text-gray-300">{item.total_escorts ?? 0}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-wand-magic-sparkles text-pink-400"></i> Estilos
          </h1>
          <p className="text-gray-400 mt-1">Administra los estilos disponibles en la plataforma</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-pink-500/20">
          <i className="fas fa-plus"></i> Nuevo Estilo
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Estilos" value={stats.total} icon="fa-wand-magic-sparkles" color="#ec4899" loading={isLoading} />
        <StatCard label="Activos" value={stats.activos} icon="fa-toggle-on" color="#22c55e" loading={isLoading} />
        <StatCard label="Inactivos" value={stats.inactivos} icon="fa-toggle-off" color="#6b7280" loading={isLoading} />
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error}</div>}

      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar estilo..."
        filters={[
          { key: 'todos', label: 'Todos' },
          { key: 'activos', label: 'Activos' },
          { key: 'inactivos', label: 'Inactivos' },
        ]}
        activeFilter={filtro}
        onFilterChange={(key) => { setFiltro(key); setPagination(prev => ({ ...prev, page: 1 })); }}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron estilos' : 'No hay estilos registrados'}
        emptyIcon="fa-wand-magic-sparkles"
        getRowKey={(item) => item.id}
        getActions={getActions}
      />

      {pagination.pages > 1 && (
        <div className="bg-admin-card border border-admin-border rounded-xl px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Mostrando <span className="text-white font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> - <span className="text-white font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> de <span className="text-white font-medium">{pagination.total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1} className="p-2 rounded-lg bg-admin-border text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <i className="fas fa-chevron-left"></i>
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => handlePageChange(page)} className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${pagination.page === page ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-admin-border text-gray-300 hover:bg-gray-700'}`}>
                {page}
              </button>
            ))}
            <button onClick={() => handlePageChange(pagination.page + 1)} disabled={!pagination.hasMore} className="p-2 rounded-lg bg-admin-border text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">{modalMode === 'create' ? 'Nuevo Estilo' : 'Editar Estilo'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[#2d2d44] text-gray-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {fieldErrors.general && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"><i className="fas fa-exclamation-circle"></i>{fieldErrors.general}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre <span className="text-red-400">*</span></label>
                <input type="text" value={formData.nombre} onChange={(e) => { setFormData(prev => ({ ...prev, nombre: e.target.value })); if (fieldErrors.nombre) setFieldErrors(prev => { const n = { ...prev }; delete n.nombre; return n; }); }} placeholder="Ej: Elegante"
                  className={`w-full px-4 py-2.5 bg-[#0f0f23] border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors ${fieldErrors.nombre ? 'border-red-500' : 'border-gray-700'}`} />
                {fieldErrors.nombre && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.nombre}</p>}
              </div>
              <IconPicker value={formData.icono} onChange={(icon) => setFormData(prev => ({ ...prev, icono: icon }))} error={!!fieldErrors.icono} />
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Orden</label><input type="number" value={formData.orden} onChange={(e) => setFormData(prev => ({ ...prev, orden: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-pink-500 transition-colors" /></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label><select value={formData.activo} onChange={(e) => setFormData(prev => ({ ...prev, activo: parseInt(e.target.value) }))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-pink-500 transition-colors"><option value={1}>Activo</option><option value={0}>Inactivo</option></select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold rounded-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20">
                  {saving && <i className="fas fa-circle-notch fa-spin"></i>}{saving ? 'Guardando...' : modalMode === 'create' ? 'Crear' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="¿Eliminar estilo?"
        message={`Estás a punto de eliminar <strong>${deleteConfirm?.nombre || ''}</strong>.${(deleteConfirm?.total_escorts ?? 0) > 0 ? ` Este estilo tiene ${deleteConfirm?.total_escorts} escort(s) asociada(s).` : ' Esta acción no se puede deshacer.'}`}
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        cancelText="Cancelar"
        variant="danger"
        confirmDisabled={deleting || (deleteConfirm?.total_escorts ?? 0) > 0}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
