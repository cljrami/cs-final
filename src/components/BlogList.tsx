import { useEffect, useState } from 'react';

interface Article {
  id: number;
  slug: string;
  titulo: string;
  extracto?: string;
  imagen?: string;
  autor?: string;
  published_at?: string;
}

export default function BlogList() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/blog-list.php');
        const data = await res.json();
        if (active && data?.success) {
          setArticles(data.data ?? []);
        } else if (active) {
          setError('No se pudieron cargar los artículos');
        }
      } catch {
        if (active) setError('Error de conexión');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-80 bg-surface/50 border border-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-12 text-muted">{error}</div>;
  }

  if (articles.length === 0) {
    return <div className="text-center py-12 text-muted">No hay artículos publicados aún.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {articles.map((a) => (
        <a key={a.id} href={`/blog/${a.slug}`} className="group rounded-2xl bg-surface border border-white/5 overflow-hidden hover:border-red-500/30 transition-all shadow-lg shadow-black/5 hover:shadow-red-500/10">
          {a.imagen ? (
            <div className="aspect-video overflow-hidden bg-raised">
              <img src={a.imagen} alt={a.titulo} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>
          ) : (
            <div className="aspect-video bg-raised flex items-center justify-center">
              <i className="fas fa-newspaper text-muted text-3xl" />
            </div>
          )}
          <div className="p-5">
            <h2 className="text-lg font-bold text-ink leading-snug group-hover:text-red-400 transition-colors line-clamp-2">{a.titulo}</h2>
            <p className="text-sm text-muted mt-2 line-clamp-2">{a.extracto || ''}</p>
            <div className="mt-3 text-xs text-gray-500">{a.autor || 'Anónimo'} · {a.published_at ? a.published_at.split(' ')[0] : ''}</div>
          </div>
        </a>
      ))}
    </div>
  );
}
