"use client";
import { useEffect, useState } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import { getUsuarioToken } from '../../lib/usuarioAuth';
import '@fancyapps/ui/dist/fancybox/fancybox.css';

interface Perfil {
  id:number; nombre:string; edad:number; ciudad:string; rating:number; total_valoraciones:number;
  telefono:string|null; whatsapp:string|null; verificado?:number; verificado_vigente?:number; vip?:number; vip_vigente?:number; foto_principal:string|null;
  descripcion_corta:string|null; descripcion_larga:string|null;
  altura:number|null; peso:number|null; medidas:string|null; nacionalidad:string|null; etnia:string|null;
  color_pelo:string|null; color_ojos:string|null; orientacion:string|null; estilo:string|null;
  idiomas:string|null; categoria_nombre?:string|null; activa_vigente?:number;
  created_at?:string|null;
  servicios?:{nombre:string;incluido:number}[]; fotos?:{url:string; tipo?:string; gif_url?:string|null; es_portada?:number}[];
}

export default function PerfilPublicoExact(){
  const [perfil,setPerfil]=useState<Perfil|null>(null);
  const [loading,setLoading]=useState(true);
  const [likes,setLikes]=useState(0);
  const [favorito,setFavorito]=useState(false);
  const [comentarios,setComentarios]=useState<any[]>([]);
  const [comentariosTotal,setComentariosTotal]=useState(0);
  const [comentarioTexto,setComentarioTexto]=useState('');
  const [puntuacion,setPuntuacion]=useState(5);
  const [codigo,setCodigo]=useState('');
  const [enviando,setEnviando]=useState(false);
  const [errorForm,setErrorForm]=useState<string|null>(null);
  const [showQR,setShowQR]=useState(false);
  const [showShare,setShowShare]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [reportMotivo,setReportMotivo]=useState('');
  const [reportDetalle,setReportDetalle]=useState('');
  const [reportEnviando,setReportEnviando]=useState(false);
  const [reportMsg,setReportMsg]=useState<string|null>(null);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    let id=params.get('id');
    let includeInactive=params.get('include_inactive');
    if(!id){
      const m=window.location.pathname.match(/^\/cs(\d+)\/?$/);
      if(m){ id=m[1]; includeInactive='1'; }
    }
    if(!id) { setLoading(false); return; }
    const url=`/api/escort/perfil-publico.php?id=${id}${includeInactive?`&include_inactive=${includeInactive}`:''}&_t=${Date.now()}`;
    fetch(url)
      .then(r=>r.json())
      .then(d=>{
        if(d.success) setPerfil(d.perfil);
        else setPerfil(null);
        setLoading(false);
      })
      .catch(()=>{
        setLoading(false);
        setPerfil(null);
      });
  },[]);
  useEffect(()=>{
    import('@fancyapps/ui').then(mod=>{
      const Fancybox=(mod as any).Fancybox;
      if(Fancybox){
        Fancybox.destroy();
        Fancybox.bind('[data-fancybox="gallery"]',{
          Toolbar:false,
          Thumbs:false,
          dragToClose:true,
          Carousel:{center:true},
          Image:{fit:'contain'},
          Video:{autoplay:true, fit:'contain'}
        });
      }
    });
  },[perfil?.id]);
  useEffect(()=>{
    const isActive = Number(perfil?.activa_vigente) === 1;
    if(perfil && isActive){
      document.title = `${perfil.nombre} ${perfil.edad} años | Consexvip`;
    } else if(perfil && !isActive){
      document.title = `No disponible - ${perfil.nombre} - CSEscorts`;
    }
  },[perfil?.id, perfil?.activa_vigente, perfil?.nombre, perfil?.edad]);
  useEffect(()=>{
    if(!perfil?.id) return;
    fetch(`/api/escorts/favorito.php?id=${perfil.id}`).then(r=>r.json()).then(d=>{
      if(d.success){ setLikes(d.likes||0); setFavorito(!!d.favorito); }
    }).catch(()=>{});
  },[perfil?.id]);
  useEffect(()=>{
    if(!perfil?.id) return;
    fetch(`/api/comentarios/listar.php?escort_id=${perfil.id}`).then(r=>r.json()).then(d=>{
      if(d.success){
        setComentarios(d.comentarios||[]);
        setComentariosTotal(d.total||0);
      }
    }).catch(()=>{});
  },[perfil?.id]);
  const enviarComentario = async () => {
    setErrorForm(null);
    if(!getUsuarioToken()){ window.location.href='/ingresar'; return; }
    if(!comentarioTexto.trim() || comentarioTexto.trim().length<10){ setErrorForm('El comentario debe tener al menos 10 caracteres'); return; }
    if(!codigo.trim()){ setErrorForm('Código de verificación requerido'); return; }
    setEnviando(true);
    try{
      const res = await fetch('/api/comentarios/crear.php',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+getUsuarioToken()},
        body: JSON.stringify({escort_id: perfil?.id, comentario: comentarioTexto.trim(), puntuacion, codigo_verificacion: codigo.trim().toUpperCase()})
      });
      const data = await res.json();
      if(data.success){
        setComentarioTexto('');
        setCodigo('');
        setPuntuacion(5);
        // recargar
        const r2 = await fetch(`/api/comentarios/listar.php?escort_id=${perfil?.id}`);
        const d2 = await r2.json();
        if(d2.success){ setComentarios(d2.comentarios||[]); setComentariosTotal(d2.total||0); }
      } else {
        setErrorForm(data.fieldErrors?.codigo_verificacion || data.error || 'Error al enviar');
      }
    }catch(e:any){
      setErrorForm('Error de conexión');
    }finally{ setEnviando(false); }
  };
  const toggleFavorito = async () => {
    if(!getUsuarioToken()){ window.location.href='/ingresar'; return; }
    if(!perfil?.id) return;
    const method = favorito ? 'DELETE' : 'POST';
    try{
      const res = await fetch(`/api/escorts/favorito.php?id=${perfil.id}`,{
        method,
        headers:{ 'Authorization':'Bearer '+getUsuarioToken() }
      });
      const data = await res.json();
      if(data.success){
        setLikes(data.likes||0);
        setFavorito(!!data.favorito);
      }
    }catch{}
  };
  const handleShare = async () => {
    setShowShare(true);
  };
  const copyLink = async () => {
    try{ await navigator.clipboard.writeText(window.location.href); alert('Enlace copiado'); }catch{}
  };
  const handleQR = () => {
    setShowQR(true);
  };
  const handleReportOpen = () => {
    if(!getUsuarioToken()){ window.location.href='/ingresar'; return; }
    setShowReport(true);
    setReportMsg(null);
  };
  const handleReportSubmit = async () => {
    if(!perfil?.id || !reportMotivo.trim()){ setReportMsg('Selecciona un motivo'); return; }
    setReportEnviando(true);
    setReportMsg(null);
    try{
      const res = await fetch('/api/reportes.php',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+getUsuarioToken()},
        body: JSON.stringify({escort_id: perfil.id, motivo: reportMotivo.trim(), detalle: reportDetalle.trim()})
      });
      const data = await res.json();
      if(data.success){
        setReportMsg('Reporte enviado correctamente');
        setReportMotivo('');
        setReportDetalle('');
        setTimeout(()=> setShowReport(false),1500);
      }else{
        setReportMsg(data.error || 'Error al enviar reporte');
      }
    }catch{
      setReportMsg('Error de conexión');
    }finally{
      setReportEnviando(false);
    }
  };
  if(loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
        <div className="animate-pulse text-gray-400">Cargando perfil...</div>
      </div>
    );
  }
  if(!perfil) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-gray-400">Perfil no encontrado</p>
        </div>
      </div>
    );
  }
  const isActive = Number(perfil.activa_vigente) === 1;
  if(!isActive) {
    const ciudad = perfil.ciudad || '';
    const foto = perfil.foto_principal || '';
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white">
        <div className="text-center px-4 max-w-lg mx-auto">
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-gray-600">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" className="w-full h-full object-cover opacity-30 grayscale" />
              ) : (
                <i className="fas fa-user text-gray-400 text-4xl"></i>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center border-2 border-[#0a0a0f]">
              <i className="fas fa-clock text-gray-400 text-xs"></i>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-1">{perfil.nombre}</h1>
          <p className="text-gray-400 text-sm mb-6">{perfil.edad} años • {ciudad}</p>

          <div className="bg-gray-900/50 border border-white/10 rounded-xl p-6 mb-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <i className="fas fa-pause-circle text-yellow-500 text-2xl"></i>
            </div>
            <h2 className="text-lg font-semibold mb-2">Perfil temporalmente no disponible</h2>
            <p className="text-gray-400 text-sm">
              Esta escort ha pausado su perfil o está siendo revisado por nuestro equipo.
              Vuelve a intentarlo más tarde o explora otros perfiles disponibles.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={()=>window.history.length>1?window.history.back():window.location.href='/'}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white border border-white/10 rounded-lg font-medium transition-all"
            >
              <i className="fas fa-arrow-left"></i> Volver
            </button>
          </div>
        </div>
      </div>
    );
  }
  const portadaFoto = perfil.fotos?.find(f => f.es_portada === 1) || perfil.fotos?.[0];
  const foto = portadaFoto
    ? (portadaFoto.tipo === 'video' && portadaFoto.gif_url ? portadaFoto.gif_url : portadaFoto.url)
    : (perfil.foto_principal || '');
  const serviciosInc = perfil.servicios?.filter(s => s.incluido === 1) || [];
  const serviciosAd = perfil.servicios?.filter(s => s.incluido === 0) || [];
  const verificado = Number(perfil.verificado_vigente ?? perfil.verificado ?? 0);
  const ratingNum = Number(perfil.rating || 0);
  const estrellas = Array.from({ length: 5 }, (_, i) => i < Math.round(ratingNum) ? '★' : '☆').join('');
  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <nav className="text-sm text-gray-400 mb-6">Inicio / {perfil.ciudad} / {perfil.nombre}</nav>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="relative mx-auto md:mx-0 flex-shrink-0">
            <div className="w-48 h-48 rounded-full overflow-hidden bg-gray-800">
              {foto && <img src={foto} className="w-full h-full object-cover" alt={perfil.nombre}/>}
            </div>
            {(Number(perfil.vip_vigente ?? perfil.vip ?? 0) === 1 || Number(perfil.verificado_vigente ?? perfil.verificado ?? 0) === 1) && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 flex gap-2 z-10">
                {Number(perfil.vip_vigente ?? perfil.vip ?? 0) === 1 && (
                  <span className="w-9 h-9 bg-yellow-500 rounded-full border-2 border-[#0a0a0f] flex items-center justify-center text-black shadow-lg">
                    <i className="fas fa-crown text-xs"></i>
                  </span>
                )}
                {Number(perfil.verificado_vigente ?? perfil.verificado ?? 0) === 1 && (
                  <span className="w-9 h-9 bg-blue-500 rounded-full border-2 border-[#0a0a0f] flex items-center justify-center text-white shadow-lg">
                    <i className="fas fa-check text-xs"></i>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{perfil.nombre} <span className="text-gray-400">, {perfil.edad} Años</span></h1>
            {verificado === 1 ? <p className="text-green-400 text-sm mt-1">Verificada</p> : <p className="text-yellow-400 text-sm mt-1">Fotografías sin verificar</p>}
            <div className="flex items-center gap-2 mt-1 text-yellow-400">{estrellas} <span className="text-white">{perfil.rating} ({perfil.total_valoraciones})</span></div>
            <p className="text-green-400 mt-2">{perfil.telefono || ''}</p>
            <div className="flex gap-2 mt-4 flex-wrap">
              {perfil.telefono && <a href={`tel:${perfil.telefono}`} target="_blank" className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center"><i className="fas fa-phone"></i></a>}
              {perfil.whatsapp && <a href={`https://wa.me/${perfil.whatsapp}`} target="_blank" className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M20.5 3.5A11 11 0 0 0 3.5 20.5L2 22l1.8-5.3A11 11 0 1 0 20.5 3.5zM12 20a8 8 0 1 1 8-8c0 .4-.1.8-.1 1.2l-1.1-.3-1.6.9-.5-1.1c-.5-.1-1-.2-1.5-.2-4.4 0-8 3.6-8 8 .4 0 .8-.1 1.2-.1l.9-1.6.9-1.6-.3-1.1z"/></svg></a>}
              <button onClick={handleShare} className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center"><i className="fas fa-share-alt"></i></button>
              <button onClick={handleQR} className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center"><i className="fas fa-qrcode"></i></button>
              <button onClick={toggleFavorito} className={`px-4 py-2 rounded-lg text-sm flex items-center gap-1 ${favorito ? 'bg-red-600' : 'bg-red-900/50'}`}>
                <i className={`fas fa-heart ${favorito ? 'text-white' : 'text-gray-300'}`}></i> {likes}
              </button>
              <button onClick={handleReportOpen} className="px-4 py-2 rounded-lg text-sm bg-gray-700">Reportar</button>
            </div>
            <div className="mt-4 text-sm text-gray-300 flex items-center gap-2 flex-wrap uppercase tracking-wide">
              <span>MUJER</span>
              <span className="text-gray-500">/</span>
              <span className="flex items-center gap-1">
                <span className="font-semibold">{likes}</span>
                <i className="fas fa-heart text-red-500 text-xs"></i>
              </span>
              <span className="text-gray-500">/</span>
              <span>{perfil.ciudad?.toUpperCase()}</span>
            </div>
          </div>
        </div>
        
        {perfil.descripcion_corta && (
          <div className="mt-8 text-gray-200" dangerouslySetInnerHTML={{__html:sanitizeHtml(perfil.descripcion_corta)}}/>
        )}
        {perfil.descripcion_larga && (
          <div className="mt-8 text-gray-200" dangerouslySetInnerHTML={{__html:sanitizeHtml(perfil.descripcion_larga)}}/>
        )}
        
        <h2 className="mt-8 mb-4 font-bold flex items-center gap-2"><i className="fas fa-clipboard-list text-red-500"/> Detalles</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            {k:'EDAD',v:perfil.edad+' Años'},
            {k:'ALTURA',v:perfil.altura?perfil.altura+' Cm':''},
            {k:'PESO',v:perfil.peso?perfil.peso+' Kg':''},
            {k:'MEDIDAS',v:perfil.medidas||''},
            {k:'NACIONALIDAD',v:perfil.nacionalidad||''},
            {k:'ETNIA',v:perfil.etnia||''},
            {k:'COLOR DE PELO',v:perfil.color_pelo||''},
            {k:'COLOR DE OJOS',v:perfil.color_ojos||''},
            {k:'ORIENTACION',v:perfil.orientacion||''},
            {k:'ESTILO',v:perfil.estilo||''},
            {k:'CIUDAD',v:perfil.ciudad||''},
            {k:'IDIOMAS',v:perfil.idiomas||''},
          ].filter(it=>it.v && String(it.v).trim()!=='').map(it=>(
            <div key={it.k} className="bg-gray-900/40 rounded p-3">
              <div className="text-gray-400 text-xs">{it.k}</div>
              <div className="text-white">{it.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="text-gray-400 text-xs mb-2">SERVICIOS INCLUIDOS</div>
          <div className="flex gap-2 flex-wrap">{serviciosInc.map(s=><span key={s.nombre} className="px-3 py-1 bg-red-600 rounded text-xs">{s.nombre}</span>)}</div>
          <div className="text-gray-400 text-xs mt-4 mb-2">SERVICIOS ADICIONALES</div>
          <div className="flex gap-2 flex-wrap">{serviciosAd.map(s=><span key={s.nombre} className="px-3 py-1 bg-red-900/50 rounded text-xs border border-red-700">{s.nombre}</span>)}</div>
        </div>

        <h2 className="mt-8 mb-2 font-bold flex items-center gap-2"><i className="fas fa-images text-red-500"/> Galería</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          {Number(perfil.verificado_vigente ?? perfil.verificado ?? 0) === 1 && (
            <span className="inline-flex items-center gap-1.5 text-blue-400">
              <i className="fas fa-check-circle"></i> Verificada
            </span>
          )}
          {Number(perfil.vip_vigente ?? perfil.vip ?? 0) === 1 && (
            <span className="inline-flex items-center gap-1.5 text-yellow-400">
              <i className="fas fa-crown"></i> VIP
            </span>
          )}
          {perfil.created_at && (
            <span className="inline-flex items-center gap-1.5 text-gray-400">
              <i className="fas fa-calendar"></i> {new Date(perfil.created_at).toLocaleDateString('es-CL',{month:'short',year:'numeric'}).replace('.', '')}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-gray-400">
            <i className="fas fa-map-marker-alt"></i> {perfil.ciudad}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(perfil.fotos||[]).map((f,i)=>(
            <a key={i} data-fancybox="gallery" href={f.url} className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-800">
              <img src={f.url} className="w-full h-full object-cover hover:scale-105 transition"/>
            </a>
          ))}
        </div>

        <h2 className="mt-10 mb-4 font-bold">Comentarios {comentariosTotal>0 && `(${comentariosTotal})`}</h2>
        {getUsuarioToken() ? (
          <div className="bg-gray-900/40 border border-white/10 rounded-xl p-5 mb-6">
            <h3 className="text-white text-sm font-semibold mb-3">Deja tu comentario</h3>
            <textarea value={comentarioTexto} onChange={e=>setComentarioTexto(e.target.value)} rows={3} placeholder={`Escribe tu experiencia con ${perfil.nombre}...`} className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-red-500/50 mb-3"/>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-400 text-xs">Puntuación:</span>
              <div className="flex gap-1">{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setPuntuacion(n)} className={`text-sm ${n<=puntuacion?'text-yellow-400':'text-gray-600'}`}><i className="fas fa-star"/></button>)}</div>
            </div>
            <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} maxLength={6} placeholder="Código de verificación" className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm uppercase tracking-widest mb-3"/>
            {errorForm && <p className="text-red-400 text-xs mb-2">{errorForm}</p>}
            <button onClick={enviarComentario} disabled={enviando} className="px-4 py-2 bg-red-600 rounded-lg text-sm disabled:opacity-50">{enviando?'Enviando...':'Enviar comentario'}</button>
          </div>
        ) : (
          <div className="bg-gray-900/40 border border-white/10 rounded-xl p-6 mb-6 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-300 mb-3">
              <i className="fas fa-user-friends text-gray-400"></i>
              <span>Debe ser <span className="text-red-400 font-semibold">usuario registrado</span> para poder comentar</span>
            </div>
            <a href="/mi-cuenta/registro" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg text-sm">
              <i className="fas fa-user-plus"></i> Registrarse
            </a>
          </div>
        )}
        <div className="space-y-4">
          {comentarios.length===0 && <div className="bg-gray-900/40 rounded-xl p-6 text-gray-400">No hay comentarios aún.</div>}
          {comentarios.map((c:any,i:number)=>(
            <div key={i} className="bg-gray-900/40 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs font-bold">{c.usuario?.charAt(0)?.toUpperCase()}</div>
                <span className="text-gray-300 text-sm font-medium">{c.usuario}</span>
                {c.cita_verificada && <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">Cita verificada</span>}
              </div>
              <div className="flex items-center gap-2 mb-2 pl-9">
                {c.puntuacion && <span className="text-yellow-400">{Array.from({length:c.puntuacion}).map((_,k)=><i key={k} className="fas fa-star text-[10px]"/> )}</span>}
                <span className="text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})}</span>
              </div>
              <p className="text-gray-300 text-sm">{c.comentario}</p>
            </div>
          ))}
        </div>

        {/* Share Modal */}
        {showShare && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={()=>setShowShare(false)}>
            <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl max-w-md w-full p-6 relative" onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setShowShare(false)} className="absolute top-3 right-3 text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
              <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                <i className="fa-solid fa-share-nodes text-red-400"></i> Compartir perfil
              </h3>
              <p className="text-gray-400 text-sm mb-5">Comparte el perfil de {perfil?.nombre} con quien quieras</p>
              <div className="grid grid-cols-3 gap-3">
                <a href={`https://wa.me/?text=${encodeURIComponent('Te recomiendo el perfil de '+ (perfil?.nombre||'') +' en Kimi')}%0A${encodeURIComponent(window.location.href)}`} target="_blank" className="flex flex-col items-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style={{background:'#25D366'}}><i className="fab fa-whatsapp text-[20px]"></i></span>
                  <span className="text-white text-xs font-medium">WhatsApp</span>
                </a>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Te recomiendo el perfil de '+ (perfil?.nombre||'') +' en Kimi')}&url=${encodeURIComponent(window.location.href)}`} target="_blank" className="flex flex-col items-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style={{background:'#000'}}><svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M18.2 4.8h2.4l-5.3 6.1 6.3 8.4h-4.9l-3.8-5-4.4 5H5.5l5.7-6.5L4.4 4.8h5l3.4 4.5 3.9-4.5z"/></svg></span>
                  <span className="text-white text-xs font-medium">X / Twitter</span>
                </a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} target="_blank" className="flex flex-col items-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style={{background:'#1877F2'}}><svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 5 3.7 9.1 8.5 9.9v-7H8v-2.9h2.5V9.5c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.3.2 2.3.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6v1.9h2.9l-.5 2.9H13.5v7C18.3 21.1 22 17 22 12z"/></svg></span>
                  <span className="text-white text-xs font-medium">Facebook</span>
                </a>
                <a href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Te recomiendo el perfil de '+ (perfil?.nombre||'') +' en Kimi')}`} target="_blank" className="flex flex-col items-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style={{background:'#229ED9'}}><svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M1.5 12l20-9-9.5 10.5-4-4-1.5 9.5z"/></svg></span>
                  <span className="text-white text-xs font-medium">Telegram</span>
                </a>
                <a href={`mailto:?subject=${encodeURIComponent('Te recomiendo el perfil de '+ (perfil?.nombre||'') +' en Kimi')}&body=${encodeURIComponent('Te recomiendo el perfil de '+ (perfil?.nombre||'') +' en Kimi\n'+window.location.href)}`} className="flex flex-col items-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg" style={{background:'#6b7280'}}><i className="fas fa-envelope"></i></span>
                  <span className="text-white text-xs font-medium">Email</span>
                </a>
              </div>
              <button onClick={copyLink} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-all">
                <i className="fas fa-link"></i> Copiar enlace
              </button>
            </div>
          </div>
        )}

        {/* QR Modal */}
        {showQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={()=>setShowQR(false)}>
            <div className="bg-[#0a0a0f] border border-white/10 rounded-xl p-6 max-w-sm w-full text-center" onClick={e=>e.stopPropagation()}>
              <h3 className="text-white font-semibold mb-4">Código QR del perfil</h3>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.href)}`} alt="QR" className="mx-auto rounded-lg"/>
              <p className="text-gray-400 text-xs mt-3">Escanea para abrir este perfil</p>
              <button onClick={()=>setShowQR(false)} className="mt-4 px-4 py-2 bg-red-600 rounded-lg text-sm text-white">Cerrar</button>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {showReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={()=>setShowReport(false)}>
            <div className="bg-[#0a0a0f] border border-white/10 rounded-xl p-6 max-w-md w-full" onClick={e=>e.stopPropagation()}>
              <h3 className="text-white font-semibold mb-4">Reportar perfil</h3>
              {reportMsg && <p className={`text-sm mb-3 ${reportMsg.includes('correct')?'text-green-400':'text-red-400'}`}>{reportMsg}</p>}
              <label className="text-gray-300 text-sm">Motivo</label>
              <select value={reportMotivo} onChange={e=>setReportMotivo(e.target.value)} className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3">
                <option value="">Selecciona un motivo</option>
                <option value="Contenido inapropiado">Contenido inapropiado</option>
                <option value="Información falsa">Información falsa</option>
                <option value="Perfil duplicado">Perfil duplicado</option>
                <option value="Spam">Spam</option>
                <option value="Otro">Otro</option>
              </select>
              <label className="text-gray-300 text-sm">Detalle</label>
              <textarea value={reportDetalle} onChange={e=>setReportDetalle(e.target.value)} rows={3} placeholder="Describe el problema..." className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3"/>
              <div className="flex gap-2 justify-end">
                <button onClick={()=>setShowReport(false)} className="px-4 py-2 rounded-lg text-sm bg-gray-700">Cancelar</button>
                <button onClick={handleReportSubmit} disabled={reportEnviando} className="px-4 py-2 rounded-lg text-sm bg-red-600 disabled:opacity-50">{reportEnviando?'Enviando...':'Enviar reporte'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
