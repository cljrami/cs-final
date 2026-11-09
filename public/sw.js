/* public/sw.js
 * Service worker de Consexvip.
 * Objetivo: que el sitio se pueda instalar como app y abra rápido.
 *
 * Estrategias:
 *  - HTML / API / panel admin  → network-first (nunca contenido viejo).
 *  - Assets con hash (/_astro/) → cache-first (son inmutables).
 *  - Imágenes (uploads)        → stale-while-revalidate.
 *  - Navegación offline        → página offline.html.
 *
 * IMPORTANTE: el admin y el panel de escort NUNCA se cachean.
 */

const VERSION = 'v1';
const CACHE_STATIC = `consexvip-static-${VERSION}`;
const CACHE_PAGES = `consexvip-pages-${VERSION}`;
const CACHE_IMGS = `consexvip-imgs-${VERSION}`;

const OFFLINE_URL = '/offline.html';

// Rutas que jamás se cachean (contenido privado o dinámico)
const NUNCA_CACHE = [
  '/admin',
  '/micuenta',
  '/mi-cuenta',
  '/api/',
  '/unirse',
  '/ingresar',
  '/login',
  '/recuperar',
  '/recuperar-clave',
  '/micuenta/login',
  '/micuenta/registro',
];

const PRECACHE = [
  '/',
  '/offline.html',
  '/favicon.ico',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/site.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('consexvip-') && !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function esPrivado(url) {
  const path = url.pathname;
  return NUNCA_CACHE.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // solo mismo origen
  if (esPrivado(url)) return;                                // nada privado se cachea

  // Navegación (HTML): network-first con fallback offline
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE_PAGES);
          cache.put(req, res.clone());
          return res;
        } catch (e) {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
      })()
    );
    return;
  }

  // Assets con hash: cache-first (inmutables)
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') {
          const cache = await caches.open(CACHE_STATIC);
          cache.put(req, res.clone());
        }
        return res;
      })()
    );
    return;
  }

  // Imágenes: stale-while-revalidate
  if (/\.(?:jpg|jpeg|png|webp|gif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_IMGS);
        const cached = await cache.match(req);
        const fetching = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fetching;
      })()
    );
  }
});
