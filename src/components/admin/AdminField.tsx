import type { ChangeEvent } from 'react';
import { Skeleton } from '../ui/Skeleton';

export interface AdminFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  textarea?: boolean;
  tipo?: 'bool' | 'int' | 'imagen' | 'json';
  maxLength?: number;
}

interface AdminFieldProps {
  campo: AdminFieldDef;
  value: string;
  descripcion?: string;
  onChange: (key: string, value: string) => void;
  onUpload?: (e: ChangeEvent<HTMLInputElement>, key: string) => void;
  uploading?: boolean;
  loading?: boolean;
}

const FULL_WIDTH_KEYS = new Set(['robots_contenido', 'schema_sameAs']);
const MONO_KEYS = new Set(['robots_contenido', 'schema_sameAs']);

const inputClass =
  'w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3.5 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors';

export default function AdminField({
  campo,
  value,
  descripcion,
  onChange,
  onUpload,
  uploading,
  loading,
}: AdminFieldProps) {
  const full = !!campo.textarea || campo.tipo === 'json' || campo.tipo === 'imagen' || FULL_WIDTH_KEYS.has(campo.key);
  const mono = campo.tipo === 'json' || MONO_KEYS.has(campo.key);
  const count = (value ?? '').length;
  const over = campo.maxLength ? count > campo.maxLength : false;

  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label className="block text-sm text-gray-400">{campo.label}</label>
        {campo.maxLength && (
          <span className={`text-[11px] tabular-nums ${over ? 'text-amber-400' : 'text-gray-600'}`}>
            {count}/{campo.maxLength}
          </span>
        )}
      </div>
      {descripcion && <p className="text-xs text-gray-500 mb-2">{descripcion}</p>}

      {loading ? (
        <Skeleton height={42} className="w-full rounded-lg" />
      ) : campo.tipo === 'bool' ? (
        <button
          type="button"
          onClick={() => onChange(campo.key, value === '1' ? '0' : '1')}
          className={`relative w-12 h-6 rounded-full transition-colors ${value === '1' ? 'bg-green-500' : 'bg-[#2a2a3e] border border-[#2a2a3e]'}`}
          aria-pressed={value === '1'}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value === '1' ? 'left-6' : 'left-0.5'}`}></span>
        </button>
      ) : campo.tipo === 'json' ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(campo.key, e.target.value)}
          rows={3}
          placeholder='["https://facebook.com/...", "https://instagram.com/..."]'
          className={`${inputClass} font-mono resize-y`}
        />
      ) : campo.textarea ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(campo.key, e.target.value)}
          rows={campo.key === 'robots_contenido' ? 8 : 3}
          placeholder={campo.placeholder}
          className={`${inputClass} ${mono ? 'font-mono' : ''} resize-y`}
        />
      ) : campo.tipo === 'imagen' ? (
        <div className="flex items-center gap-3">
          <div className="w-16 h-9 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e] overflow-hidden flex-shrink-0">
            {value ? (
              <img
                src={value}
                alt="Vista previa"
                className="w-full h-full object-cover"
                onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                <i className="fas fa-image"></i>
              </div>
            )}
          </div>
          {onUpload && (
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-colors whitespace-nowrap">
              <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
              {uploading ? 'Subiendo...' : 'Subir imagen'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onUpload(e, campo.key)}
                disabled={uploading}
              />
            </label>
          )}
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(campo.key, e.target.value)}
            placeholder="/uploads/og/... o https://..."
            className={`${inputClass} flex-1 min-w-0`}
          />
        </div>
      ) : (
        <input
          type={campo.tipo === 'int' ? 'number' : 'text'}
          step={campo.tipo === 'int' ? '1' : undefined}
          value={value ?? ''}
          onChange={(e) => onChange(campo.key, e.target.value)}
          placeholder={campo.placeholder}
          className={inputClass}
        />
      )}
    </div>
  );
}
