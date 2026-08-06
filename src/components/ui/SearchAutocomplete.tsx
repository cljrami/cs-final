import { useState } from 'react';

interface Option {
  id: number;
  nombre: string;
  icono?: string;
  secondary?: string;
}

interface Props {
  label: string;
  icon: string;
  itemIcon?: string;
  placeholder?: string;
  options: Option[];
  value: string;
  selectedIcon?: string;
  onChange: (value: string) => void;
  onSelect?: (option: Option) => void;
  error?: string;
  clearable?: boolean;
}

export default function SearchAutocomplete({ label, icon, itemIcon, placeholder = 'Escribe para buscar...', options, value, selectedIcon, onChange, onSelect, error, clearable = true }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? options.filter(o => o.nombre.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : options.slice(0, 10);

  const handleSelect = (opt: Option) => {
    onChange(opt.nombre);
    onSelect?.(opt);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div>
      <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
        {label}
        {error && (
          <span className="text-red-400 ml-2 text-xs normal-case">
            <i className="fas fa-exclamation-circle"></i> {error}
          </span>
        )}
      </label>
      <div className="relative">
        <i className={`fas ${value && selectedIcon ? selectedIcon : icon} absolute left-4 top-1/2 -translate-y-1/2 ${value && selectedIcon ? 'text-red-400' : 'text-gray-500'} z-10`}></i>
        <button
          type="button"
          onClick={() => { setIsOpen(true); setQuery(''); }}
          className={`w-full bg-[#1a1a24] border ${error ? 'border-red-500 ring-1 ring-red-500/20' : 'border-gray-700'} rounded-xl py-3 pl-11 pr-10 text-left text-sm cursor-pointer hover:border-gray-600 transition-colors flex items-center ${value ? 'text-white' : 'text-gray-600'}`}
        >
          <span className="flex-1 truncate">{value || placeholder}</span>
        </button>
        {value && clearable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); onSelect?.({ id: 0, nombre: '' }); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            title="Limpiar"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] p-4 bg-black/70 backdrop-blur-sm" onClick={() => { setIsOpen(false); setQuery(''); }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <i className={`fas ${icon} text-red-400`}></i>
                <h3 className="text-white font-bold text-base">Selecciona {label.toLowerCase()}</h3>
              </div>
              <button onClick={() => { setIsOpen(false); setQuery(''); }} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <i className="fas fa-times text-sm"></i>
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-white/5">
              <div className="flex items-center bg-[#252538] border border-white/10 rounded-lg px-3 py-2 focus-within:border-red-500/50 transition-colors">
                <i className="fas fa-search text-gray-500 text-xs"></i>
                <input
                  type="text"
                  placeholder="Escribe para buscar..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600 ml-2"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-gray-600 hover:text-white transition-colors">
                    <i className="fas fa-times text-xs"></i>
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-white/5 flex items-center justify-center mb-3">
                    <i className="fas fa-search text-gray-600 text-sm"></i>
                  </div>
                  <p className="text-gray-500 text-sm">
                    {query ? `No se encontró "${query}"` : 'No hay opciones disponibles'}
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {filtered.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors group ${value === opt.nombre ? 'bg-red-500/10' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                        <i className={`fas ${opt.icono || itemIcon || icon} text-red-400 text-xs`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm font-medium block truncate">{opt.nombre}</span>
                        {opt.secondary && (
                          <span className="text-gray-500 text-xs block truncate">{opt.secondary}</span>
                        )}
                      </div>
                      {value === opt.nombre && (
                        <i className="fas fa-check text-red-400 text-xs"></i>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/5 text-center">
              <span className="text-gray-600 text-xs">{filtered.length} opcion{filtered.length !== 1 ? 'es' : ''}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
