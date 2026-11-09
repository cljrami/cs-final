import { useEffect, useState, useMemo } from 'react';
import AutocompleteField from './ui/AutocompleteField';

interface Negocio {
  id: number;
  nombre: string;
  slug: string;
  categoria: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
  whatsapp?: string;
  web?: string;
  instagram?: string;
  logo_url?: string;
  destacado: number;
  ciudad_nombre?: string;
}

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  icono?: string;
  color?: string;
}

interface Ciudad {
  id: number;
  nombre: string;
  slug: string;
}

export default function NegociosHub() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [categoriaSlug, setCategoriaSlug] = useState('');
  const [ciudadId, setCiudadId] = useState<number | ''>('');
  const [destacado, setDestacado] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch('/api/negocios/categorias.php').then(r=>r.json()).then(d=>{ if(d.success) setCategorias(d.categorias); });
    fetch('/api/negocios/ciudades.php').then(r=>r.json()).then(d=>{ if(d.success) setCiudades(d.ciudades); });
  }, []);

  const fetchNegocios = async (p: number, reset=false) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('limit', '20');
    if(search) params.set('search', search);
    if(categoria) params.set('categoria', categoria);
    if(ciudadId) params.set('ciudad_id', String(ciudadId));
    if(destacado) params.set('destacado', String(destacado));
    const res = await fetch(`/api/negocios/listado.php?${params}`);
    const data = await res.json();
    if (data.success) {
      setNegocios(reset ? data.negocios : [...negocios, ...data.negocios]);
      setTotal(data.pagination.total);
      setHasMore(data.pagination.has_more);
      setPage(p);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNegocios(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoria, ciudadId, destacado]);

  const ciudadOptions = useMemo(()=> ciudades.map(c=>({id:c.id, nombre:c.nombre})), [ciudades]);
  const categoriaOptions = useMemo(()=> categorias.map(c=>({id:c.id, nombre:c.nombre, slug:c.slug})), [categorias]);

  const clearFilters = ()=> {
    setSearch('');
    setCategoria('');
    setCiudadId('');
    setDestacado('');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Directorio de Negocios</h1>
          <p className="text-gray-400 mt-2">Encuentra servicios y comercios verificados en Chile</p>
        </div>
        <button onClick={clearFilters} className="text-sm text-red-400 hover:text-red-300 transition-colors">Limpiar filtros</button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-10">
        <div className="md:col-span-2">
          <AutocompleteField label="Buscar negocio" icon="fa-search" placeholder="Nombre, descripción o servicio" options={[]} value={search} onChange={setSearch} />
        </div>
        <div>
          <AutocompleteField label="Categoría" icon="fa-tags" placeholder="Selecciona categoría" options={categoriaOptions} value={categorias.find(c=>c.slug===categoria)?.nombre||''} onChange={()=>{}} onSelect={(opt)=>{ const found = categorias.find(c=>c.id===opt.id); setCategoria(found?found.slug:''); }} />
        </div>
        <div>
          <AutocompleteField label="Ciudad" icon="fa-city" placeholder="Selecciona ciudad" options={ciudadOptions} value={ciudades.find(c=>c.id===ciudadId)?.nombre||''} onChange={()=>{}} onSelect={(opt)=>{ const found = ciudades.find(c=>c.id===opt.id); setCiudadId(found?found.id:''); }} />
        </div>
      </div>

      {loading && negocios.length===0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({length:6}).map((_,i)=>(<div key={i} className="rounded-2xl bg-admin-card border border-admin-border animate-pulse overflow-hidden"><div className="h-44 bg-admin-border/50"/><div className="p-4 space-y-3"><div className="h-4 bg-admin-border/50 rounded w-3/4"/><div className="h-3 bg-admin-border/50 rounded w-1/2"/><div className="h-3 bg-admin-border/50 rounded w-full"/></div></div>))}
        </div>
      )}

      {!loading && negocios.length===0 && (
        <div className="text-center py-24 text-admin-muted">
          <i className="fas fa-store text-4xl mb-4 text-muted"></i>
          <p className="text-lg">No se encontraron negocios</p>
          <p className="text-sm mt-1">Prueba ajustando los filtros de búsqueda</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {negocios.map(n=>{
          const cat = categorias.find(c=>c.slug===n.categoria);
          return (
          <a key={n.id} href={`/negocio?slug=${n.slug}`} className="group rounded-2xl bg-admin-card border border-admin-border hover:border-red-500/50 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl">
            <div className="relative h-44 bg-[#0f0f23] overflow-hidden">
              {n.logo_url ? <img src={n.logo_url} alt={n.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/> : <div className="w-full h-full flex items-center justify-center"><i className="fas fa-store text-5xl text-red-400/60"/></div>}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-xs">
                <i className={`fas ${cat?.icono||'fa-store'}`} style={{color: cat?.color||'#ef4444'}}></i>
                <span className="text-white">{cat?.nombre||n.categoria}</span>
              </div>
              {n.destacado && <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-300 text-[10px] uppercase tracking-wide">Destacado</div>}
            </div>
            <div className="p-4">
              <div className="font-semibold text-white group-hover:text-red-300 transition-colors truncate">{n.nombre}</div>
              <div className="text-xs text-admin-muted mt-0.5 flex items-center gap-2">
                <i className="fas fa-map-marker-alt text-red-400/70"></i>
                <span>{n.ciudad_nombre || 'Chile'}</span>
              </div>
              <div className="text-sm text-muted mt-2 line-clamp-2">{n.descripcion}</div>
            </div>
          </a>
        )})}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center mt-10">
          <button onClick={()=>fetchNegocios(page+1,false)} className="px-5 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:opacity-90 text-white font-semibold">Cargar más</button>
        </div>
      )}

      <div className="mt-8 text-sm text-admin-muted text-center">{total} negocios encontrados</div>
    </div>
  );
}
