import { useEffect, useState } from 'react';

interface Negocio {
  id: number;
  nombre: string;
  descripcion?: string;
  categoria: string;
  ciudad_nombre?: string;
  direccion?: string;
  telefono?: string;
  whatsapp?: string;
  web?: string;
  instagram?: string;
  logo_url?: string;
  seo_title?: string;
  seo_description?: string;
}

export default function NegocioFicha() {
  const [negocio, setNegocio] = useState<Negocio|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const parts = window.location.pathname.split('/');
    const slug = parts[parts.length-1] || '';
    fetch(`/api/negocios/ficha.php?slug=${encodeURIComponent(slug)}`)
      .then(r=>r.json())
      .then(d=>{ if(d.success) { setNegocio(d.negocio); if(d.negocio){ document.title = d.negocio.seo_title || d.negocio.nombre; const meta = document.querySelector('meta[name="description"]'); if(meta) meta.setAttribute('content', d.negocio.seo_description || d.negocio.descripcion || ''); } } })
      .finally(()=>setLoading(false));
  }, []);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-20 text-center">Cargando...</div>;
  if (!negocio) return <div className="max-w-4xl mx-auto px-4 py-20 text-center">Negocio no encontrado</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex gap-6 items-start">
        <div className="w-28 h-28 rounded-xl bg-raised flex items-center justify-center overflow-hidden shrink-0">
          {negocio.logo_url ? <img src={negocio.logo_url} alt={negocio.nombre} className="w-full h-full object-cover"/> : <i className="fas fa-store text-3xl text-muted"/>}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{negocio.nombre}</h1>
          <p className="text-muted text-sm">{negocio.categoria} {negocio.ciudad_nombre && `· ${negocio.ciudad_nombre}`}</p>
          <p className="mt-4 text-gray-300">{negocio.descripcion}</p>
          <div className="mt-4 flex gap-3">
            {negocio.telefono && <a href={`tel:${negocio.telefono}`} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm">Llamar</a>}
            {negocio.whatsapp && <a href={`https://wa.me/${negocio.whatsapp}`} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm">WhatsApp</a>}
            {negocio.web && <a href={negocio.web} target="_blank" className="px-3 py-1.5 rounded-lg bg-surface border border-white/10 text-sm">Web</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
