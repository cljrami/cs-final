import { useEffect, useState } from 'react';
import AdminField from './AdminField';

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
    descripcion: 'Títulos de las secciones de la página de cada ciudad.',
    icono: 'fa-city',
    placeholders: 'Usa {ciudad} para insertar el nombre de la ciudad.',
    campos: [
      { key: 'seccion_ciudad_disponibles_titulo', label: 'Título disponibles (usa {ciudad})' },
      { key: 'seccion_ciudad_valoradas_titulo', label: 'Título más valoradas (usa {ciudad})' },
      { key: 'seccion_ciudad_nuevas_titulo', label: 'Título nuevas (usa {ciudad})' },
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
  {
    titulo: 'Footer',
    descripcion: 'Los textos del pie de página que se muestran en todo el sitio.',
    icono: 'fa-shoe-prints',
    campos: [
      { key: 'footer_logo_1', label: 'Parte 1 del logo' },
      { key: 'footer_logo_2', label: 'Parte 2 del logo' },
      { key: 'footer_descripcion', label: 'Descripción bajo el logo', textarea: true },
      { key: 'footer_titulo_paginas', label: 'Título columna "Páginas"' },
      { key: 'footer_titulo_contacto', label: 'Título columna "Contacto"' },
      { key: 'footer_panel_escort', label: 'Enlace "Panel Escort"' },
      { key: 'footer_registro_usuario', label: 'Enlace "Registro Usuario"' },
      { key: 'footer_registro_escort', label: 'Enlace "Registro Escort"' },
      { key: 'footer_entrar_usuario', label: 'Enlace "Entrar como Usuario"' },
      { key: 'footer_entrar_escort', label: 'Enlace "Entrar como Escort"' },
      { key: 'footer_negocios', label: 'Enlace "Negocios"' },
      { key: 'footer_anuncia_negocio', label: 'Enlace "Anuncia tu negocio"' },
      { key: 'footer_email', label: 'Email de contacto (completo)' },
      { key: 'footer_url_twitter', label: 'URL Twitter (vacío = sin enlace)' },
      { key: 'footer_url_instagram', label: 'URL Instagram (vacío = sin enlace)' },
      { key: 'footer_url_telegram', label: 'URL Telegram (vacío = sin enlace)' },
      { key: 'footer_copy', label: 'Línea de copyright (pie)' },
      { key: 'footer_derechos', label: 'Texto de derechos reservados' },
      { key: 'footer_mayores18', label: 'Aviso mayores de 18 años' },
    ],
  },
  {
    titulo: 'Textos de tarjetas y stats',
    descripcion: 'Badges de las tarjetas de escorts, etiquetas de estadísticas y testimonios.',
    icono: 'fa-id-card',
    campos: [
      { key: 'badge_disponible', label: 'Badge "Disponible"' },
      { key: 'badge_gira', label: 'Badge "En gira"' },
      { key: 'badge_gira_ciudad', label: 'Badge gira con ciudad (usa {ciudad})' },
      { key: 'badge_nueva', label: 'Badge "Nueva"' },
      { key: 'badge_verificada', label: 'Badge "Verificada"' },
      { key: 'badge_vip', label: 'Badge "VIP"' },
      { key: 'badge_anios', label: 'Formato edad (usa {edad})' },
      { key: 'badge_valoracion', label: 'Formato valoración (usa {rating}, {reseñas})' },
      { key: 'stat_escorts_label', label: 'Stats: escorts activas' },
      { key: 'stat_ciudades_label', label: 'Stats: ciudades' },
      { key: 'stat_verificadas_label', label: 'Stats: perfiles verificados' },
      { key: 'stat_valoraciones_label', label: 'Stats: valoraciones' },
      { key: 'testimonios_titulo', label: 'Título de testimonios' },
    ],
  },
  {
    titulo: 'Modal de ciudades y estados vacíos',
    descripcion: 'Mensajes del modal de ciudades, contadores y estados sin resultados.',
    icono: 'fa-city',
    campos: [
      { key: 'modal_ciudades_titulo', label: 'Título del modal' },
      { key: 'modal_ciudades_placeholder', label: 'Placeholder del buscador' },
      { key: 'modal_ciudades_sin_resultados', label: 'Sin ciudades' },
      { key: 'modal_ciudades_no_encontrada', label: 'Ciudad no encontrada (usa {query})' },
      { key: 'modal_ciudades_contador', label: 'Contador de ciudades (usa {cantidad})' },
      { key: 'modal_ciudades_escorts_count', label: 'Contador de escorts por ciudad (usa {cantidad})' },
      { key: 'seccion_escorts_vacia', label: 'Secciones sin escorts' },
      { key: 'seccion_cargando_mas', label: 'Texto "Cargando más..."' },
      { key: 'contador_escorts', label: 'Contador de escorts (usa {cantidad})' },
      { key: 'contador_nuevas', label: 'Contador de nuevas (usa {cantidad})' },
      { key: 'contador_disponibles', label: 'Contador de disponibles (usa {cantidad})' },
    ],
  },
  {
    titulo: 'Página de ciudad',
    descripcion: 'Estados vacíos y contadores de la página de ciudad.',
    icono: 'fa-map-location-dot',
    campos: [
      { key: 'cta_badge', label: 'Badge del CTA final' },
      { key: 'ciudad_sin_resultados', label: 'Sin resultados de búsqueda' },
      { key: 'ciudad_sin_resultados_filtros', label: 'Complemento con filtros' },
      { key: 'ciudad_sin_escorts', label: 'Sin escorts en ciudad (usa {ciudad})' },
      { key: 'ciudad_contador_resultados', label: 'Contador de resultados (usa {cantidad})' },
      { key: 'ciudad_hint_filtros', label: 'Sugerencia con filtros' },
      { key: 'ciudad_hint_vuelve', label: 'Sugerencia sin publicaciones' },
      { key: 'ciudad_limpiar_filtros', label: 'Botón "Limpiar filtros"' },
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
  cta_titulo: '¿Eres escort o agencia?',
  cta_subtitulo: 'Publica tu perfil y llega a miles de clientes potenciales',
  cta_boton_1: 'Publicar Ahora',
  cta_boton_2: 'Ver Planes',
  site_nombre: 'Consexvip',
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
  footer_logo_1: 'CS',
  footer_logo_2: 'ESCORTS',
  footer_descripcion: 'Directorio Premium de Escorts en Chile',
  footer_titulo_paginas: 'Páginas',
  footer_titulo_contacto: 'Contacto',
  footer_panel_escort: 'Panel Escort',
  footer_registro_usuario: 'Registro Usuario',
  footer_registro_escort: 'Registro Escort',
  footer_entrar_usuario: 'Entrar como Usuario',
  footer_entrar_escort: 'Entrar como Escort',
  footer_negocios: 'Negocios',
  footer_anuncia_negocio: 'Anuncia tu negocio',
  footer_email: 'contacto@consexvip.cl',
  footer_url_twitter: '',
  footer_url_instagram: '',
  footer_url_telegram: '',
  footer_copy: '© 2026 Consexvip - Todos los derechos reservados.',
  footer_derechos: 'Todos los derechos reservados.',
  footer_mayores18: 'Solo para mayores de 18 años.',
  stat_escorts_label: 'Escorts activas',
  stat_ciudades_label: 'Ciudades',
  stat_verificadas_label: 'Perfiles verificados',
  stat_valoraciones_label: 'Valoraciones',
  testimonios_titulo: 'Opiniones de clientes',
  badge_disponible: 'Disponible',
  badge_gira: 'En gira',
  badge_gira_ciudad: 'En gira en {ciudad}',
  badge_nueva: 'Nueva',
  badge_verificada: 'Verificada',
  badge_vip: 'VIP',
  badge_anios: '{edad} años',
  badge_valoracion: 'Valoración: {rating} estrellas, {reseñas} reseñas',
  modal_ciudades_titulo: 'Selecciona una ciudad',
  modal_ciudades_placeholder: 'Escribe el nombre de la ciudad...',
  modal_ciudades_sin_resultados: 'No hay ciudades disponibles',
  modal_ciudades_no_encontrada: 'No se encontró "{query}"',
  modal_ciudades_contador: '{cantidad} ciudades',
  modal_ciudades_escorts_count: '{cantidad} escorts',
  seccion_escorts_vacia: 'No hay escorts disponibles',
  seccion_cargando_mas: 'Cargando más...',
  contador_escorts: '{cantidad} escorts',
  contador_nuevas: '{cantidad} nuevas',
  contador_disponibles: '{cantidad} disponibles',
  cta_badge: 'Publica tu anuncio',
  ciudad_sin_resultados: 'Sin resultados',
  ciudad_sin_resultados_filtros: 'con esos filtros',
  ciudad_sin_escorts: 'No hay escorts en {ciudad} por ahora',
  ciudad_contador_resultados: '{cantidad} resultados',
  ciudad_hint_filtros: 'Prueba con otros filtros o término de búsqueda',
  ciudad_hint_vuelve: 'Vuelve más tarde para ver nuevas publicaciones',
  ciudad_limpiar_filtros: 'Limpiar filtros',
};

const ALL_KEYS = GROUPS.flatMap(g => g.campos.map(c => c.key));

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function ContenidoData() {
  const [textos, setTextos] = useState<Textos | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(slugify(GROUPS[0].titulo));
  const [dirty, setDirty] = useState(false);

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

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

  useEffect(() => {
    const ratios: Record<string, number> = {};
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
        }
        let best = '';
        let bestRatio = 0;
        for (const group of GROUPS) {
          const id = slugify(group.titulo);
          const ratio = ratios[id] ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        }
        if (best) setActiveSection(best);
      },
      { rootMargin: '-120px 0px -50% 0px', threshold: [0, 0.1, 0.5, 1] }
    );
    for (const group of GROUPS) {
      const id = slugify(group.titulo);
      const el = document.getElementById(id);
      if (el) {
        ratios[id] = 0;
        observer.observe(el);
      }
    }
    return () => observer.disconnect();
  }, [loading]);

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
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Contenido del sitio</h1>
            <p className="text-admin-muted max-w-2xl">Edita los textos del sitio: inicio, secciones, ciudad, CTA, header, footer y tarjetas. Los metadatos SEO y Open Graph están en la sección SEO.</p>
          </div>
          <button
            type="submit"
            form="contenido-form"
            disabled={saving}
            className="hidden xl:inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
            Guardar cambios
          </button>
        </div>

        {saved && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-5 text-emerald-400 text-sm flex items-center gap-2">
            <i className="fas fa-check-circle"></i> Contenido guardado correctamente
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <form id="contenido-form" onSubmit={handleSubmit} className="space-y-5 min-w-0">
          {GROUPS.map(g => (
            <section key={g.titulo} id={slugify(g.titulo)} className="scroll-mt-24 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 md:p-6">
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
                    descripcion={textos?.[c.key]?.descripcion || '—'}
                    onChange={updateField}
                    onUpload={handleUpload}
                    uploading={uploadingKey === c.key}
                    loading={loading}
                  />
                ))}
              </div>
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

          <aside className="xl:sticky xl:top-24 space-y-4">
            <nav className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <i className="fas fa-list text-blue-400"></i> Secciones
              </h2>
              <div className="space-y-0.5 max-h-[55vh] overflow-y-auto pr-1">
                {GROUPS.map(g => {
                  const id = slugify(g.titulo);
                  return (
                    <button
                      key={g.titulo}
                      type="button"
                      onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-colors ${activeSection === id ? 'bg-blue-600/15 text-blue-300' : 'text-gray-400 hover:bg-[#252538] hover:text-white'}`}
                    >
                      <i className={`fas ${g.icono} w-4 text-center text-[11px]`}></i>
                      <span className="truncate">{g.titulo}</span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5">
              <button
                type="submit"
                form="contenido-form"
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
