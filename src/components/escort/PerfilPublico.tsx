// src/components/escort/PerfilPublico.tsx
import { useState, useEffect } from 'react';
import { getUsuarioToken } from '../../lib/usuarioAuth';
import { sanitizeHtml } from '../../lib/sanitize';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface Servicio {
  id: number;
  nombre: string;
  grupo: string;
  color: string;
  icono: string;
  incluido: number;
}

interface Foto {
  id: number;
  url: string;
  orden: number;
  es_principal: number;
}

interface EscortPerfil {
  id: number;
  nombre: string;
  slug: string;
  email: string;
  telefono: string | null;
  whatsapp: string | null;
  edad: number;
  altura: number | null;
  peso: number | null;
  medidas: string | null;
  ciudad: string;
  nacionalidad: string | null;
  idiomas: string | null;
  orientacion: string | null;
  etnia: string | null;
  color_ojos: string | null;
  color_pelo: string | null;
  estilo: string | null;
  descripcion_corta: string | null;
  descripcion_larga: string | null;
  foto_principal: string | null;
  video_presentacion: string | null;
  verificado: number;
  vip: number;
  destacado: number;
  visitas_perfil: number;
  contactos_recibidos: number;
  rating: string;
  total_valoraciones: number;
  servicios: Servicio[];
  fotos: Foto[];
}

const GRUPOS_SERVICIOS: Record<string, { label: string; icon: string }> = {
  sexual: { label: 'Sexual', icon: 'fa-heart' },
  relajacion: { label: 'Relajacion', icon: 'fa-spa' },
  acompanamiento: { label: 'Acompanamiento', icon: 'fa-glass-cheers' },
  experiencia: { label: 'Experiencia', icon: 'fa-star' },
  adicional: { label: 'Adicional', icon: 'fa-plus-circle' },
  lugar: { label: 'Lugar', icon: 'fa-map-marker-alt' },
  tiempo: { label: 'Tiempo', icon: 'fa-clock' },
  especial: { label: 'Especial', icon: 'fa-fire' },
  virtual: { label: 'Virtual', icon: 'fa-video' },
};

export default function PerfilPublico() {
  const [perfil, setPerfil] = useState<EscortPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likes, setLikes] = useState(0);
  const [favorito, setFavorito] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [valoraciones, setValoraciones] = useState<any[]>([]);
  const [vRating, setVRating] = useState(5);
  const [vComentario, setVComentario] = useState('');
  const [vAnonimo, setVAnonimo] = useState(false);
  const [vLoading, setVLoading] = useState(false);
  const [vMsg, setVMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');
    if (!id) {
      const match = window.location.pathname.match(/^\/(\d+)(?:\/|$)/);
      if (match) id = match[1];
    }
    if (!id) {
      setError('Perfil no encontrado');
      setLoading(false);
      return;
    }
    fetch(`/api/escort/perfil-publico.php?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.perfil) {
          setPerfil(data.perfil);
          document.title = `${data.perfil.nombre} - Escort en ${data.perfil.ciudad}`;
        } else {
          setError(data.error || 'Perfil no encontrado');
        }
      })
      .catch(() => setError('Error de conexion'))
      .finally(() => setLoading(false));

    // Fetch favorite status
    const token = getUsuarioToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`/api/escorts/favorito.php?id=${id}`, { headers })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setLikes(data.likes);
          setFavorito(data.favorito);
        }
      })
      .catch(() => {});

    // Fetch valoraciones
    fetch(`/api/escorts/valorar.php?escort_id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setValoraciones(data.valoraciones);
      })
      .catch(() => {});
  }, []);

  const toggleFavorite = async () => {
    if (!perfil) return;
    const token = getUsuarioToken();
    if (!token) { window.location.href = '/ingresar'; return; }

    setFavoriteLoading(true);
    try {
      const res = await fetch(`/api/escorts/favorito.php?id=${perfil.id}`, {
        method: favorito ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLikes(data.likes);
        setFavorito(data.favorito);
      }
    } catch {}
    setFavoriteLoading(false);
  };

  const submitValoracion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil) return;
    const token = getUsuarioToken();
    if (!token) { window.location.href = '/ingresar'; return; }

    setVLoading(true);
    setVMsg('');
    try {
      const res = await fetch('/api/escorts/valorar.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ escort_id: perfil.id, general: vRating, comentario: vComentario, anonimo: vAnonimo }),
      });
      const data = await res.json();
      if (data.success) {
        setVMsg('Valoración enviada correctamente. Gracias!');
        setVComentario('');
        // Refrescar valoraciones
        const r = await fetch(`/api/escorts/valorar.php?escort_id=${perfil.id}`);
        const rd = await r.json();
        if (rd.success) setValoraciones(rd.valoraciones);
      } else {
        setVMsg(data.error || 'Error al enviar valoración');
      }
    } catch {
      setVMsg('Error de conexión');
    }
    setVLoading(false);
  };

  // Inicializar Fancybox cuando haya fotos
  useEffect(() => {
    if (!perfil?.fotos?.length) return;

    const initFancybox = () => {
      const F = (window as any).Fancybox;
      if (F) {
         F.bind('[data-fancybox="galeria"]', {
          loop: true,
          buttons: ['zoom', 'slideShow', 'fullScreen', 'close'],
          Thumbs: { autoStart: false },
          animationEffect: 'fade',
          transitionEffect: 'slide',
        });
      }
    };

    // Esperar a que el script de Fancybox cargue
    if ((window as any).Fancybox) {
      initFancybox();
    } else {
      const check = setInterval(() => {
        if ((window as any).Fancybox) {
          initFancybox();
          clearInterval(check);
        }
      }, 200);
      setTimeout(() => clearInterval(check), 5000);
    }
  }, [perfil?.fotos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="relative w-full max-w-full mx-auto px-4 pt-6 pb-8">
          <Skeleton width={180} height={16} className="mb-6" baseColor="#1a1a2e" highlightColor="#2d2d44" />
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
            <div className="lg:w-80 shrink-0">
              <Skeleton className="aspect-[3/4] rounded-2xl w-full" baseColor="#1a1a2e" highlightColor="#2d2d44" />
              <Skeleton height={48} className="mt-4 rounded-xl" baseColor="#1a1a2e" highlightColor="#2d2d44" />
              <div className="mt-3 space-y-3">
                <Skeleton height={48} className="rounded-xl" baseColor="#1a1a2e" highlightColor="#2d2d44" />
                <Skeleton height={48} className="rounded-xl" baseColor="#1a1a2e" highlightColor="#2d2d44" />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#13131a]"><Skeleton count={2} baseColor="#1f1f35" highlightColor="#2d2d44" /></div>
                <div className="p-4 rounded-xl bg-[#13131a]"><Skeleton count={2} baseColor="#1f1f35" highlightColor="#2d2d44" /></div>
                <div className="p-4 rounded-xl bg-[#13131a]"><Skeleton count={2} baseColor="#1f1f35" highlightColor="#2d2d44" /></div>
                <div className="p-4 rounded-xl bg-[#13131a]"><Skeleton count={2} baseColor="#1f1f35" highlightColor="#2d2d44" /></div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Skeleton height={36} width="60%" className="mb-2" baseColor="#1a1a2e" highlightColor="#2d2d44" />
              <Skeleton height={16} width="40%" className="mb-6" baseColor="#1a1a2e" highlightColor="#2d2d44" />
              <Skeleton count={2} className="mb-6" baseColor="#1a1a2e" highlightColor="#2d2d44" />
              <div className="bg-[#13131a] rounded-2xl p-5 mb-6">
                <Skeleton height={16} width={140} className="mb-4" baseColor="#1f1f35" highlightColor="#2d2d44" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton width={36} height={36} borderRadius={8} baseColor="#1f1f35" highlightColor="#2d2d44" />
                      <div className="flex-1"><Skeleton count={2} baseColor="#1f1f35" highlightColor="#2d2d44" /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#13131a] rounded-2xl p-5 mb-6">
                <Skeleton height={16} width={120} className="mb-4" baseColor="#1f1f35" highlightColor="#2d2d44" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} width={80 + Math.random() * 60} height={32} borderRadius={999} baseColor="#1f1f35" highlightColor="#2d2d44" />
                  ))}
                </div>
              </div>
              <div>
                <Skeleton height={20} width={100} className="mb-4" baseColor="#1a1a2e" highlightColor="#2d2d44" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[3/4] rounded-xl" baseColor="#1a1a2e" highlightColor="#2d2d44" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center px-4">
          <i className="fas fa-user-slash text-gray-600 text-5xl mb-4"></i>
          <h1 className="text-2xl font-bold text-white mb-2">Perfil no encontrado</h1>
          <p className="text-gray-500">{error}</p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all">
            <i className="fas fa-arrow-left"></i> Volver al directorio
          </a>
        </div>
      </div>
    );
  }

  if (!perfil) return null;

  const fotoPrincipal = perfil.foto_principal || (perfil.fotos.length > 0 ? perfil.fotos[0].url : null);
  const idiomasArr = perfil.idiomas ? perfil.idiomas.split(',').map(i => i.trim()).filter(Boolean) : [];

  const serviciosIncluidos = perfil.servicios?.filter(s => s.incluido === 1) || [];
  const serviciosAdicionales = perfil.servicios?.filter(s => s.incluido === 0) || [];

  const groupByGrupo = (servs: Servicio[]) => {
    return servs.reduce((acc: Record<string, Servicio[]>, s) => {
      const g = s.grupo || 'otros';
      if (!acc[g]) acc[g] = [];
      acc[g].push(s);
      return acc;
    }, {});
  };

  const incluidosGrouped = groupByGrupo(serviciosIncluidos);
  const adicionalesGrouped = groupByGrupo(serviciosAdicionales);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fancyapps/ui@6.1.14/dist/fancybox/fancybox.css" />

      {/* ===== HERO / PORTADA ===== */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 via-[#0a0a0f] to-[#0a0a0f]"></div>

        <div className="relative w-full max-w-full mx-auto px-4 pt-6 pb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <a href="/" className="hover:text-red-400 transition-colors">Inicio</a>
            <i className="fas fa-chevron-right text-xs"></i>
            <span className="text-gray-400">{perfil.nombre}</span>
          </nav>

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
            {/* ===== COLUMNA IZQUIERDA ===== */}
            <div className="lg:w-80 shrink-0">
              {/* Foto principal */}
              <div className="relative group">
                <div className="aspect-3/4 rounded-2xl overflow-hidden bg-[#13131a] border border-gray-800">
                  {fotoPrincipal ? (
                    <a href={fotoPrincipal} data-fancybox="galeria" data-caption={perfil.nombre}>
                      <img 
                        src={fotoPrincipal} 
                        alt={perfil.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-zoom-in"
                      />
                    </a>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="fas fa-user text-gray-700 text-6xl"></i>
                    </div>
                  )}
                </div>

                {/* Badges - moved under Galería title */}

                {perfil.total_valoraciones > 0 && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-amber-400 text-sm font-semibold">
                    <i className="fas fa-star"></i>
                    <span>{perfil.rating}</span>
                    <span className="text-gray-400 text-xs">({perfil.total_valoraciones})</span>
                  </div>
                )}

                {Number(perfil.verificado) === 1 && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500 text-white text-[0.6rem] font-bold shadow-lg">
                    <i className="fas fa-check-circle text-[0.5rem]"></i>
                    VERIF
                  </div>
                )}
              </div>

              {/* Favorito */}
              <div className="mt-4">
                <button
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                  className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold transition-all text-base ${
                    favorito
                      ? 'bg-red-500/15 text-red-400 border-2 border-red-500/40 hover:bg-red-500/25 shadow-lg shadow-red-500/10'
                      : 'bg-[#1a1a2e] text-gray-300 border-2 border-gray-700/50 hover:border-red-500/40 hover:text-red-400 hover:bg-[#1f1f35]'
                  }`}
                >
                  {favoriteLoading ? (
                    <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full"></div>
                  ) : (
                    <i className={`fas fa-heart text-lg ${favorito ? 'text-red-500' : ''}`}></i>
                  )}
                  <span>{favorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}</span>
                  <span className="text-sm opacity-60 ml-1">({likes})</span>
                </button>
              </div>

              {/* Botones contacto */}
              <div className="mt-3 space-y-3">
                {perfil.whatsapp && (
                  <a 
                    href={`https://wa.me/${perfil.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-600/20"
                  >
                    <i className="fab fa-whatsapp text-xl"></i>
                    <span>WhatsApp</span>
                  </a>
                )}
                {perfil.telefono && (
                  <a 
                    href={`tel:${perfil.telefono.replace(/\D/g, '')}`}
                    className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/20"
                  >
                    <i className="fas fa-phone"></i>
                    <span>Llamar</span>
                  </a>
                )}
              </div>

              {/* Info rapida */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="bg-[#13131a] border border-gray-800 rounded-xl p-3 text-center">
                  <i className="fas fa-birthday-cake text-red-400 text-lg mb-1"></i>
                  <p className="text-white font-semibold text-sm">{perfil.edad} anos</p>
                  <p className="text-gray-500 text-xs">Edad</p>
                </div>
                {perfil.altura && (
                  <div className="bg-[#13131a] border border-gray-800 rounded-xl p-3 text-center">
                    <i className="fas fa-ruler-vertical text-red-400 text-lg mb-1"></i>
                    <p className="text-white font-semibold text-sm">{perfil.altura} cm</p>
                    <p className="text-gray-500 text-xs">Altura</p>
                  </div>
                )}
                {perfil.peso && (
                  <div className="bg-[#13131a] border border-gray-800 rounded-xl p-3 text-center">
                    <i className="fas fa-weight-scale text-red-400 text-lg mb-1"></i>
                    <p className="text-white font-semibold text-sm">{perfil.peso} kg</p>
                    <p className="text-gray-500 text-xs">Peso</p>
                  </div>
                )}
                {perfil.medidas && (
                  <div className="bg-[#13131a] border border-gray-800 rounded-xl p-3 text-center">
                    <i className="fas fa-ruler-combined text-red-400 text-lg mb-1"></i>
                    <p className="text-white font-semibold text-sm">{perfil.medidas}</p>
                    <p className="text-gray-500 text-xs">Medidas</p>
                  </div>
                )}
              </div>
            </div>

            {/* ===== COLUMNA DERECHA ===== */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{perfil.nombre}</h1>
                <div className="flex flex-wrap items-center gap-3 text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="fas fa-map-marker-alt text-red-400"></i>
                    {perfil.ciudad}
                  </span>
                  {perfil.nacionalidad && (
                    <span className="inline-flex items-center gap-1.5">
                      <i className="fas fa-globe text-red-400"></i>
                      {perfil.nacionalidad}
                    </span>
                  )}
                  {perfil.estilo && (
                    <span className="inline-flex items-center gap-1.5">
                      <i className="fas fa-magic text-red-400"></i>
                      {perfil.estilo}
                    </span>
                  )}
                </div>
              </div>

              {/* Descripcion corta */}
              {perfil.descripcion_corta && (
                <p className="text-gray-300 text-lg mb-6 leading-relaxed">{perfil.descripcion_corta}</p>
              )}

              {/* Caracteristicas */}
              <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5 mb-6">
                <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                  <i className="fas fa-user-circle"></i> Caracteristicas
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {perfil.orientacion && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                        <i className="fas fa-venus-mars text-red-400 text-sm"></i>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Orientacion</p>
                        <p className="text-white text-sm font-medium">{perfil.orientacion}</p>
                      </div>
                    </div>
                  )}
                  {perfil.etnia && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                        <i className="fas fa-user text-red-400 text-sm"></i>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Etnia</p>
                        <p className="text-white text-sm font-medium">{perfil.etnia}</p>
                      </div>
                    </div>
                  )}
                  {perfil.color_ojos && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                        <i className="fas fa-eye text-red-400 text-sm"></i>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Ojos</p>
                        <p className="text-white text-sm font-medium">{perfil.color_ojos}</p>
                      </div>
                    </div>
                  )}
                  {perfil.color_pelo && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                        <i className="fas fa-cut text-red-400 text-sm"></i>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Pelo</p>
                        <p className="text-white text-sm font-medium">{perfil.color_pelo}</p>
                      </div>
                    </div>
                  )}
                  {idiomasArr.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                        <i className="fas fa-language text-red-400 text-sm"></i>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Idiomas</p>
                        <p className="text-white text-sm font-medium">{idiomasArr.join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Descripcion larga */}
              {perfil.descripcion_larga && (
                <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5 mb-6">
                  <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                    <i className="fas fa-align-left"></i> Sobre mi
                  </h2>
                  <div
                    className="text-gray-300 text-sm leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-700 [&_td]:p-2 [&_th]:border [&_th]:border-gray-700 [&_th]:p-2 [&_th]:bg-[#1a1a2e] [&_img]:rounded-lg [&_a]:text-red-400 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(perfil.descripcion_larga) }}
                  />
                </div>
              )}

              {/* Servicios */}
              {(serviciosIncluidos.length > 0 || serviciosAdicionales.length > 0) && (
                <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5 mb-6">
                  <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                    <i className="fas fa-hand-sparkles"></i> Servicios
                  </h2>

                  {Object.keys(incluidosGrouped).length > 0 && (
                    <div className="mb-5">
                      <h3 className="text-green-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                        <i className="fas fa-check-circle"></i> Incluidos
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(incluidosGrouped).map(([grupo, servs]) => (
                          <div key={grupo}>
                            <h4 className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <i className={`fas ${GRUPOS_SERVICIOS[grupo]?.icon || 'fa-circle'} text-gray-600 text-[10px]`}></i>
                              {GRUPOS_SERVICIOS[grupo]?.label || grupo}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {servs.map((s: Servicio) => (
                                <span key={s.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-green-500/10 text-green-400 border border-green-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color || '#22c55e' }}></span>
                                  {s.nombre}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(adicionalesGrouped).length > 0 && (
                    <div>
                      <h3 className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                        <i className="fas fa-plus-circle"></i> Adicionales
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(adicionalesGrouped).map(([grupo, servs]) => (
                          <div key={grupo}>
                            <h4 className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <i className={`fas ${GRUPOS_SERVICIOS[grupo]?.icon || 'fa-circle'} text-gray-600 text-[10px]`}></i>
                              {GRUPOS_SERVICIOS[grupo]?.label || grupo}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {servs.map((s: Servicio) => (
                                <span key={s.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color || '#f59e0b' }}></span>
                                  {s.nombre}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Valoraciones */}
              <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5 mb-6">
                <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                  <i className="fas fa-star"></i> Valoraciones
                </h2>

                {!getUsuarioToken() ? (
                  <p className="text-gray-500 text-sm">
                    <a href="/ingresar" className="text-red-400 hover:text-red-300 underline">Inicia sesión</a> para valorar
                  </p>
                ) : (
                  <form onSubmit={submitValoracion} className="mb-6 p-4 bg-[#0f0f1a] rounded-xl border border-white/5">
                    <p className="text-white text-sm font-medium mb-3">Tu valoración</p>
                    <div className="flex items-center gap-1 mb-3">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button" onClick={() => setVRating(n)}
                          className={`text-xl transition-colors ${n <= vRating ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400/50'}`}>
                          <i className="fas fa-star"></i>
                        </button>
                      ))}
                      <span className="text-gray-500 text-sm ml-2">({vRating}/5)</span>
                    </div>
                    <textarea
                      value={vComentario}
                      onChange={e => setVComentario(e.target.value)}
                      placeholder="Comentario (opcional)"
                      maxLength={500}
                      rows={3}
                      className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-red-500/50 mb-3 resize-none"
                    />
                    <label className="flex items-center gap-2 text-gray-500 text-sm mb-3 cursor-pointer">
                      <input type="checkbox" checked={vAnonimo} onChange={e => setVAnonimo(e.target.checked)}
                        className="accent-red-500" />
                      Publicar como anónimo
                    </label>
                    {vMsg && (
                      <p className={`text-sm mb-3 ${vMsg.includes('gracias') || vMsg.includes('correctamente') ? 'text-green-400' : 'text-red-400'}`}>
                        <i className={`fas ${vMsg.includes('gracias') || vMsg.includes('correctamente') ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-1`}></i>
                        {vMsg}
                      </p>
                    )}
                    <button type="submit" disabled={vLoading}
                      className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50">
                      {vLoading ? 'Enviando...' : 'Enviar valoración'}
                    </button>
                  </form>
                )}

                {valoraciones.length === 0 ? (
                  <p className="text-gray-600 text-sm">No hay valoraciones aún. Sé el primero en valorar.</p>
                ) : (
                  <div className="space-y-4">
                    {valoraciones.map((v: any) => (
                      <div key={v.id} className="p-4 bg-[#0f0f1a] rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1a1a2e] flex items-center justify-center">
                              <i className="fas fa-user text-gray-600 text-xs"></i>
                            </div>
                            <span className="text-white text-sm font-medium">{v.usuario_nombre}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(n => (
                              <i key={n} className={`fas fa-star text-[0.6rem] ${n <= Number(v.rating) ? 'text-amber-400' : 'text-gray-700'}`}></i>
                            ))}
                          </div>
                        </div>
                        {v.comentario && <p className="text-gray-400 text-sm">{v.comentario}</p>}
                        <p className="text-gray-600 text-xs mt-1.5">{new Date(v.created_at).toLocaleDateString('es-CL')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Galeria */}
              {perfil.fotos.length > 0 && (
                <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5 mb-6">
                  <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                    <i className="fas fa-images"></i> Galeria
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {perfil.fotos.map((foto: Foto, idx: number) => (
                      <a 
                        key={foto.id}
                        href={foto.url}
                        data-fancybox="galeria"
                        data-caption={`${perfil.nombre} - Foto ${idx + 1}`}
                        className="aspect-square rounded-xl overflow-hidden bg-[#1a1a24] border border-gray-800 hover:border-red-500/50 transition-all group"
                      >
                        <img 
                          src={foto.url} 
                          alt={`${perfil.nombre} foto ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Video */}
              {perfil.video_presentacion && (
                <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5 mb-6">
                  <h2 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                    <i className="fas fa-video"></i> Video
                  </h2>
                  <div className="aspect-video rounded-xl overflow-hidden bg-[#1a1a24]">
                    <video 
                      src={perfil.video_presentacion}
                      controls
                      className="w-full h-full object-cover"
                      poster={fotoPrincipal || ''}
                    >
                      Tu navegador no soporta videos.
                    </video>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#13131a] border border-gray-800 rounded-xl p-4 text-center">
                  <i className="fas fa-eye text-red-400 text-xl mb-2"></i>
                  <p className="text-white font-bold text-lg">{(perfil.visitas_perfil || 0).toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">Visitas</p>
                </div>
                <div className="bg-[#13131a] border border-gray-800 rounded-xl p-4 text-center">
                  <i className="fas fa-phone-alt text-red-400 text-xl mb-2"></i>
                  <p className="text-white font-bold text-lg">{(perfil.contactos_recibidos || 0).toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">Contactos</p>
                </div>
                <div className="bg-[#13131a] border border-gray-800 rounded-xl p-4 text-center">
                  <i className="fas fa-star text-red-400 text-xl mb-2"></i>
                  <p className="text-white font-bold text-lg">{perfil.rating || '0.0'}</p>
                  <p className="text-gray-500 text-xs">Valoracion</p>
                </div>
                <div className="bg-[#13131a] border border-gray-800 rounded-xl p-4 text-center">
                  <i className="fas fa-heart text-red-400 text-xl mb-2"></i>
                  <p className="text-white font-bold text-lg">{likes}</p>
                  <p className="text-gray-500 text-xs">Favoritos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <script src="https://cdn.jsdelivr.net/npm/@fancyapps/ui@6.1.14/dist/fancybox/fancybox.umd.js"></script>
    </div>
  );
}