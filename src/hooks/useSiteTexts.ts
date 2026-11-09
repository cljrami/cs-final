import { useState, useEffect } from 'react';

// Los textos se obtienen SIEMPRE del servidor (/api/config/site.php) para que
// cualquier cambio desde el Admin se aplique al recargar, sin rebuild.
// Mientras no llegan, los componentes muestran un skeleton en el dato dinámico.
let cache: Record<string, string> | null = null;
let inflight: Promise<void> | null = null;

export function useSiteTexts(
  initialTexts?: Record<string, string> | null
): Record<string, string> | null {
  // No leer `cache` en el primer render: en SSR siempre es null, pero en el
  // cliente puede haberse llenado por otro island (client:load/visible). Eso
  // provoca un hydration mismatch (#418). La caché se aplica en useEffect.
  const [texts, setTexts] = useState<Record<string, string> | null>(initialTexts ?? null);

  useEffect(() => {
    if (cache) {
      setTexts(cache);
      return;
    }
    if (!inflight) {
      inflight = fetch('/api/config/site.php')
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            cache = d.data;
            setTexts(d.data);
          } else {
            setTexts({});
          }
        })
        .catch(() => setTexts({}))
        .finally(() => { inflight = null; });
    } else {
      inflight.then(() => setTexts(cache || {}));
    }
  }, []);

  return texts;
}