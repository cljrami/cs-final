import { useState, useEffect, useMemo } from 'react';
import AutocompleteField from '../ui/AutocompleteField';
import GiraDatePresets from './GiraDatePresets';
import GiraDateRangePicker from './GiraDateRangePicker';
import GiraPreviewCard from './GiraPreviewCard';
import { addDays, format, startOfTomorrow } from 'date-fns';

interface Ciudad {
  id: number;
  nombre: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { ciudadId: string; fechaInicio: string; fechaFin: string }) => void;
  initialCiudadId?: string;
  initialFechaInicio?: string;
  initialFechaFin?: string;
  ciudades: Ciudad[];
  miCiudadId: string;
}

export default function GiraActivacionPopup({
  open, onClose, onConfirm,
  initialCiudadId = '', initialFechaInicio = '', initialFechaFin = '',
  ciudades, miCiudadId
}: Props) {
  const [ciudadId, setCiudadId] = useState(initialCiudadId);
  const [fechaInicio, setFechaInicio] = useState(initialFechaInicio);
  const [fechaFin, setFechaFin] = useState(initialFechaFin);
  const [error, setError] = useState('');
  const [duracion, setDuracion] = useState(0);

  const giraOptions = useMemo(
    () => ciudades.filter(c => c.id.toString() !== miCiudadId).map(c => ({ id: c.id, nombre: c.nombre })),
    [ciudades, miCiudadId]
  );

  // Smart defaults: tomorrow + 7 days
  const smartDefault = useMemo(() => {
    const tomorrow = startOfTomorrow();
    const end = addDays(tomorrow, 6);
    return {
      inicio: format(tomorrow, 'yyyy-MM-dd'),
      fin: format(end, 'yyyy-MM-dd'),
    };
  }, []);

  useEffect(() => {
    if (open) {
      setCiudadId(initialCiudadId);
      // Smart defaults if no initial values
      setFechaInicio(initialFechaInicio || smartDefault.inicio);
      setFechaFin(initialFechaFin || smartDefault.fin);
      setError('');
    }
  }, [open, initialCiudadId, initialFechaInicio, initialFechaFin, smartDefault]);

  if (!open) return null;

  const now = format(new Date(), 'yyyy-MM-dd');
  const maxFechaFin = format(addDays(new Date(), 365), 'yyyy-MM-dd'); // max 1 year

  const handleConfirm = () => {
    if (!ciudadId) { setError('Selecciona una ciudad destino'); return; }
    if (!fechaInicio) { setError('Selecciona la fecha de inicio'); return; }
    if (!fechaFin) { setError('Selecciona la fecha de fin'); return; }
    if (fechaInicio > fechaFin) { setError('La fecha de fin debe ser posterior a la de inicio'); return; }
    if (duracion > 60) { setError('La gira no puede durar más de 60 días'); return; }
    onConfirm({ ciudadId, fechaInicio, fechaFin });
  };

  const handleDateChange = (inicio: string, fin: string) => {
    setFechaInicio(inicio);
    setFechaFin(fin);
    setError('');
  };

  const handlePresetSelect = (inicio: string, fin: string) => {
    setFechaInicio(inicio);
    setFechaFin(fin);
    setError('');
  };

  const ciudadSeleccionada = ciudades.find(c => c.id.toString() === ciudadId);
  const ciudadBase = ciudades.find(c => c.id.toString() === miCiudadId)?.nombre || '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1a1a24] border border-purple-500/30 rounded-2xl rounded-b-none sm:rounded-2xl w-full max-w-lg mx-4 mb-0 sm:mb-8 shadow-2xl shadow-purple-500/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <i className="fas fa-plane-departure text-white"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">¿Vas a visitar otra ciudad?</h2>
              <p className="text-sm text-gray-400">Selecciona la ciudad, las fechas y confirma</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-4 space-y-4">
          {/* City selector */}
          <AutocompleteField
            label="¿A qué ciudad vas?"
            icon="fa-map-marker-alt"
            placeholder="Busca la ciudad que visitarás..."
            options={giraOptions}
            value={ciudades.find(c => c.id.toString() === ciudadId)?.nombre || ''}
            onChange={() => setCiudadId('')}
            onSelect={(opt) => setCiudadId(opt.id.toString())}
          />

          {/* Quick Presets */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
              Rápido
            </label>
            <GiraDatePresets onSelect={handlePresetSelect} />
          </div>

          {/* Date Range Picker */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
              Fechas de tu gira
            </label>
            <GiraDateRangePicker
              valueInicio={fechaInicio}
              valueFin={fechaFin}
              minDate={now}
              maxDate={maxFechaFin}
              onChange={handleDateChange}
              onDurationChange={setDuracion}
            />
          </div>

          {/* Preview Card */}
          <GiraPreviewCard
            ciudadNombre={ciudadSeleccionada?.nombre || ''}
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            ciudadBase={ciudadBase}
          />

          {/* Duration warning */}
          {duracion > 30 && duracion <= 60 && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-triangle"></i>
              Gira larga: {duracion} días. Se bloqueará sticky en ciudad destino.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-triangle"></i>{error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-all text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ciudadId || duracion > 60}
            className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all text-sm flex items-center justify-center gap-2"
          >
            <i className="fas fa-check"></i>Guardar gira
          </button>
        </div>
      </div>
    </div>
  );
}
