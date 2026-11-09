import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';

interface Articulo {
  id: number;
  titulo: string;
  slug: string;
  imagen: string;
  extracto: string;
  contenido: string;
  autor: string;
  categoria_id: number | null;
  categoria_nombre: string;
  etiquetas: string;
  estado: 'borrador' | 'publicado' | 'archivado';
  destacado: number;
  vistas: number;
  meta_titulo: string;
  meta_descripcion: string;
  meta_keywords: string;
  url_externa: string;
  robots: 'index' | 'noindex';
  canonical: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

interface Stats {
  total: number;
  publicados: number;
  borradores: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

const API_URL = '/api/admin/articulos.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function getAuthHeadersForm(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Authorization': `Bearer ${token}` };
}

function generateSlug(nombre: string) {
  return nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function decodeHtml(html: string) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

interface FormState {
  titulo: string;
  slug: string;
  imagen: string;
  extracto: string;
  contenido: string;
  autor: string;
  categoria_id: number | null;
  etiquetas: string;
  estado: string;
  destacado: number;
  meta_titulo: string;
  meta_descripcion: string;
  meta_keywords: string;
  url_externa: string;
  robots: string;
  canonical: string;
  ciudad_id: number | null;
}

const EMPTY_FORM: FormState = {
  titulo: '',
  slug: '',
  imagen: '',
  extracto: '',
  contenido: '',
  autor: '',
  categoria_id: null,
  etiquetas: '',
  estado: 'borrador',
  destacado: 0,
  meta_titulo: '',
  meta_descripcion: '',
  meta_keywords: '',
  url_externa: '',
  robots: 'index',
  canonical: '',
  ciudad_id: null,
};

export default function ArticulosData() {
  const [items, setItems] = useState<Articulo[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, publicados: 0, borradores: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('todos');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ciudades, setCiudades] = useState<{ id: number; nombre: string }[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Articulo | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [showSeo, setShowSeo] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Articulo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<{ ids: (string | number)[]; message: string } | null>(null);

  const [showCatModal, setShowCatModal] = useState(false);
  const [catNombre, setCatNombre] = useState('');
  const [catDescripcion, setCatDescripcion] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  const initialLoadRef = useRef(false);

  // Quill
  const editorRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<any>(null);
  const [quillReady, setQuillReady] = useState(false);
  const quillContenidoRef = useRef('');

  const cargarQuill = () => {
    if ((window as any).Quill) { setQuillReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js';
    script.onload = () => setQuillReady(true);
    document.body.appendChild(script);
  };

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}?accion=categorias`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setCategorias(data.categorias || []);
    } catch {}
  }, []);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: pagination.page.toString(), limit: pagination.limit.toString(), estado, search });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setItems(data.articulos || []);
      setStats(data.stats || { total: 0, publicados: 0, borradores: 0 });
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
    fetchCategorias();
    fetch('/api/ciudades/listado.php')
      .then(r => r.json())
      .then(d => { if (d?.success) setCiudades(d.data || []); })
      .catch(() => {});
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

  // Quill init dentro del modal
  useEffect(() => {
    if (!showModal) return;
    cargarQuill();
  }, [showModal]);

  useEffect(() => {
    if (!quillReady || !showModal || !editorRef.current || quillRef.current) return;
    const Quill = (window as any).Quill;
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      placeholder: 'Escribe el contenido del artículo...',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block'],
          ['link', 'image', 'video'],
          ['clean']
        ]
      }
    });
    quill.on('text-change', () => {
      setFormData(prev => ({ ...prev, contenido: quill.root.innerHTML }));
    });
    if (quillContenidoRef.current) {
      quill.clipboard.dangerouslyPasteHTML(decodeHtml(quillContenidoRef.current));
      const actual = quill.root.innerHTML;
      setFormData(prev => ({ ...prev, contenido: actual }));
    }
    quillRef.current = quill;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quillReady, showModal, modalMode]);

  const resetQuill = () => { quillRef.current = null; setFormData(prev => ({ ...prev, contenido: quillContenidoRef.current || '' })); };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingItem(null);
    quillContenidoRef.current = '';
    setFormData(EMPTY_FORM);
    setFieldErrors({});
    setShowSeo(false);
    resetQuill();
    setShowModal(true);
  };

  const openEditModal = (item: Articulo) => {
    setModalMode('edit');
    setEditingItem(item);
    quillContenidoRef.current = item.contenido || '';
    setFormData({
      titulo: item.titulo || '',
      slug: item.slug || generateSlug(item.titulo),
      imagen: item.imagen || '',
      extracto: item.extracto || '',
      contenido: item.contenido || '',
      autor: item.autor || '',
      categoria_id: item.categoria_id,
      etiquetas: item.etiquetas || '',
      estado: item.estado || 'borrador',
      destacado: item.destacado ?? 0,
      meta_titulo: item.meta_titulo || '',
      meta_descripcion: item.meta_descripcion || '',
      meta_keywords: item.meta_keywords || '',
      url_externa: item.url_externa || '',
      robots: item.robots || 'index',
      canonical: item.canonical || '',
    });
    setFieldErrors({});
    setShowSeo(false);
    resetQuill();
    setShowModal(true);
    fetchCategorias();
  };

  const closeModal = () => {
    setShowModal(false);
    quillRef.current = null;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const res = await fetch('/api/admin/upload-imagen.php', { method: 'POST', headers: getAuthHeadersForm(), body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al subir imagen');
      setFormData(prev => ({ ...prev, imagen: data.url }));
      showNotification('Imagen subida correctamente');
    } catch (err: any) {
      setFieldErrors({ imagen: err.message });
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFieldErrors({});
    setSaving(true);
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.slug && dataToSend.titulo) dataToSend.slug = generateSlug(dataToSend.titulo);
      const body = modalMode === 'edit' ? JSON.stringify({ ...dataToSend, id: editingItem?.id }) : JSON.stringify(dataToSend);
      const res = await fetch(API_URL, { method: modalMode === 'edit' ? 'PUT' : 'POST', headers: getAuthHeaders(), body });
      const data = await res.json();
      if (!data.success) {
        if (data.fieldErrors) { setFieldErrors(data.fieldErrors); setSaving(false); return; }
        throw new Error(data.error || 'Error al guardar');
      }
      showNotification(modalMode === 'create' ? 'Artículo creado correctamente' : 'Artículo actualizado correctamente');
      closeModal();
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
      showNotification('Artículo eliminado correctamente');
      setDeleteConfirm(null);
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setError(err.message); }
    finally { setDeleting(false); }
  };

  const handleBulkDelete = (sel: Set<string | number>) => {
    if (sel.size === 0) return;
    setBulkConfirm({
      ids: Array.from(sel),
      message: `Estas a punto de eliminar ${sel.size} articulo(s) seleccionado(s). Esta accion no se puede deshacer.`,
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
      showNotification(`${ids.length} articulo(s) eliminado(s) correctamente`);
      setSelected(new Set());
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setError(err.message); }
    finally { setBulkDeleting(false); }
  };

  const toggleDestacado = async (item: Articulo) => {
    try {
      const res = await fetch(API_URL, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ id: item.id, destacado: item.destacado ? 0 : 1 }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showNotification(`Artículo ${item.destacado ? 'quité' : 'marcado'} como destacado`);
      fetchItems();
    } catch (err: any) { setError(err.message); }
  };

  const changeEstado = async (item: Articulo, nuevoEstado: string) => {
    try {
      const res = await fetch(API_URL, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ id: item.id, estado: nuevoEstado }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showNotification(`Estado cambiado a ${nuevoEstado}`);
      fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) { setError(err.message); }
  };

  const crearCategoria = async () => {
    if (!catNombre.trim()) return;
    setCatSaving(true);
    try {
      const res = await fetch(API_URL, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ tipo: 'categoria', nombre: catNombre, descripcion: catDescripcion }) });
      const data = await res.json();
      if (!data.success) { setError(data.error || (data.fieldErrors?.nombre || 'Error')); setCatSaving(false); return; }
      await fetchCategorias();
      setCatNombre('');
      setCatDescripcion('');
      setShowCatModal(false);
      showNotification('Categoría creada');
    } catch (err: any) { setError(err.message); }
    finally { setCatSaving(false); }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getActions = (item: Articulo): ActionItem[] => [
    { label: 'Editar', icon: 'fa-edit', onClick: () => openEditModal(item) },
    {
      label: item.estado === 'publicado' ? 'Archivar' : 'Publicar',
      icon: item.estado === 'publicado' ? 'fa-archive' : 'fa-check',
      onClick: () => changeEstado(item, item.estado === 'publicado' ? 'archivado' : 'publicado'),
    },
    { label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setDeleteConfirm(item) },
  ];

  const columns: Column<Articulo>[] = [
    {
      key: 'titulo',
      header: 'Artículo',
      width: '260',
      render: (item: Articulo) => (
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-[#2d2d44] flex items-center justify-center overflow-hidden flex-shrink-0">
            {item.imagen ? (
              <img src={item.imagen} alt={item.titulo} className="w-full h-full object-cover" />
            ) : (
              <i className="fas fa-newspaper text-gray-500"></i>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-white text-sm line-clamp-1">{item.titulo}</div>
            <div className="text-xs text-gray-500">/{item.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'categoria_nombre',
      header: 'Categoría',
      width: '130',
      render: (item: Articulo) => <span className="text-sm text-gray-300">{item.categoria_nombre || <span className="text-gray-500">—</span>}</span>,
    },
    {
      key: 'destacado',
      header: 'Destacado',
      width: '90',
      align: 'center',
      render: (item: Articulo) => (
        <button onClick={() => toggleDestacado(item)} title={item.destacado ? 'Quitar destacado' : 'Marcar destacado'}>
          <i className={`fas fa-star text-xl ${item.destacado ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'} transition-colors`}></i>
        </button>
      ),
    },
    {
      key: 'vistas',
      header: 'Vistas',
      width: '90',
      align: 'center',
      render: (item: Articulo) => (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2d2d44]">
          <i className="fas fa-eye text-gray-400 text-xs"></i>
          <span className="text-sm font-medium text-gray-300">{item.vistas ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '120',
      align: 'center',
      render: (item: Articulo) => {
        const map: Record<string, string> = {
          publicado: 'bg-green-500/15 text-green-400 border-green-500/30',
          borrador: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
          archivado: 'bg-red-500/15 text-red-400 border-red-500/30',
        };
        return (
          <span className={`px-3 py-1 rounded-full border text-xs font-medium capitalize ${map[item.estado] || ''}`}>{item.estado}</span>
        );
      },
    },
  ];

  const inputCls = (name: string) =>
    `w-full px-4 py-2.5 bg-[#0f0f23] border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors ${fieldErrors[name] ? 'border-red-500' : 'border-gray-700'}`;

  const errMsg = (name: string) =>
    fieldErrors[name] && <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1"><i className="fas fa-exclamation-circle text-xs"></i>{fieldErrors[name]}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-newspaper text-yellow-400"></i> Artículos
          </h1>
          <p className="text-gray-400 mt-1">Administra los artículos del blog (se muestran en el homepage)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCatModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors">
            <i className="fas fa-tags"></i> Categorías
          </button>
          <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-semibold rounded-lg transition-all shadow-lg shadow-yellow-500/20">
            <i className="fas fa-plus"></i> Nuevo Artículo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Artículos" value={stats.total} icon="fa-newspaper" color="#eab308" loading={isLoading} />
        <StatCard label="Publicados" value={stats.publicados} icon="fa-check-circle" color="#22c55e" loading={isLoading} />
        <StatCard label="Borradores" value={stats.borradores} icon="fa-pen" color="#3b82f6" loading={isLoading} />
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error}</div>}

      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por título, slug o autor..."
        filters={[
          { key: 'todos', label: 'Todos' },
          { key: 'publicado', label: 'Publicados' },
          { key: 'borrador', label: 'Borradores' },
          { key: 'archivado', label: 'Archivados' },
        ]}
        activeFilter={estado}
        onFilterChange={(key) => { setEstado(key); setPagination(prev => ({ ...prev, page: 1 })); }}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron artículos' : 'No hay artículos registrados'}
        emptyIcon="fa-newspaper"
        getRowKey={(item) => item.id}
        selectable
        selected={selected}
        onSelectionChange={setSelected}
        onBulkDelete={handleBulkDelete}
        getActions={getActions}
      />

      <ConfirmModal
        isOpen={bulkConfirm !== null}
        title="Eliminar seleccionados"
        message={bulkConfirm?.message || ''}
        confirmText={bulkDeleting ? 'Eliminando...' : 'Eliminar'}
        cancelText="Cancelar"
        variant="danger"
        confirmDisabled={bulkDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkConfirm(null)}
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
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-lg font-bold text-white">{modalMode === 'create' ? 'Nuevo Artículo' : 'Editar Artículo'}</h2>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-[#2d2d44] text-gray-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handleSave} className="space-y-4">
                {fieldErrors.general && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"><i className="fas fa-exclamation-circle"></i>{fieldErrors.general}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Título <span className="text-red-400">*</span></label>
                  <input type="text" value={formData.titulo} onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))} placeholder="Ej: 5 consejos para una cita perfecta"
                    className={inputCls('titulo')} />
                  {errMsg('titulo')}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Slug <span className="text-gray-500 text-xs">(auto)</span></label>
                  <input type="text" value={formData.slug} onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))} placeholder="5-consejos-para-una-cita-perfecta"
                    className={inputCls('slug')} />
                  {errMsg('slug')}
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">URL del artículo:</span>
                    <code className="text-gray-300 bg-[#0f0f23] px-2 py-1 rounded break-all">{(window.location.origin || 'https://www.consexvip.cl') + '/blog/' + (formData.slug || generateSlug(formData.titulo))}</code>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Imagen de portada</label>
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-20 rounded-xl bg-[#0f0f23] border border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {formData.imagen ? <img src={formData.imagen} alt="Portada" className="w-full h-full object-cover" /> : <i className="fas fa-image text-gray-600"></i>}
                    </div>
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                        {uploadingImg ? <><i className="fas fa-circle-notch fa-spin"></i> Subiendo...</> : <><i className="fas fa-upload"></i> Subir imagen</>}
                        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploadingImg} />
                      </label>
                      <input type="text" value={formData.imagen} onChange={(e) => setFormData(prev => ({ ...prev, imagen: e.target.value }))} placeholder="/uploads/blog/..." className={`mt-2 w-full px-3 py-2 bg-[#0f0f23] border rounded-lg text-xs text-white focus:outline-none ${fieldErrors.imagen ? 'border-red-500' : 'border-gray-700'}`} />
                    </div>
                  </div>
                  {errMsg('imagen')}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Autor</label>
                    <input type="text" value={formData.autor} onChange={(e) => setFormData(prev => ({ ...prev, autor: e.target.value }))} placeholder="Ej: Equipo ConsexVIP" className={inputCls('autor')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Categoría</label>
                    <select value={formData.categoria_id ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, categoria_id: e.target.value ? parseInt(e.target.value) : null }))} className={inputCls('categoria_id')}>
                      <option value="">Sin categoría</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Ciudad (opcional)</label>
                    <select value={formData.ciudad_id ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, ciudad_id: e.target.value ? parseInt(e.target.value) : null }))} className={inputCls('ciudad_id')}>
                      <option value="">Todas las ciudades</option>
                      {ciudades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Extracto / Resumen</label>
                  <textarea value={formData.extracto} onChange={(e) => setFormData(prev => ({ ...prev, extracto: e.target.value }))} placeholder="Breve resumen que se muestra como tarjeta..." rows={2}
                    className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors resize-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Contenido (HTML)</label>
                  <div className="quill-dark rounded-xl overflow-hidden border border-gray-700">
                    <div ref={editorRef}></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label>
                    <select value={formData.estado} onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))} className={inputCls('estado')}>
                      <option value="borrador">Borrador</option>
                      <option value="publicado">Publicado</option>
                      <option value="archivado">Archivado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Destacado</label>
                    <select value={formData.destacado} onChange={(e) => setFormData(prev => ({ ...prev, destacado: parseInt(e.target.value) }))} className={inputCls('destacado')}>
                      <option value={0}>No</option>
                      <option value={1}>Sí</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Etiquetas</label>
                    <input type="text" value={formData.etiquetas} onChange={(e) => setFormData(prev => ({ ...prev, etiquetas: e.target.value }))} placeholder="consejos, citas" className={inputCls('etiquetas')} />
                  </div>
                </div>

                {/* SEO */}
                <div className="border border-gray-700 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => setShowSeo(!showSeo)} className="w-full flex items-center justify-between px-4 py-3 bg-[#0f0f23] text-sm font-medium text-gray-200 hover:bg-[#13132b] transition-colors">
                    <span className="flex items-center gap-2"><i className="fas fa-search text-blue-400"></i> SEO (Título, Descripción, Enlace)</span>
                    <i className={`fas fa-chevron-down transition-transform ${showSeo ? '-rotate-180' : ''}`}></i>
                  </button>
                  {showSeo && (
                    <div className="p-4 space-y-4 bg-[#131318]">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Enlace externo <span className="text-xs text-gray-500">— opcional. Si se ingresa (https://), la tarjeta también ofrece "Ir al sitio". Si está vacío, el artículo se enlaza a su URL /blog/{slug}.</span></label>
                        <input type="text" value={formData.url_externa} onChange={(e) => setFormData(prev => ({ ...prev, url_externa: e.target.value }))} placeholder="https://..." className={inputCls('url_externa')} />
                        {errMsg('url_externa')}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1.5">Meta Título</label>
                          <input type="text" value={formData.meta_titulo} onChange={(e) => setFormData(prev => ({ ...prev, meta_titulo: e.target.value }))} className={inputCls('meta_titulo')} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1.5">Robots</label>
                          <select value={formData.robots} onChange={(e) => setFormData(prev => ({ ...prev, robots: e.target.value }))} className={inputCls('robots')}>
                            <option value="index">index, follow</option>
                            <option value="noindex">noindex</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Meta Descripción</label>
                        <textarea value={formData.meta_descripcion} onChange={(e) => setFormData(prev => ({ ...prev, meta_descripcion: e.target.value }))} rows={2} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-500 transition-colors resize-none" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1.5">Meta Keywords</label>
                          <input type="text" value={formData.meta_keywords} onChange={(e) => setFormData(prev => ({ ...prev, meta_keywords: e.target.value }))} className={inputCls('meta_keywords')} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1.5">Canonical</label>
                          <input type="text" value={formData.canonical} onChange={(e) => setFormData(prev => ({ ...prev, canonical: e.target.value }))} placeholder="https://..." className={inputCls('canonical')} />
                          {errMsg('canonical')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex gap-3 flex-shrink-0">
              <button type="button" onClick={closeModal} className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors">Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-semibold rounded-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20">
                {saving && <i className="fas fa-circle-notch fa-spin"></i>}{saving ? 'Guardando...' : modalMode === 'create' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><i className="fas fa-tags text-yellow-400"></i> Categorías</h3>
              <button onClick={() => setShowCatModal(false)} className="p-1 rounded-lg hover:bg-[#2d2d44] text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            <div className="mb-4 max-h-48 overflow-y-auto space-y-1.5 border border-gray-800 rounded-lg p-2">
              {categorias.length === 0 && <p className="text-gray-500 text-sm px-2 py-2">Sin categorías</p>}
              {categorias.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0f0f23]">
                  <span className="text-sm text-gray-200">{c.nombre}</span>
                  <span className="text-xs text-gray-500">/{c.slug}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <input type="text" value={catNombre} onChange={(e) => setCatNombre(e.target.value)} placeholder="Nueva categoría" className={inputCls('catNombre')} />
              <input type="text" value={catDescripcion} onChange={(e) => setCatDescripcion(e.target.value)} placeholder="Descripción (opcional)" className={inputCls('catDescripcion')} />
              <button onClick={crearCategoria} disabled={catSaving || !catNombre.trim()} className="w-full px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {catSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-plus"></i>} Agregar categoría
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="¿Eliminar artículo?"
        message={`Estás a punto de eliminar <strong>${deleteConfirm?.titulo || ''}</strong>. Esta acción no se puede deshacer.`}
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        cancelText="Cancelar"
        variant="danger"
        confirmDisabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
