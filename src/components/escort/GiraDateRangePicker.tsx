import { useState, useEffect } from 'react';

interface Props {
  valueInicio: string;
  valueFin: string;
  minDate?: string;
  maxDate?: string;
  onChange: (inicio: string, fin: string) => void;
  onDurationChange?: (dias: number) => void;
}

export default function GiraDateRangePicker({
  valueInicio,
  valueFin,
  minDate,
  maxDate,
  onChange,
  onDurationChange,
}: Props) {
  
  const dias = valueInicio && valueFin 
    ? Math.max(0, Math.floor((new Date(valueFin).getTime() - new Date(valueInicio).getTime()) / 864e5) + 1) 
    : 0;

  useEffect(() => {
    onDurationChange?.(dias);
  }, [dias, onDurationChange]);

  return (
    <div className="space-y-3">
      {/* Dos inputs lado a lado (mobile: stacked) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-400 text-xs mb-1">Inicio de gira</label>
          <input type="date" value={valueInicio} min={minDate} max={valueFin || maxDate}
            onChange={e => onChange(e.target.value, valueFin)}
            className="w-full bg-[#0f0f1a] border border-gray-700 rounded-xl py-2.5 px-3 text-white
              focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm" />
        </div>
        <div>
          <label className="block text-gray-400 text-xs mb-1">Fin de gira</label>
          <input type="date" value={valueFin} min={valueInicio || minDate} max={maxDate}
            onChange={e => onChange(valueInicio, e.target.value)}
            className="w-full bg-[#0f0f1a] border border-gray-700 rounded-xl py-2.5 px-3 text-white
              focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm" />
        </div>
      </div>

      {/* Barra visual: rango + duración + limpiar */}
      {(valueInicio || valueFin) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#0a0a0f] border border-purple-500/20 rounded-xl">
          {valueInicio && (
            <span className="px-2.5 py-1 bg-purple-500/15 text-purple-300 text-xs rounded-lg flex items-center gap-1">
              <i className="fas fa-calendar-day"></i>
              <span>{new Date(valueInicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
            </span>
          )}
          {valueInicio && valueFin && <i className="fas fa-arrow-right text-gray-500 text-xs"></i>}
          {valueFin && (
            <span className="px-2.5 py-1 bg-purple-500/15 text-purple-300 text-xs rounded-lg flex items-center gap-1">
              <i className="fas fa-calendar-check"></i>
              <span>{new Date(valueFin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
            </span>
          )}
          {dias > 0 && (
            <span className="ml-auto px-2.5 py-1 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-lg flex items-center gap-1">
              <i className="fas fa-clock"></i> {dias} {dias === 1 ? 'día' : 'días'}
            </span>
          )}
          <button type="button" onClick={() => onChange('', '')}
            className="ml-2 text-gray-500 hover:text-red-400 text-xs transition-colors">
            <i className="fas fa-times mr-1"></i> Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
