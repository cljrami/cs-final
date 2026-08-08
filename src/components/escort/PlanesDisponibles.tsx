// src/components/escort/PlanesEscort.tsx

import React, { useState, useEffect } from 'react';

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

export default function PlanesEscort() {
  const [planesBase, setPlanesBase] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [metodoPago, setMetodoPago] = useState<'transferencia' | 'efectivo'>('transferencia');
  const [comprobante, setComprobante] = useState('');
  const [notas, setNotas] = useState('');
  const [solicitando, setSolicitando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showWarning, setShowWarning] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : '';

  useEffect(() => {
    fetchPlanes();
  }, []);

  const fetchPlanes = async () => {
    try {
      const res = await fetch('/api/escort/planes.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPlanesBase(data.planes.filter((p: Plan) => p.tipo === 'base'));
      }
    } catch (e) {
      setError('Error cargando planes');
    } finally {
      setLoading(false);
    }
  };

  const handleSolicitar = async () => {
    if (!selectedPlan) return;
    
    setSolicitando(true);
    setError('');
    setSuccess('');
    setShowWarning(false);

    try {
      const res = await fetch('/api/escort/solicitar-plan.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          plan_id: selectedPlan,
          metodo_pago: metodoPago,
          comprobante_pago: comprobante,
          notas: notas,
          es_extra: false
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        setShowWarning(true);
        setSelectedPlan(null);
        setComprobante('');
        setNotas('');
      } else {
        setError(data.error || 'Error al solicitar plan');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setSolicitando(false);
    }
  };

  const PlanCard = ({ plan, isSelected, onSelect }: {
    plan: Plan;
    isSelected: boolean;
    onSelect: () => void;
  }) => {
    const isFree = plan.precio === 0;

    return (
      <div
        className={`
          relative bg-[#13131a] border rounded-2xl p-6 transition-all
          ${isSelected
            ? 'border-red-500 shadow-lg shadow-red-500/10'
            : plan.no_disponible
              ? 'border-gray-800 opacity-60'
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

        {/* Nombre y precio */}
        <h3 className="text-xl font-bold text-white mb-1">{plan.nombre}</h3>
        <div className="mb-4">
          {isFree ? (
            <span className="text-2xl font-bold text-green-400">Gratis</span>
          ) : (
            <>
              <span className="text-2xl font-bold text-white">${plan.precio.toLocaleString()}</span>
              <span className="text-gray-500 text-sm ml-1">{plan.moneda}</span>
            </>
          )}
        </div>

        {/* Duración */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 bg-[#1a1a24] rounded-xl px-3 py-2 w-fit">
          <i className="fas fa-calendar-alt text-gray-400" />
          <span>{plan.duracion_dias} días</span>
        </div>

        {/* Features */}
        <ul className="space-y-3 text-sm">
          <li className="flex items-center gap-3 text-gray-300">
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fas fa-camera text-green-400 text-xs" />
            </div>
            <span>{plan.max_fotos} fotos</span>
          </li>
          <li className="flex items-center gap-3 text-gray-300">
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fas fa-video text-green-400 text-xs" />
            </div>
            <span>{plan.max_videos} videos</span>
          </li>
          {plan.permite_vip && (
            <li className="flex items-center gap-3 text-amber-400">
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-crown text-amber-400 text-xs" />
              </div>
              <span>Puede solicitar VIP</span>
            </li>
          )}
          {plan.permite_destacado && (
            <li className="flex items-center gap-3 text-purple-400">
              <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-star text-purple-400 text-xs" />
              </div>
              <span>Puede destacarse</span>
            </li>
          )}
        </ul>

        {/* No disponible */}
        {plan.no_disponible && (
          <div className="mt-4 p-3 bg-gray-800/50 rounded-xl text-xs text-gray-500 text-center border border-gray-700">
            <i className="fas fa-ban mr-1"></i>
            {plan.motivo_no_disponible}
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-4 right-4 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
            <i className="fas fa-check text-white text-sm" />
          </div>
        )}

        {/* Botón seleccionar */}
        <button
          onClick={onSelect}
          disabled={plan.no_disponible || isSelected}
          className={`
            w-full mt-5 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm
            ${plan.no_disponible
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : isSelected
                ? 'bg-green-500/15 text-green-400 border border-green-500/30 cursor-default'
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-lg shadow-red-500/20 cursor-pointer'
            }
          `}
        >
          {plan.no_disponible ? (
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
  };

  const SolicitudForm = () => (
    <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
          <i className="fas fa-paper-plane text-red-400"></i>
        </div>
        <div>
          <h2 className="text-white font-bold">Solicitar Plan</h2>
          <p className="text-gray-500 text-xs">Completa los datos para tu solicitud</p>
        </div>
      </div>

      {/* Método de pago */}
      <div className="mb-5">
        <label className="block text-gray-400 text-xs uppercase tracking-wider mb-3">Método de pago</label>
        <div className="flex gap-3">
          <button
            onClick={() => setMetodoPago('transferencia')}
            className={`
              flex-1 p-3 rounded-xl border transition-all text-sm font-medium
              ${metodoPago === 'transferencia'
                ? 'border-red-500 bg-red-500/10 text-red-400 shadow-lg shadow-red-500/10'
                : 'border-gray-700 bg-[#1a1a24] text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }
            `}
          >
            <i className="fas fa-university mr-2" />
            Transferencia
          </button>
          <button
            onClick={() => setMetodoPago('efectivo')}
            className={`
              flex-1 p-3 rounded-xl border transition-all text-sm font-medium
              ${metodoPago === 'efectivo'
                ? 'border-red-500 bg-red-500/10 text-red-400 shadow-lg shadow-red-500/10'
                : 'border-gray-700 bg-[#1a1a24] text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }
            `}
          >
            <i className="fas fa-money-bill-wave mr-2" />
            Efectivo
          </button>
        </div>
      </div>

      {/* Comprobante */}
      <div className="mb-5">
        <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
          Comprobante de pago
        </label>
        <div className="relative">
          <i className="fas fa-receipt absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
          <input
            type="text"
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value)}
            placeholder="URL o referencia del depósito..."
            className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm"
          />
        </div>
        <p className="text-gray-600 text-xs mt-1.5">Ej: foto del depósito, número de transferencia...</p>
      </div>

      {/* Notas */}
      <div className="mb-5">
        <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Notas adicionales</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Información adicional para el administrador..."
          rows={3}
          className="w-full bg-[#1a1a24] border border-gray-700 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm resize-none"
        />
      </div>

      {/* Botón solicitar */}
      <button
        onClick={handleSolicitar}
        disabled={solicitando || !comprobante.trim()}
        className={`
          w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
          ${solicitando || !comprobante.trim()
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20'
          }
        `}
      >
        {solicitando ? (
          <>
            <i className="fas fa-circle-notch fa-spin" />
            Enviando solicitud...
          </>
        ) : (
          <>
            <i className="fas fa-paper-plane" />
            Solicitar plan
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Alerts */}
      {success && (
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

      {/* ADVERTENCIA POST-SOLICITUD */}
      {showWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fas fa-clock text-amber-400 text-xl"></i>
            </div>
            <div>
              <h3 className="text-amber-400 font-bold text-lg mb-2">Solicitud en revisión</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Tu pago ha sido registrado y está siendo revisado por nuestro equipo. 
                Una vez verificado, tu anuncio será <strong className="text-white">publicado automáticamente</strong> si cumple 
                con todas las condiciones establecidas.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-500/70">
                <i className="fas fa-info-circle"></i>
                <span>Este proceso puede tomar hasta 24 horas hábiles</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLANES BASE */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <i className="fas fa-gem text-blue-400"></i>
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Planes Base</h2>
            <p className="text-gray-500 text-xs">Selecciona tu plan principal (Gratis, Semanal, Quincenal, Mensual)</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
                <div className="w-16 h-5 bg-gray-800 rounded-full mb-4 animate-pulse" />
                <div className="w-32 h-7 bg-gray-800 rounded mb-1 animate-pulse" />
                <div className="w-24 h-8 bg-gray-800 rounded mb-4 animate-pulse" />
                <div className="w-20 h-5 bg-gray-800 rounded mb-4 animate-pulse" />
                <div className="space-y-3">
                  <div className="w-36 h-4 bg-gray-800 rounded animate-pulse" />
                  <div className="w-36 h-4 bg-gray-800 rounded animate-pulse" />
                  <div className="w-40 h-4 bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
            ))
          ) : (
            planesBase.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={selectedPlan === plan.id}
                onSelect={() => {
                  if (plan.no_disponible) return;
                  setSelectedPlan(plan.id);
                  setShowWarning(false);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Formulario plan base */}
      {selectedPlan && <SolicitudForm />}
    </div>
  );
}