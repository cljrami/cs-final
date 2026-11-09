import { useEffect, useState } from 'react';

interface Ciudad {
  id: number;
  nombre: string;
  slug: string;
}

export default function CiudadesHub() {
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/ciudades/listado.php', { signal: controller.signal });
        const text = await res.text();
        const cleaned = text.startsWith('\uFEFF') ? text.slice(1) : text;
        const data = JSON.parse(cleaned);
        if (data.success && Array.isArray(data.data)) {
          const slugify = (nombre: string) => nombre
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          const list = data.data
            .filter((c: any) => c && c.nombre)
            .map((c: any) => ({ id: c.id, nombre: c.nombre, slug: c.slug || slugify(c.nombre) }))
            .sort((a: Ciudad, b: Ciudad) => a.nombre.localeCompare(b.nombre, 'es'));
          setCiudades(list);
        } else {
          setError('No se pudieron cargar las ciudades');
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-surface/50 border border-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-muted">{error}</p>;
  }

  if (ciudades.length === 0) {
    return <p className="text-muted">No hay ciudades disponibles por el momento.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {ciudades.map((c) => (
          <a
            key={c.id}
            href={`/escorts-${c.slug}`}
            className="group flex items-center justify-between gap-3 bg-surface border border-white/5 hover:border-red-500/30 rounded-xl px-4 py-4 transition-colors"
          >
            <span className="flex items-center gap-2 text-ink font-medium text-sm">
              <i className="fas fa-map-marker-alt text-red-500/80 text-xs" />
              {c.nombre}
            </span>
            <i className="fas fa-chevron-right text-gray-600 group-hover:text-red-400 text-xs transition-colors" />
          </a>
        ))}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Ciudades con escorts en Chile',
            numberOfItems: ciudades.length,
            itemListElement: ciudades.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: `Escorts en ${c.nombre}`,
              url: `https://www.consexvip.cl/escorts-${c.slug}`,
            })),
          }),
        }}
      />
    </>
  );
}
