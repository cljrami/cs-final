import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/Skeleton';

interface CampoConfig {
  valor: string;
  descripcion: string;
  tipo?: string;
}

interface Campo {
  key: string;
  label: string;
  placeholder?: string;
  textarea?: boolean;
  tipo?: 'bool' | 'int';
}

interface Grupo {
  titulo: string;
  descripcion: string;
  icono: string;
  campos: Campo[];
}

const GROUPS: Grupo[] = [
  {
    titulo: 'General',
    descripcion: 'URL raíz del sitio usada para generar el sitemap.',
    icono: 'fa-globe',
    campos: [
      { key: 'seo_url', label: 'URL raíz del sitio', placeholder: 'https://kimi.zona8.cl' },
    ],
  },
  {
    titulo: 'Sitemap',
    descripcion: 'Opciones de generación del sitemap.xml.',
    icono: 'fa-sitemap',
    campos: [
      { key: 'sitemap_habilitado', label: 'Generar sitemap automático', tipo: 'bool' },
      { key: 'sitemap_incluir_escorts', label: 'Incluir perfiles de escorts', tipo: 'bool' },
      { key: 'sitemap_incluir_ciudades', label: 'Incluir páginas de ciudades', tipo: 'bool' },
      { key: 'sitemap_incluir_paginas', label: 'Incluir páginas estáticas', tipo: 'bool' },
      { key: 'sitemap_max_escorts', label: 'Máximo de escorts (0 = sin límite)', tipo: 'int' },
    ],
  },
  {
    titulo: 'Prioridades y frecuencias',
    descripcion: 'Prioridad (0.0 a 1.0) y frecuencia de actualización de cada tipo de página.',
    icono: 'fa-sliders',
    campos: [
      { key: 'sitemap_priority_home', label: 'Prioridad inicio' },
      { key: 'sitemap_priority_escort', label: 'Prioridad escorts' },
      { key: 'sitemap_priority_ciudad', label: 'Prioridad ciudades' },
      { key: 'sitemap_priority_pagina', label: 'Prioridad páginas estáticas' },
      { key: 'sitemap_freq_home', label: 'Frecuencia inicio (daily)' },
      { key: 'sitemap_freq_escort', label: 'Frecuencia escorts (monthly)' },
      { key: 'sitemap_freq_ciudad', label: 'Frecuencia ciudades (weekly)' },
      { key: 'sitemap_freq_pagina', label: 'Frecuencia páginas estáticas (monthly)' },
    ],
  },
  {
    titulo: 'robots.txt',
    descripcion: 'Gestiona el robots.txt. Si está habilitado, se sirve el contenido de abajo.',
    icono: 'fa-robot',
    campos: [
      { key: 'robots_habilitado', label: 'Usar robots.txt gestionado desde admin', tipo: 'bool' },
      {
        key: 'robots_contenido',
        label: 'Contenido del robots.txt',
        textarea: true,
        placeholder: 'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://kimi.zona8.cl/sitemap.xml',
      },
    ],
  },
  {
    titulo: 'URLs adicionales del sitemap',
    descripcion: 'Páginas extra que quieras incluir en el sitemap, una por línea.',
    icono: 'fa-link',
    campos: [
      {
        key: 'sitemap_urls_extra',
        label: 'URLs adicionales',
        textarea: true,
        placeholder: '/contacto\n/planes',
      },
    ],
  },
];

const DEFAULTS: Record<string, string> = {
  seo_url: 'https://kimi.zona8.cl',
  sitemap_habilitado: '1',
  sitemap_incluir_escorts: '1',
  sitemap_incluir_ciudades: '1',
  sitemap_incluir_paginas: '1',
  sitemap_max_escorts: '1000',
  sitemap_priority_home: '1.0',
  sitemap_priority_escort: '0.9',
  sitemap_priority_ciudad: '0.8',
  sitemap_priority_pagina: '0.5',
  sitemap_freq_home: 'daily',
  sitemap_freq_escort: 'monthly',
  sitemap_freq_ciudad: 'weekly',
  sitemap_freq_pagina: 'monthly',
  robots_habilitado: '0',
  robots_contenido: '',
  sitemap_urls_extra: '',
};

const ALL_KEYS = GROUPS.flatMap(g => g.campos.map(c => c.key));

export default function SeoData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>(DEFAULTS);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/admin/seo.php', {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(async r => {
        const text = await r.text();
        try { return JSON.parse(text); } catch (e) { throw new Error('No es JSON'); }
      })
      .then(data => {
        if (data.success) {
          const next: Record<string, string> = { ...DEFAULTS };
          for (const key of ALL_KEYS) {
            next[key] = data.seo?.[key]?.valor || DEFAULTS[key];
          }
          setFormData(next);
        } else {
          setError(data.error || 'Error');
        }
      })
      .catch(err => setError('Error: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/seo.php', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setErrorMsg(data.error || 'Error al guardar');
      }
    } catch (err) {
      setErrorMsg('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-400">
        <i className="fas fa-exclamation-circle mr-2"></i>{error}
      </div>
    );
  }

  return (
    <>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">SEO (Sitemap y robots.txt)</h1>
        <p className="text-admin-muted mb-8">Configura el sitemap.xml y el robots.txt de tu sitio. Los cambios se aplican al instante.</p>

        {saved && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 text-emerald-400 text-sm flex items-center gap-2">
            <i className="fas fa-check-circle"></i> Configuración guardada correctamente
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            <i className="fas fa-sitemap"></i> Ver sitemap.xml
          </a>
          <a
            href="/robots.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            <i className="fas fa-robot"></i> Ver robots.txt
          </a>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          {GROUPS.map(g => (
            <div key={g.titulo} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-1">
                <span className="w-9 h-9 rounded-lg bg-[#252538] flex items-center justify-center">
                  <i className={`fas ${g.icono} text-blue-400 text-sm`}></i>
                </span>
                <h2 className="text-base font-semibold text-white">{g.titulo}</h2>
              </div>
              <p className="text-xs text-gray-500 mb-5 ml-12">{g.descripcion}</p>

              <div className="space-y-4">
                {g.campos.map(c => (
                  <div key={c.key}>
                    <label className="block text-sm text-gray-400 mb-1">{c.label}</label>
                    {loading ? (
                      <Skeleton height={42} className="w-full rounded-lg" />
                    ) : c.tipo === 'bool' ? (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, [c.key]: formData[c.key] === '1' ? '0' : '1' })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${formData[c.key] === '1' ? 'bg-green-500' : 'bg-[#2a2a3e] border border-[#2a2a3e]'}`}
                        aria-pressed={formData[c.key] === '1'}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${formData[c.key] === '1' ? 'left-6' : 'left-0.5'}`}></span>
                      </button>
                    ) : c.textarea ? (
                      <textarea
                        value={formData[c.key] ?? ''}
                        onChange={(e) => setFormData({ ...formData, [c.key]: e.target.value })}
                        rows={c.key === 'robots_contenido' ? 8 : 4}
                        placeholder={c.placeholder}
                        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
                      />
                    ) : (
                      <input
                        type={c.tipo === 'int' ? 'number' : 'text'}
                        step={c.tipo === 'int' ? '1' : undefined}
                        value={formData[c.key] ?? ''}
                        onChange={(e) => setFormData({ ...formData, [c.key]: e.target.value })}
                        placeholder={c.placeholder}
                        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {saving && <i className="fas fa-spinner fa-spin"></i>}
              <i className="fas fa-save"></i> Guardar Cambios
            </button>
            {saved && <span className="text-emerald-400 text-sm"><i className="fas fa-check-circle mr-1"></i>Guardado</span>}
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setErrorMsg('')}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-exclamation-circle text-red-400 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Error</h3>
              <p className="text-gray-400 text-sm">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg('')} className="w-full px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
