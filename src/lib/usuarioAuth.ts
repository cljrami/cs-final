export const API_BASE = '/api/usuarios';

export function getUsuarioToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('usuario_token');
}

export function setUsuarioToken(token: string): void {
  localStorage.setItem('usuario_token', token);
}

export function getUsuarioData(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('usuario_data');
  return raw ? JSON.parse(raw) : null;
}

export function setUsuarioData(data: Record<string, any>): void {
  localStorage.setItem('usuario_data', JSON.stringify(data));
}

export function isUsuarioLoggedIn(): boolean {
  return !!getUsuarioToken();
}

export function logoutUsuario(): void {
  localStorage.removeItem('usuario_token');
  localStorage.removeItem('usuario_data');
  window.location.href = '/ingresar';
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getUsuarioToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

export function requireAuth(): void {
  if (!isUsuarioLoggedIn()) {
    window.location.href = '/ingresar';
  }
}
