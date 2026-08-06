import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';

interface Servicio {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  descripcion_corta: string;
  grupo: string;
  icono: string;
  color: string;
  tipicamente_adicional: number;
  orden: number;
  activo: number;
  total_escorts: number;
  created_at: string;
}

interface Stats {
  total: number;
  activos: number;
  inactivos: number;
  adicionales: number;
  incluidos: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

const API_URL = '/api/admin/servicios.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const GRUPOS: Record<string, { label: string; color: string }> = {
  sexual: { label: 'Sexual', color: '#ec4899' },
  relajacion: { label: 'Relajación', color: '#10b981' },
  acompanamiento: { label: 'Acompañamiento', color: '#3b82f6' },
  experiencia: { label: 'Experiencia', color: '#8b5cf6' },
  adicional: { label: 'Adicional', color: '#f97316' },
  lugar: { label: 'Lugar', color: '#06b6d4' },
  tiempo: { label: 'Tiempo', color: '#6366f1' },
  virtual: { label: 'Virtual', color: '#d946ef' },
};

const iconOptions = [
  'fa-tag', 'fa-heart', 'fa-star', 'fa-gem', 'fa-crown', 'fa-fire',
  'fa-bolt', 'fa-moon', 'fa-sun', 'fa-spa', 'fa-glass-cheers', 'fa-music',
  'fa-venus', 'fa-arrow-up', 'fa-lips', 'fa-kiss', 'fa-hand', 'fa-plug',
  'fa-droplet', 'fa-face-smile', 'fa-shield-virus', 'fa-shower', 'fa-hand-sparkles',
  'fa-om', 'fa-circle-dot', 'fa-bath', 'fa-hot-tub', 'fa-utensils', 'fa-plane',
  'fa-car', 'fa-building', 'fa-briefcase', 'fa-clock', 'fa-calendar-week',
  'fa-mug-hot', 'fa-masks-theater', 'fa-users', 'fa-people-group', 'fa-venus-double',
  'fa-tshirt', 'fa-shoe-prints', 'fa-moon', 'fa-tint', 'fa-link', 'fa-arrow-right',
  'fa-hand-fist', 'fa-circle', 'fa-house', 'fa-hotel', 'fa-eye', 'fa-eye-slash',
  'fa-shuffle', 'fa-user-tie', 'fa-baby', 'fa-comment-slash', 'fa-video', 'fa-camera',
  'fa-film', 'fa-comments', 'fa-wifi', 'fa-wine-glass'
];

function renderIcon(icono?: string) {
  return icono?.startsWith('fa-') ? icono : `fa-${icono || 'tag'}`;
}

function generateSlug(nombre: string) {
  return nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function ServiciosData() {
  const [items, setItems] = useState<Servicio[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activos: 0, inactivos: 0, adicionales: 0, incluidos: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [grupoFilter, setGrupoFilter] = useState('todos');
  const [filtro, setFiltro] = useState('todos');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [gruposDisponibles, setGruposDisponibles] = useState<string[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Servicio | null>(null);
  const [formData, setFormData] = useState({
    nombre: '', slug: '', descripcion: '', descripcion_corta: '',
    grupo: 'sexual', icono: 'fa-tag', color: '#6366f1',
    tipicamente_adicional: 0, orden: 0, activo: 1
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Servicio | null>(null);
  const [deleting, setDeleting] = useState(false);

  const initialLoadRef = useRef(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: pagination.page.toString(), limit: pagination.limit.toString(), filtro, search });
      if (grupoFilter !== 'todos') params.set('grupo', grupoFilter);
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setItems(data.servicios || []);
      setStats(data.stats || { total: 0, activos: 0, inactivos: 0, adicionales: 0, incluidos: 0 });
      setPagination(data.pagination || pagination);
      setGruposDisponibles(data.grupos || []);
    } catch (err: any) {
      setError(err.message);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filtro, grupoFilter, search]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    fetchItems();
  }, []);

  useEffect(() => {
    if (!initialLoadRef.current) return;
    fetchItems();
  }, [filtro, grupoFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    if (!initialLoadRef.current) return;
    const timer = setTimeout(() => { setPagination(prev => ({ ...prev, page: 1 })); fetchItems(); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ nombre: '', slug: '', descripcion: '', descripcion_corta: '', grupo: 'sexual', icono: 'fa-tag', color: '#6366f1', tipicamente_adicional: 0, orden: 0, activo: 1 });
    setEditingItem(null);
    setFieldErrors({});
    setShowModal(true);
  };

  const openEditModal = (item: Servicio) => {
    setModalMode('edit');
    setFormData({
      nombre: item.nombre,
      slug: item.slug || '',
      descripcion: item.descripcion || '',
      descripcion_corta: item.descripcion_corta || '',
      grupo: item.grupo || 'sexual',
      icono: item.icono?.startsWith('fa-') ? item.icono : `fa-${item.icono || 'tag'}`,
      color: item.color || '#6366f1',
      tipicamente_adicional: item.tipicamente_adicional ?? 0,
      orden: item.orden ?? 0,
      activo: item.activo
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
      const dataToSend: any = { ...formData };
      if (!dataToSend.slug && dataToSend.nombre) dataToSend.slug = generateSlug(dataToSend.nombre);
      dataToSend.tipicamente_adicional = parseInt(dataToSend.tipicamente_adicional);
      dataToSend.orden = parseInt(dataToSend.orden);
      dataToSend.activo = parseInt(dataToSend.activo);
      const body = modalMode === 'edit' ? JSON.stringify({ ...dataToSend, id: editingItem?.id }) : JSON.stringify(dataToSend);
      const res = await fetch(API_URL, { method: modalMode === 'edit' ? 'PUT' : 'POST', headers: getAuthHeaders(), body });
      const data = await res.json();
      if (!data.success) {
        if (data.fieldErrors) { setFieldErrors(data.fieldErrors); setSaving(false); return; }
        throw new Error(data.error || 'Error al guardar');
      }
      showNotification(modalMode === 'create' ? 'Servicio creado correctamente' : 'Servicio actualizado correctamente');
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
      showNotification('Servicio eliminado correctamente');
      setDeleteConfirm(null);
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setError(err.message); }
    finally { setDeleting(false); }
  };

  const toggleActivo = async (item: Servicio) => {
    try {
      const res = await fetch(API_URL, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ id: item.id, activo: item.activo ? 0 : 1 }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showNotification(`Servicio ${item.activo ? 'desactivado' : 'activado'} correctamente`);
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setError(err.message); }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getActions = (item: Servicio): ActionItem[] => [
    { label: 'Editar', icon: 'fa-edit', onClick: () => openEditModal(item) },
    { label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setDeleteConfirm(item) },
  ];

  const columns: Column<Servicio>[] = [
    {
      key: 'nombre',
      header: 'Servicio',
      width: '240',
      render: (item: Servicio) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (item.color || '#6366f1') + '20' }}>
            <i className={`fas ${renderIcon(item.icono)}`} style={{ color: item.color || '#6366f1' }}></i>
          </div>
          <div>
            <div className="font-medium text-white text-sm">{item.nombre}</div>
            <div className="text-xs text-gray-500">/{item.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'grupo',
      header: 'Grupo',
      width: '140',
      render: (item: Servicio) => {
        const grupoInfo = GRUPOS[item.grupo] || { label: item.grupo, color: '#6366f1' };
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: grupoInfo.color + '20', color: grupoInfo.color }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: grupoInfo.color }}></div>
            {grupoInfo.label}
          </span>
        );
      },
    },
    {
      key: 'descripcion_corta',
      header: 'Descripción',
      width: '220',
      render: (item: Servicio) => <span className="text-gray-300 text-sm line-clamp-2">{item.descripcion_corta || item.descripcion || '-'}</span>,
    },
    {
      key: 'tipicamente_adicional',
      header: 'Tipo',
      width: '110',
      align: 'center',
      render: (item: Servicio) => item.tipicamente_adicional ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs"><i className="fas fa-plus-circle text-[10px]"></i>Adicional</span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs"><i className="fas fa-check-circle text-[10px]"></i>Incluido</span>
      ),
    },
    {
      key: 'activo',
      header: 'Estado',
      width: '100',
      align: 'center',
      render: (item: Servicio) => (
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
      render: (item: Servicio) => (
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
            <i className="fas fa-concierge-bell text-yellow-400"></i> Servicios
          </h1>
          <p className="text-gray-400 mt-1">Administra los servicios disponibles en la plataforma</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-semibold rounded-lg transition-all shadow-lg shadow-yellow-500/20">
          <i className="fas fa-plus"></i> Nuevo Servicio
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Servicios" value={stats.total} icon="fa-list" color="#3b82f6" loading={isLoading} />
        <StatCard label="Activos" value={stats.activos} icon="fa-toggle-on" color="#22c55e" loading={isLoading} />
        <StatCard label="Inactivos" value={stats.inactivos} icon="fa-toggle-off" color="#6b7280" loading={isLoading} />
        <StatCard label="Adicionales" value={stats.adicionales} icon="fa-plus-circle" color="#f97316" loading={isLoading} />
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error}</div>}

      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar servicio..."
        filters={[
          { key: 'todos', label: 'Todos' },
          { key: 'activos', label: 'Activos' },
          { key: 'inactivos', label: 'Inactivos' },
          { key: 'adicionales', label: 'Adicionales' },
          { key: 'incluidos', label: 'Incluidos' },
        ]}
        activeFilter={filtro}
        onFilterChange={setFiltro}
      />
      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar servicio..."
        hideSearch
        filters={[
          { key: 'todos', label: 'Todos los grupos' },
          ...Object.entries(GRUPOS).map(([key, g]) => ({ key, label: g.label })),
        ]}
        activeFilter={grupoFilter}
        onFilterChange={setGrupoFilter}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron servicios' : 'No hay servicios registrados'}
        emptyIcon="fa-concierge-bell"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-2xl shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">{modalMode === 'create' ? 'Nuevo Servicio' : 'Editar Servicio'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[#2d2d44] text-gray-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              {fieldErrors.general && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"><i className="fas fa-exclamation-circle"></i>{fieldErrors.general}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre <span className="text-red-400">*</span></label>
                <input type="text" value={formData.nombre} onChange={(e) => { setFormData(prev => ({ ...prev, nombre: e.target.value })); if (fieldErrors.nombre) setFieldErrors(prev => { const n = { ...prev }; delete n.nombre; return n; }); }} placeholder="Ej: Sexo anal"
                  className={`w-full px-4 py-2.5 bg-[#0f0f23] border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors ${fieldErrors.nombre ? 'border-red-500' : 'border-gray-700'}`} />
                {fieldErrors.nombre && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Slug <span className="text-gray-500 text-xs">(auto)</span></label>
                <input type="text" value={formData.slug} onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))} placeholder="sexo-anal"
                  className={`w-full px-4 py-2.5 bg-[#0f0f23] border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors ${fieldErrors.slug ? 'border-red-500' : 'border-gray-700'}`} />
                {fieldErrors.slug && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors.slug}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción corta</label>
                <input type="text" value={formData.descripcion_corta} onChange={(e) => setFormData(prev => ({ ...prev, descripcion_corta: e.target.value }))} placeholder="Breve descripción para la lista"
                  className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción completa</label>
                <textarea value={formData.descripcion} onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))} placeholder="Descripción detallada del servicio..." rows={3}
                  className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Grupo</label>
                <select value={formData.grupo} onChange={(e) => setFormData(prev => ({ ...prev, grupo: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors">
                  {Object.entries(GRUPOS).map(([key, g]) => (<option key={key} value={key}>{g.label}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Icono</label>
                <div className="grid grid-cols-10 gap-2 max-h-40 overflow-y-auto p-2 bg-[#0f0f23] rounded-lg border border-gray-700">
                  {iconOptions.map(icon => (
                    <button key={icon} type="button" onClick={() => setFormData(prev => ({ ...prev, icono: icon }))}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-center ${formData.icono === icon ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400 shadow-lg shadow-yellow-500/10' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:bg-[#2d2d44]'}`} title={icon}>
                      <i className={`fas ${icon} text-sm`}></i>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={formData.color} onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))} className="w-12 h-10 rounded-lg bg-transparent border border-gray-700 cursor-pointer" />
                  <input type="text" value={formData.color} onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))} placeholder="#6366f1" className="flex-1 px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo</label>
                  <select value={formData.tipicamente_adicional} onChange={(e) => setFormData(prev => ({ ...prev, tipicamente_adicional: parseInt(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors">
                    <option value={0}>Incluido</option>
                    <option value={1}>Adicional</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Orden</label><input type="number" value={formData.orden} onChange={(e) => setFormData(prev => ({ ...prev, orden: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors" /></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label><select value={formData.activo} onChange={(e) => setFormData(prev => ({ ...prev, activo: parseInt(e.target.value) }))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors"><option value={1}>Activo</option><option value={0}>Inactivo</option></select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-semibold rounded-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20">
                  {saving && <i className="fas fa-circle-notch fa-spin"></i>}{saving ? 'Guardando...' : modalMode === 'create' ? 'Crear' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="¿Eliminar servicio?"
        message={`Estás a punto de eliminar <strong>${deleteConfirm?.nombre || ''}</strong>.${(deleteConfirm?.total_escorts ?? 0) > 0 ? ` Este servicio tiene ${deleteConfirm?.total_escorts} escort(s) asociada(s).` : ' Esta acción no se puede deshacer.'}`}
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
