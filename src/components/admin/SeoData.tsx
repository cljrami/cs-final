import { useEffect, useState } from 'react';
import { showToast } from '../ui/Toast';
import AdminField from './AdminField';

interface Campo {
  key: string;
  label: string;
  placeholder?: string;
  textarea?: boolean;
  tipo?: 'bool' | 'int' | 'imagen' | 'json';
  maxLength?: number;
}

interface Grupo {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  placeholders?: string;
  campos: Campo[];
}

const SECCIONES = [
  { id: 'general', label: 'General', icono: 'fa-globe' },
  { id: 'opengraph', label: 'Open Graph', icono: 'fa-share-nodes' },
  { id: 'favicon', label: 'Favicon', icono: 'fa-icons' },
  { id: 'schema', label: 'Schema.org', icono: 'fa-magnifying-glass-chart' },
  { id: 'plantillas', label: 'Plantillas', icono: 'fa-file-lines' },
  { id: 'sitemap', label: 'Sitemap', icono: 'fa-sitemap' },
  { id: 'robots', label: 'robots.txt', icono: 'fa-robot' },
  { id: 'indexnow', label: 'IndexNow', icono: 'fa-bolt' },
  { id: 'verificacion', label: 'Verificación meta', icono: 'fa-shield-alt' },
];

const GROUPS: Grupo[] = [
  {
    id: 'general',
    titulo: 'SEO general',
    descripcion: 'Título, descripción, keywords y metadatos globales del sitio.',
    icono: 'fa-magnifying-glass',
    campos: [
      { key: 'seo_url', label: 'URL raíz del sitio', placeholder: 'https://www.consexvip.cl' },
      { key: 'seo_description', label: 'Meta description', textarea: true, maxLength: 160 },
      { key: 'seo_keywords', label: 'Meta keywords (separadas por coma)', textarea: true },
      { key: 'seo_canonical', label: 'URL canónica' },
      { key: 'seo_robots', label: 'Directiva robots (ej: INDEX, FOLLOW)' },
      { key: 'seo_author', label: 'Autor' },
      { key: 'seo_publisher', label: 'Publisher' },
      { key: 'seo_lang', label: 'Idioma del sitio (ej: es)' },
    ],
  },
  {
    id: 'opengraph',
    titulo: 'Open Graph / Redes',
    descripcion: 'Cómo se muestra el sitio al compartirlo en redes sociales y WhatsApp.',
    icono: 'fa-share-nodes',
    campos: [
      { key: 'og_imagen', label: 'Imagen Open Graph (1200x630)', tipo: 'imagen' },
      { key: 'og_type', label: 'Tipo (ej: website)' },
      { key: 'twitter_handle', label: 'Handle de Twitter/X (ej: @marca)' },
      { key: 'og_fb_app_id', label: 'Facebook App ID' },
    ],
  },
  {
    id: 'favicon',
    titulo: 'Favicon / Iconos',
    descripcion: 'Iconos del sitio mostrados en la pestaña del navegador y resultados de búsqueda.',
    icono: 'fa-icons',
    campos: [
      { key: 'site_favicon_svg', label: 'Favicon SVG', tipo: 'imagen' },
      { key: 'site_favicon_32', label: 'Favicon PNG 32x32', tipo: 'imagen' },
      { key: 'site_favicon_16', label: 'Favicon PNG 16x16', tipo: 'imagen' },
      { key: 'site_apple_touch', label: 'Apple Touch Icon', tipo: 'imagen' },
    ],
  },
  {
    id: 'schema',
    titulo: 'Schema.org (JSON-LD)',
    descripcion: 'Datos estructurados de la organización para Google y buscadores.',
    icono: 'fa-magnifying-glass-chart',
    placeholders: 'sameAs debe ser un JSON: ["https://facebook.com/...", "https://instagram.com/..."]',
    campos: [
      { key: 'schema_habilitado', label: 'Habilitar Schema.org', tipo: 'bool' },
      { key: 'schema_tipo', label: 'Tipo (ej: Organization)' },
      { key: 'schema_nombre', label: 'Nombre' },
      { key: 'schema_url', label: 'URL' },
      { key: 'schema_logo', label: 'Logo (512x512 PNG recomendado)', tipo: 'imagen' },
      { key: 'schema_description', label: 'Descripción', textarea: true },
      { key: 'schema_sameAs', label: 'Perfiles sociales (JSON)', tipo: 'json' },
      { key: 'schema_email', label: 'Email de contacto' },
      { key: 'schema_telefono', label: 'Teléfono' },
      { key: 'schema_localidad', label: 'Localidad' },
      { key: 'schema_pais', label: 'País (ej: CL)' },
      { key: 'schema_imagen', label: 'Imagen (1200x630 recomendado)', tipo: 'imagen' },
    ],
  },
  {
    id: 'plantillas',
    titulo: 'Plantillas SEO por página',
    descripcion: 'Títulos y descripciones de cada tipo de página del sitio.',
    icono: 'fa-file-lines',
    placeholders: 'Variables: {ciudad}, {nombre}, {edad}, {descripcion}, {titulo}, {site}.',
    campos: [
      { key: 'seo_inicio_titulo', label: 'Título inicio', placeholder: 'Escorts en Chile | {site}' },
      { key: 'seo_inicio_description', label: 'Descripción inicio', textarea: true, maxLength: 160 },
      { key: 'seo_ciudad_titulo', label: 'Título ciudad', placeholder: 'Escorts en {ciudad} | {site}' },
      { key: 'seo_ciudad_description', label: 'Descripción ciudad', textarea: true, maxLength: 160 },
      { key: 'seo_ciudad_keywords', label: 'Keywords ciudad', textarea: true },
      { key: 'seo_escort_titulo', label: 'Título perfil escort', placeholder: '{nombre} en {ciudad} | {site}' },
      { key: 'seo_escort_description', label: 'Descripción perfil escort', textarea: true, maxLength: 160 },
      { key: 'seo_escort_og_titulo', label: 'Título Open Graph perfil escort' },
      { key: 'seo_escort_og_description', label: 'Descripción Open Graph perfil escort', textarea: true, maxLength: 160 },
      { key: 'seo_blog_titulo', label: 'Título artículo', placeholder: '{titulo} | {site}' },
      { key: 'seo_blog_description', label: 'Descripción artículo', textarea: true, maxLength: 160 },
      { key: 'seo_login_titulo', label: 'Título iniciar sesión' },
      { key: 'seo_login_description', label: 'Descripción iniciar sesión', textarea: true },
      { key: 'seo_registro_titulo', label: 'Título registro' },
      { key: 'seo_registro_description', label: 'Descripción registro', textarea: true },
      { key: 'seo_recuperar_titulo', label: 'Título recuperar contraseña' },
      { key: 'seo_recuperar_description', label: 'Descripción recuperar contraseña', textarea: true },
      { key: 'seo_404_titulo', label: 'Título 404' },
      { key: 'seo_404_description', label: 'Descripción 404', textarea: true },
      { key: 'seo_pausado_titulo', label: 'Título perfil pausado' },
      { key: 'seo_pausado_description', label: 'Descripción perfil pausado', textarea: true },
    ],
  },
  {
    id: 'sitemap',
    titulo: 'Sitemap',
    descripcion: 'Opciones de generación del sitemap.xml.',
    icono: 'fa-sitemap',
    campos: [
      { key: 'sitemap_habilitado', label: 'Generar sitemap automático', tipo: 'bool' },
      { key: 'sitemap_incluir_escorts', label: 'Incluir perfiles de escorts', tipo: 'bool' },
      { key: 'sitemap_incluir_ciudades', label: 'Incluir páginas de ciudades', tipo: 'bool' },
      { key: 'sitemap_incluir_paginas', label: 'Incluir páginas estáticas', tipo: 'bool' },
      { key: 'sitemap_incluir_articulos', label: 'Incluir artículos de blog', tipo: 'bool' },
      { key: 'sitemap_max_escorts', label: 'Máximo de escorts (0 = sin límite)', tipo: 'int' },
      {
        key: 'sitemap_urls_extra',
        label: 'URLs adicionales (una por línea)',
        textarea: true,
        placeholder: '/contacto\n/planes',
      },
    ],
  },
  {
    id: 'prioridades',
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
    id: 'robots',
    titulo: 'robots.txt',
    descripcion: 'Gestiona el robots.txt. Si está habilitado, se sirve el contenido de abajo.',
    icono: 'fa-robot',
    campos: [
      { key: 'robots_habilitado', label: 'Usar robots.txt gestionado desde admin', tipo: 'bool' },
      {
        key: 'robots_contenido',
        label: 'Contenido del robots.txt',
        textarea: true,
        placeholder: 'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://www.consexvip.cl/sitemap.xml',
      },
    ],
  },
  {
    id: 'indexnow',
    titulo: 'IndexNow (indexación rápida)',
    descripcion: 'Clave para IndexNow de Google/Bing. Se publica un archivo {clave}.txt en la raíz y se envían pings automáticos al publicar contenido.',
    icono: 'fa-bolt',
    campos: [
      { key: 'indexnow_key', label: 'Clave IndexNow (38+ caracteres alfanuméricos)' },
    ],
  },
  {
    id: 'verificacion',
    titulo: 'Verificación por metaetiqueta (opcional)',
    descripcion: 'Solo si verificas por metaetiqueta. Si usas DNS en Google, ignora esta sección. Bing requiere metaetiqueta o importar desde GSC. Se publican tras build + deploy.',
    icono: 'fa-shield-alt',
    campos: [
      { key: 'verify_google', label: 'Google Search Console (content=, solo metaetiqueta)' },
      { key: 'verify_bing', label: 'Bing Webmaster (msvalidate.01, solo metaetiqueta)' },
    ],
  },
];

const DEFAULTS: Record<string, string> = {
  seo_url: 'https://www.consexvip.cl',
  seo_description: 'Directorio Premium de Escorts en Chile',
  seo_keywords: 'escorts, chile, acompañantes, putas, escort, modelo, chilena, santiago, valdivia',
  seo_canonical: 'https://www.consexvip.cl/',
  seo_robots: 'INDEX, FOLLOW',
  seo_author: 'ConsexVIP',
  seo_publisher: 'ConsexVIP',
  seo_lang: 'es',
  og_imagen: '',
  og_type: 'website',
  twitter_handle: '',
  og_fb_app_id: '',
  schema_habilitado: '1',
  schema_tipo: 'Organization',
  schema_nombre: 'Consexvip',
  schema_url: 'https://www.consexvip.cl/',
  schema_logo: '',
  schema_description: 'Directorio Premium de Escorts en Chile',
  schema_sameAs: '',
  schema_email: '',
  schema_telefono: '',
  schema_localidad: '',
  schema_pais: 'CL',
  schema_imagen: '',
  sitemap_habilitado: '1',
  sitemap_incluir_escorts: '1',
  sitemap_incluir_ciudades: '1',
  sitemap_incluir_paginas: '1',
  sitemap_incluir_articulos: '1',
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
  indexnow_key: '',
  verify_google: '',
  verify_bing: '',
  seo_inicio_titulo: 'Escorts en Chile | {site}',
  seo_inicio_description: 'Directorio premium de escorts en Chile. Perfiles verificados, valoraciones reales y contacto directo en tu ciudad.',
  seo_ciudad_titulo: 'Escorts en {ciudad} | {site}',
  seo_ciudad_description: 'Escorts verificadas en {ciudad}. Perfiles con fotos, tarifas y contacto directo. Reserva con seguridad.',
  seo_ciudad_keywords: 'escorts en {ciudad}, acompañantes en {ciudad}, escorts {ciudad}',
  seo_escort_titulo: '{nombre} en {ciudad} | {site}',
  seo_escort_description: 'Perfil de {nombre}, escort verificada en {ciudad}. Fotos, tarifas y contacto directo.',
  seo_escort_og_titulo: '{nombre}, {edad} años - Consexvip',
  seo_escort_og_description: 'Perfil verificado de {nombre} en {ciudad}',
  seo_blog_titulo: '{titulo} | {site}',
  seo_blog_description: '',
  seo_login_titulo: 'Iniciar sesión',
  seo_login_description: 'Accede a tu cuenta para guardar favoritos y valorar perfiles',
  seo_registro_titulo: 'Crear cuenta',
  seo_registro_description: 'Crea tu cuenta de usuario para guardar favoritos y valorar perfiles',
  seo_recuperar_titulo: 'Recuperar Contraseña',
  seo_recuperar_description: 'Recupera el acceso a tu cuenta',
  seo_404_titulo: 'Página no encontrada',
  seo_404_description: 'La página que buscas no existe o fue movida',
  seo_pausado_titulo: 'Perfil pausado',
  seo_pausado_description: 'Este perfil está temporalmente pausado',
};

function SitemapPreview() {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/sitemap.xml?r=' + Date.now(), { cache: 'no-store' })
      .then(async r => {
        const text = await r.text();
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        const locs = Array.from(doc.querySelectorAll('url > loc'))
          .map(el => (el.textContent || '').trim())
          .filter(Boolean);
        setUrls(locs);
      })
      .catch(err => setError('No se pudo cargar el sitemap: ' + err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="mt-5 border-t border-[#2a2a3e] pt-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-300">
            <i className="fas fa-sitemap text-blue-400 mr-1.5"></i>Vista previa del sitemap
          </h3>
          {!loading && !error && <span className="text-[11px] text-gray-500">{urls.length} URLs</span>}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#252538] hover:bg-[#2f2f46] disabled:opacity-50 text-gray-300 rounded-md text-xs font-medium transition-colors"
        >
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i> Actualizar
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Refleja el sitemap publicado. Para modificarlo, activa o desactiva secciones arriba, ajusta las URLs extra y guarda.
      </p>
      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-7 rounded-md bg-[#252538] animate-pulse"></div>
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <i className="fas fa-exclamation-circle mr-1"></i>{error}
        </p>
      ) : urls.length === 0 ? (
        <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <i className="fas fa-info-circle mr-1"></i>El sitemap no contiene URLs. Revisa que esté habilitado.
        </p>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-[#2a2a3e] bg-[#151524] divide-y divide-[#2a2a3e]">
          {urls.map((url, idx) => (
            <div key={url + idx} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className="text-gray-600 tabular-nums w-6 text-right flex-shrink-0">{idx + 1}</span>
              <i className="fas fa-link text-gray-600 text-[10px] flex-shrink-0"></i>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-gray-300 hover:text-blue-300 transition-colors"
              >
                {url}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RobotsPreview() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/robots.txt?r=' + Date.now(), { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        setText(await r.text());
      })
      .catch(err => setError('No se pudo cargar robots.txt: ' + err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="mt-5 border-t border-[#2a2a3e] pt-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-gray-300">
          <i className="fas fa-robot text-blue-400 mr-1.5"></i>Archivo robots.txt publicado
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#252538] hover:bg-[#2f2f46] disabled:opacity-50 text-gray-300 rounded-md text-xs font-medium transition-colors"
        >
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i> Actualizar
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Así se está sirviendo ahora. Si activas la gestión desde admin, se usará el contenido del campo de arriba al guardar.
      </p>
      {loading ? (
        <div className="h-40 rounded-lg bg-[#252538] animate-pulse"></div>
      ) : error ? (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <i className="fas fa-exclamation-circle mr-1"></i>{error}
        </p>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-lg border border-[#2a2a3e] bg-[#151524] px-3 py-2.5 text-xs text-gray-300 font-mono whitespace-pre-wrap">
          {text || '(vacío)'}
        </pre>
      )}
    </div>
  );
}

const ALL_KEYS = GROUPS.flatMap(g => g.campos.map(c => c.key));

export default function SeoData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [reindexando, setReindexando] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>(DEFAULTS);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('general');
  const [dirty, setDirty] = useState(false);

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  // Notifica a Google/Bing (IndexNow) para reindexar en minutos
  const reindexar = async () => {
    setReindexando(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/seo-reindexar.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) showToast(data.message || 'Reindexación enviada');
      else showToast(data.error || 'Error al reindexar', 'error');
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setReindexando(false);
    }
  };

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

  useEffect(() => {
    if (loading) return;
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best = '';
        let bestRatio = 0;
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        });
        if (best) setActiveSection(best);
      },
      { rootMargin: '-120px 0px -50% 0px', threshold: [0, 0.1, 0.5, 1] }
    );
    GROUPS.forEach(g => {
      const el = document.getElementById(g.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading]);

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
        setDirty(false);
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const carpeta = key.startsWith('schema_')
      ? 'schema'
      : key.startsWith('site_favicon')
        ? 'favicon'
        : key === 'site_apple_touch'
          ? 'favicon'
          : 'og';
    setUploadingKey(key);
    setErrorMsg('');

    try {
      const token = localStorage.getItem('admin_token');
      const fd = new FormData();
      fd.append('imagen', file);
      fd.append('carpeta', carpeta);

      const res = await fetch('/api/admin/subir-og.php', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: fd,
      });

      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({ ...prev, [key]: data.path }));
        setDirty(true);
      } else {
        setErrorMsg(data.error || 'Error al subir la imagen');
      }
    } catch (err) {
      setErrorMsg('Error de conexión al subir la imagen');
    } finally {
      setUploadingKey(null);
      if (e.target) e.target.value = '';
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
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">SEO</h1>
            <p className="text-admin-muted text-sm">Metadatos, Open Graph, datos estructurados, plantillas, sitemap y robots.txt del sitio.</p>
          </div>
          <button
            type="submit"
            form="seo-form"
            disabled={saving}
            className="hidden xl:inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
            Guardar cambios
          </button>
        </div>

        <nav className="sticky top-16 z-30 -mx-1 px-1 py-3 mb-6 bg-[#0f0f1a]/95 backdrop-blur border-b border-[#2a2a3e] flex gap-2 overflow-x-auto">
          {SECCIONES.map(s => (
            <button
              type="button"
              key={s.id}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                activeSection === s.id
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-[#1a1a2e] border-[#2a2a3e] text-gray-300 hover:bg-[#252538] hover:text-white'
              }`}
            >
              <i className={`fas ${s.icono}`}></i> {s.label}
            </button>
          ))}
        </nav>

        {saved && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-5 text-emerald-400 text-sm flex items-center gap-2">
            <i className="fas fa-check-circle"></i> Configuración guardada correctamente
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <form id="seo-form" onSubmit={handleSubmit} className="space-y-5 min-w-0">
          {GROUPS.map(g => (
            <section key={g.id} id={g.id} className="scroll-mt-32 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 md:p-6">
              <div className="flex items-center gap-3 mb-1">
                <span className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <i className={`fas ${g.icono} text-blue-400 text-sm`}></i>
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">{g.titulo}</h2>
                  <p className="text-xs text-gray-500">{g.descripcion}</p>
                </div>
              </div>
              {g.placeholders && (
                <p className="text-xs text-amber-400/80 mt-2"><i className="fas fa-info-circle mr-1"></i>{g.placeholders}</p>
              )}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {g.campos.map(c => (
                  <AdminField
                    key={c.key}
                    campo={c}
                    value={formData[c.key] ?? ''}
                    onChange={updateField}
                    onUpload={handleUpload}
                    uploading={uploadingKey === c.key}
                    loading={loading}
                  />
                ))}
              </div>

              {g.id === 'sitemap' && <SitemapPreview />}
              {g.id === 'robots' && <RobotsPreview />}
            </section>
          ))}

          <div className="flex items-center gap-3 flex-wrap bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
              Guardar cambios
            </button>
            {dirty && !saving && (
              <span className="text-amber-400 text-xs"><i className="fas fa-circle text-[6px] mr-1 align-middle"></i>Cambios sin guardar</span>
            )}
            {saved && <span className="text-emerald-400 text-sm"><i className="fas fa-check-circle mr-1"></i>Guardado</span>}
          </div>
          </form>

          <aside className="xl:sticky xl:top-32 space-y-4">
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <i className="fas fa-bolt text-yellow-400"></i> Acciones
              </h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#252538] hover:bg-[#2f2f46] text-gray-300 rounded-lg text-xs font-medium transition-colors">
                    <i className="fas fa-eye"></i> Ver sitemap
                  </a>
                  <button type="button" onClick={() => window.open("/sitemap.xml?r=" + Date.now(), "_blank")} className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-300 border border-yellow-500/30 rounded-lg text-xs font-semibold transition-colors">
                    <i className="fas fa-sync-alt"></i> Regenerar
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#252538] hover:bg-[#2f2f46] text-gray-300 rounded-lg text-xs font-medium transition-colors">
                    <i className="fas fa-eye"></i> Ver robots
                  </a>
                  <button type="button" onClick={() => window.open("/robots.txt?r=" + Date.now(), "_blank")} className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#252538] hover:bg-[#2f2f46] text-gray-300 rounded-lg text-xs font-medium transition-colors">
                    <i className="fas fa-sync-alt"></i> Regenerar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={reindexar}
                  disabled={reindexando}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#252538] hover:bg-[#2f2f46] disabled:opacity-50 text-gray-200 rounded-lg text-xs font-medium transition-colors"
                  title="Notifica a Google y Bing (IndexNow) las URLs del sitio"
                >
                  {reindexando ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt text-yellow-400"></i>}
                  Reindexar ahora
                </button>
              </div>
            </div>

            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <i className="fas fa-signal text-emerald-400"></i> Estado
              </h2>
              <ul className="space-y-2.5 text-xs">
                <li className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">Sitemap</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${formData.sitemap_habilitado === '1' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'}`}>
                    <i className="fas fa-circle text-[5px]"></i> {formData.sitemap_habilitado === '1' ? 'Activo' : 'Desactivado'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">robots.txt</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${formData.robots_habilitado === '1' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'}`}>
                    <i className="fas fa-circle text-[5px]"></i> {formData.robots_habilitado === '1' ? 'Gestionado' : 'Estático'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-gray-400">IndexNow</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${formData.indexnow_key?.trim() ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
                    <i className="fas fa-circle text-[5px]"></i> {formData.indexnow_key?.trim() ? 'Configurado' : 'Sin clave'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5">
              <button
                type="submit"
                form="seo-form"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                Guardar cambios
              </button>
              <p className={`text-xs mt-2.5 text-center ${dirty ? 'text-amber-400' : 'text-gray-500'}`}>
                {dirty ? 'Tienes cambios sin guardar' : 'Todo guardado'}
              </p>
            </div>
          </aside>
        </div>
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
