// src/components/escort/MiPlan.tsx
// UI basada en ExtrasPlan pero mostrando SOLO planes base

import React, { useState, useEffect, useRef } from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface Plan {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  tipo: 'base' | 'extra';
  duracion_dias: number;
  precio: number;
  moneda: string;
  max_fotos: number;
  max_videos: number;
  permite_vip: boolean;
  permite_destacado: boolean;
  uso_unico: boolean;
  badge: string;
  color_badge: string;
  no_disponible?: boolean;
  motivo_no_disponible?: string;
}

interface MiPlanData {
  success: boolean;
  tiene_plan: boolean;
  plan?: {
    suscripcion_id: number;
    plan_id: number;
    nombre: string;
    slug: string;
    tipo: string;
    badge: string | null;
    color_badge: string;
    duracion_dias: number;
    max_fotos: number;
    max_videos: number;
    permite_vip: boolean;
    permite_destacado: boolean;
    uso_unico: boolean;
  };
  estado?: {
    codigo: string;
    texto: string;
    dias_restantes: number;
    dias_totales: number;
    porcentaje_usado: number;
    porcentaje_restante: number;
  };
  fechas?: {
    inicio: string | null;
    fin: string | null;
    pausa: string | null;
  };
  pausas?: {
    usadas: number;
    maximas: number;
    restantes: number;
  };
  acciones?: {
    puede_pausar: boolean;
    puede_reactivar: boolean;
    motivo_no_pausar: string;
  };
  pago?: {
    id: number;
    precio: number;
    moneda: string;
    comprobante: string | null;
  };
  ya_uso_gratis?: boolean;
  puede_comprar?: boolean;
}

interface SolicitudConfirmada {
  planId: number;
  planNombre: string;
  escortId: number;
  escortNombre: string;
  suscripcionId: number;
}

export default function MiPlan() {
  const [planData, setPlanData] = useState<MiPlanData | null>(null);
  const [planesBase, setPlanesBase] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [solicitando, setSolicitando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [solicitudConfirmada, setSolicitudConfirmada] = useState<SolicitudConfirmada | null>(null);

  const [pausando, setPausando] = useState(false);
  const [pausaError, setPausaError] = useState('');
  const [pausaSuccess, setPausaSuccess] = useState('');

  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState('');
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const fileInputComprobante = useRef<HTMLInputElement>(null);
  const [showPausaConfirm, setShowPausaConfirm] = useState<'pausar' | 'reactivar' | null>(null);

  const [showReuploadModal, setShowReuploadModal] = useState(false);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadPreview, setReuploadPreview] = useState('');
  const [reuploadLoading, setReuploadLoading] = useState(false);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : '';

  const selectedPlanData = selectedPlan ? planesBase.find(p => p.id === selectedPlan) ?? null : null;

  useEffect(() => {
    fetchMiPlan();
    fetchPlanesBase();
  }, []);

  const fetchMiPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/escort/mi-plan.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPlanData(data);
      } else {
        setError(data.error || 'Error al cargar plan');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanesBase = async () => {
    try {
      const res = await fetch('/api/escort/planes.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        // SOLO planes base, no extras
        setPlanesBase(data.planes.filter((p: Plan) => p.tipo === 'base'));
      }
    } catch (e) {
      console.error('Error cargando planes base');
    }
  };

  const handlePausaToggle = async (accion: 'pausada' | 'activa') => {
    setPausando(true);
    setPausaError('');
    setPausaSuccess('');
    setShowPausaConfirm(null);

    try {
      const res = await fetch('/api/escort/estado.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ estado: accion })
      });
      const data = await res.json();
      if (data.success) {
        setPausaSuccess(accion === 'pausada' ? 'Plan pausado correctamente' : 'Plan reactivado correctamente');
        fetchMiPlan();
        setTimeout(() => setPausaSuccess(''), 3000);
      } else {
        setPausaError(data.error || 'Error al cambiar estado del plan');
      }
    } catch (e) {
      setPausaError('Error de conexión con el servidor');
    } finally {
      setPausando(false);
    }
  };

  const togglePlanSelection = (planId: number) => {
    const plan = planesBase.find(p => p.id === planId);
    if (!plan || plan.no_disponible) return;

    setSelectedPlan(prev => prev === planId ? null : planId);
    setError('');
    setSuccess('');
  };

  const openConfirmModal = () => {
    if (!selectedPlan) return;
    setShowConfirmModal(true);
    setError('');
    setSuccess('');
  };

  const handleConfirmSolicitar = async () => {
    if (!selectedPlan) return;

    setSolicitando(true);
    setError('');
    setSuccess('');
    setShowConfirmModal(false);

    try {
      let comprobanteUrl = null;
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
          comprobanteUrl = uploadData.path;
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
          plan_id: selectedPlan,
          comprobante_pago: comprobanteUrl
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        const planContratado = planesBase.find(p => p.id === selectedPlan);
        setSolicitudConfirmada({
          planId: selectedPlan,
          planNombre: planContratado?.nombre || 'Plan seleccionado',
          escortId: data.data?.escort_id || 0,
          escortNombre: 'Escort',
          suscripcionId: data.suscripcion_id || 0
        });
        setShowSuccessModal(true);
        setSelectedPlan(null);
      } else {
        setError(data.error || 'Error al solicitar plan');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setSolicitando(false);
    }
  };

  const handleReuploadComprobante = async () => {
    if (!reuploadFile || !planData?.pago?.id) return;
    setReuploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('comprobante', reuploadFile);
      formData.append('tipo', 'pago');
      formData.append('id', String(planData.pago.id));
      const res = await fetch('/api/escort/subir-comprobante.php', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Comprobante subido correctamente');
        setTimeout(() => setSuccess(''), 3000);
        setShowReuploadModal(false);
        setReuploadFile(null);
        setReuploadPreview('');
        fetchMiPlan();
      } else {
        setError(data.error || 'Error al subir comprobante');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setReuploadLoading(false);
    }
  };

  // ============================================================
  // RENDER: SIN PLAN ACTIVO - Mostrar cards de planes base
  // ============================================================
  if (!loading && planData && !planData.tiene_plan) {
    return (
      <>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <i className="fas fa-credit-card text-red-500"></i>
              Mi Plan
            </h1>
            <p className="text-gray-500 mt-1">
              {planData.ya_uso_gratis 
                ? 'Elige un plan para seguir publicando tu perfil'
                : '¡Publica tu perfil! Selecciona un plan para empezar'
              }
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2">
              <i className="fas fa-check-circle"></i>
              {success}
            </div>
          )}

          {/* Cards de planes base */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {planesBase.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                <i className="fas fa-inbox text-3xl mb-3" />
                <p>No hay planes disponibles</p>
              </div>
            ) : (
              planesBase.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const noDisponible = plan.no_disponible;

                return (
                  <div
                    key={plan.id}
                    onClick={() => togglePlanSelection(plan.id)}
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
                    </div>

                    {/* Nombre */}
                    <h3 className="text-xl font-bold text-white mb-1">{plan.nombre}</h3>

                    {/* Precio */}
                    <div className="mb-4">
                      <span className="text-2xl font-bold text-white">
                        {plan.precio === 0 ? 'GRATIS' : '$' + plan.precio.toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-sm ml-1">{plan.moneda}</span>
                    </div>

                    {/* Duración */}
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 bg-[#1a1a24] rounded-xl px-3 py-2 w-fit">
                      <i className="fas fa-calendar-alt text-gray-400" />
                      <span>{plan.duracion_dias} días de publicación</span>
                    </div>

                    {/* Características */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <i className="fas fa-images text-red-400 w-5" />
                        <span>{plan.max_fotos} fotos</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <i className="fas fa-video text-red-400 w-5" />
                        <span>{plan.max_videos} videos</span>
                      </div>
                      {plan.permite_vip && (
                        <div className="flex items-center gap-2 text-sm text-amber-400">
                          <i className="fas fa-crown w-5" />
                          <span>Permite VIP</span>
                        </div>
                      )}
                      {plan.permite_destacado && (
                        <div className="flex items-center gap-2 text-sm text-purple-400">
                          <i className="fas fa-star w-5" />
                          <span>Permite Destacado</span>
                        </div>
                      )}
                      {plan.uso_unico && (
                        <div className="flex items-center gap-2 text-sm text-blue-400">
                          <i className="fas fa-gift w-5" />
                          <span>Solo una vez</span>
                        </div>
                      )}
                    </div>

                    {/* Mensaje no disponible */}
                    {noDisponible && plan.motivo_no_disponible && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 mb-3">
                        <p className="text-red-400 text-xs flex items-start gap-1.5">
                          <i className="fas fa-ban mt-0.5 flex-shrink-0" />
                          {plan.motivo_no_disponible}
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

          {/* BOTÓN SOLICITAR PLAN */}
          {selectedPlan && selectedPlanData && (
            <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                    <i className="fas fa-paper-plane text-red-400"></i>
                  </div>
                  <div>
                    <h2 className="text-white font-bold">Plan Seleccionado</h2>
                    <p className="text-gray-500 text-xs">{selectedPlanData.nombre} • {selectedPlanData.duracion_dias} días</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
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
                    {selectedPlanData.precio === 0 ? 'Solicitar Gratis' : 'Solicitar Plan'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* POPUP DE CONFIRMACIÓN */}
        {showConfirmModal && selectedPlanData && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 lg:p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <i className="fas fa-credit-card text-red-400 text-xl"></i>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">Confirmar Plan</h3>
                <p className="text-gray-400 text-sm mb-5">¿Deseas solicitar el siguiente plan?</p>

                <div className="w-full bg-[#13131a] border border-gray-800 rounded-xl p-4 mb-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: selectedPlanData.color_badge }}
                    />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Plan seleccionado</span>
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">{selectedPlanData.nombre}</h4>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">
                      <i className="fas fa-calendar-alt mr-1.5 text-gray-500" />
                      {selectedPlanData.duracion_dias} días
                    </span>
                    <span className="text-white font-semibold">
                      {selectedPlanData.precio === 0 ? 'GRATIS' : '$' + selectedPlanData.precio.toLocaleString() + ' ' + selectedPlanData.moneda}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">{selectedPlanData.descripcion}</p>
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
                    Tu plan se activará una vez aprobado por el administrador. Este proceso puede tomar hasta 24 horas hábiles.
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

        {/* POPUP DE ÉXITO */}
        {showSuccessModal && solicitudConfirmada && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 lg:p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <i className="fas fa-check-circle text-green-400 text-xl"></i>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">¡Plan Solicitado!</h3>
                <p className="text-gray-400 text-sm mb-5">Tu solicitud ha sido registrada correctamente.</p>

                <div className="w-full bg-[#13131a] border border-gray-800 rounded-xl p-4 mb-4 text-left space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Plan</span>
                    <span className="text-white font-medium text-sm">{solicitudConfirmada.planNombre}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">ID Plan</span>
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
                        Tu plan se <strong className="text-white">activará</strong> una vez aprobado por el administrador.
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    window.location.reload();
                  }}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-green-500/20 text-sm"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ============================================================
  // RENDER: CON PLAN ACTIVO - Mostrar detalles del plan
  // ============================================================
  if (!loading && planData && planData.tiene_plan) {
    const plan = planData.plan!;
    const estado = planData.estado!;
    const fechas = planData.fechas!;
    const pausas = planData.pausas!;
    const acciones = planData.acciones!;
    const pago = planData.pago!;

    const estadoColors: Record<string, string> = {
      activa: 'text-emerald-400 bg-emerald-900/30 border-emerald-800',
      pausada: 'text-orange-400 bg-orange-900/30 border-orange-800',
      expirada: 'text-red-400 bg-red-900/30 border-red-800',
      pendiente_aprobacion: 'text-yellow-400 bg-yellow-900/30 border-yellow-800',
      rechazada: 'text-rose-400 bg-rose-900/30 border-rose-800',
      cancelada: 'text-gray-400 bg-gray-900/30 border-gray-700',
    };

    const puedeRenovar = ['expirada', 'cancelada', 'rechazada'].includes(estado.codigo);

    return (
      <>
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <i className="fas fa-credit-card text-red-500"></i>
              Mi Plan
            </h1>
            <p className="text-gray-500 mt-1">Gestiona tu plan de publicación</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2">
              <i className="fas fa-check-circle"></i>
              {success}
            </div>
          )}

          {/* Card principal del plan */}
          <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: plan.color_badge || '#6366f1' }}
                >
                  {plan.badge ? plan.badge.charAt(0) : 'P'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{plan.nombre}</h2>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border mt-1 ${estadoColors[estado.codigo] || estadoColors.expirada}`}>
                    <i className={`fas ${
                      estado.codigo === 'activa' ? 'fa-check-circle' :
                      estado.codigo === 'pausada' ? 'fa-pause-circle' :
                      estado.codigo === 'expirada' ? 'fa-times-circle' :
                      estado.codigo === 'pendiente_aprobacion' ? 'fa-clock' :
                      estado.codigo === 'rechazada' ? 'fa-ban' :
                      'fa-question-circle'
                    }`} />
                    {estado.texto}
                  </span>
                </div>
              </div>

              {puedeRenovar && (
                <button
                  onClick={() => {
                    setPlanData(null);
                    fetchMiPlan();
                    fetchPlanesBase();
                  }}
                  className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  <i className="fas fa-sync-alt mr-1.5" />
                  Renovar Plan
                </button>
              )}
            </div>

            {/* Barra de progreso */}
            {estado.codigo === 'activa' && (
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Progreso del plan</span>
                  <span className="text-white font-medium">{estado.dias_restantes} días restantes</span>
                </div>
                <div className="w-full h-3 bg-[#2a2a3e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all"
                    style={{ width: `${estado.porcentaje_usado}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{estado.porcentaje_usado}% usado</span>
                  <span>{estado.porcentaje_restante}% restante</span>
                </div>
              </div>
            )}

            {estado.codigo === 'pausada' && (
              <div className="mt-6 bg-orange-900/20 border border-orange-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-orange-400">
                  <i className="fas fa-pause-circle text-xl" />
                  <span className="font-medium">Plan pausado</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Tu plan está pausado desde el {fechas.pausa || '-'}. 
                  Tienes {estado.dias_restantes} días guardados.
                </p>
              </div>
            )}

            {estado.codigo === 'pendiente_aprobacion' && (
              <div className="mt-6 bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-400">
                  <i className="fas fa-clock text-xl" />
                  <span className="font-medium">Pendiente de aprobación</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Tu solicitud está siendo revisada por el administrador.
                </p>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════
              GRID DE INFO - FECHAS CORREGIDAS
              ═══════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* ── FECHAS: Solo si NO está pendiente de aprobación ── */}
            <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">
                <i className="fas fa-calendar-alt mr-2" />Fechas
              </h3>
              <div className="space-y-3">
                {estado.codigo === 'pendiente_aprobacion' ? (
                  /* Pendiente: NO mostrar fechas, solo mensaje */
                  <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3">
                    <p className="text-yellow-400 text-sm flex items-center gap-2">
                      <i className="fas fa-clock" />
                      Las fechas se mostrarán una vez aprobada tu solicitud
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Aprobado/Activo/Pausado/Expirado: SÍ mostrar fechas */}
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-sm">Inicio</span>
                      <span className="text-white font-medium">{fechas.inicio || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-sm">Vencimiento</span>
                      <span className="text-white font-medium">{fechas.fin || '-'}</span>
                    </div>
                    {fechas.pausa && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Pausado desde</span>
                        <span className="text-orange-400 font-medium">{fechas.pausa}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">
                <i className="fas fa-star mr-2" />Características
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <i className="fas fa-images text-red-400 w-5" />
                  <span>{plan.max_fotos} fotos máx.</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <i className="fas fa-video text-red-400 w-5" />
                  <span>{plan.max_videos} videos máx.</span>
                </div>
                {plan.permite_vip && (
                  <div className="flex items-center gap-2 text-sm text-amber-400">
                    <i className="fas fa-crown w-5" />
                    <span>Permite VIP</span>
                  </div>
                )}
                {plan.permite_destacado && (
                  <div className="flex items-center gap-2 text-sm text-purple-400">
                    <i className="fas fa-star w-5" />
                    <span>Permite Destacado</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">
                <i className="fas fa-pause-circle mr-2" />Pausas
              </h3>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Usadas</span>
                  <span className="text-white font-medium">{pausas.usadas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Máximas</span>
                  <span className="text-white font-medium">{pausas.maximas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">Restantes</span>
                  <span className={`font-medium ${pausas.restantes > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pausas.restantes}
                  </span>
                </div>
              </div>

              {pausaSuccess && (
                <div className="mb-3 p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-xs flex items-center gap-2">
                  <i className="fas fa-check-circle"></i>
                  {pausaSuccess}
                </div>
              )}
              {pausaError && (
                <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i>
                  {pausaError}
                </div>
              )}

              {estado.codigo === 'activa' && (
                <button
                  onClick={() => {
                    if (!acciones.puede_pausar) return;
                    setShowPausaConfirm('pausar');
                  }}
                  disabled={pausando || !acciones.puede_pausar}
                  title={!acciones.puede_pausar ? acciones.motivo_no_pausar : ''}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all
                    ${acciones.puede_pausar
                      ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/50'
                      : 'bg-gray-800/50 border border-gray-700 text-gray-600 cursor-not-allowed'
                    }
                    ${pausando ? 'opacity-70' : ''}
                  `}
                >
                  {pausando ? (
                    <><i className="fas fa-spinner fa-spin"></i> Procesando...</>
                  ) : (
                    <><i className="fas fa-pause"></i> Pausar Plan</>
                  )}
                </button>
              )}

              {estado.codigo === 'pausada' && (
                <button
                  onClick={() => setShowPausaConfirm('reactivar')}
                  disabled={pausando}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                >
                  {pausando ? (
                    <><i className="fas fa-spinner fa-spin"></i> Procesando...</>
                  ) : (
                    <><i className="fas fa-play"></i> Reactivar Plan</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Pago */}
          <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">
              <i className="fas fa-receipt mr-2" />Información de Pago
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">${pago.precio.toLocaleString()}</p>
                <p className="text-sm text-gray-500">{pago.moneda}</p>
              </div>
              {pago.comprobante ? (
                <div className="flex items-center gap-2">
                  <a
                    href={`/uploads/comprobantes/${pago.comprobante}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#3d3d5c] text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                  >
                    <i className="fas fa-file-image" />
                    Ver comprobante
                  </a>
                  <button
                    onClick={() => setShowReuploadModal(true)}
                    className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm transition-colors flex items-center gap-2 border border-blue-500/20"
                  >
                    <i className="fas fa-upload" />
                    Re-subir
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowReuploadModal(true)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-upload" />
                  Subir comprobante
                </button>
              )}
            </div>
          </div>

          {/* Re-upload comprobante modal */}
          {showReuploadModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
              <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-md shadow-2xl p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                    <i className="fas fa-upload text-blue-400 text-xl"></i>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Subir comprobante</h3>
                  <p className="text-gray-400 text-sm mb-5">Selecciona el comprobante de pago</p>

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
                    <button onClick={() => { setShowReuploadModal(false); setReuploadFile(null); setReuploadPreview(''); }}
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
        </div>
      {/* Modal de confirmación para pausar/reactivar */}
      {showPausaConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 lg:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-[360px] shadow-2xl p-5 lg:p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center mb-3 lg:mb-4 ${
                showPausaConfirm === 'pausar' ? 'bg-yellow-500/10' : 'bg-emerald-500/10'
              }`}>
                <i className={`fas ${showPausaConfirm === 'pausar' ? 'fa-pause text-yellow-400' : 'fa-play text-emerald-400'} text-lg lg:text-xl`}></i>
              </div>
              <h3 className="text-base lg:text-lg font-bold text-white mb-1 lg:mb-2">
                {showPausaConfirm === 'pausar' ? 'Pausar plan?' : 'Reactivar plan?'}
              </h3>
              <p className="text-gray-400 text-sm mb-4 lg:mb-6">
                {showPausaConfirm === 'pausar'
                  ? 'Al pausar tu plan, los días restantes se conservan. Podrás reactivarlo cuando quieras.'
                  : 'Al reactivar tu plan, tu anuncio volverá a estar visible y se descontarán los días de pausa.'
                }
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowPausaConfirm(null)}
                  className="flex-1 px-3 py-2 lg:px-4 lg:py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handlePausaToggle(showPausaConfirm === 'pausar' ? 'pausada' : 'activa')}
                  disabled={pausando}
                  className={`flex-1 px-3 py-2 lg:px-4 lg:py-2.5 font-semibold rounded-lg transition-all text-sm ${
                    showPausaConfirm === 'pausar'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-lg shadow-yellow-500/20'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20'
                  }`}
                >
                  {pausando ? 'Procesando...' : showPausaConfirm === 'pausar' ? 'Pausar' : 'Reactivar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  // ============================================================
  // LOADING STATE
  // ============================================================
    return (
      <div className="space-y-8">
        <Skeleton width={180} height={32} className="mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
              <Skeleton width={80} height={24} className="mb-4 rounded-full" />
              <Skeleton width={140} height={28} className="mb-1" />
              <Skeleton width={100} height={32} className="mb-4" />
              <Skeleton width={200} height={16} className="mb-2" />
              <Skeleton width={160} height={16} />
            </div>
          ))}
        </div>
      </div>
    );
}