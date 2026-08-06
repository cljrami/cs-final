import { useState, useEffect, useMemo } from 'react';
import AutocompleteField from '../ui/AutocompleteField';

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

  const giraOptions = useMemo(
    () => ciudades.filter(c => c.id.toString() !== miCiudadId).map(c => ({ id: c.id, nombre: c.nombre })),
    [ciudades, miCiudadId]
  );

  useEffect(() => {
    if (open) {
      setCiudadId(initialCiudadId);
      setFechaInicio(initialFechaInicio);
      setFechaFin(initialFechaFin);
      setError('');
    }
  }, [open, initialCiudadId, initialFechaInicio, initialFechaFin]);

  if (!open) return null;

  const now = new Date().toISOString().split('T')[0];

  const handleConfirm = () => {
    if (!ciudadId) { setError('Selecciona una ciudad destino'); return; }
    if (!fechaInicio) { setError('Selecciona la fecha de inicio'); return; }
    if (!fechaFin) { setError('Selecciona la fecha de fin'); return; }
    if (fechaInicio > fechaFin) { setError('La fecha de fin debe ser posterior a la de inicio'); return; }
    onConfirm({ ciudadId, fechaInicio, fechaFin });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1a24] border border-purple-500/30 rounded-2xl p-6 md:p-8 w-full max-w-md mx-4 shadow-2xl shadow-purple-500/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <i className="fas fa-plane-departure text-white text-xl"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">¿Vas a visitar otra ciudad?</h2>
            <p className="text-sm text-gray-400">Por algún tiempo... cuéntanos a dónde y por cuánto</p>
          </div>
        </div>

        <div className="space-y-4">
          <AutocompleteField
            label="¿A qué ciudad vas?"
            icon="fa-map-marker-alt"
            placeholder="Busca la ciudad que visitarás..."
            options={giraOptions}
            value={ciudades.find(c => c.id.toString() === ciudadId)?.nombre || ''}
            onChange={() => setCiudadId('')}
            onSelect={(opt) => setCiudadId(opt.id.toString())}
          />

          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Fecha inicio</label>
            <div className="relative">
              <i className="fas fa-calendar absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
              <input type="date" value={fechaInicio} min={now} onChange={e => setFechaInicio(e.target.value)}
                className="w-full bg-[#0f0f1a] border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Fecha fin</label>
            <div className="relative">
              <i className="fas fa-calendar-check absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
              <input type="date" value={fechaFin} min={fechaInicio || now} onChange={e => setFechaFin(e.target.value)}
                className="w-full bg-[#0f0f1a] border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all text-sm" />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-triangle"></i>{error}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-all text-sm">
            Cancelar
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:opacity-90 text-white rounded-xl font-medium transition-all text-sm">
            <i className="fas fa-check mr-2"></i>Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
