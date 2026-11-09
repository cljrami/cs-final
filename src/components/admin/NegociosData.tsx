import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';
import AutocompleteField from '../ui/AutocompleteField';

interface Negocio {
  id: number;
  nombre: string;
  slug: string;
  categoria: string;
  ciudad_nombre?: string;
  activo: number;
  destacado: number;
}

interface Stats {
  total: number;
  activos: number;
  destacados: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const API_URL = '/api/admin/negocios.php';

const fmtCLP = (n:number) => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(Number(n)||0);

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

export default function NegociosData() {
  const [items, setItems] = useState<Negocio[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, activos: 0, destacados: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('todos');
  const [categoria, setCategoria] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [mainTab, setMainTab] = useState<'negocios'|'categorias'|'planes'|'ciudades'>('negocios');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create'|'edit'>('create');
  const [editingItem, setEditingItem] = useState<Negocio|null>(null);
  const [activeTab, setActiveTab] = useState<'info'|'seo'>('info');
  const [formData, setFormData] = useState({ nombre: '', categoria: 'otro', ciudad_id: 0, ciudad_nombre: '', activo: 1, destacado: 0, direccion: '', telefono: '', whatsapp: '', web: '', instagram: '', descripcion: '', seo_title:'', seo_description:'', seo_keywords:'', seo_og_image:'', plan_id:0 });
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const [ciudades, setCiudades] = useState<{id:number,nombre:string}[]>([]);
  const [ciudadQuery, setCiudadQuery] = useState('');
  const [dropFiles, setDropFiles] = useState<File[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<Negocio|null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categorias, setCategorias] = useState<{id:number,nombre:string,slug:string,icono?:string,color?:string,activa?:number,orden?:number}[]>([]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ id:0, nombre:'', slug:'', icono:'fa-store', color:'#64748b', activa:1, orden:0 });
  const [catMode, setCatMode] = useState<'create'|'edit'>('create');
  const [duplicateCat, setDuplicateCat] = useState<string|null>(null);
  const [planes, setPlanes] = useState<{id:number,nombre:string,duracion:string,valor:number,activo:number,orden:number}[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({ id:0, nombre:'', duracion:'mensual', valor:0, activo:1, orden:0 });
  const [planMode, setPlanMode] = useState<'create'|'edit'>('create');
  const [ciudadesAdmin, setCiudadesAdmin] = useState<{id:number,nombre:string,slug:string,activa:number}[]>([]);
  const [showCiudadModal, setShowCiudadModal] = useState(false);
  const [ciudadForm, setCiudadForm] = useState({ id:0, nombre:'', slug:'', activa:1 });
  const [ciudadMode, setCiudadMode] = useState<'create'|'edit'>('create');
  const [showPageSeoModal, setShowPageSeoModal] = useState(false);
  const [pageSeo, setPageSeo] = useState({ meta_title:'', meta_description:'', meta_keywords:'', og_image:'' });
  const initialLoadRef = useRef(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: pagination.page.toString(), limit: pagination.limit.toString(), estado, search, categoria });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setItems(data.negocios || []);
      setStats(data.stats || { total: 0, activos: 0, destacados: 0 });
      setPagination(p => ({ ...p, total: data.pagination.total, pages: data.pagination.pages }));
    } catch (err:any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, estado, search, categoria]);

  useEffect(()=>{ if (!initialLoadRef.current){ initialLoadRef.current=true; fetchItems(); } }, []);
  useEffect(()=>{ if (!initialLoadRef.current) return; fetchItems(); }, [estado, pagination.page, categoria]);
  useEffect(()=>{ if (!initialLoadRef.current) return; const t=setTimeout(()=>{ setPagination(p=>({...p, page:1})); fetchItems(); },400); return ()=>clearTimeout(t); }, [search]);

  const showNotification = (msg:string)=>{ setSuccessMsg(msg); setTimeout(()=>setSuccessMsg(''),3000); };

  const loadCiudades = async () => {
    try {
      const r = await fetch('/api/negocios/ciudades.php');
      const d = await r.json();
      if (d.success) setCiudades(d.ciudades || []);
    } catch {}
  };

  const loadCategorias = async () => {
    try {
      const r = await fetch('/api/admin/negocios-categorias.php', { headers: getAuthHeaders() });
      const d = await r.json();
      if (d.success) setCategorias(d.categorias || []);
    } catch {}
  };

  const loadPlanes = async () => {
    try {
      const r = await fetch(`/api/admin/negocios-planes.php`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (d.success) setPlanes(d.planes || []);
    } catch {}
  };

  const loadCiudadesAdmin = async () => {
    try {
      const r = await fetch('/api/admin/ciudades.php', { headers: getAuthHeaders() });
      const d = await r.json();
      if (d.success) setCiudadesAdmin(d.ciudades || []);
    } catch {}
  };

  const loadPageSeo = async () => {
    try {
      const r = await fetch('/api/admin/admin-seo.php?seccion=negocios_admin', { headers: getAuthHeaders() });
      const d = await r.json();
      if (d.success && d.seo) setPageSeo({ meta_title:d.seo.meta_title||'', meta_description:d.seo.meta_description||'', meta_keywords:d.seo.meta_keywords||'', og_image:d.seo.og_image||'' });
    } catch {}
  };

  const openCreateModal = () => {
    setModalMode('create'); setActiveTab('info'); setFormData({ nombre:'', categoria:'otro', ciudad_id:0, ciudad_nombre:'', activo:1, destacado:0, direccion:'', telefono:'', whatsapp:'', web:'', instagram:'', descripcion:'', seo_title:'', seo_description:'', seo_keywords:'', seo_og_image:'', plan_id:0 }); setEditingItem(null); setFieldErrors({}); setCiudadQuery(''); setDropFiles([]); loadCiudades(); loadCategorias(); setShowModal(true);
  };
  const openEditModal = async (item:Negocio) => {
    setModalMode('edit'); setActiveTab('info'); setEditingItem(item); setFieldErrors({}); setCiudadQuery(item.ciudad_nombre||''); setDropFiles([]); loadCiudades(); loadCategorias();
    try {
      const res = await fetch(`/api/negocios/ficha.php?slug=${encodeURIComponent(item.slug)}`);
      const d = await res.json();
      if (d.success && d.negocio) {
        const n = d.negocio;
        setFormData({ nombre:n.nombre, categoria:n.categoria||'otro', ciudad_id:0, ciudad_nombre:n.ciudad_nombre||'', activo:item.activo, destacado:item.destacado, direccion:n.direccion||'', telefono:n.telefono||'', whatsapp:n.whatsapp||'', web:n.web||'', instagram:n.instagram||'', descripcion:n.descripcion||'', seo_title:n.seo_title||'', seo_description:n.seo_description||'', seo_keywords:n.seo_keywords||'', seo_og_image:n.seo_og_image||'', plan_id:n.plan_id||0 });
        setCiudadQuery(n.ciudad_nombre||'');
      } else {
        setFormData({ nombre:item.nombre, categoria:item.categoria||'otro', ciudad_id:0, ciudad_nombre:item.ciudad_nombre||'', activo:item.activo, destacado:item.destacado, direccion:'', telefono:'', whatsapp:'', web:'', instagram:'', descripcion:'', seo_title:'', seo_description:'', seo_keywords:'', seo_og_image:'', plan_id:0 });
      }
    } catch { setFormData({ nombre:item.nombre, categoria:item.categoria||'otro', ciudad_id:0, ciudad_nombre:item.ciudad_nombre||'', activo:item.activo, destacado:item.destacado, direccion:'', telefono:'', whatsapp:'', web:'', instagram:'', descripcion:'', seo_title:'', seo_description:'', seo_keywords:'', seo_og_image:'', plan_id:0 }); }
    setShowModal(true);
  };

  const handleSave = async (e:React.FormEvent) => {
    e.preventDefault(); setFieldErrors({}); setSaving(true);
    try {
      const body = modalMode==='edit' ? JSON.stringify({ ...formData, id: editingItem?.id }) : JSON.stringify(formData);
      const res = await fetch(API_URL, { method: modalMode==='edit'?'PUT':'POST', headers:getAuthHeaders(), body });
      const data = await res.json();
      if (!data.success) { if (data.fieldErrors) { setFieldErrors(data.fieldErrors); setSaving(false); return; } throw new Error(data.error || 'Error al guardar'); }
      showNotification(modalMode==='create'?'Negocio creado':'Negocio actualizado');
      setShowModal(false); fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err:any) { setFieldErrors({ general: err.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return; setDeleting(true);
    try {
      const res = await fetch(`${API_URL}?id=${deleteConfirm.id}`, { method:'DELETE', headers:getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      showNotification('Negocio eliminado'); setDeleteConfirm(null); fetchItems(); window.dispatchEvent(new Event('counts-refresh'));
    } catch (err:any) { setError(err.message); }
    finally { setDeleting(false); }
  };

  const toggleActivo = async (item:Negocio) => {
    try {
      const res = await fetch(API_URL, { method:'PUT', headers:getAuthHeaders(), body: JSON.stringify({ id:item.id, nombre:item.nombre, categoria:item.categoria, activo:item.activo?0:1, destacado:item.destacado }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showNotification(`Negocio ${item.activo?'desactivado':'activado'}`);
      fetchItems();
    } catch(err:any){ setError(err.message); }
  };

  const handlePageChange = (p:number) => { if (p<1||p>pagination.pages) return; setPagination(prev=>({...prev, page:p})); };

  const getActions = (item:Negocio): ActionItem[] => [
    { label:'Editar', icon:'fa-edit', onClick:()=>openEditModal(item) },
    { label:'Eliminar', icon:'fa-trash-alt', danger:true, onClick:()=>setDeleteConfirm(item) },
  ];

  const columns: Column<Negocio>[] = [
    { key:'nombre', header:'Nombre', width:'260', render:(i)=>(
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><i className="fas fa-store text-red-400"></i></div>
        <div><div className="font-medium text-white text-sm">{i.nombre}</div><div className="text-xs text-gray-500">{i.slug}</div></div>
      </div>
    )},
    { key:'categoria', header:'Categoría', width:'140', render:(i)=><span className="text-sm text-gray-300">{i.categoria}</span> },
    { key:'ciudad_nombre', header:'Ciudad', width:'140', render:(i)=><span className="text-sm text-gray-400">{i.ciudad_nombre||'-'}</span> },
    { key:'destacado', header:'Destacado', width:'100', align:'center', render:(i)=><i className={`fas fa-star ${i.destacado?'text-yellow-400':'text-gray-600'}`}></i> },
    { key:'activo', header:'Estado', width:'100', align:'center', render:(i)=>(
      <button onClick={()=>toggleActivo(i)} className="inline-flex items-center justify-center" title={i.activo?'Desactivar':'Activar'}>
        <i className={`fas fa-toggle-on text-2xl ${i.activo?'text-green-400':'text-gray-500'}`}></i>
      </button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><i className="fas fa-store text-red-400"></i> Negocios</h1><p className="text-gray-400 mt-1">Administra los negocios de la plataforma</p></div>
        <div className="flex gap-2">
          <button onClick={()=>{ loadPageSeo(); setShowPageSeoModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3a3a5a] text-white font-semibold rounded-lg"><i className="fas fa-search"></i> SEO Página</button>
          {mainTab==='negocios' && <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg"><i className="fas fa-plus"></i> Nuevo Negocio</button>}
          {mainTab==='categorias' && <button onClick={()=>{setCatMode('create');setCatForm({id:0,nombre:'',slug:'',icono:'fa-store',color:'#64748b',activa:1,orden:0});setShowCatModal(true);}} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg"><i className="fas fa-plus"></i> Nueva Categoría</button>}
          {mainTab==='planes' && <button onClick={()=>{ setPlanMode('create'); setPlanForm({id:0,nombre:'',duracion:'mensual',valor:0,activo:1,orden:0}); setShowPlanModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg"><i className="fas fa-plus"></i> Nuevo Plan</button>}
          {mainTab==='ciudades' && <button onClick={()=>{setCiudadMode('create');setCiudadForm({id:0,nombre:'',slug:'',activa:1});setShowCiudadModal(true);}} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg"><i className="fas fa-plus"></i> Nueva Ciudad</button>}
        </div>
      </div>

      <div className="flex border-b border-gray-700">
        {(['negocios','categorias','planes','ciudades'] as const).map(t=>(
          <button key={t} onClick={()=>{setMainTab(t); if(t==='categorias') loadCategorias(); if(t==='planes') loadPlanes(); if(t==='ciudades') loadCiudadesAdmin();}} className={`px-4 py-2 text-sm capitalize ${mainTab===t?'text-white border-b-2 border-red-500':'text-gray-400'}`}>{t}</button>
        ))}
      </div>

      {mainTab==='negocios' && (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Negocios" value={stats.total} icon="fa-store" color="#ef4444" loading={isLoading} />
          <StatCard label="Activos" value={stats.activos} icon="fa-toggle-on" color="#22c55e" loading={isLoading} />
          <StatCard label="Destacados" value={stats.destacados} icon="fa-star" color="#eab308" loading={isLoading} />
        </div>

        {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error}</div>}

        <SearchFilters search={search} onSearch={setSearch} placeholder="Buscar negocio..." filters={[{key:'todos',label:'Todos'},{key:'activos',label:'Activos'},{key:'inactivos',label:'Inactivos'}]} activeFilter={estado} onFilterChange={(k)=>{setEstado(k); setPagination(p=>({...p,page:1}));}} />

        <DataTable columns={columns} data={items} loading={isLoading} skeletonRows={5} emptyMessage={search?'No se encontraron negocios':'No hay negocios'} emptyIcon="fa-store" getRowKey={i=>i.id} getActions={getActions} />

        {pagination.pages>1 && (
        <div className="bg-admin-card border border-admin-border rounded-xl px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">Mostrando {((pagination.page-1)*pagination.limit)+1} - {Math.min(pagination.page*pagination.limit, pagination.total)} de {pagination.total}</p>
          <div className="flex items-center gap-2">
            <button onClick={()=>handlePageChange(pagination.page-1)} disabled={pagination.page===1} className="p-2 rounded-lg bg-admin-border text-gray-300 disabled:opacity-40"><i className="fas fa-chevron-left"></i></button>
            {Array.from({length:pagination.pages},(_,i)=>i+1).slice(0,7).map(p=>(
              <button key={p} onClick={()=>handlePageChange(p)} className={`w-10 h-10 rounded-lg text-sm ${pagination.page===p?'bg-red-600 text-white':'bg-admin-border text-gray-300'}`}>{p}</button>
            ))}
            <button onClick={()=>handlePageChange(pagination.page+1)} disabled={pagination.page===pagination.pages} className="p-2 rounded-lg bg-admin-border text-gray-300 disabled:opacity-40"><i className="fas fa-chevron-right"></i></button>
          </div>
        </div>
      )}
        </>
      )}

      {mainTab==='categorias' && (
        <div className="space-y-4">
          <DataTable
            columns={[
              { key:'nombre', header:'Nombre', width:'200', render:(c)=> <span className="text-white">{c.nombre}</span> },
              { key:'slug', header:'Slug', width:'150', render:(c)=> <span className="text-gray-300">{c.slug}</span> },
              { key:'icono', header:'Icono', width:'120', render:(c)=> <span className="text-gray-300">{c.icono}</span> },
              { key:'color', header:'Color', width:'100', render:(c)=> <span className="inline-block w-4 h-4 rounded" style={{background:c.color}}></span> },
              { key:'activa', header:'Activa', width:'100', render:(c)=> <span className="text-gray-300">{c.activa?'Sí':'No'}</span> },
            ]}
            data={categorias}
            loading={false}
            getRowKey={c=>c.id}
            getActions={c=>[ 
              { label:'Editar', icon:'fa-edit', onClick:()=>{setCatMode('edit');setCatForm({id:c.id,nombre:c.nombre,slug:c.slug,icono:c.icono||'fa-store',color:c.color||'#64748b',activa:c.activa||1,orden:0});setShowCatModal(true);} },
              { label:'Eliminar', icon:'fa-trash-alt', danger:true, onClick:async()=>{ if(!confirm('Eliminar categoría?')) return; await fetch('/api/admin/negocios-categorias.php?id='+c.id,{method:'DELETE',headers:getAuthHeaders()}); loadCategorias(); } }
            ]}
          />
        </div>
      )}

      {mainTab==='planes' && (
        <div className="space-y-4">
          <DataTable
            columns={[
              { key:'nombre', header:'Nombre', width:'200', render:(p)=> <span className="text-white">{p.nombre}</span> },
              { key:'duracion', header:'Duración', width:'140', render:(p)=> <span className="text-gray-300">{p.duracion}</span> },
              { key:'valor', header:'Valor', width:'150', render:(p)=> <span className="text-gray-300">{fmtCLP(p.valor)}</span> },
              { key:'activo', header:'Activo', width:'100', render:(p)=> <span className="text-gray-300">{p.activo?'Sí':'No'}</span> },
              { key:'orden', header:'Orden', width:'80', render:(p)=> <span className="text-gray-300">{p.orden}</span> },
            ]}
            data={planes}
            loading={false}
            getRowKey={p=>p.id}
            getActions={p=>[
              { label:'Editar', icon:'fa-edit', onClick:()=>{ setPlanMode('edit'); setPlanForm({id:p.id,nombre:p.nombre,duracion:p.duracion,valor:p.valor,activo:p.activo,orden:p.orden||0}); setShowPlanModal(true);} },
              { label:'Eliminar', icon:'fa-trash-alt', danger:true, onClick:async()=>{ if(!confirm('Eliminar plan?')) return; await fetch(`/api/admin/negocios-planes.php?id=${p.id}`,{method:'DELETE',headers:getAuthHeaders()}); loadPlanes(); } }
            ]}
          />
        </div>
      )}

      {mainTab==='ciudades' && (
        <div className="space-y-4">
          <DataTable
            columns={[
              { key:'nombre', header:'Nombre', width:'200', render:(c)=> <span className="text-white">{c.nombre}</span> },
              { key:'slug', header:'Slug', width:'150', render:(c)=> <span className="text-gray-300">{c.slug}</span> },
              { key:'activa', header:'Activa', width:'100', render:(c)=> <span className="text-gray-300">{c.activa?'Sí':'No'}</span> },
            ]}
            data={ciudadesAdmin}
            loading={false}
            getRowKey={c=>c.id}
            getActions={c=>[
              { label:'Editar', icon:'fa-edit', onClick:()=>{setCiudadMode('edit');setCiudadForm({id:c.id,nombre:c.nombre,slug:c.slug,activa:c.activa});setShowCiudadModal(true);} },
              { label:'Eliminar', icon:'fa-trash-alt', danger:true, onClick:async()=>{ if(!confirm('Eliminar ciudad?')) return; await fetch('/api/admin/ciudades.php?id='+c.id,{method:'DELETE',headers:getAuthHeaders()}); loadCiudadesAdmin(); } }
            ]}
          />
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700"><h2 className="text-lg font-bold text-white">{modalMode==='create'?'Nuevo Negocio':'Editar Negocio'}</h2><button onClick={()=>setShowModal(false)} className="p-1 rounded-lg hover:bg-[#2d2d44]"><i className="fas fa-times"></i></button></div>
            <div className="flex border-b border-gray-700 px-6">
              {(['info','seo'] as const).map(t=>(
                <button key={t} onClick={()=>setActiveTab(t)} className={`px-4 py-2 text-sm capitalize ${activeTab===t?'text-white border-b-2 border-red-500':'text-gray-400'}`}>{t}</button>
              ))}
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {fieldErrors.general && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{fieldErrors.general}</div>}
              {activeTab==='info' && (
                <>
                  <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre *</label><input type="text" value={formData.nombre} onChange={e=>setFormData(p=>({...p,nombre:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white" required/></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label><select value={formData.activo} onChange={e=>setFormData(p=>({...p,activo:parseInt(e.target.value)}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"><option value={1}>Activo</option><option value={0}>Inactivo</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Destacado</label><select value={formData.destacado} onChange={e=>setFormData(p=>({...p,destacado:parseInt(e.target.value)}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"><option value={0}>No</option><option value={1}>Sí</option></select></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Ciudad</label>
                    <AutocompleteField
                      options={ciudades.map(c=>({ value: c.id, label: c.nombre }))}
                      value={formData.ciudad_id ? ciudades.find(c=>c.id===formData.ciudad_id)?.nombre || formData.ciudad_nombre || '' : (ciudadQuery || '')}
                      placeholder="Buscar ciudad..."
                      onSelect={(opt)=>{ const found = ciudades.find(c=>c.id===Number(opt?.value)); setFormData(p=>({...p, ciudad_id: found?.id||0, ciudad_nombre: found?.nombre||'' })); setCiudadQuery(''); }}
                      onChange={(v)=>{ setCiudadQuery(v); setFormData(p=>({...p, ciudad_nombre: v, ciudad_id: 0 })); }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Teléfono</label><input type="text" value={formData.telefono} onChange={e=>setFormData(p=>({...p,telefono:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1.5">WhatsApp</label><input type="text" value={formData.whatsapp} onChange={e=>setFormData(p=>({...p,whatsapp:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Web</label><input type="url" value={formData.web} onChange={e=>setFormData(p=>({...p,web:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Instagram</label><input type="text" value={formData.instagram} onChange={e=>setFormData(p=>({...p,instagram:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Dirección</label><input type="text" value={formData.direccion} onChange={e=>setFormData(p=>({...p,direccion:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción</label><textarea value={formData.descripcion} onChange={e=>setFormData(p=>({...p,descripcion:e.target.value}))} rows={3} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                   <div className="mt-2">
                     <label className="block text-sm font-medium text-gray-300 mb-1.5">Categoría</label>
                     <select value={formData.categoria} onChange={e=>setFormData(p=>({...p,categoria:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white">
                       {categorias.map(c=><option key={c.slug} value={c.slug}>{c.nombre}</option>)}
                     </select>
                   </div>
                   <div className="mt-2">
                     <label className="block text-sm font-medium text-gray-300 mb-1.5">Plan</label>
                      <select value={formData.plan_id||0} onChange={e=>setFormData(p=>({...p,plan_id:parseInt(e.target.value)||0}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white">
                        <option value={0}>-- Sin plan --</option>
                        {planes.map(p=><option key={p.id} value={p.id}>{p.nombre} - {p.duracion} - {fmtCLP(p.valor)}</option>)}
                      </select>
                   </div>
                   <div onDragOver={e=>e.preventDefault()} onDrop={e=>{ e.preventDefault(); const files = Array.from(e.dataTransfer.files); setDropFiles(prev=>[...prev,...files]); }} className="border-2 border-dashed border-white/15 rounded-xl p-6 text-center bg-[#0f0f15]">
                    <i className="fas fa-cloud-upload-alt text-2xl text-gray-500 mb-2"></i>
                    <p className="text-gray-400 text-sm">Arrastra imágenes aquí o haz clic para seleccionar</p>
                    <input type="file" multiple accept="image/*" onChange={e=>{ if(e.target.files) setDropFiles(prev=>[...prev,...Array.from(e.target.files||[])]) }} className="hidden" id="negocio-drop"/>
                    <label htmlFor="negocio-drop" className="mt-2 inline-block px-3 py-1.5 bg-admin-border rounded-lg text-xs cursor-pointer">Seleccionar archivos</label>
                    {dropFiles.length>0 && <div className="mt-3 text-xs text-gray-300">{dropFiles.length} archivo(s) listo(s)</div>}
                  </div>
                </>
              )}
              {activeTab==='seo' && (
                <>
                  <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Título SEO</label><input type="text" value={formData.seo_title} onChange={e=>setFormData(p=>({...p,seo_title:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción SEO</label><textarea value={formData.seo_description} onChange={e=>setFormData(p=>({...p,seo_description:e.target.value}))} rows={3} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Palabras clave</label><input type="text" value={formData.seo_keywords} onChange={e=>setFormData(p=>({...p,seo_keywords:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Imagen OG</label>
                    {formData.seo_og_image && <img src={formData.seo_og_image} alt="OG" className="w-32 h-20 object-cover rounded mb-2"/>}
                    <input type="file" accept="image/*" onChange={async e=>{ const file=e.target.files?.[0]; if(!file) return; const fd=new FormData(); fd.append('file',file); try { const res=await fetch('/api/admin/upload-seo-image.php',{method:'POST', headers:{Authorization:getAuthHeaders().Authorization}, body:fd}); const d=await res.json(); if(d.success){ setFormData(p=>({...p,seo_og_image:d.path})); showNotification('Imagen OG subida'); } else { showNotification('Error al subir'); } } catch { showNotification('Error al subir'); } }} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/>
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2 border-t border-gray-700">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2.5 bg-[#2d2d44] text-white rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg disabled:opacity-60">{saving?'Guardando...':modalMode==='create'?'Crear':'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700"><h2 className="text-lg font-bold text-white">{catMode==='create'?'Nueva Categoría':'Editar Categoría'}</h2><button onClick={()=>setShowCatModal(false)} className="p-1 rounded-lg hover:bg-[#2d2d44]"><i className="fas fa-times"></i></button></div>
            <form onSubmit={async e=>{ e.preventDefault(); try { if (catMode==='create' && categorias.some(c=>c.nombre.toLowerCase()===catForm.nombre.trim().toLowerCase())) { setDuplicateCat(catForm.nombre.trim()); return; } const body=JSON.stringify(catForm); const res=await fetch('/api/admin/negocios-categorias.php',{method:catMode==='create'?'POST':'PUT',headers:getAuthHeaders(),body}); const d=await res.json(); if(!d.success) { const msg = (d.error||'Error').toLowerCase(); if (catMode==='create' && (msg.includes('duplic')||msg.includes('exist'))) { setDuplicateCat(catForm.nombre.trim()); return; } throw new Error(d.error||'Error'); } setShowCatModal(false); loadCategorias(); showNotification(catMode==='create'?'Categoría creada correctamente':'Categoría actualizada correctamente'); } catch(err:any){ showNotification('Error: '+(err.message||'Error al guardar')); } }} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre</label><input value={catForm.nombre} onChange={e=>setCatForm(p=>({...p,nombre:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Icono</label><input value={catForm.icono} onChange={e=>setCatForm(p=>({...p,icono:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Color</label><input type="color" value={catForm.color} onChange={e=>setCatForm(p=>({...p,color:e.target.value}))} className="w-full h-10 bg-[#0f0f23] border border-gray-700 rounded-lg"/></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowCatModal(false)} className="flex-1 px-4 py-2.5 bg-[#2d2d44] text-white rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700"><h2 className="text-lg font-bold text-white">{planMode==='create'?'Nuevo Plan':'Editar Plan'}</h2><button onClick={()=>setShowPlanModal(false)} className="p-1 rounded-lg hover:bg-[#2d2d44]"><i className="fas fa-times"></i></button></div>
             <form onSubmit={async e=>{ e.preventDefault(); try { const body=JSON.stringify({...planForm}); const res=await fetch('/api/admin/negocios-planes.php',{method:planMode==='create'?'POST':'PUT',headers:getAuthHeaders(),body}); const d=await res.json(); if(!d.success) throw new Error(d.error||'Error'); setShowPlanModal(false); loadPlanes(); showNotification(planMode==='create'?'Plan creado correctamente':'Plan actualizado correctamente'); } catch(err:any){ showNotification('Error: '+(err.message||'Error al guardar')); } }} className="p-6 space-y-4">
               <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre</label><input value={planForm.nombre} onChange={e=>setPlanForm(p=>({...p,nombre:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
               <div className="grid grid-cols-2 gap-4">
                 <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Duración</label><select value={planForm.duracion} onChange={e=>setPlanForm(p=>({...p,duracion:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option></select></div>
                  <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Valor (CLP)</label><input type="text" value={planForm.valor ? fmtCLP(planForm.valor) : ''} onChange={e=>{ const digits = e.target.value.replace(/[^0-9]/g,''); setPlanForm(p=>({...p,valor:parseInt(digits)||0})); }} placeholder="Ej: 50.000" className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Activo</label><select value={planForm.activo} onChange={e=>setPlanForm(p=>({...p,activo:parseInt(e.target.value)}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"><option value={1}>Sí</option><option value={0}>No</option></select></div>
                 <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Orden</label><input type="number" value={planForm.orden} onChange={e=>setPlanForm(p=>({...p,orden:parseInt(e.target.value)||0}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
               </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowPlanModal(false)} className="flex-1 px-4 py-2.5 bg-[#2d2d44] text-white rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPageSeoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700"><h2 className="text-lg font-bold text-white">SEO Página Negocios</h2><button onClick={()=>setShowPageSeoModal(false)} className="p-1 rounded-lg hover:bg-[#2d2d44]"><i className="fas fa-times"></i></button></div>
            <form onSubmit={async e=>{ e.preventDefault(); try { const body=JSON.stringify({ seccion:'negocios_admin', meta_title:pageSeo.meta_title, meta_description:pageSeo.meta_description, meta_keywords:pageSeo.meta_keywords, og_image:pageSeo.og_image }); const res=await fetch('/api/admin/admin-seo.php',{method:'POST', headers:getAuthHeaders(), body}); const d=await res.json(); if(!d.success) throw new Error(d.error||'Error'); setShowPageSeoModal(false); showNotification('SEO de página guardado'); } catch(err:any){ showNotification('Error: '+(err.message||'Error al guardar')); } }} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Título</label><input value={pageSeo.meta_title} onChange={e=>setPageSeo(p=>({...p,meta_title:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción</label><textarea value={pageSeo.meta_description} onChange={e=>setPageSeo(p=>({...p,meta_description:e.target.value}))} rows={3} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Palabras clave</label><input value={pageSeo.meta_keywords} onChange={e=>setPageSeo(p=>({...p,meta_keywords:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/></div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Imagen OG</label>
                {pageSeo.og_image && <img src={pageSeo.og_image} className="w-32 h-20 object-cover rounded mb-2"/>}
                <input type="file" accept="image/*" onChange={async e=>{ const file=e.target.files?.[0]; if(!file) return; const fd=new FormData(); fd.append('file',file); try { const res=await fetch('/api/admin/upload-seo-image.php',{method:'POST', headers:{Authorization:getAuthHeaders().Authorization}, body:fd}); const d=await res.json(); if(d.success){ setPageSeo(p=>({...p,og_image:d.path})); showNotification('Imagen subida'); } else { showNotification('Error al subir'); } } catch { showNotification('Error al subir'); } }} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowPageSeoModal(false)} className="flex-1 px-4 py-2.5 bg-[#2d2d44] text-white rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCiudadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700"><h2 className="text-lg font-bold text-white">{ciudadMode==='create'?'Nueva Ciudad':'Editar Ciudad'}</h2><button onClick={()=>setShowCiudadModal(false)} className="p-1 rounded-lg hover:bg-[#2d2d44]"><i className="fas fa-times"></i></button></div>
            <form onSubmit={async e=>{ e.preventDefault(); try { const body=JSON.stringify(ciudadForm); const res=await fetch(`/api/admin/ciudades.php${ciudadForm.id? '?id='+ciudadForm.id : ''}`,{method:ciudadForm.id?'PUT':'POST',headers:getAuthHeaders(),body}); const d=await res.json(); if(!d.success) throw new Error(d.error||'Error'); setShowCiudadModal(false); showNotification('Ciudad guardada'); loadCiudadesAdmin(); } catch(err:any){ showNotification('Error: '+(err.message||'Error al guardar')); } }} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre *</label><input value={ciudadForm.nombre} onChange={e=>setCiudadForm(p=>({...p,nombre:e.target.value, slug:e.target.value.toLowerCase().replace(/\s+/g,'-')}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white" required/></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Slug</label><input value={ciudadForm.slug} onChange={e=>setCiudadForm(p=>({...p,slug:e.target.value}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white" required/></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1.5">Activa</label><select value={ciudadForm.activa} onChange={e=>setCiudadForm(p=>({...p,activa:parseInt(e.target.value)}))} className="w-full px-4 py-2.5 bg-[#0f0f23] border border-gray-700 rounded-lg text-white"><option value={1}>Sí</option><option value={0}>No</option></select></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowCiudadModal(false)} className="flex-1 px-4 py-2.5 bg-[#2d2d44] text-white rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={duplicateCat!==null} title="Categoría existente" message={`La categoría "${duplicateCat}" ya existe.`} confirmText="Aceptar" cancelText="Cancelar" variant="danger" onConfirm={()=>setDuplicateCat(null)} onCancel={()=>setDuplicateCat(null)} />
      <ConfirmModal isOpen={deleteConfirm!==null} title="¿Eliminar negocio?" message={`Eliminar ${deleteConfirm?.nombre}`} confirmText={deleting?'Eliminando...':'Eliminar'} cancelText="Cancelar" variant="danger" confirmDisabled={deleting} onConfirm={handleDelete} onCancel={()=>setDeleteConfirm(null)} />
    </div>
  );
}
