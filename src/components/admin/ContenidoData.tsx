import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/Skeleton';

interface TextoConfig {
  valor: string;
  descripcion: string;
  tipo?: string;
}

interface Textos {
  [key: string]: TextoConfig;
}

interface Campo {
  key: string;
  label: string;
  textarea?: boolean;
  tipo?: 'bool' | 'json' | 'imagen';
}

interface Grupo {
  titulo: string;
  descripcion: string;
  icono: string;
  placeholders?: string;
  campos: Campo[];
}

const GROUPS: Grupo[] = [
  {
    titulo: 'Inicio (Hero)',
    descripcion: 'Los textos que se ven al entrar al sitio.',
    icono: 'fa-house',
    campos: [
      { key: 'hero_badge', label: 'Badge del inicio' },
      { key: 'hero_titulo', label: 'Título principal' },
      { key: 'hero_subtitulo', label: 'Subtítulo', textarea: true },
      { key: 'confianza_1', label: 'Texto de confianza 1' },
      { key: 'confianza_2', label: 'Texto de confianza 2' },
      { key: 'confianza_3', label: 'Texto de confianza 3' },
    ],
  },
  {
    titulo: 'Secciones del inicio',
    descripcion: 'Títulos de las secciones de escorts en la página principal.',
    icono: 'fa-layer-group',
    campos: [
      { key: 'seccion_disponibles_titulo', label: 'Título "Disponibles ahora"' },
      { key: 'seccion_nuevas_titulo', label: 'Título "Nuevas en tu ciudad"' },
      { key: 'seccion_valoradas_titulo', label: 'Título "Más valoradas"' },
      { key: 'seccion_escorts_titulo', label: 'Título "Escorts"' },
      { key: 'seccion_historias_titulo', label: 'Título "Historias"' },
      { key: 'seccion_ciudad_grid_titulo', label: 'Título de escorts principales (usa {ciudad})' },
    ],
  },
  {
    titulo: 'Página de ciudad',
    descripcion: 'Títulos de secciones y SEO de la página de cada ciudad.',
    icono: 'fa-city',
    placeholders: 'Usa {ciudad} para insertar el nombre de la ciudad.',
    campos: [
      { key: 'seccion_ciudad_disponibles_titulo', label: 'Título disponibles (usa {ciudad})' },
      { key: 'seccion_ciudad_valoradas_titulo', label: 'Título más valoradas (usa {ciudad})' },
      { key: 'seccion_ciudad_nuevas_titulo', label: 'Título nuevas (usa {ciudad})' },
      { key: 'seo_ciudad_h1', label: 'H1 (usa {ciudad})' },
      { key: 'seo_ciudad_titulo', label: 'Título <title> (usa {ciudad})' },
      { key: 'seo_ciudad_description', label: 'Meta description (usa {ciudad}, máx 160 chars)', textarea: true },
      { key: 'seo_ciudad_keywords', label: 'Meta keywords (usa {ciudad})', textarea: true },
    ],
  },
  {
    titulo: 'Perfil de escort',
    descripcion: 'Títulos y metadatos SEO del perfil público de cada escort.',
    icono: 'fa-user',
    placeholders: 'Usa {nombre}, {edad}, {ciudad} y {descripcion}.',
    campos: [
      { key: 'seo_escort_titulo', label: 'Título <title> (usa {nombre}, {edad})' },
      { key: 'seo_escort_description', label: 'Meta description (usa {nombre}, {ciudad}, {descripcion})', textarea: true },
      { key: 'seo_escort_og_titulo', label: 'Título Open Graph (usa {nombre}, {edad})' },
      { key: 'seo_escort_og_description', label: 'Descripción Open Graph (usa {nombre}, {ciudad})', textarea: true },
    ],
  },
  {
    titulo: 'Páginas del sitio',
    descripcion: 'Títulos y descripciones de las páginas internas.',
    icono: 'fa-file-lines',
    campos: [
      { key: 'seo_inicio_titulo', label: 'Meta Título <title> de inicio' },
      { key: 'seo_inicio_description', label: 'Descripción inicio', textarea: true },
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
    titulo: 'Open Graph / Redes',
    descripcion: 'Configuración de Open Graph y Twitter Card para compartir en redes.',
    icono: 'fa-share-nodes',
    campos: [
      { key: 'og_imagen', label: 'Imagen Open Graph (1200x630)', tipo: 'imagen' },
      { key: 'og_type', label: 'Tipo (ej: website)' },
      { key: 'twitter_handle', label: 'Handle de Twitter/X (ej: @marca)' },
      { key: 'og_fb_app_id', label: 'Facebook App ID' },
    ],
  },
  {
    titulo: 'Schema.org (JSON-LD)',
    descripcion: 'Datos estructurados de la organización (Organización/WebSite) para buscadores.',
    icono: 'fa-magnifying-glass-chart',
    placeholders: 'sameAs debe ser un JSON: ["https://facebook.com/...", "https://instagram.com/..."]',
    campos: [
      { key: 'schema_habilitado', label: 'Habilitar Schema.org', tipo: 'bool' },
      { key: 'schema_tipo', label: 'Tipo (ej: Organization)' },
      { key: 'schema_nombre', label: 'Nombre' },
      { key: 'schema_url', label: 'URL' },
      { key: 'schema_logo', label: 'Logo (URL)' },
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
    titulo: 'SEO general',
    descripcion: 'Metadatos y configuración SEO global del sitio.',
    icono: 'fa-magnifying-glass',
    campos: [
      { key: 'seo_description', label: 'Meta Description (máx 160 chars)', textarea: true },
      { key: 'seo_keywords', label: 'Meta Keywords', textarea: true },
      { key: 'seo_url', label: 'URL principal' },
      { key: 'seo_canonical', label: 'Canonical URL' },
      { key: 'seo_robots', label: 'Robots Tag (ej: INDEX, FOLLOW)' },
      { key: 'seo_author', label: 'Author' },
      { key: 'seo_publisher', label: 'Publisher' },
      { key: 'seo_lang', label: 'Idioma del sitio (ej: es, en)' },
    ],
  },
  {
    titulo: 'CTA final (¿Eres escort o agencia?)',
    descripcion: 'El bloque con botones para publicar un anuncio al final del inicio.',
    icono: 'fa-bullhorn',
    campos: [
      { key: 'cta_titulo', label: 'Título' },
      { key: 'cta_subtitulo', label: 'Subtítulo', textarea: true },
      { key: 'cta_boton_1', label: 'Botón principal' },
      { key: 'cta_boton_2', label: 'Botón secundario' },
    ],
  },
  {
    titulo: 'Sitio',
    descripcion: 'Nombre y descripción que se muestran en el footer.',
    icono: 'fa-globe',
    campos: [
      { key: 'site_nombre', label: 'Nombre del sitio' },
      { key: 'site_descripcion', label: 'Descripción del sitio', textarea: true },
    ],
  },
  {
    titulo: 'Header (Barra de navegación)',
    descripcion: 'Los textos que se muestran en el header de todas las páginas.',
    icono: 'fa-bars',
    campos: [
      { key: 'nav_logo_1', label: 'Parte 1 del logo (color rojo)' },
      { key: 'nav_logo_2', label: 'Parte 2 del logo (color blanco)' },
      { key: 'nav_inicio', label: 'Enlace Inicio' },
      { key: 'nav_ciudades', label: 'Enlace Ciudades' },
      { key: 'nav_ingresar', label: 'Botón Ingresar' },
      { key: 'nav_publicar', label: 'Botón Publicar' },
      { key: 'nav_entrar_usuario', label: 'Acceso "Entrar como Usuario"' },
      { key: 'nav_entrar_usuario_desc', label: 'Subtexto del acceso Usuario' },
      { key: 'nav_entrar_escort', label: 'Acceso "Entrar como Escort"' },
      { key: 'nav_entrar_escort_desc', label: 'Subtexto del acceso Escort' },
      { key: 'nav_mi_panel', label: 'Enlace "Mi Panel" (escort)' },
      { key: 'nav_mi_cuenta', label: 'Enlace "Mi Cuenta" (usuario)' },
      { key: 'nav_mis_favoritos', label: 'Enlace "Mis Favoritos" (usuario)' },
      { key: 'nav_mi_perfil', label: 'Enlace "Mi Perfil" (usuario)' },
      { key: 'nav_cerrar_sesion', label: 'Botón "Cerrar sesión"' },
    ],
  },
];

const DEFAULTS: Record<string, string> = {
  hero_badge: 'Perfiles verificados',
  hero_titulo: 'Encuentra tu Experiencia Hoy',
  hero_subtitulo: 'Perfiles verificados y actualizados diariamente',
  confianza_1: 'Verificados',
  confianza_2: 'Seguro',
  confianza_3: 'Actualizados hoy',
  seccion_disponibles_titulo: 'Disponibles ahora',
  seccion_escorts_titulo: 'Escorts',
  seccion_historias_titulo: 'Historias',
  seccion_ciudad_grid_titulo: 'Todos los escorts en {ciudad}',
  seccion_nuevas_titulo: 'Nuevas en tu ciudad',
  seccion_valoradas_titulo: 'Más valoradas',
  seccion_ciudad_disponibles_titulo: 'Disponibles ahora en {ciudad}',
  seccion_ciudad_valoradas_titulo: 'Más valoradas en {ciudad}',
  seccion_ciudad_nuevas_titulo: 'Nuevas en {ciudad}',
  seo_ciudad_h1: 'Escorts en {ciudad}',
  seo_ciudad_titulo: 'Escorts en {ciudad} | CSEscorts',
  seo_ciudad_description: 'Encuentra escorts y acompañantes en {ciudad}. Perfiles verificados y actualizados diariamente.',
  seo_ciudad_keywords: 'escorts en {ciudad}, acompañantes en {ciudad}, escorts {ciudad}',
  seo_escort_titulo: '{nombre}, {edad} años | CSEscorts',
  seo_escort_description: 'Perfil de {nombre} en {ciudad}. {descripcion}',
  seo_escort_og_titulo: '{nombre}, {edad} años - CSEscorts',
  seo_escort_og_description: 'Perfil verificado de {nombre} en {ciudad}',
  seo_inicio_titulo: 'Inicio',
  seo_inicio_description: 'Directorio Premium de Escorts en Chile',
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
  seo_description: 'Directorio Premium de Escorts en Chile',
  seo_keywords: 'escorts, chile, acompañantes, putas, escort, modelo, chilena, santiago, valdivia',
  seo_url: 'https://kimi.zona8.cl/',
  seo_canonical: 'https://kimi.zona8.cl/',
  seo_robots: 'INDEX, FOLLOW',
  seo_author: 'Kimi',
  seo_publisher: 'Kimi',
  seo_lang: 'es',
  og_imagen: '',
  og_type: 'website',
  twitter_handle: '',
  og_fb_app_id: '',
  schema_habilitado: '1',
  schema_tipo: 'Organization',
  schema_nombre: 'CSEscorts',
  schema_url: 'https://kimi.zona8.cl/',
  schema_logo: '',
  schema_description: 'Directorio Premium de Escorts en Chile',
  schema_sameAs: '',
  schema_email: '',
  schema_telefono: '',
  schema_localidad: '',
  schema_pais: 'CL',
  schema_imagen: '',
  cta_titulo: '¿Eres escort o agencia?',
  cta_subtitulo: 'Publica tu perfil y llega a miles de clientes potenciales',
  cta_boton_1: 'Publicar Ahora',
  cta_boton_2: 'Ver Planes',
  site_nombre: 'CSEscorts',
  site_descripcion: 'Directorio Premium de Escorts',
  nav_logo_1: 'CS',
  nav_logo_2: 'Escorts',
  nav_inicio: 'Inicio',
  nav_ciudades: 'Ciudades',
  nav_ingresar: 'Ingresar',
  nav_publicar: 'Publicar',
  nav_entrar_usuario: 'Entrar como Usuario',
  nav_entrar_usuario_desc: 'Guarda favoritos, valora',
  nav_entrar_escort: 'Entrar como Escort',
  nav_entrar_escort_desc: 'Administra tu perfil',
  nav_mi_panel: 'Mi Panel',
  nav_mi_cuenta: 'Mi Cuenta',
  nav_mis_favoritos: 'Mis Favoritos',
  nav_mi_perfil: 'Mi Perfil',
  nav_cerrar_sesion: 'Cerrar sesión',
};

const ALL_KEYS = GROUPS.flatMap(g => g.campos.map(c => c.key));

export default function ContenidoData() {
  const [textos, setTextos] = useState<Textos | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/admin/contenido.php', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(async r => {
        const text = await r.text();
        try { return JSON.parse(text); } catch (e) { throw new Error('No es JSON'); }
      })
      .then(data => {
        if (data.success) {
          setTextos(data.textos);
          const next: Record<string, string> = { ...DEFAULTS };
          for (const key of ALL_KEYS) {
            next[key] = data.textos[key]?.valor || DEFAULTS[key];
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
      const res = await fetch('/api/admin/contenido.php', {
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const carpeta = key === 'schema_imagen' ? 'schema' : 'og';
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
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Contenido del sitio</h1>
        <p className="text-admin-muted mb-8">Edita todos los textos y metadatos del sitio: inicio, secciones, ciudad, perfiles, SEO, Open Graph y Schema.org</p>

        {saved && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 text-emerald-400 text-sm flex items-center gap-2">
            <i className="fas fa-check-circle"></i> Contenido guardado correctamente
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          {GROUPS.map(g => (
            <div key={g.titulo} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-1">
                <span className="w-9 h-9 rounded-lg bg-[#252538] flex items-center justify-center">
                  <i className={`fas ${g.icono} text-blue-400 text-sm`}></i>
                </span>
                <h2 className="text-base font-semibold text-white">{g.titulo}</h2>
              </div>
              <p className="text-xs text-gray-500 mb-1 ml-12">{g.descripcion}</p>
              {g.placeholders && (
                <p className="text-xs text-amber-400/80 mb-5 ml-12"><i className="fas fa-info-circle mr-1"></i>{g.placeholders}</p>
              )}

              <div className="space-y-4">
                {g.campos.map(c => (
                  <div key={c.key}>
                    <label className="block text-sm text-gray-400 mb-1">{c.label}</label>
                    <p className="text-xs text-gray-500 mb-2">
                      {loading ? <Skeleton width={200} height={14} /> : textos?.[c.key]?.descripcion || '—'}
                    </p>
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
                    ) : c.tipo === 'json' ? (
                      <textarea
                        value={formData[c.key] ?? ''}
                        onChange={(e) => setFormData({ ...formData, [c.key]: e.target.value })}
                        rows={3}
                        placeholder='["https://facebook.com/...", "https://instagram.com/..."]'
                        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
                      />
                    ) : c.textarea ? (
                      <textarea
                        value={formData[c.key] ?? ''}
                        onChange={(e) => setFormData({ ...formData, [c.key]: e.target.value })}
                        rows={2}
                        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-y"
                      />
                    ) : c.tipo === 'imagen' ? (
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-9 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e] overflow-hidden flex-shrink-0">
                          {formData[c.key] ? (
                            <img
                              src={formData[c.key]}
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
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-colors">
                          <i className={`fas ${uploadingKey === c.key ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
                          {uploadingKey === c.key ? 'Subiendo...' : 'Subir imagen'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => handleUpload(e, c.key)}
                            disabled={uploadingKey !== null}
                          />
                        </label>
                        <input
                          type="text"
                          value={formData[c.key] ?? ''}
                          onChange={(e) => setFormData({ ...formData, [c.key]: e.target.value })}
                          placeholder="/uploads/og/... o https://..."
                          className="flex-1 min-w-0 bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={formData[c.key] ?? ''}
                        onChange={(e) => setFormData({ ...formData, [c.key]: e.target.value })}
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

      {/* Modal Error */}
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
