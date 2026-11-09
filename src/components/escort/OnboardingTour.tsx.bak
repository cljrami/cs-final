// src/components/escort/OnboardingTour.tsx
import { useState, useEffect, useRef } from 'react';
import { API_BASE, decodeEscortToken } from '../../lib/escortAuth';

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
  max_pausas_permitidas?: number;
  no_disponible?: boolean;
  motivo_no_disponible?: string;
}

type Fase = 'welcome' | 'planes' | 'resumen';

function decodeToken(token: string | null): any {
  if (!token) return null;
  return decodeEscortToken(token);
}

const capacidades = [
  { icon: 'fa-user-edit', color: 'text-orange-400', label: 'Editar tu perfil', desc: 'Datos, medidas, servicios y más' },
  { icon: 'fa-images', color: 'text-pink-400', label: 'Subir fotos', desc: 'Tu galería y portada' },
  { icon: 'fa-history', color: 'text-purple-400', label: 'Historias', desc: 'Contenido de 24 horas' },
  { icon: 'fa-crown', color: 'text-amber-400', label: 'VIP & Destacado', desc: 'Según tu plan' },
];

export default function OnboardingTour() {
  const [fase, setFase] = useState<Fase>('welcome');
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [planResumen, setPlanResumen] = useState<Plan | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState('');
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : '';
  const selectedPlanData = planes.find(p => p.id === selectedPlan) ?? null;

  const fetchPlanes = async () => {
    setLoadingPlanes(true);
    try {
      const res = await fetch('/api/escort/planes.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPlanes(data.planes.filter((p: Plan) => p.tipo === 'base'));
      } else {
        setError(data.error || 'Error cargando planes');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoadingPlanes(false);
    }
  };

  useEffect(() => {
    const t = localStorage.getItem('escort_token');
    const tokenData = decodeToken(t);

    if (!t || !tokenData) {
      window.location.replace('/micuenta/login');
      return;
    }

    if (!tokenData.exp || tokenData.exp < Date.now() / 1000) {
      localStorage.removeItem('escort_token');
      localStorage.removeItem('escort_data');
      window.location.replace('/micuenta/login');
      return;
    }

    // Si el token ya tiene primer_login = 0, no debería estar aquí
    if (tokenData.primer_login === 0) {
      window.location.replace('/micuenta/resumen');
      return;
    }

    setTokenValid(true);
    fetchPlanes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinuar = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    setError('');

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
          comprobanteUrl = uploadData.comprobante_url;
        } else {
          setError(uploadData.error || 'Error al subir comprobante');
          setSubmitting(false);
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
          metodo_pago: 'transferencia',
          comprobante_pago: comprobanteUrl,
          notas: '',
          es_extra: false
        })
      });

      const data = await res.json();
      if (data.success) {
        setPlanResumen(selectedPlanData);
        setFase('resumen');
      } else {
        setError(data.error || 'Error al solicitar el plan');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);

    try {
      const response = await fetch(`${API_BASE}/onboarding-completed.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('escort_token', data.token);
      }
    } catch {
      // Si falla la red, redirigimos igual; el guard revalidará luego.
    }

    window.location.replace('/micuenta/resumen');
  };

  const planFeatures = (plan: Plan) => {
    const items: { icon: string; text: string; color?: string }[] = [
      { icon: 'fa-calendar-alt', text: `${plan.duracion_dias} días de publicación` },
      { icon: 'fa-dollar-sign', text: plan.precio === 0 ? 'Gratis' : `$${plan.precio.toLocaleString()} ${plan.moneda}` },
      { icon: 'fa-images', text: `${plan.max_fotos} fotos` },
      { icon: 'fa-video', text: plan.max_videos > 0 ? `${plan.max_videos} videos` : 'Sin videos' },
    ];
    if (plan.permite_vip) items.push({ icon: 'fa-crown', text: 'Puede solicitar VIP', color: 'text-amber-400' });
    if (plan.permite_destacado) items.push({ icon: 'fa-star', text: 'Puede destacarse', color: 'text-purple-400' });
    if (plan.max_pausas_permitidas && plan.max_pausas_permitidas > 0) {
      items.push({ icon: 'fa-pause-circle', text: `${plan.max_pausas_permitidas} pausas` });
    }
    return items;
  };

  if (tokenValid === null) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-2xl flex items-center justify-center">
            <i className="fas fa-circle-notch fa-spin text-red-500 text-2xl"></i>
          </div>
          <p className="text-gray-400">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl my-4">

        {/* ══════════ BIENVENIDA ══════════ */}
        {fase === 'welcome' && (
          <div className="relative bg-[#13131a] border border-gray-800 rounded-3xl p-6 md:p-8 text-center shadow-2xl">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br from-red-500 to-red-600 opacity-10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="relative">
              <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl">
                <i className="fas fa-shield-alt text-white text-3xl"></i>
              </div>

              <h2 className="text-2xl font-bold text-white mb-1">¡Bienvenida a tu panel!</h2>
              <p className="text-red-400 text-xs font-medium mb-3 uppercase tracking-wider">Empecemos por lo más importante</p>
              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-md mx-auto">
                Para poder editar tu perfil, subir fotos y usar tu panel, primero debes{' '}
                <strong className="text-white">seleccionar tu plan</strong>. El resto de las opciones
                se habilitarán cuando el administrador apruebe tu solicitud.
              </p>

              {/* Capacidades (bloqueadas hasta aprobación) */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {capacidades.map((c) => (
                  <div key={c.label} className="bg-[#0a0a0f] border border-gray-800 rounded-xl p-3 text-left flex items-center gap-3 opacity-70">
                    <div className="w-9 h-9 rounded-lg bg-[#1a1a24] flex items-center justify-center flex-shrink-0">
                      <i className={`fas ${c.icon} ${c.color} text-sm`}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-gray-300 font-medium flex items-center gap-1.5">
                        {c.label}
                        <i className="fas fa-lock text-[10px] text-gray-600"></i>
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setFase('planes')}
                className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
              >
                <i className="fas fa-credit-card"></i>
                Seleccionar mi plan
              </button>
            </div>
          </div>
        )}

        {/* ══════════ SELECCIÓN DE PLAN ══════════ */}
        {fase === 'planes' && (
          <div className="relative bg-[#13131a] border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fas fa-credit-card text-red-400 text-xl"></i>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Selecciona tu plan</h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  Elige el plan con el que quieres publicar. Al aprobarlo, tu panel se habilitará.
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 mb-4">
                <i className="fas fa-exclamation-triangle"></i>
                {error}
              </div>
            )}

            {loadingPlanes ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-[#1a1a24] border border-gray-800 rounded-2xl p-5">
                    <div className="w-20 h-5 bg-gray-800 rounded-full mb-4 animate-pulse" />
                    <div className="w-32 h-7 bg-gray-800 rounded mb-1 animate-pulse" />
                    <div className="w-24 h-8 bg-gray-800 rounded mb-4 animate-pulse" />
                    <div className="space-y-2">
                      <div className="w-36 h-4 bg-gray-800 rounded animate-pulse" />
                      <div className="w-36 h-4 bg-gray-800 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {planes.map((plan) => {
                    const isSelected = selectedPlan === plan.id;
                    const noDisponible = plan.no_disponible;

                    return (
                      <div
                        key={plan.id}
                        className={`
                          relative bg-[#1a1a24] border rounded-2xl p-5 transition-all
                          ${isSelected
                            ? 'border-red-500 shadow-lg shadow-red-500/10'
                            : noDisponible
                              ? 'border-gray-800 opacity-50'
                              : 'border-gray-800 hover:border-gray-600'
                          }
                        `}
                      >
                        <div
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3"
                          style={{
                            backgroundColor: plan.color_badge + '15',
                            color: plan.color_badge,
                            border: `1px solid ${plan.color_badge}30`
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: plan.color_badge }} />
                          {plan.badge}
                        </div>

                        <h3 className="text-lg font-bold text-white mb-1">{plan.nombre}</h3>
                        <div className="mb-3">
                          <span className="text-xl font-bold text-white">
                            {plan.precio === 0 ? 'GRATIS' : '$' + plan.precio.toLocaleString()}
                          </span>
                          <span className="text-gray-500 text-sm ml-1">{plan.moneda}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3 bg-[#0a0a0f] rounded-lg px-3 py-1.5 w-fit">
                          <i className="fas fa-calendar-alt text-gray-400" />
                          <span>{plan.duracion_dias} días</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <i className="fas fa-images text-red-400 w-4" />
                            <span>{plan.max_fotos} fotos</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <i className="fas fa-video text-red-400 w-4" />
                            <span>{plan.max_videos} videos</span>
                          </div>
                          {plan.permite_vip && (
                            <div className="flex items-center gap-2 text-xs text-amber-400">
                              <i className="fas fa-crown w-4" />
                              <span>Permite VIP</span>
                            </div>
                          )}
                          {plan.permite_destacado && (
                            <div className="flex items-center gap-2 text-xs text-purple-400">
                              <i className="fas fa-star w-4" />
                              <span>Permite Destacado</span>
                            </div>
                          )}
                        </div>

                        {noDisponible && plan.motivo_no_disponible && (
                          <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                            <p className="text-red-400 text-xs flex items-start gap-1.5">
                              <i className="fas fa-ban mt-0.5 flex-shrink-0" />
                              {plan.motivo_no_disponible}
                            </p>
                          </div>
                        )}

                        {isSelected && (
                          <div className="absolute top-4 right-4 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                            <i className="fas fa-check text-white text-xs"></i>
                          </div>
                        )}

                        {/* Botón seleccionar */}
                        <button
                          onClick={() => {
                            if (noDisponible) return;
                            setSelectedPlan(plan.id);
                            setComprobanteFile(null);
                            setComprobantePreview('');
                            setError('');
                          }}
                          disabled={noDisponible || isSelected}
                          className={`
                            w-full mt-4 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm
                            ${noDisponible
                              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                              : isSelected
                                ? 'bg-green-500/15 text-green-400 border border-green-500/30 cursor-default'
                                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-lg shadow-red-500/20 cursor-pointer'
                            }
                          `}
                        >
                          {noDisponible ? (
                            <>
                              <i className="fas fa-ban" />
                              No disponible
                            </>
                          ) : isSelected ? (
                            <>
                              <i className="fas fa-check-circle" />
                              Seleccionado
                            </>
                          ) : (
                            <>
                              <i className="fas fa-hand-pointer" />
                              Seleccionar plan
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Comprobante opcional para plan de pago */}
                {selectedPlanData && selectedPlanData.precio > 0 && (
                  <div className="mt-5 bg-[#1a1a24] border border-gray-800 rounded-2xl p-4">
                    <label className="block text-xs text-gray-400 mb-1.5">
                      Comprobante de pago <span className="text-gray-600">(opcional)</span>
                    </label>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
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
                      }}
                    />
                    {!comprobanteFile ? (
                      <div
                        onClick={() => fileInput.current?.click()}
                        className="border-2 border-dashed border-gray-700 rounded-xl p-3 text-center cursor-pointer hover:border-gray-500 transition-colors"
                      >
                        <i className="fas fa-cloud-upload-alt text-gray-500 text-lg mb-1"></i>
                        <div className="text-gray-500 text-xs">Click para subir comprobante</div>
                        <div className="text-gray-600 text-[10px]">JPG, PNG, PDF · Max 5MB</div>
                      </div>
                    ) : (
                      <div className="bg-[#0a0a0f] rounded-xl p-3 flex items-center gap-3">
                        {comprobantePreview ? (
                          <img src={comprobantePreview} alt="Preview" className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-[#1a1a2e] flex items-center justify-center text-gray-500">
                            <i className="fas fa-file-pdf text-lg"></i>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-white text-sm truncate">{comprobanteFile.name}</div>
                          <div className="text-gray-500 text-xs">{(comprobanteFile.size / 1024).toFixed(1)} KB</div>
                        </div>
                        <button
                          onClick={() => { setComprobanteFile(null); setComprobantePreview(''); }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    )}
                    <p className="text-gray-600 text-xs mt-2">Puedes adjuntarlo después desde Mi Plan.</p>
                  </div>
                )}

                {selectedPlanData && selectedPlanData.precio === 0 && (
                  <div className="mt-5 bg-green-500/5 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <i className="fas fa-gift text-green-400"></i>
                    <p className="text-green-400/80 text-xs">
                      Plan gratuito: no requiere comprobante de pago. Solo confirma tu selección.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => setFase('welcome')}
                    className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm flex items-center gap-2"
                  >
                    <i className="fas fa-arrow-left"></i>
                    Volver
                  </button>
                  <button
                    onClick={handleContinuar}
                    disabled={!selectedPlan || submitting}
                    className={`
                      flex-1 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
                      ${(!selectedPlan || submitting)
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-lg shadow-red-500/20'
                      }
                    `}
                  >
                    {submitting ? (
                      <>
                        <i className="fas fa-circle-notch fa-spin" />
                        {subiendoComprobante ? 'Subiendo comprobante...' : 'Enviando solicitud...'}
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane" />
                        {selectedPlanData?.precio === 0 ? 'Confirmar plan gratis' : 'Continuar'}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════ RESUMEN DEL PLAN ══════════ */}
        {fase === 'resumen' && planResumen && (
          <div className="relative bg-[#13131a] border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-2xl flex items-center justify-center">
              <i className="fas fa-check-circle text-green-400 text-3xl"></i>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">Plan seleccionado</h2>
            <p className="text-gray-500 text-sm mb-6">Tu solicitud fue registrada correctamente.</p>

            {/* Plan info */}
            <div className="w-full bg-[#1a1a24] border border-gray-800 rounded-2xl p-5 mb-5 text-left">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: planResumen.color_badge || '#6366f1' }}
                >
                  {planResumen.badge ? planResumen.badge.charAt(0) : 'P'}
                </div>
                <div>
                  <h3 className="text-white font-bold">{planResumen.nombre}</h3>
                  <span className="text-xs text-gray-500">
                    {planResumen.precio === 0
                      ? 'Gratis por ' + planResumen.duracion_dias + ' días'
                      : '$' + planResumen.precio.toLocaleString() + ' ' + planResumen.moneda + ' · ' + planResumen.duracion_dias + ' días'}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Este plan incluye</p>
                <div className="space-y-2.5">
                  {planFeatures(planResumen).map((f, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className={`fas ${f.icon} text-green-400 text-xs ${f.color || ''}`}></i>
                      </div>
                      <span className={f.color || ''}>{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Moderación */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 text-left flex items-start gap-3">
              <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-hourglass-half text-amber-400"></i>
              </div>
              <div>
                <p className="text-amber-400 font-semibold text-sm mb-1">Tu solicitud está en moderación</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Cuando el administrador apruebe tu plan, tu <strong className="text-white">panel se habilitará</strong> y tu{' '}
                  <strong className="text-white">anuncio aparecerá publicado</strong>. Te avisaremos por tu bandeja de notificaciones.
                </p>
              </div>
            </div>

            <button
              onClick={finish}
              disabled={finishing}
              className={`
                w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2
                ${finishing ? 'opacity-70 cursor-wait' : ''}
              `}
            >
              <i className={`fas ${finishing ? 'fa-circle-notch fa-spin' : 'fa-user-edit'}`}></i>
              {finishing ? 'Finalizando...' : 'Completar mi perfil'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
