import { useState, useRef, useEffect, useCallback } from 'react';

interface Option {
  id: number;
  nombre: string;
}

interface Props {
  label: string;
  icon: string;
  itemIcon?: string;
  placeholder?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function SearchAutocomplete({ label, icon, itemIcon, placeholder = 'Escribe para buscar...', options, value, onChange, error }: Props) {
  const [input, setInput] = useState(value);
  const [sugerencias, setSugerencias] = useState<Option[]>([]);
  const [show, setShow] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(value);
  }, [value]);

  const filtrar = useCallback((texto: string) => {
    if (!texto.trim()) {
      setSugerencias([]);
      return;
    }
    const filtradas = options.filter(o =>
      o.nombre.toLowerCase().includes(texto.toLowerCase())
    );
    setSugerencias(filtradas.slice(0, 10));
    setSelectedIndex(-1);
  }, [options]);

  useEffect(() => {
    filtrar(input);
  }, [input, filtrar]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const seleccionar = (opt: Option) => {
    setInput(opt.nombre);
    onChange(opt.nombre);
    setShow(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, sugerencias.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && sugerencias[selectedIndex]) {
        seleccionar(sugerencias[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShow(false);
    }
  };

  return (
    <div ref={containerRef}>
      <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
        {label}
        {error && (
          <span className="text-red-400 ml-2 text-xs normal-case">
            <i className="fas fa-exclamation-circle"></i> {error}
          </span>
        )}
      </label>
      <div className="relative">
        <i className={`fas ${icon} absolute left-4 top-1/2 -translate-y-1/2 text-gray-500`}></i>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShow(true);
            if (!e.target.value.trim()) onChange('');
          }}
          onFocus={() => {
            setShow(true);
            filtrar(input);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-[#1a1a24] border ${error ? 'border-red-500 ring-1 ring-red-500/20' : 'border-gray-700'} rounded-xl py-3 pl-11 pr-10 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm`}
        />
        {input && (
          <button
            type="button"
            onClick={() => { setInput(''); onChange(''); setShow(false); inputRef.current?.focus(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <i className="fas fa-times"></i>
          </button>
        )}

        {show && sugerencias.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden max-h-64 overflow-y-auto">
            {sugerencias.map((opt, index) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => seleccionar(opt)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                  index === selectedIndex 
                    ? 'bg-red-500/10 text-red-400' 
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {itemIcon && <i className={`fas ${itemIcon} text-gray-500 text-xs`}></i>}
                <span className="flex-1 text-sm">{opt.nombre}</span>
              </button>
            ))}
          </div>
        )}

        {show && input && sugerencias.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-gray-700 rounded-xl shadow-2xl p-4 text-center text-gray-500 text-sm">
            <i className="fas fa-search mb-2 block text-lg"></i>
            No se encontraron {label.toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
}