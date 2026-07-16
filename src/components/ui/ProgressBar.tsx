// src/components/ui/ProgressBar.tsx
import React from 'react';

// ─── TIPOS ─────────────────────────────────────────────
interface Campo {
  key: string;
  label: string;
  icon: string;
  desc?: string;
  isArray?: boolean;
}

interface ProgressBarProps {
  percentage: number;
  label?: string;
  showMessage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  // Modo expandido (solo PerfilForm)
  camposObligatorios?: Campo[];
  camposOpcionales?: Campo[];
  form?: Record<string, any>;
  showCards?: boolean;
}

// ─── COMPONENTE ──────────────────────────────────────
export default function ProgressBar({
  percentage,
  label = 'Progreso de tu perfil',
  showMessage = true,
  size = 'md',
  className = '',
  camposObligatorios,
  camposOpcionales,
  form,
  showCards = false,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(percentage, 0), 100);

  // ── Colores según porcentaje ──
  const getColors = () => {
    if (clamped < 30) return {
      bg: 'from-gray-600 to-gray-500',
      fill: 'bg-gray-600',
      text: 'text-gray-400',
      glow: 'shadow-gray-500/10',
      cardBg: 'from-gray-700 to-gray-600',
    };
    if (clamped < 60) return {
      bg: 'from-amber-500 to-amber-400',
      fill: 'bg-amber-500',
      text: 'text-amber-400',
      glow: 'shadow-amber-500/20',
      cardBg: 'from-amber-600 to-amber-500',
    };
    if (clamped < 90) return {
      bg: 'from-orange-500 to-orange-400',
      fill: 'bg-orange-500',
      text: 'text-orange-400',
      glow: 'shadow-orange-500/20',
      cardBg: 'from-orange-600 to-orange-500',
    };
    return {
      bg: 'from-green-500 to-emerald-400',
      fill: 'bg-green-500',
      text: 'text-green-400',
      glow: 'shadow-green-500/20',
      cardBg: 'from-green-600 to-emerald-500',
    };
  };

  const colors = getColors();

  // ── Mensaje motivacional ──
  const getMessage = () => {
    if (clamped === 0) return '¡Empieza a completar tu perfil para destacar!';
    if (clamped < 30) return '¡Empieza a completar tu perfil para destacar!';
    if (clamped < 60) return 'Vas por buen camino, sigue así';
    if (clamped < 90) return '¡Casi listo! Unos pocos campos más';
    if (clamped < 100) return '¡Solo falta un toque final!';
    return '¡Perfil 100% completo! Estás lista para brillar';
  };

  // ── Tamaños ──
  const sizes = {
    sm: { bar: 'h-2', text: 'text-xs', pct: 'text-lg' },
    md: { bar: 'h-2.5', text: 'text-sm', pct: 'text-xl' },
    lg: { bar: 'h-3', text: 'text-base', pct: 'text-2xl' },
  };
  const s = sizes[size];

  // ── Helpers para cards ──
  const isCampoComplete = (campo: Campo) => {
    if (!form) return false;
    if (campo.isArray) return form[campo.key] && form[campo.key].length > 0;
    const val = form[campo.key];
    return val && val.toString().trim() !== '';
  };

  const totalObligatorios = camposObligatorios?.length || 0;
  const totalOpcionales = camposOpcionales?.length || 0;
  const completadosObligatorios = camposObligatorios?.filter(isCampoComplete).length || 0;
  const completadosOpcionales = camposOpcionales?.filter(isCampoComplete).length || 0;

  // ── RENDER ──
  return (
    <div className={`bg-[#13131a] border border-gray-800 rounded-2xl p-5 md:p-6 space-y-6 ${className}`}>
      {/* HEADER: título + porcentaje grande + icono */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <i className="fas fa-chart-pie text-red-500 text-sm"></i>
          <h3 className="text-white font-bold text-lg">{label}</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={`${s.pct} font-bold text-white`}>{clamped}%</span>
            {showCards && (
              <p className="text-gray-600 text-xs">
                {completadosObligatorios + completadosOpcionales}/{totalObligatorios + totalOpcionales} campos
              </p>
            )}
          </div>
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.cardBg} flex items-center justify-center shadow-lg ${colors.glow}`}>
            <i className={`fas ${clamped === 100 ? 'fa-crown' : 'fa-fire'} text-white text-xl`}></i>
          </div>
        </div>
      </div>

      {/* BARRA DE PROGRESO (la única) */}
      <div className="relative">
        <div className={`${s.bar} bg-gray-800 rounded-full overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${colors.bg}`}
            style={{ width: `${clamped}%` }}
          />
        </div>
        {/* Checkpoints */}
        {showCards && (
          <div className="flex justify-between mt-2 px-1">
            {[0, 25, 50, 75, 100].map(p => (
              <div key={p} className="flex flex-col items-center gap-1">
                <div className={`w-2 h-2 rounded-full transition-all ${clamped >= p ? colors.fill : 'bg-gray-800'}`}></div>
                <span className="text-[10px] text-gray-600">{p}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mensaje */}
      {showMessage && <p className={`${s.text} text-gray-500`}>{getMessage()}</p>}

      {/* ─── CARDS DE CAMPOS (solo en modo expandido) ─── */}
      {showCards && camposObligatorios && form && (
        <>
          {/* Obligatorios */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Campos obligatorios</span>
              <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] rounded-full font-bold">*</span>
              <span className={`ml-auto text-xs ${colors.text} font-medium`}>{completadosObligatorios}/{totalObligatorios} completados</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {camposObligatorios.map(campo => {
                const isComplete = isCampoComplete(campo);
                return (
                  <div
                    key={campo.key}
                    className={`group relative p-3 rounded-xl border transition-all duration-300 cursor-default ${
                      isComplete
                        ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40 hover:bg-green-500/10'
                        : 'bg-[#1a1a24] border-gray-800 hover:border-red-500/30 hover:bg-red-500/5'
                    }`}
                    title={campo.desc}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                        isComplete ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'
                      }`}>
                        <i className={`fas ${isComplete ? 'fa-check' : campo.icon} text-xs`}></i>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${isComplete ? 'text-green-400' : 'text-gray-500'}`}>{campo.label}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{isComplete ? 'Completado' : 'Pendiente'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Opcionales */}
          {clamped < 100 && camposOpcionales && (
            <div className="pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Para destacar</span>
                <i className="fas fa-sparkles text-amber-500/60 text-xs"></i>
                <span className={`ml-auto text-xs ${colors.text} font-medium`}>{completadosOpcionales}/{totalOpcionales} completados</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {camposOpcionales.map(campo => {
                  const isComplete = isCampoComplete(campo);
                  return (
                    <div
                      key={campo.key}
                      className={`group relative p-3 rounded-xl border transition-all duration-300 cursor-default ${
                        isComplete
                          ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40 hover:bg-green-500/10'
                          : 'bg-[#1a1a24] border-gray-800/60 hover:border-amber-500/20 hover:bg-amber-500/5'
                      }`}
                      title={campo.desc}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                          isComplete ? 'bg-green-500/20 text-green-400' : 'bg-gray-800/60 text-gray-600'
                        }`}>
                          <i className={`fas ${isComplete ? 'fa-check' : campo.icon} text-xs`}></i>
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-medium truncate ${isComplete ? 'text-green-400' : 'text-gray-500'}`}>{campo.label}</p>
                          <p className="text-[10px] text-gray-600 mt-0.5">{isComplete ? 'Completado' : 'Opcional'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Celebración 100% */}
          {clamped === 100 && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 border border-green-500/20 p-4">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                  <i className="fas fa-trophy text-green-400"></i>
                </div>
                <div>
                  <p className="text-green-400 text-sm font-bold">¡Perfil 100% completo!</p>
                  <p className="text-green-400/60 text-xs">Aparecerás destacada en el directorio</p>
                </div>
              </div>
            </div>
          )}

          {/* Alerta urgencia */}
          {clamped < 30 && (
            <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <i className="fas fa-exclamation text-red-400"></i>
              </div>
              <div>
                <p className="text-red-400 text-sm font-medium">Perfil incompleto</p>
                <p className="text-red-400/50 text-xs">Los perfiles completos reciben hasta 5x más visitas</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}