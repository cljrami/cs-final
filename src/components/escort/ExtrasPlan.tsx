// src/components/escort/ExtrasPlan.tsx

import React, { useState, useEffect, useRef } from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import EscortStatCard from '../ui/EscortStatCard';

interface Plan {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  tipo: 'base' | 'extra';
  duracion_dias: number;
  precio: number;
  moneda: string;
  badge: string;
  color_badge: string;
  no_disponible?: boolean;
  motivo_no_disponible?: string;
}

interface EscortExtra {
  id: number;
  plan_id: number;
  plan_nombre: string;
  estado: string;
  fecha_fin: string | null;
  comprobante_pago: string | null;
  pendiente_aprobacion: boolean;
}

// NUEVO: Interface para el plan base activo
interface PlanBaseActivo {
  suscripcion_id: number;
  plan_id: number;
  nombre: string;
  estado: 'activa' | 'pausada' | 'pendiente' | 'expirada';
  dias_restantes: number;
  fecha_fin: string | null;
}

interface EscortInfo {
  id: number;
  nombre: string;
}

interface SolicitudConfirmada {
  planId: number;
  planNombre: string;
  escortId: number;
  escortNombre: string;
  suscripcionId: number;
}

export default function ExtrasPlan() {
  const [planesExtra, setPlanesExtra] = useState<Plan[]>([]);
  const [extrasActivos, setExtrasActivos] = useState<EscortExtra[]>([]);
  const [planBase, setPlanBase] = useState<PlanBaseActivo | null>(null);
  const [escortInfo, setEscortInfo] = useState<EscortInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExtra, setSelectedExtra] = useState<number | null>(null);
  const [solicitando, setSolicitando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [solicitudConfirmada, setSolicitudConfirmada] = useState<SolicitudConfirmada | null>(null);

  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState('');
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const fileInputComprobante = useRef<HTMLInputElement>(null);

  const [showReuploadModal, setShowReuploadModal] = useState(false);
  const [reuploadExtra, setReuploadExtra] = useState<EscortExtra | null>(null);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadPreview, setReuploadPreview] = useState('');
  const [reuploadLoading, setReuploadLoading] = useState(false);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : '';

  useEffect(() => {
    fetchExtras();
    fetchExtrasActivos();
    fetchPlanBase(); // NUEVO
    fetchEscortInfo();
  }, []);

  const fetchExtras = async () => {
    try {
      const res = await fetch('/api/escort/planes.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPlanesExtra(data.planes.filter((p: Plan) => p.tipo === 'extra'));
      }
    } catch (e) {
      setError('Error cargando extras');
    } finally {
      setLoading(false);
    }
  };

  const fetchExtrasActivos = async () => {
    try {
      const res = await fetch('/api/escort/extras-activos.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setExtrasActivos(data.extras);
      }
    } catch (e) {
      // Silencioso
    }
  };

  // NUEVO: Obtener plan base activo para validar duración
  const fetchPlanBase = async () => {
    try {
      const res = await fetch('/api/escort/mi-plan.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.tiene_plan) {
        setPlanBase({
          suscripcion_id: data.plan.suscripcion_id,
          plan_id: data.plan.plan_id,
          nombre: data.plan.nombre,
          estado: data.estado.codigo,
          dias_restantes: data.estado.dias_restantes,
          fecha_fin: data.fechas.fin
        });
      } else {
        setPlanBase(null);
      }
    } catch (e) {
      setPlanBase(null);
    }
  };

  const fetchEscortInfo = async () => {
    try {
      const res = await fetch('/api/escort/perfil-sidebar.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.escort) {
        setEscortInfo({
          id: data.escort.id,
          nombre: data.escort.nombre_artistico || data.escort.nombre
        });
      }
    } catch (e) {
      // Silencioso
    }
  };

  // NUEVO: Determina si puede solicitar extras
  const puedeSolicitarExtras = () => {
    return planBase?.estado === 'activa' && (planBase?.dias_restantes ?? 0) > 0;
  };

  // NUEVO: Valida si un extra cabe en los días restantes del plan
  const extraEsValido = (plan: Plan): { valido: boolean; motivo?: string } => {
    if (!planBase) {
      return { valido: false, motivo: 'Necesitas un plan activo' };
    }
    if (planBase.estado !== 'activa') {
      return { valido: false, motivo: `Tu plan está ${planBase.estado}` };
    }
    if (plan.duracion_dias > planBase.dias_restantes) {
      return { 
        valido: false, 
        motivo: `Solo te quedan ${planBase.dias_restantes} días de plan. Este extra requiere ${plan.duracion_dias} días.` 
      };
    }
    return { valido: true };
  };

  const toggleExtraSelection = (planId: number) => {
    const plan = planesExtra.find(p => p.id === planId);
    if (!plan) return;
    
    // NUEVO: Validar si puede seleccionar
    const validacion = extraEsValido(plan);
    if (!validacion.valido) return;
    
    setSelectedExtra(prev => prev === planId ? null : planId);
    setError('');
    setSuccess('');
  };

  const openConfirmModal = () => {
    if (!selectedExtra) return;
    setShowConfirmModal(true);
    setError('');
    setSuccess('');
  };

  const handleConfirmSolicitar = async () => {
    if (!selectedExtra) return;
    
    setSolicitando(true);
    setError('');
    setSuccess('');
    setShowConfirmModal(false);

    try {
      let comprobantePath = null;
      if (comprobanteFile) {
        setSubiendoComprobante(true);
        const formData = new FormData();
        formData.append('comprobante', comprobanteFile);
        const uploadRes = await fetch('/api/escort/subir-comprobante.php', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const uploadData = await uploadRes.json();
        setSubiendoComprobante(false);
        if (uploadData.success) {
          comprobantePath = uploadData.path;
        } else {
          setError(uploadData.error || 'Error al subir comprobante');
          setSolicitando(false);
          return;
        }
      }

      const res = await fetch('/api/escort/solicitar-plan.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          plan_id: selectedExtra,
          comprobante_pago: comprobantePath,
          es_extra: true
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        const extraContratado = planesExtra.find(p => p.id === selectedExtra);
        setSolicitudConfirmada({
          planId: selectedExtra,
          planNombre: extraContratado?.nombre || 'Extra seleccionado',
          escortId: data.data?.escort_id || escortInfo?.id || 0,
          escortNombre: data.data?.escort_nombre || escortInfo?.nombre || 'Escort',
          suscripcionId: data.data?.suscripcion_id || 0
        });
        setShowSuccessModal(true);
        setSelectedExtra(null);
        fetchExtrasActivos();
      } else {
        setError(data.error || 'Error al solicitar extra');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setSolicitando(false);
    }
  };

  const handleReuploadComprobante = async () => {
    if (!reuploadExtra || !reuploadFile) return;
    setReuploadLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('comprobante', reuploadFile);
      formData.append('tipo', 'suscripcion');
      formData.append('id', String(reuploadExtra.id));
      const res = await fetch('/api/escort/subir-comprobante.php', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setReuploadExtra(null);
        setReuploadFile(null);
        setReuploadPreview('');
        setShowReuploadModal(false);
        setSuccess('Comprobante subido correctamente');
        fetchExtrasActivos();
      } else {
        setError(data.error || 'Error al subir comprobante');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setReuploadLoading(false);
    }
  };

  const selectedExtraData = planesExtra.find(p => p.id === selectedExtra);

  // NUEVO: Render mensaje cuando no puede solicitar extras
  const renderBloqueoExtras = () => {
    if (!planBase) {
      return (
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-lock text-gray-500 text-xl"></i>
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Extras bloqueados</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Necesitas tener un <strong className="text-white">plan activo</strong> para poder solicitar extras.
            <br /><br />
            Ve a <strong className="text-red-400">Mi Plan</strong> y selecciona un plan primero.
          </p>
          <a 
            href="/micuenta/mi-plan"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors text-sm"
          >
            <i className="fas fa-gem" />
            Ir a Mi Plan
          </a>
        </div>
      );
    }

    if (planBase.estado !== 'activa') {
      const estadoTexto = {
        'pendiente': 'pendiente de aprobación',
        'pausada': 'pausado',
        'expirada': 'expirado'
      }[planBase.estado] || planBase.estado;

      return (
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-clock text-amber-400 text-xl"></i>
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Extras no disponibles</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Tu plan <strong className="text-white">{planBase.nombre}</strong> está <strong className="text-amber-400">{estadoTexto}</strong>.
            <br /><br />
            Los extras solo están disponibles cuando tu plan está <strong className="text-green-400">activo</strong>.
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <SkeletonTheme baseColor="#1a1a2e" highlightColor="#2d2d44" duration={1.2}>
      <div className="space-y-8">
        {/* Header estilo "Mi Plan" */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <i className="fas fa-plus-circle text-red-500"></i>
            Extras al Plan
          </h1>
          <p className="text-gray-500 mt-1">
            {puedeSolicitarExtras() 
              ? 'Mejora tu visibilidad con servicios adicionales' 
              : 'Servicios adicionales para destacar tu anuncio'}
          </p>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <EscortStatCard
              icon="fa-star"
              value={extrasActivos.filter(e => e.estado === 'activo').length}
              label="Extras activos"
              color="#a855f7"
            />
            <EscortStatCard
              icon="fa-calendar-alt"
              value={planBase ? `${planBase.dias_restantes} días` : '—'}
              label="Días restantes en tu plan"
              color="#22c55e"
            />
            <EscortStatCard
              icon="fa-plus-circle"
              value={planesExtra.length}
              label="Extras disponibles"
              color="#ef4444"
            />
          </div>
        )}

        {/* Alerts */}
        {success && !showSuccessModal && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2 animate-pulse">
            <i className="fas fa-check-circle"></i>
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
            <i className="fas fa-exclamation-triangle"></i>
            {error}
          </div>
        )}

        {/* EXTRAS ACTIVOS - solo si no está cargando y hay datos */}
        {!loading && extrasActivos.length > 0 && (
          <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <i className="fas fa-star text-purple-400 text-xl"></i>
              <div>
                <h2 className="text-white font-bold">Extras Activos</h2>
                <p className="text-gray-500 text-xs">Servicios adicionales contratados</p>
              </div>
            </div>
            <div className="space-y-3">
              {extrasActivos.map((extra) => (
                <div key={extra.id} className="flex items-center justify-between bg-[#1a1a24] rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-white text-sm font-medium">{extra.plan_nombre}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      extra.estado === 'activo' 
                        ? 'bg-green-500/10 text-green-400' 
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {extra.estado}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {extra.pendiente_aprobacion && (
                      <span className="text-amber-400 text-xs">Pendiente pago</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setReuploadExtra(extra); setShowReuploadModal(true); }}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs transition-colors flex items-center gap-1.5 border border-blue-500/20"
                    >
                      <i className="fas fa-upload" />
                      {extra.comprobante_pago ? 'Re-subir' : 'Subir'} comprobante
                    </button>
                    {extra.fecha_fin && (
                      <span className="text-gray-500 text-xs">
                        hasta {new Date(extra.fecha_fin).toLocaleDateString('es-CL')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            BLOQUEO: Sin plan o plan no activo
            ═══════════════════════════════════════════ */}
        {!loading && !puedeSolicitarExtras() && renderBloqueoExtras()}

        {/* ═══════════════════════════════════════════
            LOADING - Skeleton cards
            ═══════════════════════════════════════════ */}
        {loading && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Skeleton width={180} height={24} />
              <div>
                <Skeleton width={160} height={20} className="mb-1" />
                <Skeleton width={280} height={14} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
                  <Skeleton width={80} height={24} className="mb-4 rounded-full" />
                  <Skeleton width={140} height={28} className="mb-1" />
                  <Skeleton width={100} height={32} className="mb-4" />
                  <Skeleton width={120} height={32} className="mb-4" />
                  <Skeleton width={200} height={16} className="mb-2" />
                  <Skeleton width={160} height={16} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            PLANES EXTRA - Solo si tiene plan activo
            ═══════════════════════════════════════════ */}
        {!loading && puedeSolicitarExtras() && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <i className="fas fa-plus-circle text-purple-400 text-xl"></i>
              <div>
                <h2 className="text-white font-bold text-lg">Destacados Disponibles</h2>
                <p className="text-gray-500 text-xs">
                  Aumenta tu visibilidad en el directorio
                  {planBase && (
                    <span className="text-green-400 ml-1">
                      • {planBase.dias_restantes} días restantes en tu plan
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {planesExtra.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <i className="fas fa-inbox text-3xl mb-3" />
                  <p>No hay planes extras disponibles</p>
                </div>
              ) : (
                planesExtra.map((plan) => {
                  const isSelected = selectedExtra === plan.id;
                  const validacion = extraEsValido(plan);
                  const noDisponible = !validacion.valido;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => toggleExtraSelection(plan.id)}
                      className={`
                        relative bg-[#13131a] border rounded-2xl p-6 cursor-pointer transition-all
                        ${isSelected
                          ? 'border-red-500 shadow-lg shadow-red-500/10'
                          : noDisponible
                            ? 'border-gray-800 opacity-50 cursor-not-allowed'
                            : 'border-gray-800 hover:border-gray-600 hover:shadow-lg hover:shadow-black/20'
                        }
                      `}
                    >
                      {/* Badge */}
                      <div
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4"
                        style={{ 
                          backgroundColor: plan.color_badge + '15', 
                          color: plan.color_badge, 
                          border: `1px solid ${plan.color_badge}30` 
                        }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: plan.color_badge }} />
                        {plan.badge}
                        <span className="ml-1 text-[10px] uppercase opacity-70">Extra</span>
                      </div>

                      {/* Nombre */}
                      <h3 className="text-xl font-bold text-white mb-1">{plan.nombre}</h3>
                      
                      {/* Precio */}
                      <div className="mb-4">
                        <span className="text-2xl font-bold text-white">${plan.precio.toLocaleString()}</span>
                        <span className="text-gray-500 text-sm ml-1">{plan.moneda}</span>
                      </div>

                      {/* Duración */}
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 bg-[#1a1a24] rounded-xl px-3 py-2 w-fit">
                        <i className="fas fa-calendar-alt text-gray-400" />
                        <span>{plan.duracion_dias} días</span>
                      </div>

                      {/* Descripción */}
                      <p className="text-gray-400 text-sm mb-4">{plan.descripcion}</p>

                      {/* NUEVO: Mensaje de no disponible */}
                      {noDisponible && validacion.motivo && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 mb-3">
                          <p className="text-red-400 text-xs flex items-start gap-1.5">
                            <i className="fas fa-ban mt-0.5 flex-shrink-0" />
                            {validacion.motivo}
                          </p>
                        </div>
                      )}

                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute top-4 right-4 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                          <i className="fas fa-check text-white text-sm" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* BOTÓN SOLICITAR EXTRA */}
        {selectedExtra && selectedExtraData && (
          <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <i className="fas fa-paper-plane text-red-400"></i>
                </div>
                <div>
                  <h2 className="text-white font-bold">Extra Seleccionado</h2>
                  <p className="text-gray-500 text-xs">{selectedExtraData.nombre} • {selectedExtraData.duracion_dias} días</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedExtra(null)}
                className="text-gray-500 hover:text-white transition-colors text-sm"
              >
                <i className="fas fa-times" /> Cambiar
              </button>
            </div>
            
            <button
              onClick={openConfirmModal}
              disabled={solicitando}
              className={`
                w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
                ${solicitando
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'
                }
              `}
            >
              {solicitando ? (
                <>
                  <i className="fas fa-circle-notch fa-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane" />
                  Solicitar Extra
                </>
              )}
            </button>
          </div>
        )}

        {/* POPUP DE CONFIRMACIÓN - Extra */}
        {showConfirmModal && selectedExtraData && escortInfo && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 lg:p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                  <i className="fas fa-plus-circle text-purple-400 text-xl"></i>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">Confirmar Extra</h3>
                <p className="text-gray-400 text-sm mb-5">¿Deseas solicitar el siguiente servicio adicional?</p>

                <div className="w-full bg-[#13131a] border border-gray-800 rounded-xl p-4 mb-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: selectedExtraData.color_badge }}
                    />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Extra seleccionado</span>
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">{selectedExtraData.nombre}</h4>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">
                      <i className="fas fa-calendar-alt mr-1.5 text-gray-500" />
                      {selectedExtraData.duracion_dias} días
                    </span>
                    <span className="text-white font-semibold">
                      ${selectedExtraData.precio.toLocaleString()} {selectedExtraData.moneda}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">{selectedExtraData.descripcion}</p>
                </div>

                {/* NUEVO: Info del plan base */}
                {planBase && (
                  <div className="w-full bg-[#13131a] border border-gray-800 rounded-xl p-4 mb-4 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Plan base</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white">{planBase.nombre}</span>
                      <span className="text-green-400">{planBase.dias_restantes} días restantes</span>
                    </div>
                  </div>
                )}

                <div className="w-full bg-[#13131a] border border-gray-800 rounded-xl p-4 mb-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Solicitante</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{escortInfo.nombre}</span>
                    <span className="text-amber-400 font-mono text-sm font-bold">ID: #{escortInfo.id}</span>
                  </div>
                </div>

                <div className="w-full mb-4">
                  <label className="block text-xs text-gray-400 mb-1.5 text-left">Comprobante de pago <span className="text-gray-600">(opcional)</span></label>
                  <input ref={fileInputComprobante} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { setError('El archivo no puede superar 5MB'); return; }
                      setComprobanteFile(file);
                      if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setComprobantePreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setComprobantePreview('');
                      }
                    }} />
                  {!comprobanteFile ? (
                    <div onClick={() => fileInputComprobante.current?.click()}
                      className="border-2 border-dashed border-[#2d2d44] rounded-xl p-3 text-center cursor-pointer hover:border-gray-500 transition-colors">
                      <i className="fas fa-cloud-upload-alt text-gray-500 text-lg mb-1"></i>
                      <div className="text-gray-500 text-xs">Click para subir comprobante</div>
                      <div className="text-gray-600 text-[10px]">JPG, PNG, PDF · Max 5MB</div>
                    </div>
                  ) : (
                    <div className="bg-[#13131a] rounded-xl p-3 flex items-center gap-3">
                      {comprobantePreview ? (
                        <img src={comprobantePreview} alt="Preview" className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-[#1a1a2e] flex items-center justify-center text-gray-500"><i className="fas fa-file-pdf text-lg"></i></div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-white text-sm truncate">{comprobanteFile.name}</div>
                        <div className="text-gray-500 text-xs">{(comprobanteFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button onClick={() => { setComprobanteFile(null); setComprobantePreview(''); }} className="text-red-400 hover:text-red-300 text-sm">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-5 w-full">
                  <p className="text-amber-400/80 text-xs text-left flex items-start gap-2">
                    <i className="fas fa-info-circle mt-0.5 flex-shrink-0" />
                    Tu extra se activará automáticamente una vez verificado tu pago. Este proceso puede tomar hasta 24 horas hábiles.
                  </p>
                </div>

                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleConfirmSolicitar}
                    disabled={solicitando || subiendoComprobante}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-red-500/20 text-sm flex items-center justify-center gap-2"
                  >
                    {(solicitando || subiendoComprobante) ? (
                      <i className="fas fa-circle-notch fa-spin" />
                    ) : (
                      <i className="fas fa-paper-plane" />
                    )}
                    {subiendoComprobante ? 'Subiendo...' : solicitando ? 'Solicitando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Re-upload comprobante modal para extras */}
        {showReuploadModal && reuploadExtra && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-md shadow-2xl p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <i className="fas fa-upload text-blue-400 text-xl"></i>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Subir comprobante</h3>
                <p className="text-gray-400 text-sm mb-2">{reuploadExtra.plan_nombre}</p>
                <p className="text-gray-500 text-xs mb-5">Selecciona el comprobante de pago</p>

                <div className="w-full mb-4">
                  <input ref={reuploadInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { setError('El archivo no puede superar 5MB'); return; }
                      setReuploadFile(file);
                      if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setReuploadPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setReuploadPreview('');
                      }
                    }} />
                  {!reuploadFile ? (
                    <div onClick={() => reuploadInputRef.current?.click()}
                      className="border-2 border-dashed border-[#2d2d44] rounded-xl p-4 text-center cursor-pointer hover:border-gray-500 transition-colors">
                      <i className="fas fa-cloud-upload-alt text-gray-500 text-2xl mb-2"></i>
                      <div className="text-gray-500 text-sm">Click para seleccionar archivo</div>
                      <div className="text-gray-600 text-xs mt-1">JPG, PNG, PDF · Max 5MB</div>
                    </div>
                  ) : (
                    <div className="bg-[#13131a] rounded-xl p-3 flex items-center gap-3">
                      {reuploadPreview ? (
                        <img src={reuploadPreview} alt="Preview" className="w-14 h-14 rounded object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded bg-[#1a1a2e] flex items-center justify-center text-gray-500"><i className="fas fa-file-pdf text-2xl"></i></div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-white text-sm truncate">{reuploadFile.name}</div>
                        <div className="text-gray-500 text-xs">{(reuploadFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button onClick={() => { setReuploadFile(null); setReuploadPreview(''); }} className="text-red-400 hover:text-red-300">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 w-full">
                  <button onClick={() => { setShowReuploadModal(false); setReuploadExtra(null); setReuploadFile(null); setReuploadPreview(''); }}
                    className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm">
                    Cancelar
                  </button>
                  <button onClick={handleReuploadComprobante} disabled={!reuploadFile || reuploadLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm flex items-center justify-center gap-2">
                    {reuploadLoading ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-upload" />}
                    {reuploadLoading ? 'Subiendo...' : 'Subir'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* POPUP DE ÉXITO - Extra */}
        {showSuccessModal && solicitudConfirmada && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 lg:p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <i className="fas fa-check-circle text-green-400 text-xl"></i>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">¡Extra Solicitado!</h3>
                <p className="text-gray-400 text-sm mb-5">Tu solicitud de extra ha sido registrada correctamente.</p>

                <div className="w-full bg-[#13131a] border border-gray-800 rounded-xl p-4 mb-4 text-left space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Solicitante</span>
                    <div className="text-right">
                      <span className="text-white text-sm font-medium block">{solicitudConfirmada.escortNombre}</span>
                      <span className="text-amber-400 font-mono text-xs">ID: #{solicitudConfirmada.escortId}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Extra</span>
                    <span className="text-white font-medium text-sm">{solicitudConfirmada.planNombre}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">ID Extra</span>
                    <span className="text-white font-mono text-sm">#{solicitudConfirmada.planId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">N° Solicitud</span>
                    <span className="text-white font-mono text-sm">#{solicitudConfirmada.suscripcionId}</span>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-800">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <p className="text-amber-400 text-xs text-center">
                        <i className="fas fa-clock mr-1.5" />
                        Tu extra se <strong className="text-white">activará automáticamente</strong> una vez verificado tu pago.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 mb-5">
                  <i className="fas fa-info-circle" />
                  <span>Este proceso puede tomar hasta 24 horas hábiles</span>
                </div>

                <button 
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-green-500/20 text-sm"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SkeletonTheme>
  );
}