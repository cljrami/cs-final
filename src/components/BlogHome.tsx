import { useState, useEffect } from 'react';
import { useSiteTexts } from '../hooks/useSiteTexts';

interface Articulo {
  id: number;
  titulo: string;
  slug: string;
  imagen: string;
  extracto: string;
  autor: string;
  meta_titulo: string;
  meta_descripcion: string;
  url_externa: string;
  published_at: string;
  categoria_nombre: string;
}

interface Props {
  initialArticles?: Articulo[] | null;
  initialTexts?: Record<string, string> | null;
}

export default function BlogHome({ initialArticles = null, initialTexts = null }: Props) {
  const [articulos, setArticulos] = useState<Articulo[]>(initialArticles ?? []);
  const [loading, setLoading] = useState(!initialArticles);
  const texts = useSiteTexts(initialTexts);

  useEffect(() => {
    fetch('/api/blog/articulos.php?destacados=1&limit=3')
      .then(r => r.json())
      .then(d => { if (d.success) setArticulos(d.articulos || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && articulos.length === 0) return null;

  const titulo = texts?.seccion_blog_titulo || 'Artículos & Consejos';

  return (
    <section className="py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-ink font-bold text-lg flex items-center gap-2">
          <i className="fas fa-newspaper text-amber-400"></i> {titulo}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface border border-white/5 overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-raised"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded-full bg-raised"></div>
                  <div className="h-3 w-full rounded-full bg-raised"></div>
                  <div className="h-3 w-1/2 rounded-full bg-raised"></div>
                </div>
              </div>
            ))
          : articulos.map((a) => {
              const internalUrl = `/blog/${a.slug}`;
              const hasExternal = a.url_externa && /^https?:\/\//i.test(a.url_externa);
              const tituloArt = a.meta_titulo || a.titulo;
              const desc = a.extracto || a.meta_descripcion || '';
              return (
                <article
                  key={a.id}
                  className="group rounded-xl bg-surface border border-white/5 hover:border-red-500/30 overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-red-500/5"
                >
                  <a href={internalUrl} className="block">
                    <div className="aspect-[16/9] overflow-hidden bg-raised">
                      {a.imagen ? (
                      <img src={a.imagen} alt={tituloArt} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-raised">
                          <i className="fas fa-newspaper text-3xl text-muted"></i>
                        </div>
                      )}
                    </div>
                    <div className="p-4 pb-0">
                      {a.categoria_nombre && (
                        <span className="text-xs font-medium text-red-400 uppercase tracking-wider">{a.categoria_nombre}</span>
                      )}
                      <div className="mt-1 font-semibold text-ink text-base group-hover:text-red-400 transition-colors line-clamp-2">{tituloArt}</div>
                      {desc && <p className="mt-1.5 text-sm text-muted line-clamp-2">{desc}</p>}
                    </div>
                  </a>
                  <div className="px-4 pb-4 pt-3 inline-flex items-center justify-between w-full text-sm font-medium text-red-500">
                    <a href={internalUrl} className="flex items-center gap-1.5 group-hover:gap-2.5 transition-all text-red-400">
                      Leer más <i className="fas fa-arrow-right text-xs"></i>
                    </a>
                    {hasExternal && (
                      <a
                        href={a.url_externa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:text-amber-300"
                        title="Ir al sitio externo"
                      >
                        <i className="fas fa-up-right-from-square"></i>
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
      </div>
    </section>
  );
}