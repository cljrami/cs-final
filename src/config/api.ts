// ============================================
// CONFIGURACION API - KIMI
// ============================================

const isDev = import.meta.env.DEV;

export const API_BASE_URL = isDev 
  ? 'http://localhost:8000/api'  // XAMPP/WAMP local
  : '/api';                       // Producción: /public_html/api/

export async function apiFetch(endpoint: string, options?: RequestInit) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}