import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';
import IconPicker from '../ui/IconPicker';

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  icono: string;
  color: string;
  activa: number;
  orden: number;
  total_escorts: number;
  created_at: string;
}

interface Stats {
  total: number;
  activas: number;
  inactivas: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

const API_URL = '/api/admin/categorias.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function renderIcon(icono?: string) {
  if (!icono) return 'fa-tag';
  return icono.startsWith('fa-') ? icono : `fa-${icono}`;
}

function generateSlug(nombre: string) {
  return nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function CategoriasData() {
  const [items, setItems] = useState<Categoria[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activas: 0, inactivas: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('todos');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState({ nombre: '', slug: '', descripcion: '', icono: 'fa-tag', color: '#6366f1', orden: 0, activa: 1 });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Categoria | null>(null);
  const [deleting, setDeleting] = useState(false);

  const initialLoadRef = useRef(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: pagination.page.toString(), limit: pagination.limit.toString(), estado, search });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setItems(data.categorias || []);
      setStats(data.stats || { total: 0, activas: 0, inactivas: 0 });
      setPagination(data.pagination || pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, estado, search]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    fetchItems();
  }, []);

  useEffect(() => {
    if (!initialLoadRef.current) return;
    fetchItems();
  }, [estado, pagination.page, pagination.limit]);

  useEffect(() => {
    if (!initialLoadRef.current) return;
    const timer = setTimeout(() => { setPagination(prev => ({ ...prev, page: 1 })); fetchItems(); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ nombre: '', slug: '', descripcion: '', icono: 'fa-tag', color: '#6366f1', orden: 0, activa: 1 });
    setEditingItem(null);
    setFieldErrors({});
    setShowModal(true);
  };

  const openEditModal = (item: Categoria) => {
    setModalMode('edit');
    setFormData({
      nombre: item.nombre,
      slug: item.slug || generateSlug(item.nombre),
      descripcion: item.descripcion || '',
      icono: item.icono || 'fa-tag',
      color: item.color || '#6366f1',
      orden: item.orden ?? 0,
      activa: item.activa
    });
    setEditingItem(item);
    setFieldErrors({});
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSaving(true);
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.slug && dataToSend.nombre) dataToSend.slug = generateSlug(dataToSend.nombre);
      const body = modalMode === 'edit' ? JSON.stringify({ ...dataToSend, id: editingItem?.id }) : JSON.stringify(dataToSend);
      const res = await fetch(API_URL, { method: modalMode === 'edit' ? 'PUT' : 'POST', headers: getAuthHeaders(), body });
      const data = await res.json();
      if (!data.success) {
        if (data.fieldErrors) { setFieldErrors(data.fieldErrors); setSaving(false); return; }
        throw new Error(data.error || 'Error al guardar');
      }
      showNotification(modalMode === 'create' ? 'Categoría creada correctamente' : 'Categoría actualizada correctamente');
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
      showNotification('Categoría eliminada correctamente');
      setDeleteConfirm(null);
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setError(err.message); }
    finally { setDeleting(false); }
  };

  const toggleActiva = async (item: Categoria) => {
    try {
      const res = await fetch(API_URL, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ id: item.id, activa: item.activa ? 0 : 1 }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showNotification(`Categoría ${item.activa ? 'desactivada' : 'activada'} correctamente`);
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setError(err.message); }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getActions = (item: Categoria): ActionItem[] => [
    { label: 'Editar', icon: 'fa-edit', onClick: () => openEditModal(item) },
    { label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setDeleteConfirm(item) },
  ];

  const columns: Column<Categoria>[] = [
    {
      key: 'nombre',
      header: 'Categoría',
      width: '240',
      render: (item: Categoria) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (item.color || '#6366f1') + '20' }}>
            <i className={`fas ${renderIcon(item.icono)}`} style={{ color: item.color || '#6366f1' }}></i>
          </div>
          <div>
            <div className="font-medium text-white text-sm">{item.nombre}</div>
            <div className="text-xs text-gray-500">/{item.slug || generateSlug(item.nombre)}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      width: '240',
      render: (item: Categoria) => <span className="text-gray-300 text-sm line-clamp-2">{item.descripcion || '-'}</span>,
    },
    {
      key: 'orden',
      header: 'Orden',
      width: '80',
      align: 'center',
      render: (item: Categoria) => <span className="text-sm text-gray-400">{item.orden ?? 0}</span>,
    },
    {
      key: 'total_escorts',
      header: 'Escorts',
      width: '100',
      align: 'center',
      render: (item: Categoria) => (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2d2d44]">
          <i className="fas fa-users text-gray-400 text-xs"></i>
          <span className="text-sm font-medium text-gray-300">{item.total_escorts ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'activa',
      header: 'Estado',
      width: '100',
      align: 'center',
      render: (item: Categoria) => (
        <button onClick={() => toggleActiva(item)} className="inline-flex items-center justify-center" title={item.activa ? 'Desactivar' : 'Activar'}>
          <i className={`fas fa-toggle-on text-2xl ${item.activa ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-400'} transition-colors`}></i>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-tags text-yellow-400"></i> Categorías
          </h1>
          <p className="text-gray-400 mt-1">Administra las categorías disponibles en la plataforma</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-semibold rounded-lg transition-all shadow-lg shadow-yellow-500/20">
          <i className="fas fa-plus"></i> Nueva Categoría
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Categorías" value={stats.total} icon="fa-tags" color="#eab308" loading={isLoading} />
        <StatCard label="Activas" value={stats.activas} icon="fa-toggle-on" color="#22c55e" loading={isLoading} />
        <StatCard label="Inactivas" value={stats.inactivas} icon="fa-toggle-off" color="#6b7280" loading={isLoading} />
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error}</div>}

      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nombre..."
        filters={[
          { key: 'todos', label: 'Todas' },
          { key: 'activas', label: 'Activas' },
          { key: 'inactivas', label: 'Inactivas' },
        ]}
        activeFilter={estado}
        onFilterChange={(key) => { setEstado(key); setPagination(prev => ({ ...prev, page: 1 })); }}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron categorías' : 'No hay categorías registradas'}
        emptyIcon="fa-tags"
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
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-lg font-bold text-white">{modalMode === 'create' ? 'Nueva Categoría' : 'Editar Categoría'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[#2d2d44] text-gray-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handleSave} className="space-y-4">
                {fieldErrors.general && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"><i className="fas fa-exclamation-circle"></i>{fieldErrors.general}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre <span className="text-red-400">*</span></label>
                  <input type="text" value={formData.nombre} onChange={(e) => { setFormData(prev => ({ ...prev, nombre: e.target.value })); if (fieldErrors.nombre) setFieldErrors(prev => { const n = { ...prev }; delete n.nombre; return n; }); }} placeholder="Ej: VIP"
                    className={`w-full px-4 py-2.5 bg-[#0f0f23] border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors ${fieldErrors.nombre ? 'border-red-500' : 'border-gray-700'}`} />
                  {fieldErrors.nombre && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.nombre}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Slug <span className="text-gray-500 text-xs">(auto)</span></label>
                  <input type="text" value={formData.slug} onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))} placeholder="vip"
                    className={`w-full px-4 py-2.5 bg-[#0f0f23] border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors ${fieldErrors.slug ? 'border-red-500' : 'border-gray-700'}`} />
                  {fieldErrors.slug && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.slug}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción</label>
                  <textarea value={formData.descripcion} onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))} placeholder="Breve descripción..." rows={3}
                    className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Icono</label>
                  <IconPicker value={formData.icono} onChange={(icon) => setFormData(prev => ({ ...prev, icono: icon }))} error={!!fieldErrors.icono} />
                  {fieldErrors.icono && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.icono}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formData.color} onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))} className="w-12 h-10 rounded-lg bg-transparent border border-gray-700 cursor-pointer" />
                    <input type="text" value={formData.color} onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))} placeholder="#6366f1" className="flex-1 px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Orden</label><input type="number" value={formData.orden} onChange={(e) => setFormData(prev => ({ ...prev, orden: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors" /></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label><select value={formData.activa} onChange={(e) => setFormData(prev => ({ ...prev, activa: parseInt(e.target.value) }))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors"><option value={1}>Activa</option><option value={0}>Inactiva</option></select></div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex gap-3 flex-shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-semibold rounded-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20">
                {saving && <i className="fas fa-circle-notch fa-spin"></i>}{saving ? 'Guardando...' : modalMode === 'create' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="¿Eliminar categoría?"
        message={`Estás a punto de eliminar <strong>${deleteConfirm?.nombre || ''}</strong>.${(deleteConfirm?.total_escorts ?? 0) > 0 ? ` Esta categoría tiene ${deleteConfirm?.total_escorts} escort(s) asociada(s). No podrás eliminarla hasta que reasignes o elimines las escorts.` : ' Esta acción no se puede deshacer.'}`}
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
