// src/components/escort/SolicitarVip.tsx
// Pantalla VIP con la MISMA UI y proceso que Verificación de Identidad:
// header + tarjeta de estado (icono + título/descripción + 1 botón) +
// tarjeta de beneficios (si activo) + 1 modal (solicitar / re-subir / ver).
// Lógica propia VIP: estados enviado/aprobado/rechazado, gateo permite_vip,
// comprobante de pago (imagen o PDF), vigencia ligada al plan base,
// re-subir comprobante y cancelar solicitud pendiente.

import { useState, useEffect, useRef, useCallback } from 'react';
import { showToast } from '../ui/Toast';
import { escortFileUrl } from '../../lib/fileUrl';
import { Skeleton } from '../ui/Skeleton';

interface PlanBase {
  id: number;
  nombre: string;
  color: string;
  fecha_fin: string;
  dias_restantes: number;
  permite_vip: boolean;
}

interface Solicitud {
  id: number;
  estado: 'enviado' | 'aprobado' | 'rechazado';
  comprobante_pago: string | null;
  admin_notas: string | null;
  fecha_respuesta: string | null;
  created_at: string;
}

interface SolicitudAprobada {
  id: number;
  estado: 'aprobado';
  comprobante_pago: string | null;
  fecha_respuesta: string | null;
}

interface Config {
  precio_vip: number;
  moneda_vip: string;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CL');
};

const MAX_COMPROBANTE_SIZE = 5 * 1024 * 1024;

const esPdf = (nombre?: string | null) => {
  if (!nombre) return false;
  return /\.pdf$/i.test(nombre);
};

const validarArchivo = (file: File): string | null => {
  const tipos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (!tipos.includes(file.type)) {
    return 'Formato no permitido. Usa: JPG, PNG, GIF, WEBP o PDF.';
  }
  if (file.size > MAX_COMPROBANTE_SIZE) {
    return 'El archivo no puede superar los 5 MB.';
  }
  return null;
};

type ModoModal = 'solicitar' | 'resubir' | 'ver' | null;

export default function SolicitarVip() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success] = useState('');
  const setSuccess = (m: string) => showToast(m);

  const [vipActivo, setVipActivo] = useState(false);
  const [diasVipRestantes, setDiasVipRestantes] = useState(0);
  const [fechaVipExpira, setFechaVipExpira] = useState<string | null>(null);

  const [planBase, setPlanBase] = useState<PlanBase | null>(null);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [solicitudAprobada, setSolicitudAprobada] = useState<SolicitudAprobada | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [puedeSolicitar, setPuedeSolicitar] = useState(false);
  const [motivoNoSolicitar, setMotivoNoSolicitar] = useState('');

  const [modalModo, setModalModo] = useState<ModoModal>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoCancel, setConfirmandoCancel] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : '';
  const solicitudObjetivo = solicitud ?? solicitudAprobada;
  const modalOpen = modalModo !== null;

  const fetchEstado = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/escort/estado-vip.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Respuesta no es JSON');
      }
      if (data.success) {
        setVipActivo(data.escort.vip_activo ?? false);
        setDiasVipRestantes(data.escort.dias_vip_restantes ?? 0);
        setFechaVipExpira(data.escort.fecha_vip_expira ?? null);
        setPlanBase(data.plan_base ?? null);
        setSolicitud(data.solicitud ?? null);
        setSolicitudAprobada(data.solicitud_aprobada ?? null);
        setConfig(data.config ?? null);
        setPuedeSolicitar(data.puede_solicitar ?? false);
        setMotivoNoSolicitar(data.motivo_no_solicitar ?? '');
      } else {
        setError(data.error || 'Error cargando estado VIP');
      }
    } catch (e: any) {
      setError('Error de conexión: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEstado();
  }, [fetchEstado]);

  useEffect(() => {
    let disposed = false;
    import('@fancyapps/ui').then((mod) => {
      if (disposed) return;
      const F = mod.Fancybox;
      F.bind('[data-fancybox]');
    });
    return () => { disposed = true; };
  }, [modalModo]);

  const abrirModal = (modo: Exclude<ModoModal, null>) => {
    setError('');
    setSuccess('');
    setComprobanteFile(null);
    setComprobantePreview(null);
    setConfirmandoCancel(false);
    setModalModo(modo);
  };

  const cerrarModal = () => {
    setModalModo(null);
    setComprobanteFile(null);
    setComprobantePreview(null);
    setConfirmandoCancel(false);
    setError('');
    setSuccess('');
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    const err = validarArchivo(file);
    if (err) {
      setError(err);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setComprobanteFile(file);
    setError('');
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setComprobantePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setComprobantePreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!puedeSolicitar) return;
    setEnviando(true);
    setError('');
    setSuccess('');
    try {
      let comprobanteUrl: string | null = null;

      if (comprobanteFile) {
        const formData = new FormData();
        formData.append('comprobante', comprobanteFile);
        formData.append('tipo', 'vip');
        const uploadRes = await fetch('/api/escort/subir-comprobante.php', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const uploadText = await uploadRes.text();
        let uploadData;
        try {
          uploadData = JSON.parse(uploadText);
        } catch {
          throw new Error('Respuesta no es JSON al subir el comprobante');
        }
        if (!uploadData.success) {
          setError(uploadData.error || 'Error al subir el comprobante');
          return;
        }
        comprobanteUrl = uploadData.comprobante_url || null;
      }

      const res = await fetch('/api/escort/solicitar-vip.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: 'mensual',
          comprobante_pago: comprobanteUrl,
        }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Respuesta no es JSON');
      }
      if (data.success) {
        setSuccess('Solicitud enviada. Tu VIP esta en revision.');
        setComprobanteFile(null);
        setComprobantePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await fetchEstado();
        window.dispatchEvent(new Event('sidebar-refresh'));
        setModalModo(null); // cerrar modal tras éxito
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch (e: any) {
      setError('Error de conexi��n: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleReupload = async () => {
    if (!solicitudObjetivo || !comprobanteFile) return;
    setEnviando(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('comprobante', comprobanteFile);
      formData.append('tipo', 'vip');
      formData.append('id', String(solicitudObjetivo.id));
      const res = await fetch('/api/escort/subir-comprobante.php', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('¡Comprobante actualizado! Tu VIP sigue en revisión.');
        setComprobanteFile(null);
        setComprobantePreview(null);
        setModalModo(null);
        await fetchEstado();
        window.dispatchEvent(new Event('sidebar-refresh'));
      } else {
        setError(data.error || 'Error al subir comprobante');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setEnviando(false);
    }
  };

  const handleCancelar = async () => {
    if (!solicitud || solicitud.estado !== 'enviado') return;
    setCancelando(true);
    setError('');
    try {
      const res = await fetch('/api/escort/cancelar-vip.php', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: solicitud.id })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Solicitud cancelada correctamente.');
        setConfirmandoCancel(false);
        await fetchEstado();
        window.dispatchEvent(new Event('sidebar-refresh'));
      } else {
        setError(data.error || 'Error al cancelar solicitud');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setCancelando(false);
    }
  };

  // ── Estado exclusivo (misma idea que Verificación) ──
  const esPendiente = !!solicitud && solicitud.estado === 'enviado';
  const esRechazada = !!solicitud && solicitud.estado === 'rechazado';
  const sinPlan = !planBase;
  const planNoVip = !!planBase && !planBase.permite_vip;
  const mostrarFormulario = (puedeSolicitar && !esPendiente) || esRechazada;
  const esResubir = modalModo === 'resubir' || (modalModo === 'solicitar' && esPendiente);
  const botonTexto = esPendiente ? 'Ver documentos'
    : vipActivo ? 'Ver detalles'
    : esRechazada ? 'Solicitar de nuevo'
    : mostrarFormulario ? 'Solicitar'
    : 'Ver detalles';
  const botonIcono = esPendiente || vipActivo ? 'fa-eye'
    : esRechazada || mostrarFormulario ? 'fa-paper-plane'
    : 'fa-eye';

  const abrirAccion = () => {
    if (esPendiente || vipActivo) abrirModal('ver');
    else if (mostrarFormulario) abrirModal('solicitar');
    else abrirModal('ver');
  };

  const getEstadoUI = () => {
    if (vipActivo) {
      return {
        icon: 'fa-crown',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        titulo: '¡VIP Activo!',
        desc: `Tu perfil tiene el badge VIP hasta el ${formatDate(fechaVipExpira)} (${diasVipRestantes} días restantes).`
      };
    }
    if (esPendiente) {
      return {
        icon: 'fa-clock',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        titulo: 'Pendiente de revisión',
        desc: 'Tu solicitud está en espera de revisión por el equipo. Esto puede tomar hasta 24 horas.'
      };
    }
    if (esRechazada) {
      return {
        icon: 'fa-times-circle',
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        titulo: 'Rechazada',
        desc: solicitud?.admin_notas || 'Tu solicitud fue rechazada. Puedes volver a intentarlo.'
      };
    }
    if (planNoVip) {
      return {
        icon: 'fa-ban',
        color: 'text-gray-400',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/20',
        titulo: 'Tu plan no incluye VIP',
        desc: motivoNoSolicitar || 'Tu plan actual no permite solicitar el badge VIP.'
      };
    }
    if (sinPlan) {
      return {
        icon: 'fa-lock',
        color: 'text-gray-400',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/20',
        titulo: 'Necesitas un plan activo',
        desc: motivoNoSolicitar || 'El VIP está ligado a tu plan base. Activa un plan primero.'
      };
    }
    return {
      icon: 'fa-crown',
      color: 'text-gray-400',
      bg: 'bg-gray-500/10',
      border: 'border-gray-500/20',
      titulo: 'Sin VIP',
      desc: 'Solicita tu badge VIP para destacar en el directorio.'
    };
  };

  const estadoUI = getEstadoUI();
  const enModalVer = modalModo === 'ver';
  const solicitudEnModal = solicitud ?? (solicitudAprobada as Solicitud | null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Badge VIP</h1>
        <p className="text-gray-500 text-sm mt-1">
          El badge VIP te da visibilidad premium en el directorio
        </p>
      </div>

      {/* Status card */}
      <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl p-6">
        <div className="flex items-center gap-4">
          {loading ? (
            <>
              <Skeleton width={56} height={56} borderRadius="0.75rem" />
              <div className="flex-1 space-y-2">
                <Skeleton height={24} width="12rem" borderRadius="0.25rem" />
                <Skeleton height={16} width="18rem" borderRadius="0.25rem" />
              </div>
              <Skeleton height={40} width={128} borderRadius="0.75rem" />
            </>
          ) : (
            <>
              <div className={`w-14 h-14 rounded-xl ${estadoUI.bg} flex items-center justify-center flex-shrink-0`}>
                <i className={`fas ${estadoUI.icon} ${estadoUI.color} text-2xl`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg sm:text-xl font-extrabold bg-gradient-to-r ${estadoUI.color === 'text-amber-400' ? 'from-amber-300 to-amber-500' : estadoUI.color === 'text-green-400' ? 'from-emerald-300 to-emerald-500' : estadoUI.color === 'text-red-400' ? 'from-rose-300 to-rose-500' : 'from-blue-300 to-blue-500'} bg-clip-text text-transparent`}>{estadoUI.titulo}</h3>
                <p className="text-gray-400 text-sm mt-1">{estadoUI.desc}</p>
                {(solicitud?.fecha_respuesta || solicitud?.created_at) && (esPendiente || esRechazada) && (
                  <p className="text-gray-600 text-xs mt-2">
                    {esRechazada && solicitud?.fecha_respuesta
                      ? `Revisado el: ${formatDate(solicitud.fecha_respuesta)}`
                      : `Enviado el: ${formatDate(solicitud?.created_at || null)}`}
                  </p>
                )}
              </div>
              {(sinPlan || planNoVip) ? (
                <div className="shrink-0 text-right">
                  <span className="text-gray-500 text-xs">No disponible con tu plan</span>
                </div>
              ) : (
                <button
                  onClick={abrirAccion}
                  className="shrink-0 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  <i className={`fas ${botonIcono}`} />
                  {botonTexto}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {vipActivo && (
      <div className="relative overflow-hidden bg-gradient-to-br from-[#18182e] via-[#14142e] to-[#121220] border border-white/[0.08] rounded-3xl p-6 shadow-2xl shadow-amber-900/10">
          <h3 className="text-white font-bold mb-4">Beneficios de tu VIP</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: 'fa-crown', titulo: 'Badge dorado en perfil', desc: 'Destacas sobre el resto' },
              { icon: 'fa-arrow-up', titulo: 'Prioridad en búsquedas', desc: 'Apareces antes en resultados' },
              { icon: 'fa-eye', titulo: 'Más visitas a tu perfil', desc: 'Mayor visibilidad premium' },
              { icon: 'fa-gem', titulo: 'Insignia exclusiva', desc: 'Solo para perfiles VIP' },
            ].map((b) => (
              <div key={b.titulo} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <i className={`fas ${b.icon} text-amber-400 text-sm`} />
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{b.titulo}</div>
                  <div className="text-gray-500 text-xs">{b.desc}</div>
                </div>
              </div>
            ))}
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
                success ? 'bg-green-500/10' : 'bg-amber-500/10'
              }`}>
                <i className={`fas ${
                  success
                    ? 'fa-check-circle text-green-400'
                    : enModalVer
                      ? 'fa-eye text-amber-400'
                      : esResubir
                        ? 'fa-upload text-amber-400'
                        : 'fa-crown text-amber-400'
                } text-xl`} />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-white mb-1">
                {success
                  ? 'Solicitud enviada'
                  : enModalVer
                    ? 'Documentos enviados'
                    : esResubir
                      ? 'Re-subir comprobante'
                      : 'Solicitar VIP'}
              </h3>

              {/* Subtitle */}
              <p className="text-gray-400 text-sm mb-5">
                {success
                  ? 'Tu solicitud está en revisión'
                  : enModalVer
                    ? 'Revisa lo que enviaste'
                    : esResubir
                      ? 'Si te equivocaste, sube un nuevo comprobante'
                      : 'Sube tu comprobante de pago'}
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

              {/* Upload section (solicitar / re-subir) */}
              {!enModalVer && !success && (
                <div className="w-full mb-4">
                  <label className="block text-xs text-gray-400 mb-1.5 text-left">
                    Comprobante de pago <span className="text-gray-600">(opcional)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  />
                  {!comprobanteFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#2d2d44] rounded-xl p-4 text-center cursor-pointer hover:border-gray-500 transition-colors"
                    >
                      <i className="fas fa-cloud-upload-alt text-gray-500 text-2xl mb-2"></i>
                      <div className="text-gray-500 text-sm">Click para subir tu comprobante</div>
                      <div className="text-gray-600 text-xs mt-1">JPG, PNG, GIF, WEBP, PDF · Max 5MB</div>
                    </div>
                  ) : (
                    <div className="bg-[#13131a] rounded-xl p-3 flex items-center gap-3">
                      {comprobantePreview ? (
                        <a href={comprobantePreview} data-fancybox="vip-preview">
                          <img src={comprobantePreview} alt="Preview" className="w-14 h-14 rounded object-cover cursor-pointer" />
                        </a>
                      ) : (
                        <div className="w-14 h-14 rounded bg-[#1a1a2e] flex items-center justify-center text-gray-500">
                          <i className="fas fa-file-pdf text-2xl"></i>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-white text-sm truncate">{comprobanteFile.name}</div>
                        <div className="text-gray-500 text-xs">{(comprobanteFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button onClick={() => { setComprobanteFile(null); setComprobantePreview(null); }} className="text-red-400 hover:text-red-300">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Info precio + vigencia */}
              {!enModalVer && !success && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-5 w-full">
                  <p className="text-amber-400/80 text-xs text-left flex items-start gap-2">
                    <i className="fas fa-info-circle mt-0.5 flex-shrink-0" />
                    Valor: {config ? `$${config.precio_vip.toLocaleString('es-CL')} ${config.moneda_vip || ''}` : '—'}.
                    El VIP dura lo que dure tu plan base{planBase ? ` (vence el ${formatDate(planBase.fecha_fin)})` : ''}.
                  </p>
                </div>
              )}

              {/* Detalle (ver) */}
              {enModalVer && solicitudEnModal && !success && (
                <div className="w-full mb-4 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Estado</span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      solicitudEnModal.estado === 'aprobado'
                        ? 'bg-green-500/10 text-green-400'
                        : solicitudEnModal.estado === 'rechazado'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      <i className="fas fa-clock text-[0.6rem]" />
                      {solicitudEnModal.estado === 'aprobado' ? 'Aprobado'
                        : solicitudEnModal.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Fecha de envío</span>
                    <span className="text-white text-sm">{formatDate((solicitudEnModal as Solicitud).created_at || null)}</span>
                  </div>
                  {solicitudEnModal.fecha_respuesta && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">Fecha de respuesta</span>
                      <span className="text-white text-sm">{formatDate(solicitudEnModal.fecha_respuesta)}</span>
                    </div>
                  )}
                  {(solicitudEnModal as Solicitud).admin_notas && (
                    <div>
                      <div className="text-gray-500 text-xs mb-1">Notas del admin</div>
                      <div className="text-white text-sm">{(solicitudEnModal as Solicitud).admin_notas}</div>
                    </div>
                  )}
                  {solicitudEnModal.comprobante_pago && (
                    <div>
                      <div className="text-gray-500 text-xs mb-2">Comprobante de pago</div>
                      {esPdf(solicitudEnModal.comprobante_pago) ? (
                        <a
                          href={escortFileUrl(solicitudEnModal.comprobante_pago)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a2a3e] hover:bg-[#3d3d5c] text-white rounded-lg text-sm transition-colors"
                        >
                          <i className="fas fa-file-pdf text-red-400" />
                          Ver comprobante PDF
                        </a>
                      ) : (
                        <a href={escortFileUrl(solicitudEnModal.comprobante_pago)} data-fancybox="vip-comprobante">
                          <img
                            src={escortFileUrl(solicitudEnModal.comprobante_pago)}
                            alt="Comprobante"
                            className="w-full rounded-lg max-h-48 object-contain bg-black/30 cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        </a>
                      )}
                    </div>
                  )}
                  {!solicitudEnModal.comprobante_pago && esPendiente && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-amber-400/80 text-xs text-left">
                        Sin comprobante adjunto. Súbelo desde la tarjeta para agilizar la aprobación.
                      </p>
                    </div>
                  )}
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
              ) : enModalVer ? (
                <div className="flex flex-col gap-3 w-full">
                  {esPendiente && !confirmandoCancel && (
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => abrirModal('resubir')}
                        className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-upload" />
                        {solicitud?.comprobante_pago ? 'Re-subir' : 'Subir'} comprobante
                      </button>
                      <button
                        onClick={cerrarModal}
                        className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                      >
                        Cerrar
                      </button>
                    </div>
                  )}
                  {esPendiente && !confirmandoCancel && (
                    <button
                      onClick={() => setConfirmandoCancel(true)}
                      className="w-full px-4 py-2 text-red-400/70 hover:text-red-400 text-xs transition-colors"
                    >
                      Cancelar solicitud
                    </button>
                  )}
                  {confirmandoCancel && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 w-full">
                      <p className="text-gray-300 text-sm mb-4">¿Seguro que quieres cancelar tu solicitud VIP?</p>
                      <div className="flex gap-3 w-full">
                        <button
                          onClick={() => setConfirmandoCancel(false)}
                          className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                        >
                          Volver
                        </button>
                        <button
                          onClick={handleCancelar}
                          disabled={cancelando}
                          className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2"
                        >
                          {cancelando ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-trash-alt" />}
                          {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
                        </button>
                      </div>
                    </div>
                  )}
                  {(!esPendiente || confirmandoCancel) && !confirmandoCancel && (
                    <div className="flex gap-3 w-full">
                      {vipActivo && (
                        <button
                          onClick={() => abrirModal('resubir')}
                          className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2"
                        >
                          <i className="fas fa-upload" />
                          Re-subir comprobante
                        </button>
                      )}
                      <button
                        onClick={cerrarModal}
                        className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                      >
                        Cerrar
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-3 w-full">
                  <button
                    onClick={cerrarModal}
                    className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={esResubir ? handleReupload : handleSubmit}
                    disabled={enviando || (!puedeSolicitar && !esResubir) || (esResubir && !comprobanteFile)}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/20 text-sm flex items-center justify-center gap-2"
                  >
                    {enviando ? (
                      <i className="fas fa-circle-notch fa-spin" />
                    ) : (
                      <i className="fas fa-paper-plane" />
                    )}
                    {enviando ? 'Enviando...' : (esResubir ? 'Subir comprobante' : 'Enviar Solicitud')}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
