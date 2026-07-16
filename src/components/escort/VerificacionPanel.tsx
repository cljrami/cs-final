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
    setComprobante(null);
    setComprobantePreview('');
    setComprobanteNombre('');
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
        setSuccess('¡Solicitud enviada! Tu verificación está en revisión.');
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

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-[#1a1a2e] rounded-2xl" />
        <div className="h-64 bg-[#1a1a2e] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Verificación de Identidad</h1>
        <p className="text-gray-500 text-sm mt-1">
          Obtén el badge de verificación para destacar tu autenticidad
        </p>
      </div>

      {/* Status card */}
      {estadoUI && (
        <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl p-6">
          <div className="flex items-center gap-4">
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
              <i className={`fas ${puedeSolicitar ? 'fa-paper-plane' : 'fa-eye'}`} />
              {puedeSolicitar ? 'Solicitar' : 'Ver documentos'}
            </button>
          </div>
        </div>
      )}

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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={cerrarModal}
        >
          <div
            className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-[#2d2d44] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${estadoUI?.bg || 'bg-gray-500/10'} flex items-center justify-center`}>
                  <i className={`fas fa-shield-alt ${estadoUI?.color || 'text-gray-400'}`} />
                </div>
                <div>
                  <h3 className="text-white font-bold">
                    {success ? 'Solicitud enviada' : puedeSolicitar ? 'Solicitar Verificación' : 'Documentos enviados'}
                  </h3>
                  <p className="text-gray-500 text-xs">
                    {success
                      ? 'Tus documentos están en revisión'
                      : puedeSolicitar
                        ? 'Sube tu selfie con la fecha de hoy'
                        : 'Revisa los documentos que enviaste'}
                  </p>
                </div>
              </div>
              <button
                onClick={cerrarModal}
                className="w-8 h-8 rounded-lg hover:bg-[#252538] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                  <i className="fas fa-exclamation-triangle" />
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError('')} className="hover:text-red-300">✕</button>
                </div>
              )}

              {success && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                  <i className="fas fa-check-circle" />
                  <span className="flex-1">{success}</span>
                </div>
              )}

              {/* Si hay éxito o estado pendiente → mostrar documentos enviados */}
              {(success || data?.estado === 'pendiente' || data?.estado === 'aprobada') && data && (
                <div className="space-y-4">
                  {data.foto_perfil_real && (
                    <div>
                      <div className="text-gray-500 text-xs mb-2 font-medium">Selfie enviada</div>
                      <a href={data.foto_perfil_real} data-fancybox="verif-modal">
                        <img
                          src={data.foto_perfil_real}
                          alt="Selfie"
                          className="rounded-xl w-full max-h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity border border-[#2d2d44]"
                        />
                      </a>
                    </div>
                  )}

                  {data?.estado === 'rechazada' && data.notas_revision && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                      <div className="text-red-400 text-sm font-semibold mb-1">Motivo del rechazo</div>
                      <div className="text-gray-400 text-sm">{data.notas_revision}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Si está en estado no_solicitado o rechazada → mostrar formulario */}
              {puedeSolicitar && !success && (
                <>
                  {/* Selfie */}
                  <div className="space-y-2">
                    <label className="block text-gray-400 text-sm font-medium">
                      1. Selfie con tu rostro <span className="text-red-400">*</span>
                    </label>
                    <p className="text-gray-600 text-xs">
                      Sostén un papel con la fecha de hoy y tu nombre
                    </p>
                    <div
                      onClick={() => fileInputPerfil.current?.click()}
                      className={`
                        relative aspect-video rounded-xl border-2 border-dashed cursor-pointer
                        overflow-hidden transition-all
                        ${previewPerfil ? 'border-green-500/50' : 'border-gray-700 hover:border-gray-500'}
                      `}
                    >
                      {previewPerfil ? (
                        <img src={previewPerfil} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                          <i className="fas fa-camera text-3xl mb-2" />
                          <span className="text-xs">Click para subir</span>
                        </div>
                      )}
                      <input
                        ref={fileInputPerfil}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>



                  {/* Requisitos */}
                  <div className="bg-[#13131a] rounded-xl p-4 space-y-2">
                    <h4 className="text-gray-400 text-sm font-medium">Requisitos:</h4>
                    <ul className="text-gray-500 text-xs space-y-1">
                      <li className="flex items-center gap-2">
                        <i className="fas fa-check text-green-500 text-[10px]" />
                        La selfie debe mostrar claramente tu rostro
                      </li>
                      <li className="flex items-center gap-2">
                        <i className="fas fa-check text-green-500 text-[10px]" />
                        Máximo 5MB por imagen
                      </li>
                      <li className="flex items-center gap-2">
                        <i className="fas fa-check text-green-500 text-[10px]" />
                        Tus datos son confidenciales
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#2d2d44] flex gap-3 justify-end">
              {puedeSolicitar && !success && (
                <button
                  onClick={handleSubmit}
                  disabled={uploading || !fotoPerfil}
                  className={`
                    flex-1 py-3 rounded-xl font-semibold text-sm transition-all
                    ${!fotoPerfil
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/20'
                    }
                  `}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="fas fa-circle-notch fa-spin" />
                      Enviando...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <i className="fas fa-shield-alt" />
                      Enviar Solicitud
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={cerrarModal}
                className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                  puedeSolicitar && !success
                    ? 'px-5 bg-[#252538] hover:bg-[#30304a] text-gray-400'
                    : 'flex-1 bg-[#252538] hover:bg-[#30304a] text-white'
                }`}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
