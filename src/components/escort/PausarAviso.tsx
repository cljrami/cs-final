import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '../ui/Skeleton';

interface PausaDetalleItem {
  inicio: string;
  fin: string | null;
  dias: number;
  vigente: boolean;
  notas?: string;
}

interface PauseData {
  pausasUsadas: number;
  pausasMaximas: number;
  pausasRestantes: number;
  planDiasRestantes: number;
  planEstado: 'activa' | 'pausada' | 'expirada';
  planNombre: string;
  puedePausar: boolean;
  puedeReactivar: boolean;
  motivoNoPausar: string;
  planActivo: boolean;
  planPendiente: boolean;
  fechaLimitePausas: string | null;
  plazoDiasRestantes: number | null;
  plazoVencido: boolean;
  diasGuardadosPausas: number;
  pausasDetalle: PausaDetalleItem[];
  fechaPausaActual: string | null;
  fechaFinProyectada: string | null;
  fechaFin: string | null;
}

export default function PausarAviso() {
  const [data, setData] = useState<PauseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pausando, setPausando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : '';

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/escort/resumen.php?_t=' + Date.now(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (d.success) {
        const rd = d.data;
        const planEstado: PauseData['planEstado'] = rd.planPausado ? 'pausada' : rd.planVigente ? 'activa' : 'expirada';
        const pausasUsadas = rd.pausasUsadas ?? 0;
        const pausasMaximas = rd.pausasMaximas ?? 0;
        const pausasRestantes = rd.pausasRestantes ?? 0;
        const plazoVencido = rd.plazoVencido ?? false;
        const plazoDiasRestantes = rd.plazoDiasRestantes ?? null;

        let motivoNoPausar = '';
        if (rd.planVigente) {
          if (plazoVencido) {
            motivoNoPausar = `Tu plazo para usar pausas venció el ${rd.fechaLimitePausas || '—'}. Las pausas no usadas se perdieron.`;
          } else if (pausasRestantes <= 0) {
            motivoNoPausar = `Ya usaste todas tus pausas (${pausasUsadas} de ${pausasMaximas}).`;
          } else if (plazoDiasRestantes != null && plazoDiasRestantes <= 0) {
            motivoNoPausar = 'Este es el último día para usar tus pausas.';
          }
        }

        setData({
          pausasUsadas,
          pausasMaximas,
          pausasRestantes,
          planDiasRestantes: rd.planDiasRestantes ?? 0,
          planEstado,
          planNombre: rd.planNombre ?? '',
          planActivo: rd.planVigente || rd.planPausado,
          planPendiente: rd.planPendiente ?? false,
          puedePausar: rd.planVigente && pausasRestantes > 0 && !plazoVencido && !(plazoDiasRestantes != null && plazoDiasRestantes <= 0),
          puedeReactivar: rd.planPausado,
          motivoNoPausar,
          fechaLimitePausas: rd.fechaLimitePausas ?? null,
          plazoDiasRestantes,
          plazoVencido,
          diasGuardadosPausas: rd.diasGuardadosPausas ?? 0,
          pausasDetalle: rd.pausasDetalle ?? [],
          fechaPausaActual: rd.fechaPausaActual ?? null,
          fechaFinProyectada: rd.fechaFinProyectada ?? null,
          fechaFin: rd.fechaFin ?? null,
        });
      }
    } catch {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePauseToggle = async () => {
    if (pausando || !data) return;
    setPausando(true);
    setError('');
    setSuccess('');
    setShowConfirm(false);

    try {
      const accion = data.planEstado === 'pausada' ? 'activa' : 'pausada';
      const res = await fetch('/api/escort/estado.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ estado: accion })
      });
      const d = await res.json();
      if (d.success) {
        setSuccess(accion === 'pausada' ? 'Plan pausado correctamente' : 'Plan reactivado correctamente');
        fetchData();
        window.dispatchEvent(new Event('sidebar-refresh'));
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(d.error || 'Error al cambiar estado');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setPausando(false);
    }
  };

  const exportHistory = () => {
    if (!data || data.pausasDetalle.length === 0) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = data.pausasDetalle.map(p => [
      esc(p.inicio),
      esc(p.fin || 'vigente'),
      esc(String(p.dias)),
      esc(p.vigente ? 'Vigente' : 'Finalizada'),
      esc(p.notas ? p.notas.replace(/[\r\n]+/g, ' ') : '-')
    ]);
    const csv = ['"Fecha inicio","Fecha fin","Dias guardados","Estado","Notas"', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-pausas-${(data.planNombre || 'plan').replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <i className="fas fa-pause-circle text-yellow-400"></i>
            Pausar Aviso
          </h1>
          <p className="text-gray-500 mt-1">Cargando información de pausas...</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
              <Skeleton width={80} height={14} className="mb-3" />
              <Skeleton width={60} height={28} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.planActivo) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <i className="fas fa-pause-circle text-yellow-400"></i>
            Pausar Aviso
          </h1>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-8 text-center">
          <i className="fas fa-inbox text-gray-500 text-4xl mb-4"></i>
          <h3 className="text-white font-bold mb-2">Sin plan activo</h3>
          <p className="text-gray-400 text-sm mb-4">No tienes un plan activo para pausar</p>
          <a href="/micuenta/planes" className="inline-block px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all">
            Ver planes
          </a>
        </div>
      </div>
    );
  }

  if (data.planPendiente) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <i className="fas fa-pause-circle text-yellow-400"></i>
            Pausar Aviso
          </h1>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-8 text-center">
          <i className="fas fa-hourglass-half text-amber-400 text-4xl mb-4"></i>
          <h3 className="text-white font-bold mb-2">Plan pendiente de aprobación</h3>
          <p className="text-gray-400 text-sm mb-1">Tu plan {data.planNombre} está esperando aprobación del administrador.</p>
          <p className="text-gray-500 text-xs">No puedes pausar el plan hasta que sea aprobado.</p>
        </div>
      </div>
    );
  }

  const pausasPorcentaje = data.pausasMaximas > 0 ? Math.round((data.pausasUsadas / data.pausasMaximas) * 100) : 0;
  const barColor = pausasPorcentaje >= 100 ? 'bg-red-500' : pausasPorcentaje >= 50 ? 'bg-yellow-500' : 'bg-emerald-500';
  const planVencePronto = data.planEstado === 'activa' && data.pausasRestantes <= 0 && data.planDiasRestantes > 0 && data.planDiasRestantes <= 7;
  const plazoVencePronto = data.planEstado === 'activa' && data.pausasRestantes > 0 && !data.plazoVencido && data.plazoDiasRestantes != null && data.plazoDiasRestantes > 0 && data.plazoDiasRestantes <= 7;

  const renderPauseButton = () => {
    if (data.planEstado === 'pausada') {
      return (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={pausando}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50"
        >
          {pausando ? <><i className="fas fa-circle-notch fa-spin"></i> Procesando...</> : <><i className="fas fa-play"></i> Reactivar Aviso</>}
        </button>
      );
    }
    if (data.planEstado === 'activa' && data.puedePausar) {
      return (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={pausando}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/50"
        >
          {pausando ? (<><i className="fas fa-circle-notch fa-spin"></i> Procesando...</>) : (<><i className="fas fa-pause"></i> Pausar Aviso</>)}
        </button>
      );
    }
    return (
      <button
        disabled
        title={data.motivoNoPausar || 'No tienes pausas disponibles'}
        aria-disabled="true"
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm cursor-not-allowed bg-gray-800/40 border border-gray-700 text-gray-500"
      >
        <i className="fas fa-ban mr-2"></i>
        {data.planEstado === 'activa' && data.pausasRestantes <= 0
          ? 'No tienes pausas disponibles'
          : data.motivoNoPausar || 'No puedes pausar ahora'}
      </button>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-pause-circle text-yellow-400"></i>
          Pausar Aviso
        </h1>
        <p className="text-gray-500 mt-1">Administra las pausas de tu anuncio</p>
      </div>

      {/* Alerts */}
      {error && (
        <div role="status" className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-check-circle"></i>
          {success}
        </div>
      )}

      {planVencePronto && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-exclamation-triangle"></i>
          Tu plan vence en {data.planDiasRestantes} días. Ya no te quedan pausas; renueva a tiempo para no perder tu anuncio.
        </div>
      )}

      {plazoVencePronto && !planVencePronto && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-clock"></i>
          Tu plazo para usar pausas vence en {data.plazoDiasRestantes} días. Aún te quedan {data.pausasRestantes} pausas por usar.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-pause-circle text-yellow-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Pausas Totales</span>
            <button
              onClick={() => setShowHelp(v => !v)}
              aria-label="Qué son las pausas"
              className="text-xs text-gray-500 hover:text-gray-300 ml-auto"
            >
              <i className="fas fa-question-circle"></i>
            </button>
          </div>
          <p className="text-2xl font-bold text-white">{data.pausasMaximas}</p>
          <p className="text-gray-600 text-xs mt-1">permitidas por tu plan</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-check-circle text-orange-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Usadas</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.pausasUsadas}</p>
          <p className="text-gray-600 text-xs mt-1">pausas realizadas</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className={`fas fa-clock ${data.pausasRestantes > 0 ? 'text-emerald-400' : 'text-red-400'}`}></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Disponibles</span>
          </div>
          <p className={`text-2xl font-bold ${data.pausasRestantes > 0 ? 'text-white' : 'text-red-400'}`}>{data.pausasRestantes}</p>
          <p className="text-gray-600 text-xs mt-1">pausas restantes</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-hourglass-half text-blue-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Días Restantes</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.planDiasRestantes}</p>
          <p className="text-gray-600 text-xs mt-1">días para vencer</p>
        </div>
      </div>

      {/* Progress bar */}
      {data.pausasMaximas > 0 && (
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs uppercase tracking-wider">Uso de pausas</span>
            <span className={`text-xs font-semibold ${data.pausasRestantes > 0 ? 'text-gray-400' : 'text-red-400'}`}>
              {data.pausasUsadas} de {data.pausasMaximas} usadas ({pausasPorcentaje}%)
            </span>
          </div>
          <div className="w-full h-3 bg-[#1a1a24] rounded-full overflow-hidden">
            <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(100, pausasPorcentaje)}%` }}></div>
          </div>
        </div>
      )}

      {/* Help tooltip */}
      {showHelp && (
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5 text-sm text-gray-400">
          <p className="mb-2">
            <i className="fas fa-pause text-yellow-400 mr-2"></i>
            <b className="text-white">Pausar</b> deja tu anuncio temporalmente invisible. Los días del plan se congelan, no los pierdes.
          </p>
          <p className="mb-2">
            <i className="fas fa-check-circle text-emerald-400 mr-2"></i>
            Al <b className="text-white">reactivar</b>, tu fecha de vencimiento se extiende automáticamente con los días que estuviste en pausa.
          </p>
          <p className="text-gray-500">
            Puedes pausar hasta <b className="text-white">{data.pausasMaximas} veces</b>. El plazo para usarlas se calcula desde tu primera pausa.
          </p>
        </div>
      )}

      {/* Plan info + botón */}
      <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
            <i className="fas fa-info-circle text-yellow-400"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold">Plan {data.planNombre}</h3>
            <p className="text-gray-500 text-xs">
              {data.planEstado === 'pausada'
                ? 'Tu anuncio está pausado actualmente'
                : data.planEstado === 'activa'
                  ? data.fechaFin
                    ? `Tu anuncio está visible. Vence el ${data.fechaFin}.`
                    : 'Tu anuncio está visible.'
                  : 'Plan expirado'}
            </p>
          </div>
        </div>

        <div className="bg-[#1a1a24] rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2 text-sm text-gray-400">
            <i className="fas fa-lightbulb text-yellow-400 mt-0.5"></i>
            <p>
              {data.planEstado === 'pausada'
                ? 'Al reactivar tu anuncio, los días pausados se suman a tu fecha de vencimiento y tu perfil vuelve a ser visible.'
                : data.planEstado === 'activa' && data.pausasRestantes <= 0
                  ? `Has agotado todas tus pausas disponibles para este plan (${data.pausasUsadas} de ${data.pausasMaximas}).`
                  : `Puedes pausar tu anuncio hasta ${data.pausasMaximas} veces. Mientras está pausado, el tiempo de tu plan se detiene y al reactivarlo tu fecha de vencimiento se extiende.`}
            </p>
          </div>
        </div>

        {renderPauseButton()}

        {data.planEstado === 'pausada' && data.fechaFinProyectada && (
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <i className="fas fa-calendar-alt text-blue-400"></i>
            Al reactivar, tu plan vencerá el <b className="text-white ml-1">{data.fechaFinProyectada}</b>
          </p>
        )}
      </div>

      {/* Plazo contextual */}
      {(data.fechaLimitePausas || data.plazoVencido) && (
        <div className={`bg-[#13131a] border ${data.plazoVencido ? 'border-red-500/30' : 'border-gray-800'} rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs uppercase tracking-wider flex items-center gap-2">
              <i className={`fas fa-hourglass-half ${data.plazoVencido ? 'text-red-400' : 'text-purple-400'}`}></i>
              Plazo para usar pausas
            </span>
            {data.fechaLimitePausas && (
              <span className={`text-xs font-semibold ${data.plazoVencido ? 'text-red-400' : 'text-purple-400'}`}>
                {data.fechaLimitePausas}
              </span>
            )}
          </div>
          <p className={`text-sm ${data.plazoVencido ? 'text-red-400' : 'text-gray-400'}`}>
            {data.plazoVencido
              ? `Tu plazo para usar pausas venció el ${data.fechaLimitePausas}. Las pausas no usadas se perdieron.`
              : data.pausasRestantes <= 0
                ? `Tu plazo para usar pausas vencerá el ${data.fechaLimitePausas}. Ya usaste todas tus pausas.`
                : data.plazoDiasRestantes != null && data.plazoDiasRestantes > 0
                  ? `Te quedan ${data.plazoDiasRestantes} días para iniciar una pausa nueva.`
                  : 'Este es el último día para iniciar una pausa nueva.'}
          </p>
        </div>
      )}

      {/* Historial de pausas */}
      {data.pausasDetalle.length > 0 && (
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fas fa-clock-rotate-left text-blue-400"></i>
              <span className="text-gray-500 text-xs uppercase tracking-wider">Historial de pausas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1 flex items-center gap-1">
                <i className="fas fa-gift"></i>
                <b>{data.diasGuardadosPausas.toLocaleString()}</b> días guardados
              </span>
              <button
                onClick={exportHistory}
                className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1 flex items-center gap-1"
              >
                <i className="fas fa-download"></i> Exportar
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {data.pausasDetalle.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm bg-[#1a1a22] border border-gray-800 rounded-lg px-3 py-2">
                <span className="text-gray-300">
                  <i className="fas fa-pause text-amber-400 mr-2"></i>
                  {p.inicio}
                  {p.fin ? (
                    <>
                      <span className="text-gray-600 mx-1">→</span>
                      <i className="fas fa-play text-green-400 mr-2"></i>
                      {p.fin}
                    </>
                  ) : (
                    <span className="text-amber-400 ml-2 text-xs">(pausa vigente)</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  {p.notas && <span className="text-gray-500 text-xs">{p.notas}</span>}
                  <span className="text-gray-400 whitespace-nowrap">
                    <b className={p.vigente ? 'text-amber-400' : 'text-green-400'}>{p.dias.toLocaleString()}</b> días
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 lg:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-[360px] shadow-2xl p-5 lg:p-6">
            <div className="flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${data.planEstado === 'pausada' ? 'bg-emerald-500/10' : 'bg-yellow-500/10'}`}>
                <i className={`fas ${data.planEstado === 'pausada' ? 'fa-play text-emerald-400' : 'fa-pause text-yellow-400'} text-xl`}></i>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                {data.planEstado === 'pausada' ? 'Reactivar aviso?' : 'Pausar aviso?'}
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                {data.planEstado === 'pausada'
                  ? data.fechaFinProyectada
                    ? `Tu anuncio volverá a estar visible. Tu plan vencerá el ${data.fechaFinProyectada}.`
                    : 'Tu anuncio volverá a estar visible para los clientes.'
                  : data.pausasRestantes > 1
                    ? `Tu anuncio dejará de mostrarse. Usarás 1 pausa de ${data.pausasMaximas}; te quedarán ${data.pausasRestantes - 1}.`
                    : data.pausasRestantes === 1
                      ? 'Tu anuncio dejará de mostrarse. Usarás tu última pausa.'
                      : `Tu anuncio dejará de mostrarse. Te quedan ${data.pausasRestantes} pausas.`}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-[#2d2d44] text-white font-medium rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePauseToggle}
                  disabled={pausando}
                  className={`flex-1 px-4 py-2.5 font-semibold rounded-lg text-sm text-white shadow-lg ${
                    data.planEstado === 'pausada'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      : 'bg-gradient-to-r from-red-500 to-red-600'
                  }`}
                >
                  {pausando ? 'Procesando...' : data.planEstado === 'pausada' ? 'Reactivar' : 'Pausar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
