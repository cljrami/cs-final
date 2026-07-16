// src/lib/escortAuth.ts

const API_BASE = '/api/escort';

export function getEscortToken(): string {
  return localStorage.getItem('escort_token') || '';
}

export function getEscortHeaders(): Record<string, string> {
  const token = getEscortToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

export function decodeEscortToken(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  const token = getEscortToken();
  if (!token) return false;

  const data = decodeEscortToken(token);
  if (!data || typeof data.exp !== 'number') return false;
  return data.exp > Date.now() / 1000;
}

export function logout(): void {
  localStorage.removeItem('escort_token');
  localStorage.removeItem('escort_data');
  window.location.href = '/micuenta/login';
}

export function getEscortData(): Record<string, any> | null {
  const data = localStorage.getItem('escort_data');
  return data ? JSON.parse(data) : null;
}

export { API_BASE };