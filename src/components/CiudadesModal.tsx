import { useState, useEffect, useRef } from 'react';
import { Skeleton } from './ui/Skeleton';
import { useSiteTexts } from '../hooks/useSiteTexts';
import BannerSlot from './BannerSlot';

interface Ciudad {
  id: number;
  nombre: string;
  slug?: string;
  escorts_activas: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CiudadesModal({ isOpen, onClose }: Props) {
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const texts = useSiteTexts();

  const T = {
    titulo: texts?.modal_ciudades_titulo || 'Selecciona una ciudad',
    placeholder: texts?.modal_ciudades_placeholder || 'Escribe el nombre de la ciudad...',
    sinResultados: texts?.modal_ciudades_sin_resultados || 'No hay ciudades disponibles',
    noEncontrada: texts?.modal_ciudades_no_encontrada || 'No se encontró "{query}"',
    contador: texts?.modal_ciudades_contador || '{cantidad} ciudades',
    escortsCount: texts?.modal_ciudades_escorts_count || '{cantidad} escorts',
  };

  const fmt = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/ciudades/listado.php')
        .then(r => r.json())
        .then(data => {
          if (data.success) setCiudades(data.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const filtered = ciudades.filter(c =>
    c.nombre.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (ciudad: Ciudad) => {
    const slug = ciudad.slug
      || ciudad.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    window.location.href = `/escorts-${slug}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[10vh] p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <i className="fas fa-map-marker-alt text-red-400"></i>
            <h3 className="text-ink font-bold text-base">{texts ? T.titulo : <Skeleton width={150} height={16} inline />}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted hover:text-ink transition-colors">
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center bg-surface2 border border-white/10 rounded-lg px-3 py-2 focus-within:border-red-500/50 transition-colors">
            <i className="fas fa-search text-muted text-xs"></i>
            <input
              ref={inputRef}
              type="text"
              placeholder={texts ? T.placeholder : ''}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-ink text-sm outline-none placeholder-gray-600 ml-2"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted hover:text-ink transition-colors">
                <i className="fas fa-times text-xs"></i>
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <i className="fas fa-city text-red-400 text-xs"></i>
                    </div>
                    <Skeleton width={100 + Math.random() * 60} height={14} baseColor="#1a1a2e" highlightColor="#252538" />
                  </div>
                  <Skeleton width={50} height={20} borderRadius={999} baseColor="#1a1a2e" highlightColor="#252538" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto rounded-xl bg-white/5 flex items-center justify-center mb-3">
                <i className="fas fa-search text-muted text-sm"></i>
              </div>
              <p className="text-muted text-sm">
                {query ? fmt(T.noEncontrada, { query }) : T.sinResultados}
              </p>
            </div>
          ) : (
            <div className="py-2">
              {filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                      <i className="fas fa-city text-red-400 text-xs"></i>
                    </div>
                    <span className="text-ink text-sm font-medium capitalize">{c.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/10 text-muted px-2 py-0.5 rounded-full">
                      {fmt(T.escortsCount, { cantidad: String(c.escorts_activas) })}
                    </span>
                    <i className="fas fa-chevron-right text-muted text-xs group-hover:text-red-400 transition-colors"></i>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Banner bajo el buscador */}
        <div className="px-5 py-2 border-t border-white/5">
          <BannerSlot placement="selector_ciudad" />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 text-center">
          <span className="text-muted text-xs">{fmt(T.contador, { cantidad: String(filtered.length) })}</span>
        </div>
      </div>
    </div>
  );
}
