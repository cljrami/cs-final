import { useState, useEffect, useRef } from 'react';

interface VerificacionData {
  estado: 'no_solicitado' | 'pendiente' | 'aprobada' | 'rechazada';
  foto_perfil_real?: string;
  foto_documento?: string;
  notas_revision?: string;
  revisado_en?: string;
  creado_en?: string;
}

export default function VerificacionPanel() {
  const [data, setData] = useState<VerificacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [previewPerfil, setPreviewPerfil] = useState('');

  const fileInputPerfil = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : '';

  useEffect(() => {
    fetchEstado();
  }, []);

  useEffect(() => {
    let disposed = false;
    import('@fancyapps/ui').then((mod) => {
      if (disposed) return;
      const F = mod.Fancybox;
      F.bind('[data-fancybox]', {
        compact: false,
        idle: false,
        Toolbar: { display: ['close'] },
      });
    });
    return () => { disposed = true; };
  }, [modalOpen]);

  const fetchEstado = async () => {
    try {
      const res = await fetch('/api/escort/verificacion-estado.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setData(json.verificacion || { estado: 'no_solicitado' });
      }
    } catch {
      setError('Error cargando estado');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = () => {
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setFotoPerfil(null);
    setPreviewPerfil('');
    setError('');
    setSuccess('');
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setFotoPerfil(file);
      setPreviewPerfil(result);
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const handleSubmit = async () => {
    if (!fotoPerfil) {
      setError('Debes subir la selfie');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('foto_perfil', fotoPerfil);

      const res = await fetch('/api/escort/solicitar-verificacion.php', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const json = await res.json();
      if (json.success) {
        setSuccess(puedeReSubir ? (data?.estado === 'aprobada' ? '¡Foto actualizada correctamente!' : '¡Foto actualizada! Tu verificación sigue en revisión.') : '¡Solicitud enviada! Tu verificación está en revisión.');
        setFotoPerfil(null);
        setPreviewPerfil('');
        fetchEstado();
        window.dispatchEvent(new Event('sidebar-refresh'));
      } else {
        setError(json.error || 'Error al enviar solicitud');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setUploading(false);
    }
  };

  const puedeSolicitar = data?.estado === 'no_solicitado' || data?.estado === 'rechazada';
  const puedeReSubir = data?.estado === 'pendiente' || data?.estado === 'aprobada';
  const mostrarFormulario = puedeSolicitar || puedeReSubir;
  const botonTexto = puedeSolicitar ? 'Solicitar' : puedeReSubir ? 'Re-subir foto' : 'Ver documentos';
  const botonIcono = puedeSolicitar ? 'fa-paper-plane' : puedeReSubir ? 'fa-upload' : 'fa-eye';

  const getEstadoUI = () => {
    if (!data) return null;

    const estados: Record<string, { icon: string; color: string; bg: string; border: string; titulo: string; desc: string }> = {
      no_solicitado: {
        icon: 'fa-shield-alt',
        color: 'text-gray-400',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/20',
        titulo: 'No verificada',
        desc: 'Solicita tu verificación para obtener el badge azul en tu perfil.'
      },
      pendiente: {
        icon: 'fa-clock',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        titulo: 'Pendiente de revisión',
        desc: 'Tu solicitud está en espera de revisión por el equipo. Esto puede tomar hasta 24 horas.'
      },
      aprobada: {
        icon: 'fa-check-circle',
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        titulo: '¡Verificada!',
        desc: 'Tu perfil tiene el badge de verificación. Los clientes confían más en ti.'
      },
      rechazada: {
        icon: 'fa-times-circle',
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        titulo: 'Rechazada',
        desc: data.notas_revision || 'Tu solicitud fue rechazada. Puedes volver a intentarlo subiendo nuevas fotos.'
      }
    };

    return estados[data.estado] || estados.no_solicitado;
  };

  const estadoUI = getEstadoUI();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Verificación de Identidad</h1>
        <p className="text-gray-500 text-sm mt-1">
          Obtén el badge de verificación para destacar tu autenticidad
        </p>
      </div>

      {/* Status card */}
      <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl p-6">
        <div className="flex items-center gap-4">
          {loading ? (
            <>
              <div className="animate-pulse bg-gray-800 rounded-xl w-14 h-14" />
              <div className="flex-1 space-y-2">
                <div className="animate-pulse bg-gray-800 rounded h-6 w-48" />
                <div className="animate-pulse bg-gray-800 rounded h-4 w-72" />
              </div>
              <div className="animate-pulse bg-gray-800 rounded-xl h-10 w-32 shrink-0" />
            </>
          ) : estadoUI && (
            <>
              <div className={`w-14 h-14 rounded-xl ${estadoUI.bg} flex items-center justify-center flex-shrink-0`}>
                <i className={`fas ${estadoUI.icon} ${estadoUI.color} text-2xl`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${estadoUI.color}`}>{estadoUI.titulo}</h3>
                <p className="text-gray-400 text-sm mt-1">{estadoUI.desc}</p>
                {data?.revisado_en && (
                  <p className="text-gray-600 text-xs mt-2">
                    Revisado el: {new Date(data.revisado_en).toLocaleDateString('es-CL')}
                  </p>
                )}
              </div>
              <button
                onClick={abrirModal}
                className="shrink-0 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                <i className={`fas ${botonIcono}`} />
                {botonTexto}
              </button>
            </>
          )}
        </div>
      </div>

      {data?.estado === 'aprobada' && (
        <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl p-6">
          <h3 className="text-white font-bold mb-4">Beneficios de tu verificación</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-check-circle text-blue-400 text-sm" />
              </div>
              <div>
                <div className="text-white text-sm font-medium">Badge en tu perfil</div>
                <div className="text-gray-500 text-xs">Los clientes ven que eres real</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-arrow-up text-blue-400 text-sm" />
              </div>
              <div>
                <div className="text-white text-sm font-medium">Mayor visibilidad</div>
                <div className="text-gray-500 text-xs">Apareces antes en resultados</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-heart text-blue-400 text-sm" />
              </div>
              <div>
                <div className="text-white text-sm font-medium">Más confianza</div>
                <div className="text-gray-500 text-xs">Más contactos de clientes</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MODAL ═══════ */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 lg:p-4 bg-black/70 backdrop-blur-sm"
          onClick={cerrarModal}
        >
          <div
            className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">

              {/* Icon */}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                success ? 'bg-green-500/10' : 'bg-blue-500/10'
              }`}>
                <i className={`fas ${
                  success
                    ? 'fa-check-circle text-green-400'
                    : mostrarFormulario && puedeReSubir
                      ? 'fa-upload text-blue-400'
                      : 'fa-shield-alt text-blue-400'
                } text-xl`} />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-white mb-1">
                {success
                  ? (data?.estado === 'aprobada' ? 'Foto actualizada' : 'Solicitud enviada')
                  : mostrarFormulario
                    ? (puedeReSubir ? 'Re-subir foto' : 'Solicitar Verificación')
                    : 'Documentos enviados'}
              </h3>

              {/* Subtitle */}
              <p className="text-gray-400 text-sm mb-5">
                {success
                  ? (data?.estado === 'aprobada' ? 'Tu foto se actualizó correctamente' : 'Tus documentos están en revisión')
                  : mostrarFormulario
                    ? (puedeReSubir ? 'Si te equivocaste, sube una nueva foto' : 'Sube tu selfie con la fecha de hoy')
                    : 'Revisa los documentos que enviaste'}
              </p>

              {/* Error */}
              {error && (
                <div className="w-full bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm mb-4 text-left">
                  <i className="fas fa-exclamation-triangle" />
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError('')} className="hover:text-red-300">✕</button>
                </div>
              )}

              {/* Success message */}
              {success && (
                <div className="w-full bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm mb-4 text-left">
                  <i className="fas fa-check-circle" />
                  <span className="flex-1">{success}</span>
                </div>
              )}

              {/* Upload section */}
              {mostrarFormulario && !success && (
                <div className="w-full mb-4">
                  <label className="block text-xs text-gray-400 mb-1.5 text-left">
                    1. Selfie con tu rostro <span className="text-red-400">*</span>
                  </label>
                  <input
                    ref={fileInputPerfil}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  />
                  {!fotoPerfil ? (
                    <div
                      onClick={() => fileInputPerfil.current?.click()}
                      className="border-2 border-dashed border-[#2d2d44] rounded-xl p-4 text-center cursor-pointer hover:border-gray-500 transition-colors"
                    >
                      <i className="fas fa-camera text-gray-500 text-2xl mb-2"></i>
                      <div className="text-gray-500 text-sm">Click para subir tu selfie</div>
                      <div className="text-gray-600 text-xs mt-1">JPG, PNG · Max 5MB</div>
                    </div>
                  ) : (
                    <div className="bg-[#13131a] rounded-xl p-3 flex items-center gap-3">
                      <a href={previewPerfil} data-fancybox="verif-preview">
                        <img src={previewPerfil} alt="Preview" className="w-14 h-14 rounded object-cover cursor-pointer" />
                      </a>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-white text-sm truncate">{fotoPerfil.name}</div>
                        <div className="text-gray-500 text-xs">{(fotoPerfil.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button onClick={() => { setFotoPerfil(null); setPreviewPerfil(''); }} className="text-red-400 hover:text-red-300">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Requisitos */}
              {mostrarFormulario && !success && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-5 w-full">
                  <p className="text-amber-400/80 text-xs text-left flex items-start gap-2">
                    <i className="fas fa-info-circle mt-0.5 flex-shrink-0" />
                    Sostén un papel con la fecha de hoy y tu nombre. La selfie debe mostrar claramente tu rostro.
                  </p>
                </div>
              )}

              {/* Buttons */}
              {success ? (
                <button
                  onClick={cerrarModal}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-green-500/20 text-sm"
                >
                  Entendido
                </button>
              ) : mostrarFormulario ? (
                <div className="flex gap-3 w-full">
                  <button
                    onClick={cerrarModal}
                    className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={uploading || !fotoPerfil}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/20 text-sm flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <i className="fas fa-circle-notch fa-spin" />
                    ) : (
                      <i className="fas fa-shield-alt" />
                    )}
                    {uploading ? 'Enviando...' : (puedeReSubir ? 'Actualizar foto' : 'Enviar Solicitud')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={cerrarModal}
                  className="w-full px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Cerrar
                </button>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
