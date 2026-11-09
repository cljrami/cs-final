import { useEffect, useState } from 'react';

interface Negocio {
  id:number;
  nombre:string;
  slug:string;
  categoria:string;
  descripcion?:string;
  direccion?:string;
  telefono?:string;
  whatsapp?:string;
  web?:string;
  instagram?:string;
  logo_url?:string;
  ciudad_nombre?:string;
  activo:number;
}

export default function NegocioDetail(){
  const [negocio,setNegocio]=useState<Negocio|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug') || '';
    if(!slug){ setLoading(false); return; }
    fetch(`/api/negocios/ficha.php?slug=${encodeURIComponent(slug)}`).then(r=>r.json()).then(d=>{ if(d.success) setNegocio(d.negocio); setLoading(false);});
  },[]);
  if(loading) return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-gray-400">Cargando...</div>;
  if(!negocio) return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-gray-400">Negocio no encontrado</div>;
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="bg-admin-card border border-admin-border rounded-3xl overflow-hidden">
        <div className="h-64 bg-gradient-to-r from-red-600/20 to-red-800/20 flex items-center justify-center">
          {negocio.logo_url ? <img src={negocio.logo_url} alt={negocio.nombre} className="max-h-48 object-contain"/> : <div className="text-7xl text-red-400"><i className="fas fa-store"/></div>}
        </div>
        <div className="p-8">
          <h1 className="text-3xl font-bold text-white">{negocio.nombre}</h1>
          <p className="text-gray-400 mt-1">{negocio.categoria} {negocio.ciudad_nombre && '· '+negocio.ciudad_nombre}</p>
          {negocio.descripcion && <p className="text-gray-300 mt-4">{negocio.descripcion}</p>}
          <div className="grid sm:grid-cols-2 gap-4 mt-6 text-sm text-gray-300">
            {negocio.direccion && <div><i className="fas fa-map-marker-alt mr-2 text-red-400"/> {negocio.direccion}</div>}
            {negocio.telefono && <div><i className="fas fa-phone mr-2 text-red-400"/> {negocio.telefono}</div>}
            {negocio.whatsapp && <div><i className="fab fa-whatsapp mr-2 text-green-400"/> {negocio.whatsapp}</div>}
            {negocio.web && <a href={negocio.web} target="_blank" className="text-blue-400 hover:underline"><i className="fas fa-globe mr-2"/> Web</a>}
            {negocio.instagram && <a href={negocio.instagram} target="_blank" className="text-pink-400 hover:underline"><i className="fab fa-instagram mr-2"/> Instagram</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
