// src/lib/fileUrl.ts
// Construye URLs de archivos privados (comprobantes, verificaciones) pasando
// por serve-upload.php con token, ya que <img>/<a> no pueden mandar headers.
// Los archivos públicos (fotos, historias, avatares) pasan intactos.

const PRIVADOS = ['/uploads/comprobantes/', '/uploads/verificaciones/'];

export function fileUrl(url: string | null | undefined, token: string | null | undefined): string {
  if (!url) return '';
  let u = url.trim();

  // Normalizar rutas legacy guardadas con o sin slash inicial.
  if (!u.startsWith('/api/serve-upload.php')) {
    const privatePath = u.match(/(?:^|\/)(uploads\/(?:comprobantes|verificaciones)\/.*)$/);
    if (privatePath) {
      u = '/api/serve-upload.php?path=/' + privatePath[1];
    }
  }

  // Solo las rutas privadas llevan token
  const esPrivada = PRIVADOS.some((p) => u.includes(p));
  if (esPrivada && token && !/[?&]token=/.test(u)) {
    u += (u.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
  }
  return u;
}

export function escortFileUrl(url: string | null | undefined): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : null;
  return fileUrl(url, token);
}

export function adminFileUrl(url: string | null | undefined): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  return fileUrl(url, token);
}
