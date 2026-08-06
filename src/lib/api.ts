import type { Escort, Ciudad, ApiResponse, Pagination, SearchFilters, Filters } from '../types/escort';

const API_BASE = '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  escorts: {
    listado: (params?: { page?: number; limit?: number } & Filters & { q?: string }): Promise<ApiResponse<Escort[]>> => {
      const search = new URLSearchParams();
      if (params?.page) search.set('page', String(params.page));
      if (params?.limit) search.set('limit', String(params.limit));
      if (params?.q) search.set('q', params.q);
      if (params?.ciudad) search.set('ciudad', params.ciudad);
      if (params?.vip) search.set('vip', '1');
      if (params?.verificado) search.set('verificado', '1');
      if (params?.edad_min) search.set('edad_min', params.edad_min);
      if (params?.edad_max) search.set('edad_max', params.edad_max);
      if (params?.estado) search.set('estado', params.estado);
      return fetchJson(`${API_BASE}/escorts/listado.php?${search}`);
    },

    porCiudad: (ciudad: string, params?: { page?: number; limit?: number } & Filters & { q?: string }): Promise<ApiResponse<Escort[]>> => {
      const search = new URLSearchParams({ ciudad });
      if (params?.page) search.set('page', String(params.page));
      if (params?.limit) search.set('limit', String(params.limit));
      if (params?.q) search.set('q', params.q);
      if (params?.vip) search.set('vip', '1');
      if (params?.verificado) search.set('verificado', '1');
      if (params?.edad_min) search.set('edad_min', params.edad_min);
      if (params?.edad_max) search.set('edad_max', params.edad_max);
      return fetchJson(`${API_BASE}/escorts/por-ciudad.php?${search}`);
    },

    perfil: (id: number): Promise<ApiResponse<{ escort: Escort }>> => {
      return fetchJson(`${API_BASE}/escort.php?id=${id}`);
    },

    sugerencias: (q: string): Promise<ApiResponse<{ ciudades: string[]; escorts: { id: number; nombre: string }[] }>> => {
      return fetchJson(`${API_BASE}/escorts/sugerencias.php?q=${encodeURIComponent(q)}`);
    },

    destacadas: (limit = 10): Promise<ApiResponse<Escort[]>> => {
      return fetchJson(`${API_BASE}/escorts/destacadas.php?limit=${limit}`);
    },

    historial: (escortId: number): Promise<ApiResponse<{ id: number; url: string; tipo: string; expira_en: string }[]>> => {
      return fetchJson(`${API_BASE}/escorts/historias.php?escort_id=${escortId}`);
    },
  },

  ciudades: {
    listado: (): Promise<ApiResponse<Ciudad[]>> => {
      return fetchJson(`${API_BASE}/ciudades/listado.php`);
    },

    porCiudad: (nombre: string): Promise<ApiResponse<Ciudad>> => {
      return fetchJson(`${API_BASE}/ciudades.php?nombre=${encodeURIComponent(nombre)}`);
    },
  },

  auth: {
    login: (email: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> => {
      return fetchJson(`${API_BASE}/auth/login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    },

    register: (data: any): Promise<ApiResponse<{ token: string; user: any }>> => {
      return fetchJson(`${API_BASE}/auth/register.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },

    me: (token: string): Promise<ApiResponse<{ user: any }>> => {
      return fetchJson(`${API_BASE}/auth/me.php`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  },
};

export function buildUrl(path: string, params: Record<string, any> = ''): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  });
  return `${API_BASE}${path}?${search}`;
}