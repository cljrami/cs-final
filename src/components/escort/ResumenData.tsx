// src/components/escort/ResumenData.tsx
import { useState, useEffect } from 'react';
import { Skeleton } from '../ui/Skeleton';
import { API_BASE, getEscortHeaders } from '../../lib/escortAuth';

interface EscortData {
  id: number;
  nombre: string;
  nombreArtistico: string;
  aprobada: number;
  estado: string;
  activa: number;
  verificado: number;
  vip: number;
  destacado: number;
  disponibleAhora: number;
  planVencido: boolean;
  planPausado: boolean;
  planVigente: boolean;
  planNombre: string | null;
  planBadge: string | null;
  planColor: string | null;
  planDiasRestantes: number;
  visitasHoy: number;
  visitasTotal: number;
  contactosWhatsapp: number;
  contactosLlamar: number;
  rating: number;
  totalValorizaciones: number;
  perfilCompleto: number;
  ciudad: string;
  fotoPrincipal: string | null;
  vipVencido: boolean;
  destacadoVencido: boolean;
  extraNombre: string | null;
  pausasUsadas: number;
  pausasMaximas: number;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

export default function ResumenData() {
  const [data, setData] = useState<EscortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingDisponible, setTogglingDisponible] = useState(false);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'success', visible: false });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500);
  };

  const toggleDisponible = async () => {
    if (!data) return;
    setTogglingDisponible(true);
    try {
      const nuevo = data.disponibleAhora ? 0 : 1;
      const res = await fetch(`${API_BASE}/disponible.php`, {
        method: 'POST',
        headers: { ...getEscortHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ disponible_ahora: nuevo })
      });
      const d = await res.json();
      if (d.success) {
        setData(prev => prev ? { ...prev, disponibleAhora: d.disponible_ahora } : prev);
        showToast(
          nuevo ? 'Disponible Ahora activado' : 'Disponible Ahora desactivado',
          'success'
        );
      } else {
        showToast('Error al actualizar disponibilidad', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
    setTogglingDisponible(false);
  };

  useEffect(() => {
    fetch(`${API_BASE}/resumen.php?_t=${Date.now()}`, { headers: getEscortHeaders(), cache: 'no-store' })
      .then(async r => {
        const text = await r.text();
        try {
          const d = JSON.parse(text);
          if (d.success) {
            setData(d.data);
          } else {
            console.error('API error:', d.error || 'unknown');
            setData(null);
          }
        } catch {
          setData(null);
        }
      })
      .catch(err => {
        console.error('Fetch error:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          Bienvenida,{loading ? <Skeleton width={140} height={28} /> : data?.nombreArtistico || data?.nombre || data?.email?.split('@')[0] || 'Escort'}
        </h1>
        {loading ? (
          <div className="flex items-center gap-3 mt-2">
            <Skeleton width={100} height={26} borderRadius={999} />
            <Skeleton width={120} height={14} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {data?.planPausado ? (
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium border border-blue-500/20">
                <i className="fas fa-pause-circle mr-1"></i>Pausado
              </span>
            ) : data?.aprobada ? (
              <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium border border-green-500/20">Aprobado</span>
            ) : (
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-sm font-medium border border-amber-500/20">Pendiente</span>
            )}
            {data?.ciudad ? (
              <span className="text-gray-500 text-sm"><i className="fas fa-map-marker-alt mr-1"></i>{data.ciudad}</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-3">
        {loading ? (
          <>
            <Skeleton width={100} height={24} borderRadius={8} />
            <Skeleton width={60} height={24} borderRadius={8} />
          </>
        ) : (
          <>
            {data?.verificado === 1 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                <i className="fas fa-check-circle"></i> Verificada
              </span>
            )}
            {data?.vip === 1 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">
                <i className="fas fa-crown"></i> VIP
              </span>
            )}
            {data?.extraNombre && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                <i className="fas fa-fire"></i> {data.extraNombre}
              </span>
            )}
            {data?.planVigente && data?.planNombre && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                <i className="fas fa-check-circle"></i> {data.planNombre} · {data.planDiasRestantes}d
              </span>
            )}
            {data?.planPausado && data?.planNombre && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                <i className="fas fa-pause-circle"></i> {data.planNombre} · Pausado
              </span>
            )}
          </>
        )}
      </div>

      {/* Disponible Ahora 🔥 toggle */}
      {!loading && data && data.aprobada && (
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all duration-300 ${data.disponibleAhora ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-600'}`}>
              <i className={`fas fa-fire ${data.disponibleAhora ? 'animate-pulse' : ''}`}></i>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Disponible Ahora 🔥</p>
              <p className="text-gray-500 text-xs mt-0.5">Muestra que estás disponible en este momento</p>
            </div>
          </div>
          <button
            onClick={toggleDisponible}
            disabled={togglingDisponible}
            className="inline-flex items-center justify-center"
            title={data.disponibleAhora ? 'Desactivar Disponible Ahora' : 'Activar Disponible Ahora'}
          >
            <i className={`fas text-3xl transition-colors ${
              data.disponibleAhora ? 'fa-toggle-on text-red-400 hover:text-red-300' : 'fa-toggle-off text-gray-600 hover:text-gray-400'
            }`}></i>
          </button>
        </div>
      )}

      {/* Plan pausado warning */}
      {!loading && data?.planPausado && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 text-center">
          <i className="fas fa-pause-circle text-blue-400 text-3xl mb-3"></i>
          <h3 className="text-white font-bold mb-1">Plan pausado</h3>
          <p className="text-gray-400 text-sm mb-4">Tu anuncio no se muestra en el directorio mientras esté pausado</p>
          <a href="/micuenta/mi-plan" className="inline-block px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all">Ir a mi plan</a>
        </div>
      )}

      {/* Plan vencido warning */}
      {!loading && data?.planVencido && !data?.planPausado && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-3"></i>
          <h3 className="text-white font-bold mb-1">Tu plan ha vencido</h3>
          <p className="text-gray-400 text-sm mb-4">Tu anuncio ya no aparece en el directorio</p>
          <a href="/micuenta/planes" className="inline-block px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all">Renovar plan</a>
        </div>
      )}

      {/* Profile completion */}
      {!loading && data && (
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium">Perfil completado</span>
            <span className="text-white text-sm font-bold">{data.perfilCompleto}%</span>
          </div>
          <div className="h-2.5 bg-[#1a1a24] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700" style={{ width: `${data.perfilCompleto}%` }} />
          </div>
          {data.perfilCompleto < 100 && (
            <p className="text-gray-600 text-xs mt-2"><i className="fas fa-info-circle mr-1"></i>Completa tu perfil para aparecer mejor en el directorio</p>
          )}
        </div>
      )}

      {/* Stats grid: Visitas, Valoración, WhatsApp, Llamar, Perfil */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-eye text-blue-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Visitas al perfil</span>
          </div>
          <p className="text-2xl font-bold text-white">{loading ? <Skeleton width={60} height={28} /> : (data?.visitasTotal || 0).toLocaleString()}</p>
          <p className="text-gray-600 text-xs mt-1">a tu perfil</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-star text-yellow-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Valorización</span>
          </div>
          <p className="text-2xl font-bold text-white">{loading ? <Skeleton width={50} height={28} /> : (data?.rating ? data.rating.toFixed(1) : '—')}</p>
          <p className="text-gray-600 text-xs mt-1">{loading ? <Skeleton width={70} height={14} /> : `${data?.totalValorizaciones || 0} reseñas`}</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fab fa-whatsapp text-green-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Mensajes</span>
          </div>
          <p className="text-2xl font-bold text-white">{loading ? <Skeleton width={40} height={28} /> : (data?.contactosWhatsapp ?? 0).toLocaleString()}</p>
          <p className="text-gray-600 text-xs mt-1">clics recibidos</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-phone-alt text-red-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Llamadas</span>
          </div>
          <p className="text-2xl font-bold text-white">{loading ? <Skeleton width={40} height={28} /> : (data?.contactosLlamar ?? 0).toLocaleString()}</p>
          <p className="text-gray-600 text-xs mt-1">clics recibidos</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-user-check text-purple-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Perfil</span>
          </div>
          <p className="text-2xl font-bold text-white">{loading ? <Skeleton width={40} height={28} /> : `${data?.perfilCompleto ?? 0}%`}</p>
          <p className="text-gray-600 text-xs mt-1">completado</p>
        </div>
      </div>

      {/* Toast notification */}
      {toast.visible && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 ${
          toast.type === 'success'
            ? 'bg-green-500/90 text-white'
            : 'bg-red-500/90 text-white'
        }`}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}