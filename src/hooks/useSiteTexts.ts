import { useState, useEffect } from 'react';

let cache: Record<string, string> | null = null;
let inflight: Promise<void> | null = null;

export function useSiteTexts(): Record<string, string> {
  const [texts, setTexts] = useState<Record<string, string>>(cache || {});

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
          }
        })
        .catch(() => {})
        .finally(() => { inflight = null; });
    } else {
      inflight.then(() => setTexts(cache || {}));
    }
  }, []);

  return texts;
}
