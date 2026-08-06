import { useState, useEffect, useCallback } from 'react';

interface Comentario {
  id: number;
  comentario: string;
  puntuacion: number | null;
  aprobado: boolean;
  usuario_nombre: string;
  usuario_email: string;
  created_at: string;
}

interface CodigoVerificacion {
  id: number;
  codigo: string;
  creado_en: string;
  expira_en: string;
  usado: number;
  usado_por: number | null;
  usado_en: string | null;
  expirado: boolean;
}

export default function MisComentarios() {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [codigos, setCodigos] = useState<CodigoVerificacion[]>([]);
  const [codigosLoading, setCodigosLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [eliminandoCodigoId, setEliminandoCodigoId] = useState<number | null>(null);
  const [confirmarEliminarCodigo, setConfirmarEliminarCodigo] = useState<CodigoVerificacion | null>(null);

  const token = () => localStorage.getItem('escort_token') || '';

  const fetchComentarios = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('escort_token') || '';
      const res = await fetch(`/api/escorts/mis-comentarios.php?page=${page}&per_page=20`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setComentarios(data.comentarios || []);
      setTotalPages(data.pagination?.total_pages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchCodigos = useCallback(async () => {
    setCodigosLoading(true);
    try {
      const res = await fetch('/api/escort/codigo-verificacion.php', {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      const data = await res.json();
      if (data.success) setCodigos(data.codigos || []);
    } catch {}
    setCodigosLoading(false);
  }, []);

  const generarCodigo = async () => {
    setGenerando(true);
    setNuevoCodigo('');
    try {
      const res = await fetch('/api/escort/codigo-verificacion.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
      });
      const data = await res.json();
      if (data.success) {
        setNuevoCodigo(data.codigo);
        setSuccessMsg('Código generado correctamente');
        fetchCodigos();
      } else {
        setError(data.error || 'Error al generar código');
      }
    } catch {
      setError('Error de conexión');
    }
    setGenerando(false);
  };

  const eliminarCodigo = (codigo: CodigoVerificacion) => {
    setConfirmarEliminarCodigo(codigo);
  };

  const confirmarEliminacionCodigo = async () => {
    if (!confirmarEliminarCodigo) return;
    const id = confirmarEliminarCodigo.id;
    setEliminandoCodigoId(id);
    setConfirmarEliminarCodigo(null);
    try {
      const res = await fetch('/api/escort/codigo-verificacion.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Código eliminado');
        setTimeout(() => setSuccessMsg(''), 3000);
        if (nuevoCodigo) setNuevoCodigo('');
        fetchCodigos();
      } else {
        setError(data.error || 'Error al eliminar código');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setEliminandoCodigoId(null);
    }
  };

  const enviarWhatsApp = (codigo: string) => {
    const msg = `Tu código de verificación para dejar tu valoración es: ${codigo}. Ingresa este código en mi perfil para publicar tu comentario. Válido por 48 horas.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const enviarEmail = (codigo: string) => {
    const subject = 'Código de verificación para tu valoración';
    const body = `Tu código de verificación para dejar tu valoración es: ${codigo}.\n\nIngresa este código en mi perfil para publicar tu comentario. Válido por 48 horas.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  useEffect(() => { fetchComentarios(); }, [fetchComentarios]);
  useEffect(() => { fetchCodigos(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-comments text-red-400"></i> Mis Comentarios
        </h1>
        <p className="text-gray-400 mt-1">Consulta los comentarios que has recibido en tus perfiles</p>
      </div>

      {/* Códigos de verificación */}
      <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <i className="fas fa-check-circle text-green-400"></i> Códigos de verificación
          </h2>
          <button
            onClick={generarCodigo}
            disabled={generando}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2"
          >
            {generando ? (
              <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generando...</>
            ) : (
              <><i className="fas fa-plus"></i> Generar código</>
            )}
          </button>
        </div>

        {nuevoCodigo && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4 text-center">
            <p className="text-green-400 text-sm mb-1">¡Nuevo código generado! Compártelo con tu cliente:</p>
            <p className="text-white text-2xl font-bold tracking-widest select-all">{nuevoCodigo}</p>
            <p className="text-gray-500 text-xs mt-1">Válido por 48 horas</p>
            <div className="flex flex-col sm:flex-row justify-center gap-2 mt-4">
              <button
                onClick={() => enviarWhatsApp(nuevoCodigo)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-all"
              >
                <i className="fab fa-whatsapp"></i> Enviar por WhatsApp
              </button>
              <button
                onClick={() => enviarEmail(nuevoCodigo)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all"
              >
                <i className="fas fa-envelope"></i> Enviar por Email
              </button>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm mb-4">
            <i className="fas fa-check-circle"></i>{successMsg}
          </div>
        )}

        {codigosLoading ? (
          <div className="text-center py-4 text-gray-500">Cargando códigos...</div>
        ) : codigos.length === 0 ? (
          <p className="text-gray-500 text-sm">No has generado códigos de verificación aún.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {codigos.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-[#1a1a24] rounded-lg px-4 py-3">
                <div>
                  <span className={`font-mono font-bold text-sm ${c.usado ? 'text-gray-500 line-through' : c.expirado ? 'text-red-400' : 'text-green-400'}`}>
                    {c.codigo}
                  </span>
                  <span className="text-gray-600 text-xs ml-3">
                    {c.usado ? `Usado ${c.usado_en ? new Date(c.usado_en).toLocaleDateString() : ''}` :
                     c.expirado ? 'Expirado' : `Expira ${new Date(c.expira_en).toLocaleDateString()}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {!c.usado && !c.expirado && (
                    <>
                      <button
                        onClick={() => enviarWhatsApp(c.codigo)}
                        title="Enviar por WhatsApp"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-green-500 hover:bg-green-500/10 transition-colors"
                      >
                        <i className="fab fa-whatsapp"></i>
                      </button>
                      <button
                        onClick={() => enviarEmail(c.codigo)}
                        title="Enviar por Email"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors"
                      >
                        <i className="fas fa-envelope"></i>
                      </button>
                    </>
                  )}
                  <span className={`text-[0.6rem] px-2 py-0.5 rounded-full font-medium ${
                    c.usado ? 'bg-gray-500/10 text-gray-400' :
                    c.expirado ? 'bg-red-500/10 text-red-400' :
                    'bg-green-500/10 text-green-400'
                  }`}>
                    {c.usado ? 'Usado' : c.expirado ? 'Expirado' : 'Activo'}
                  </span>
                  <button
                    onClick={() => eliminarCodigo(c)}
                    disabled={eliminandoCodigoId === c.id}
                    title="Eliminar código"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    {eliminandoCodigoId === c.id ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fas fa-trash-alt"></i>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <i className="fas fa-exclamation-triangle"></i>{error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800 animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-800 rounded animate-pulse w-32"></div>
                    <div className="h-3 bg-gray-800 rounded animate-pulse w-40"></div>
                  </div>
                </div>
                <div className="h-5 bg-gray-800 rounded-full animate-pulse w-20"></div>
              </div>
              <div className="h-4 bg-gray-800 rounded animate-pulse w-full mb-2"></div>
              <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4"></div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                <div className="h-3 bg-gray-800 rounded animate-pulse w-28"></div>
                <div className="h-6 bg-gray-800 rounded-lg animate-pulse w-20"></div>
              </div>
            </div>
          ))}
        </div>
      ) : comentarios.length === 0 ? (
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-8 text-center">
          <i className="fas fa-comment-slash text-gray-600 text-4xl mb-3"></i>
          <p className="text-gray-500">No tienes comentarios aún</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comentarios.map((c) => (
            <div key={c.id} className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {c.usuario_nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{c.usuario_nombre}</p>
                    <p className="text-gray-600 text-xs">{c.usuario_email}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.aprobado ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                  {c.aprobado ? 'Aprobado' : 'Pendiente'}
                </span>
              </div>
              {c.puntuacion && (
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: c.puntuacion }).map((_, i) => (
                    <i key={i} className="fas fa-star text-yellow-400 text-sm"></i>
                  ))}
                </div>
              )}
              <p className="text-gray-300 text-sm leading-relaxed">{c.comentario}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                <span className="text-gray-600 text-xs">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#13131a] border border-gray-800 rounded-xl">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1">
            <i className="fas fa-chevron-left"></i> Anterior
          </button>
          <span className="text-gray-500 text-sm">Página {page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1">
            Siguiente <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}

      {confirmarEliminarCodigo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1a1a2e] border border-gray-800 rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-exclamation-triangle text-red-400 text-lg"></i>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Confirmar eliminación</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  ¿Eliminar el código <span className="font-mono text-white font-bold">{confirmarEliminarCodigo.codigo}</span>? No se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmarEliminarCodigo(null)}
                className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminacionCodigo}
                disabled={eliminandoCodigoId !== null}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {eliminandoCodigoId !== null ? (
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
  );
}
