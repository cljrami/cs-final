"use client";

import { useState, useEffect } from 'react';
import { Skeleton } from '../ui/Skeleton';
import { sanitizeHtml } from '../../lib/sanitize';

const renderHtmlSeguro = (htmlRaw: string | null): string => {
  if (!htmlRaw) return '';
  return sanitizeHtml(htmlRaw);
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
};

interface Servicio {
  id: number;
  nombre: string;
  grupo: string;
  color: string;
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
  categoria_nombre: string | null;
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
  privacidad: string | null;
  en_gira: number;
  gira_ciudad: string | null;
  gira_activa: number;
  gira_fecha_inicio: string | null;
  gira_fecha_fin: string | null;
}

const getUsuarioToken = () => {
  const token = localStorage.getItem("usuario_token");
  return token ? token : '';
};

export default function PerfilPublico() {
  const [perfil, setPerfil] = useState<EscortPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likes, setLikes] = useState(0);
  const [favorito, setFavorito] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [valoraciones, setValoraciones] = useState<any[]>([]);
  const [vRating, setVRating] = useState(0);
  const [vComentario, setVComentario] = useState('');
  const [vCodigo, setVCodigo] = useState('');
  const [vLoading, setVLoading] = useState(false);
  const [vMsg, setVMsg] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [comments, setComments] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null);

  const getUsuarioToken = () => {
    const token = localStorage.getItem("usuario_token");
    return token ? token : '';
  };

  useEffect(() => {
    const fetchPerfil = async () => {
      setLoading(true);
      try {
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
        
        const res = await fetch(`/api/escort/perfil-publico.php?id=${id}&_t=${Date.now()}`);
        const data = await res.json();
        if (data.success && data.perfil) {
          setPerfil(data.perfil);
          document.title = `${data.perfil!.nombre} - Escort en ${data.perfil!.ciudad}`;
        } else {
          setError(data.error || 'Perfil no encontrado');
        }
      } catch (err) {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPerfil();
  }, []);

  useEffect(() => {
    if (!perfil) return;
    
    const fetchFavorite = async () => {
      const token = getUsuarioToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      try {
        const res = await fetch(`/api/escorts/favorito.php?id=${perfil!.id}`, {
          method: 'GET',
          headers: headers
        });
        const data = await res.json();
        if (data.success) {
          setLikes(data.likes);
          setFavorito(data.favorito);
        }
      } catch {
        // Ignore errors
      }
    };
    
    const fetchValoraciones = async () => {
      const token = getUsuarioToken();
      const res = await fetch(`/api/escorts/valorar.php?escort_id=${perfil!.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setValoraciones(data.valoraciones);
      }
    };
    
    const fetchComments = async () => {
      const token = getUsuarioToken();
      const res = await fetch(`/api/escorts/valorar.php?escort_id=${perfil!.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        // Filter to show only comments (not ratings)
        const commentsData = data.valoraciones?.filter(v => v.comentario) || [];
        setComments(commentsData);
      }
    };
    
    fetchFavorite();
    fetchValoraciones();
    fetchComments();
  }, [perfil?.id]);

  const toggleFavorite = async () => {
    if (!perfil) return;
    const token = getUsuarioToken();
    if (!token) { window.location.href = '/ingresar'; return; }
    
    setFavoriteLoading(true);
    try {
      const res = await fetch(`/api/escorts/favorito.php?id=${perfil!.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLikes(data.likes);
        setFavorito(data.favorito);
      }
    } catch {
      // Ignore errors
    } finally {
      setFavoriteLoading(false);
    }
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
        body: JSON.stringify({ 
          escort_id: perfil!.id, 
          general: vRating, 
          comentario: vComentario,
          codigo_verificacion: vCodigo
        })
      });
      const data = await res.json();
      if (data.success) {
        setVMsg(data.message || 'Valoración enviada correctamente');
        setVComentario('');
        setVCodigo('');
        setVRating(0);
      } else {
        setVMsg(data.error || (data.fieldErrors && (data.fieldErrors.codigo_verificacion || data.fieldErrors.comentario)) || 'Error al enviar valoración');
      }
    } catch {
      setVMsg('Error de conexión');
    } finally {
      setVLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId === null) return;
    setDeletingId(deleteConfirmId);
    setDeleteConfirmId(null);
    try {
      const token = getUsuarioToken();
      const res = await fetch('/api/escorts/valorar.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: deleteConfirmId }),
      });
      const data = await res.json();
      if (data.success) {
        setVMsg('Valoración eliminada');
        // Refrescar valoraciones
        const r = await fetch(`/api/escorts/valorar.php?escort_id=${perfil!.id}`);
        const rd = await r.json();
        if (rd.success) setValoraciones(rd.valoraciones);
      } else {
        setVMsg(data.error || 'Error al eliminar');
      }
    } catch {
      setVMsg('Error de conexión');
    }
    setDeletingId(null);
  };

  const showContent = !loading && perfil;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center px-4">
          <i className="fas fa-user-slash text-muted text-5xl mb-4"></i>
          <h1 className="text-2xl font-bold text-ink mb-2">Perfil no encontrado</h1>
          <p className="text-muted">{error}</p>
          <a href="/" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold">
            <i className="fas fa-arrow-left"></i> Volver al directorio
          </a>
        </div>
      </div>
    );
  }

  if (!perfil && !loading) return null;

  const fotoPrincipal = showContent ? (perfil!.foto_principal || (perfil!.fotos.length > 0 ? perfil!.fotos[0].url : null)) : null;

  return (
    <div className="min-h-screen bg-page">
      {/* HERO / PORTADA */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 via-page to-page"></div>
        
        <div className="relative w-full max-w-full mx-auto px-4 pt-6 pb-8">
          {showContent ? (
            <>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted mb-6">
            <a href="/" className="hover:text-red-400 transition-colors">Inicio</a>
            <i className="fas fa-chevron-right text-xs"></i>
            <span className="text-muted">{perfil!.nombre}</span>
          </nav>
          
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
            {/* COLUMNA IZQUIERDA */}
            <div className="lg:w-80 shrink-0">
              {/* Foto principal */}
              <div className="relative group">
                <div className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-surface border border-gray-800" style={{ aspectRatio: '3/4' }}>
                  {fotoPrincipal ? (
                    <img 
                      src={fotoPrincipal} 
                      alt={perfil!.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="fas fa-user text-gray-700 text-6xl"></i>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* COLUMNA DERECHA */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-3xl sm:text-4xl font-bold text-ink mb-2">{perfil!.nombre}</h1>
                {Number(perfil!.total_valoraciones) > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <i key={n} className={`fas fa-star text-sm ${n <= Number(perfil!.rating || 0) ? 'text-amber-400' : 'text-gray-700'}`}></i>
                    ))}
                  </div>
                  <span className="text-ink text-sm font-medium">{(perfil!.rating || 0).toFixed(1)}</span>
                  <span className="text-muted text-xs">({perfil!.total_valoraciones || 0})</span>
                </div>
                )}
                <div className="flex flex-wrap items-center gap-3 text-muted mt-2">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="fas fa-map-marker-alt text-red-400"></i>
                    {perfil!.gira_activa === 1 ? (perfil!.gira_ciudad || perfil!.ciudad) : perfil!.ciudad}
                  </span>
                  {perfil!.edad && (
                    <span className="inline-flex items-center gap-1.5">
                      <i className="fas fa-birthday-cake text-red-400"></i>
                      {perfil!.edad} anos
                    </span>
                  )}
                </div>
              </div>

              {/* Descripción corta y larga apiladas */}
              {(perfil!.descripcion_corta?.trim() || perfil!.descripcion_larga?.trim()) && (
                <div className="mb-8">
                  <h2 className="text-ink font-bold text-lg flex items-center gap-2 mb-4">
                    <i className="fas fa-align-left text-red-500"></i> Descripción
                  </h2>
                  {perfil!.descripcion_corta?.trim() && (
                    <div
                      className="text-muted text-base leading-relaxed ql-editor mb-6 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-700 [&_td]:p-2 [&_th]:border [&_th]:border-gray-700 [&_th]:p-2 [&_th]:bg-surface [&_img]:rounded-lg [&_a]:text-red-400 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: renderHtmlSeguro(perfil!.descripcion_corta.trim()) }}
                    />
                  )}
                  {perfil!.descripcion_larga?.trim() && (
                    <div
                      className="text-muted text-base leading-relaxed ql-editor [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-700 [&_td]:p-2 [&_th]:border [&_th]:border-gray-700 [&_th]:p-2 [&_th]:bg-surface [&_img]:rounded-lg [&_a]:text-red-400 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: renderHtmlSeguro(perfil!.descripcion_larga.trim()) }}
                    />
                  )}
                </div>
              )}

              {/* Formulario de valoración / comentario */}
              <div className="mt-6">
                <h2 className="text-xl font-bold text-ink flex items-center gap-2 mb-4">
                  <i className="fas fa-star text-amber-400"></i>
                  Deja tu valoración
                </h2>
                
                {!getUsuarioToken() ? (
                  <div className="bg-surface border border-edge rounded-xl p-6 text-center">
                    <p className="text-muted mb-4">Inicia sesión para valorar y comentar este perfil</p>
                    <a href="/ingresar" className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors">
                      <i className="fas fa-sign-in-alt"></i> Iniciar Sesión
                    </a>
                  </div>
                ) : (
                  <form onSubmit={submitValoracion} className="bg-surface border border-edge rounded-xl p-5 space-y-4">
                    <div>
                      <label className="text-muted text-sm block mb-2">Tu calificación</label>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(n => (
                          <button type="button" key={n} onClick={() => setVRating(n)} className="focus:outline-none transition-transform hover:scale-110">
                            <i className={`fas fa-star text-2xl ${n <= vRating ? 'text-amber-400' : 'text-gray-700'} transition-colors`}></i>
                          </button>
                        ))}
                        <span className="text-muted text-sm ml-2">{vRating > 0 ? `${vRating}/5` : 'Toca para calificar'}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-muted text-sm block mb-2">Tu comentario</label>
                      <textarea
                        value={vComentario}
                        onChange={e => setVComentario(e.target.value)}
                        placeholder="Cuéntanos tu experiencia con esta escort..."
                        rows={3}
                        className="w-full bg-surface2 border border-gray-700 rounded-xl p-4 text-ink placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm resize-none"
                      />
                      <p className="text-muted text-xs mt-1">Puedes dejar solo la calificación o solo el comentario, o ambos.</p>
                    </div>

                    <div>
                      <label className="text-muted text-sm block mb-2">
                        <i className="fas fa-check-circle text-green-400 mr-1"></i> Código de verificación <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={vCodigo}
                        onChange={e => setVCodigo(e.target.value.toUpperCase())}
                        placeholder="Código entregado por la escort (ej: A1B2C3)"
                        maxLength={6}
                        required
                        className="w-full bg-surface2 border border-gray-700 rounded-xl py-3 px-4 text-ink uppercase tracking-widest placeholder-gray-600 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition-all text-sm"
                      />
                      <p className="text-muted text-xs mt-1">La escort te entrega este código tras confirmar tu cita. Es obligatorio para comentar.</p>
                    </div>

                    {vMsg && (
                      <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${vMsg.startsWith('Valoración enviada') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        <i className={`fas ${vMsg.startsWith('Valoración enviada') ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                        {vMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={vLoading}
                      className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {vLoading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Enviando...</>
                      ) : (
                        <><i className="fas fa-paper-plane"></i> Enviar valoración</>
                      )}
                    </button>
                    <p className="text-muted text-xs text-center">Tu valoración será revisada por un administrador antes de publicarse.</p>
                  </form>
                )}
              </div>
              
              {/* Comentarios recibidos */}
              <div className="mt-6">
                <h2 className="text-xl font-bold text-ink flex items-center gap-2 mb-4">
                  <i className="fas fa-comments text-red-400"></i>
                  Comentarios recibidos
                </h2>
                
                {comments.length === 0 ? (
                  <div className="text-center py-12 bg-surface border border-edge rounded-xl">
                    <i className="fas fa-comment-dots text-muted text-5xl mb-4 opacity-30"></i>
                    <p className="text-muted">No has recibido comentarios aún</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map(comment => (
                      <div key={comment.id} className="bg-surface border border-edge rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                              <i className="fas fa-user text-red-400"></i>
                            </div>
                            <div>
                              <span className="text-ink text-sm font-medium block">
                                {comment.usuario_nombre || 'Anónimo'}
                                {comment.cita_verificada === 1 && (
                                  <span className="inline-flex items-center gap-1 ml-1.5 text-[0.55rem] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20 align-middle">
                                    <i className="fas fa-check-circle text-[0.45rem]"></i> Cita verificada
                                  </span>
                                )}
                              </span>
                              <span className="text-muted text-xs block mt-0.5">
                                {new Date(comment.created_at).toLocaleDateString('es-CL')}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <i className="fas fa-trash-alt"></i>
                            Eliminar
                          </button>
                        </div>
                        <p className="text-muted text-sm leading-relaxed mt-3">
                          {comment.comentario}
                        </p>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-edge">
                          <span className="text-muted text-xs">
                            {new Date(comment.created_at).toLocaleDateString('es-CL')}
                          </span>
                          <div className="flex items-center gap-2">
                            {comment.aprobado ? (
                              <span className="text-green-500 text-xs flex items-center gap-1">
                                <i className="fas fa-check-circle"></i>
                                Aprobado
                              </span>
                            ) : (
                              <span className="text-yellow-500 text-xs flex items-center gap-1">
                                <i className="fas fa-clock"></i>
                                Pendiente
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {deleteConfirmId !== null && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
                    <div className="bg-surface border border-edge rounded-xl w-full max-w-sm p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-exclamation-triangle text-red-400 text-lg"></i>
                        </div>
                        <div>
                          <h3 className="text-ink font-semibold text-sm">Confirmar eliminación</h3>
                          <p className="text-muted text-sm leading-relaxed">¿Eliminar este comentario? No se puede deshacer.</p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-4 py-2 bg-raised hover:bg-raised text-muted rounded-lg text-sm font-medium transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={confirmDelete}
                          disabled={deletingId !== null}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId ? (
                            <span className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Eliminando...
                            </span>
                          ) : (
                            'Confirmar'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
            </>
          ) : (
            <>
              <nav className="flex items-center gap-2 text-sm text-muted mb-6">
                <a href="/" className="hover:text-red-400 transition-colors">Inicio</a>
                <i className="fas fa-chevron-right text-xs"></i>
                <Skeleton width={120} height={16} />
              </nav>
              <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
                <div className="lg:w-80 shrink-0">
                  <div className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-surface border border-gray-800" style={{ aspectRatio: '3/4' }}>
                    <Skeleton className="w-full h-full" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-6">
                    <h1 className="text-3xl sm:text-4xl font-bold text-ink mb-2">
                      <Skeleton width="60%" />
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 text-muted mt-2">
                      <span className="inline-flex items-center gap-1.5">
                        <i className="fas fa-map-marker-alt text-red-400"></i>
                        <Skeleton width={80} height={16} />
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <i className="fas fa-birthday-cake text-red-400"></i>
                        <Skeleton width={60} height={16} />
                      </span>
                    </div>
                  </div>
                  <Skeleton count={3} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
