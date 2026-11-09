import { useEffect, useState } from 'react';

interface Perfil {
  id: number;
  nombre: string;
  edad: number;
  telefono?: string;
  whatsapp?: string;
  ciudad?: string;
  ciudad_base?: string;
  categoria_nombre?: string;
  rating: number;
  total_valoraciones: number;
  verificado_vigente?: number;
  vip_vigente?: number;
  destacado_vigente?: number;
  activa_vigente?: number;
  descripcion_corta?: string;
  descripcion_larga?: string;
  fotos?: {id:number; url:string; orden:number; es_portada:number}[];
  servicios?: {id:number; nombre:string; grupo:string; color:string; icono:string; incluido:number}[];
  altura?: number;
  peso?: number;
  medidas?: string;
  nacionalidad?: string;
  etnia?: string;
  color_pelo?: string;
  color_ojos?: string;
  orientacion?: string;
  estilo?: string;
  idiomas?: string;
}

  export default function EscortPerfilReplica() {
  const [perfil, setPerfil] = useState<Perfil|null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    const getId = () => {
      const params = new URLSearchParams(window.location.search);
      const qId = Number(params.get('id'));
      if (qId) return qId;
      const m = window.location.pathname.match(/\/cs(\d+)/);
      if (m) return Number(m[1]);
      return null;
    };
    const id = getId();
    if (!id) { setLoading(false); return; }
    fetch(`/api/escort/perfil-publico.php?id=${id}&include_inactive=1`)
      .then(r=>r.json())
      .then(d=>{
        if(d.success) setPerfil(d.perfil);
        setLoading(false);
      })
      .catch(()=>setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-muted">Cargando...</div>;
  if (!perfil) return <div className="p-8 text-center text-muted">Perfil no encontrado</div>;

  const telefonoFormateado = perfil.telefono ? '+56 '+perfil.telefono.slice(-9).replace(/(\d{1})(\d{4})(\d{4})/,'$1 $2 $3') : '';
  const waLink = perfil.telefono ? `https://wa.me/${perfil.telefono.replace(/\D/g,'') }?text=${encodeURIComponent(`Hola ${perfil.nombre}, vi tu perfil en Kimi`)}` : '';

  const serviciosIncluidos = perfil.servicios?.filter(s=>s.incluido===1) ?? [];
  const serviciosAdicionales = perfil.servicios?.filter(s=>s.incluido===0) ?? [];

  const atributos = [
    perfil.edad && {icon:'fa-birthday-cake', label:'Edad', valor:`${perfil.edad} Años`},
    perfil.altura && {icon:'fa-ruler-vertical', label:'Altura', valor:`${perfil.altura} Cm`},
    perfil.peso && {icon:'fa-weight-scale', label:'Peso', valor:`${perfil.peso} Kg`},
    perfil.medidas && {icon:'fa-vector-square', label:'Medidas', valor:perfil.medidas},
    perfil.nacionalidad && {icon:'fa-flag', label:'Nacionalidad', valor:perfil.nacionalidad},
    perfil.etnia && {icon:'fa-user', label:'Etnia', valor:perfil.etnia},
    perfil.color_pelo && {icon:'fa-scissors', label:'Color de pelo', valor:perfil.color_pelo},
    perfil.color_ojos && {icon:'fa-eye', label:'Color de ojos', valor:perfil.color_ojos},
    perfil.orientacion && {icon:'fa-heart', label:'Orientación', valor:perfil.orientacion},
    perfil.estilo && {icon:'fa-star', label:'Estilo', valor:perfil.estilo},
    perfil.ciudad && {icon:'fa-map-marker-alt', label:'Ciudad', valor:perfil.ciudad},
    perfil.idiomas && {icon:'fa-language', label:'Idiomas', valor:perfil.idiomas},
  ].filter(Boolean) as {icon:string;label:string;valor:string}[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <nav className="flex items-center gap-2 text-sm mb-8 text-muted">
        <a href="/" className="hover:text-red-400">Inicio</a>
        <span>/</span>
        <a href={`/escorts-${(perfil.ciudad||'').toLowerCase()}`} className="hover:text-red-400 capitalize">{perfil.ciudad}</a>
        <span>/</span>
        <span className="text-muted">{perfil.nombre}</span>
      </nav>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
        <div className="shrink-0">
          <div className="relative inline-block">
            <div className="w-44 h-44 rounded-full overflow-hidden bg-surface border-2 border-white/10">
              <img src={perfil.fotos?.[0]?.url || '/placeholder.jpg'} alt={perfil.nombre} className="w-full h-full object-cover"/>
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {perfil.vip_vigente && <div className="w-8 h-8 bg-amber-400 text-black rounded-full flex items-center justify-center shadow-lg border-2 border-page"><i className="fas fa-crown text-[0.6rem]"/></div>}
              {perfil.verificado_vigente && <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-page"><i className="fas fa-check text-[0.6rem]"/></div>}
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-ink">{perfil.nombre}</h1>
            <span className="text-muted text-lg">, {perfil.edad} Años</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex">{Array.from({length:5}).map((_,i)=> <i key={i} className={`fas fa-star text-sm ${i<Math.round(perfil.rating)?'text-amber-400':'text-muted'}`}/>)}</div>
            <span className="text-ink text-sm font-medium">{perfil.rating.toFixed(1)}</span>
            <span className="text-muted text-xs">({perfil.total_valoraciones})</span>
          </div>
          {perfil.categoria_nombre && <div className="text-muted text-sm mb-3"><i className="fas fa-tag text-red-400 text-xs mr-1.5"></i>{perfil.categoria_nombre}</div>}
          {telefonoFormateado && <a href={`tel:${perfil.telefono}`} className="inline-block text-green-400 text-lg font-semibold hover:text-green-300">{telefonoFormateado}</a>}
          <div className="flex items-center gap-2 text-sm text-muted mb-5 flex-wrap">
            <span className="uppercase tracking-wide">MUJER</span>
            <span className="text-muted">/</span>
            <span className="flex items-center gap-1"><span className="text-ink font-semibold">{likesCount}</span><i className="fas fa-heart text-red-500 text-xs"></i></span>
            <span className="text-muted">/</span>
            <span className="uppercase tracking-wide">{perfil.ciudad}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {perfil.telefono && <a href={`tel:${perfil.telefono}`} className="flex items-center justify-center w-12 h-12 rounded-lg bg-red-500 text-ink font-medium text-sm shadow-lg" title="Llamar"><i className="fas fa-phone-alt"></i></a>}
            {waLink && <a href={waLink} target="_blank" className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-500 text-ink font-medium text-sm shadow-lg" title="WhatsApp"><i className="fab fa-whatsapp"></i></a>}
            <button onClick={()=>{
              const url = window.location.href;
              if (navigator.share) { navigator.share({title:perfil.nombre, url}); }
              else { navigator.clipboard.writeText(url); alert('Enlace copiado'); }
            }} className="flex items-center justify-center w-12 h-12 rounded-lg bg-red-500/80 text-white font-medium text-sm" title="Compartir"><i className="fas fa-share-alt"></i></button>
            <button onClick={()=>alert('QR próximamente')} className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/80 text-white font-medium text-sm" title="QR"><i className="fas fa-qrcode"></i></button>
            <button onClick={()=>{setLiked(l=>!l); setLikesCount(c=> l?c-1:c+1);}} className={`flex items-center justify-center w-12 h-12 rounded-lg border font-medium text-sm ${liked?'bg-red-500/30 text-red-300 border-red-500/30':'bg-red-500/20 text-red-400 border-red-500/30'}`} title="Me gusta"><i className={`fas fa-heart ${liked?'text-red-400':''}`}></i></button>
            <button onClick={()=>alert('Reporte enviado')} className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-500/20 text-muted border border-gray-500/30 font-medium text-sm" title="Reportar"><i className="fas fa-flag"></i></button>
          </div>
          <div className="mt-6 text-muted text-base leading-relaxed">
            {perfil.descripcion_corta && <p className="mb-4">{perfil.descripcion_corta}</p>}
            {perfil.descripcion_larga && <div dangerouslySetInnerHTML={{__html: perfil.descripcion_larga}}/>}
          </div>
        </div>
      </div>

      {atributos.length>0 && (
        <div className="mb-8">
          <h2 className="text-ink text-lg font-bold mb-5 flex items-center gap-2"><i className="fas fa-clipboard-list text-muted"></i> Detalles</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {atributos.map(a=>(
              <div key={a.label} className="bg-gray-900/40 rounded p-3">
                <div className="text-gray-400 text-xs uppercase">{a.label}</div>
                <div className="text-white">{a.valor}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {serviciosIncluidos.length>0 && (
        <div className="mb-8">
          <h2 className="text-muted text-sm font-medium uppercase tracking-wider mb-3">Servicios Incluidos</h2>
          <div className="flex flex-wrap gap-2">
            {serviciosIncluidos.map(s=> <span key={s.id} className="px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 text-xs font-semibold">{s.nombre}</span>)}
          </div>
        </div>
      )}

      {serviciosAdicionales.length>0 && (
        <div className="mb-8">
          <h2 className="text-muted text-sm font-medium uppercase tracking-wider mb-3">Servicios Adicionales</h2>
          <div className="flex flex-wrap gap-2">
            {serviciosAdicionales.map(s=> <span key={s.id} className="px-3 py-1.5 rounded-md bg-white/10 text-muted text-xs font-semibold">{s.nombre}</span>)}
          </div>
        </div>
      )}

      {perfil.fotos && perfil.fotos.length>0 && (
        <div className="mb-10">
          <h2 className="text-ink text-lg font-bold mb-4 flex items-center gap-2"><i className="fas fa-images text-red-500"></i> Galería</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {perfil.fotos.map(f=> <a key={f.id} href={f.url} data-fancybox="gallery" className="aspect-[3/4] bg-surface border border-white/10 rounded-xl overflow-hidden group hover:border-red-500/50">
              <img src={f.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
            </a>)}
          </div>
        </div>
      )}
    </div>
  );
}
