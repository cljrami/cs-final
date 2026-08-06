import { useState, useEffect, useCallback } from 'react';
import StatCard from '../ui/StatCard';
import SearchAutocomplete from '../ui/SearchAutocomplete';

interface Escort {
  id: number;
  nombre: string;
  email: string;
  foto_principal: string | null;
  ciudad: string | null;
  sticky: boolean;
  sticky_orden: number;
  sticky_expira: string | null;
  activa: boolean;
  eliminada: boolean;
  tiene_suscripcion_activa: boolean;
  tiene_sticky_extra: boolean;
}

interface Ciudad {
  id: number;
  nombre: string;
  escorts_activas?: number;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const API_URL = '/api/admin/sticky.php';
const CITIES_API = '/api/ciudades/listado.php';

export default function StickyAdmin() {
  const [escorts, setEscorts] = useState<Escort[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchCiudades = async () => {
    try {
      const res = await fetch(CITIES_API);
      const data = await res.json();
      if (data.success) {
        setCiudades(data.data.map((c: any) => ({
          id: c.id,
          nombre: c.nombre,
          escorts_activas: c.escorts_activas
        })));
      }
    } catch {}
  };

  const fetchEscorts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ciudadObj = ciudades.find(c => c.nombre === selectedCity);
      const params = new URLSearchParams();
      if (ciudadObj) {
        params.set('ciudad_id', String(ciudadObj.id));
        params.set('ciudad', ciudadObj.nombre);
      }
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setEscorts(data.data);
      else setError(data.error || 'Error al cargar');
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [selectedCity, ciudades]);

  useEffect(() => { fetchCiudades(); }, []);
  useEffect(() => { fetchEscorts(); }, [fetchEscorts]);

  const allEscorts = escorts
    .filter(e => !e.eliminada)
    .map((e, i) => ({ e, og: i }))
    .sort((a, b) => {
      if (a.e.sticky_orden > 0 && b.e.sticky_orden > 0) return a.e.sticky_orden - b.e.sticky_orden;
      if (a.e.sticky_orden > 0) return -1;
      if (b.e.sticky_orden > 0) return 1;
      // Mantener el orden manual (índice original) para las no sticky
      return a.og - b.og;
    })
    .map(x => x.e);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    const escort = allEscorts.find(es => es.id === id);
    if (!escort) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Crucial for allowing drop
    e.dataTransfer.dropEffect = 'move';
  };

  const isStickyReal = (e: Escort) => e.tiene_sticky_extra === true;

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const fromIdStr = e.dataTransfer.getData('text/plain');
    const fromId = parseInt(fromIdStr, 10);
    if (isNaN(fromId) || fromId === targetId) return;

    const fromEscort = allEscorts.find(es => es.id === fromId);
    if (!fromEscort) return;

    const ciudadId = ciudades.find(c => c.nombre === selectedCity)?.id;
    if (!ciudadId) {
      setError('Ciudad no seleccionada');
      return;
    }

    const post = (body: Record<string, unknown>) =>
      fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      }).then(r => r.json());

    setSavingId(fromId);
    setError('');
    setSuccessMsg('');

    // Reordenar en memoria según el ORDEN VISUAL actual de la grilla (allEscorts),
    // que es el orden que el usuario ve y arrastra.
    const lista = allEscorts.filter(x => !x.eliminada).map(x => ({ ...x }));
    const idxFrom = lista.findIndex(x => x.id === fromId);
    const idxTo = lista.findIndex(x => x.id === targetId);
    if (idxFrom < 0 || idxTo < 0) {
      setSavingId(null);
      return;
    }
    const [moved] = lista.splice(idxFrom, 1);
    lista.splice(idxTo, 0, moved);
    setEscorts(lista);

    // Si la escort arrastrada NO tiene sticky activo, solo se reordena en la vista
    // (sin asignarle sticky_orden, para que siga yendo al random en el frontend).
    if (!isStickyReal(fromEscort)) {
      setSuccessMsg('Escort reordenada en la vista (sin sticky)');
      setSavingId(null);
      return;
    }

    // Reasignar TODAS las sticky de la ciudad de forma consecutiva (1,2,3...)
    // según el orden visual de la grilla. Ese orden se refleja igual en la ciudad.
    const stickyIds = lista
      .filter(x => isStickyReal(x))
      .map(x => x.id);

    try {
      const data = await post({ action: 'reordenar', ids: stickyIds, ciudad_id: ciudadId });
      if (!data.success) throw new Error(data.error || 'Error al reordenar');
      setSuccessMsg('Posiciones sticky actualizadas');
    } catch (err: any) {
      setError(err?.message || 'Error de conexión');
    } finally {
      setSavingId(null);
      fetchEscorts();
    }
  };


  // Stats correctas: sticky activo real (extra vigente), con posición asignada (orden), etc.
  const stickyActivos = allEscorts.filter(e => isStickyReal(e));
  const stickyConOrden = allEscorts.filter(e => e.sticky_orden > 0);
  const stickyVencidos = allEscorts.filter(e => !isStickyReal(e) && e.sticky_orden > 0);
  const sinSticky = allEscorts.filter(e => !isStickyReal(e) && e.sticky_orden === 0);

  const stickyStats = {
    total: allEscorts.length,
    stickyActivos: stickyActivos.length,
    stickyConOrden: stickyConOrden.length,
    stickyVencidos: stickyVencidos.length,
    sinSticky: sinSticky.length,
    posiciones: new Set(allEscorts.map(es => es.sticky_orden).filter(o => o > 0)).size,
  };

  const estadoBadge = (e: Escort) => {
    if (isStickyReal(e)) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Sticky activo' };
    if (e.sticky_orden > 0) return { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Sticky vencido' };
    if (!e.tiene_suscripcion_activa) return { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Sin suscripción' };
    return { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Con plan activo' };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
        <i className="fas fa-thumbtack text-amber-400"></i>
        Posiciones Fijas por Ciudad
      </h1>

      {!selectedCity && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          Selecciona una ciudad para gestionar las posiciones sticky de esa zona.
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm flex items-center justify-between">
          <span><i className="fas fa-exclamation-circle mr-2"></i>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-white"><i className="fas fa-times"></i></button>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 rounded-lg text-sm flex items-center justify-between">
          <span><i className="fas fa-check-circle mr-2"></i>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-green-400 hover:text-white"><i className="fas fa-times"></i></button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon="fa-users" value={stickyStats.total} label="Total escorts" color="#6b7280" loading={loading} />
        <StatCard icon="fa-crown" value={stickyStats.stickyActivos} label="Sticky activos" color="#f59e0b" loading={loading} />
        <StatCard icon="fa-hashtag" value={stickyStats.stickyConOrden} label="Con posición" color="#3b82f6" loading={loading} />
        <StatCard icon="fa-thumbtack" value={stickyStats.posiciones} label="Posiciones usadas" color="#8b5cf6" loading={loading} />
        <StatCard icon="fa-user-clock" value={stickyStats.sinSticky} label="Sin sticky" color="#10b981" loading={loading} />
      </div>

      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
        <SearchAutocomplete
          label="Ciudad"
          icon="fa-city"
          options={ciudades.map(c => ({ id: c.id, nombre: c.nombre, secondary: `${c.escorts_activas ?? 0} avisos` }))}
          value={selectedCity}
          onChange={setSelectedCity}
          placeholder="Selecciona una ciudad para gestionar sticky..."
        />
      </div>

      {!selectedCity ? (
        <div className="text-center py-12 text-gray-600 bg-[#1a1a2e] rounded-xl border border-white/5">
          <i className="fas fa-city text-4xl mb-3 opacity-30"></i>
          <p>Selecciona una ciudad para ver las posiciones sticky.</p>
        </div>
      ) : (
        <div>
          <h3 className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
            <i className="fas fa-crown"></i>Lista de escorts y posiciones ({allEscorts.length})
            <span className="ml-auto font-normal normal-case text-gray-600 text-[0.6rem]">
              <i className="fas fa-arrows-up-down mr-1"></i>Arrastra escorts sticky para reordenar
            </span>
          </h3>
          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#1a1a2e] border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-800 animate-pulse shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded animate-pulse w-32" />
                    <div className="h-3 bg-gray-800 rounded animate-pulse w-24" />
                  </div>
                  <div className="w-20 h-8 bg-gray-800 rounded-lg animate-pulse shrink-0" />
                </div>
              ))}
            </div>
          ) : allEscorts.length === 0 ? (
            <p className="text-gray-600 text-sm italic py-4 text-center">Ninguna escort en esta ciudad</p>
          ) : (
            <div className="grid gap-2">
              {allEscorts.map(e => {
                const badge = estadoBadge(e);
                const isSticky = isStickyReal(e);
                const isStickyVencido = !isSticky && e.sticky_orden > 0;
                const isSaving = savingId === e.id;

                const cardStyle = isStickyVencido
                  ? 'bg-amber-900/20 border-2 border-amber-400/50 shadow-lg shadow-amber-500/15'
                  : isSticky
                    ? 'bg-red-900/20 border-2 border-red-400/60 shadow-lg shadow-red-500/20'
                    : 'border border-white/5 opacity-70';

                return (
                  <div
                    key={e.id}
                    draggable={isSticky}
                    onDragStart={isSticky ? ev => handleDragStart(ev, e.id) : undefined}
                    onDragOver={isSticky ? ev => handleDragOver(ev) : undefined}
                    onDrop={isSticky ? ev => handleDrop(ev, e.id) : undefined}
                    className={`bg-[#1a1a2e] rounded-xl px-4 py-3 flex items-center gap-3 transition-all select-none ${isSticky ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${cardStyle} ${isSaving ? 'opacity-50' : ''}`}
                  >
                     <div className="flex items-center gap-2 shrink-0">
                      {isSticky && (
                        <i className={`fas fa-grip-vertical ${isStickyVencido ? 'text-amber-400' : 'text-red-400'}`}></i>
                      )}
                      {!isSticky && <i className="fas fa-user text-gray-600"></i>}
                    </div>
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#2a2a3e] shrink-0">
                      {e.foto_principal ? (
                        <img src={e.foto_principal} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><i className="fas fa-user text-gray-600 text-xs"></i></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate flex items-center gap-2">
                        {e.nombre}
                        {isSticky && (
                          <span className="text-[0.55rem] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Sticky</span>
                        )}
                        {isSticky && e.sticky_orden > 0 && (
                          <span className="text-[0.55rem] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded font-medium">#{e.sticky_orden}</span>
                        )}
                      </p>
                      <p className="text-gray-500 text-xs truncate flex items-center gap-2 mt-0.5">
                        {e.ciudad || 'Sin ciudad'}
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.55rem] font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
