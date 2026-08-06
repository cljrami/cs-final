import { useState, useEffect, useRef } from 'react';

interface HistoriaItem {
  tipo: 'foto' | 'video';
  url: string;
}

interface HistoriaEscort {
  escort_id: number;
  nombre: string;
  foto_portada: string | null;
  foto_principal: string | null;
  vip: number;
  verificado: number;
  historias: HistoriaItem[];
}

interface ApiResponse {
  success: boolean;
  data: HistoriaEscort[];
}

export default function HistoriasCiudad({ ciudad }: { ciudad?: string }) {
  const [escorts, setEscorts] = useState<HistoriaEscort[]>([]);
  const [loading, setLoading] = useState(true);
  const [showViewer, setShowViewer] = useState(false);
  const [currentEscortIdx, setCurrentEscortIdx] = useState(0);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (ciudad) params.set('ciudad', ciudad);

    fetch(`/api/escorts/historias.php?${params.toString()}`)
      .then(r => r.json())
      .then((d: ApiResponse) => {
        if (d.success && d.data?.length) setEscorts(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ciudad]);

  if (loading) {
    return (
      <section className="pt-4 pb-2" aria-hidden="true">
        <div className="h-[110px]"></div>
      </section>
    );
  }
  if (escorts.length === 0) return null;

  const abrir = (idx: number) => {
    setCurrentEscortIdx(idx);
    setCurrentItemIdx(0);
    setShowViewer(true);
    document.body.style.overflow = 'hidden';
  };

  const cerrar = () => {
    setShowViewer(false);
    document.body.style.overflow = '';
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const siguienteItem = () => {
    const esc = escorts[currentEscortIdx];
    if (!esc) return;
    if (currentItemIdx < esc.historias.length - 1) {
      setCurrentItemIdx(currentItemIdx + 1);
    } else if (currentEscortIdx < escorts.length - 1) {
      setCurrentEscortIdx(currentEscortIdx + 1);
      setCurrentItemIdx(0);
    } else {
      cerrar();
      return;
    }
  };

  const anteriorItem = () => {
    if (currentItemIdx > 0) {
      setCurrentItemIdx(currentItemIdx - 1);
    } else if (currentEscortIdx > 0) {
      setCurrentEscortIdx(currentEscortIdx - 1);
      setCurrentItemIdx(escorts[currentEscortIdx - 1].historias.length - 1);
    }
  };

  const esc = showViewer && escorts[currentEscortIdx];
  const item = esc?.historias?.[currentItemIdx];

  return (
    <>
      {/* Historias row */}
      <section className="pt-4 pb-2">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {escorts.map((esc, idx) => {
            const avatar = esc.foto_portada || esc.foto_principal;
            return (
                <button
                key={esc.escort_id}
                onClick={() => abrir(idx)}
                className="flex flex-col items-center gap-1.5 shrink-0 w-24 focus:outline-none"
              >
                <span className="w-20 h-20 rounded-full p-[2.5px] bg-gradient-to-tr from-red-500 via-pink-500 to-yellow-500">
                  <span className="block w-full h-full rounded-full overflow-hidden bg-surface border-2 border-page">
                    {avatar ? (
                      <img src={avatar} alt={esc.nombre} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="fas fa-user text-muted text-xl"></i>
                      </div>
                    )}
                  </span>
                </span>
                <span className="text-muted text-xs truncate w-full text-center">{esc.nombre}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Story Viewer Modal */}
      {showViewer && esc && item && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={cerrar}>
          <button className="absolute top-4 right-4 z-20 w-11 h-11 bg-white/10 hover:bg-white/20 rounded-full text-ink text-xl" onClick={cerrar}>
            <i className="fas fa-times"></i>
          </button>
          <button className="absolute left-2 sm:left-6 z-20 w-11 h-11 bg-white/10 hover:bg-white/20 rounded-full text-ink" onClick={(e) => { e.stopPropagation(); anteriorItem(); }}>
            <i className="fas fa-chevron-left"></i>
          </button>
          <button className="absolute right-2 sm:right-6 z-20 w-11 h-11 bg-white/10 hover:bg-white/20 rounded-full text-ink" onClick={(e) => { e.stopPropagation(); siguienteItem(); }}>
            <i className="fas fa-chevron-right"></i>
          </button>

          <div className="relative w-full max-w-sm h-full sm:h-[85vh] flex flex-col">
            <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
              {esc.historias.map((_, i) => (
                <span key={i} className={`flex-1 h-0.5 rounded-full ${i < currentItemIdx ? 'bg-white' : i === currentItemIdx ? 'bg-white/90' : 'bg-white/30'}`}></span>
              ))}
            </div>

            <a href={`/${esc.escort_id}`} className="absolute top-6 left-3 right-3 z-20 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="w-9 h-9 rounded-full bg-raised overflow-hidden border border-white/20 shrink-0">
                {esc.foto_portada || esc.foto_principal ? (
                  <img src={esc.foto_portada || esc.foto_principal!} alt={esc.nombre} className="w-full h-full object-cover" />
                ) : <i className="fas fa-user text-muted text-2xl"></i>}
              </span>
              <span className="text-ink text-sm font-semibold drop-shadow">{esc.nombre}</span>
            </a>

            <div className="flex-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {item.tipo === 'video' ? (
                <video src={item.url} className="max-h-full max-w-full rounded-lg" autoPlay playsInline controls />
              ) : (
                <img src={item.url} className="max-h-full max-w-full rounded-lg object-contain" alt={esc.nombre} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
