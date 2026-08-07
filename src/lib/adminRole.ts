// src/lib/adminRole.ts
// Lee el rol del admin logueado del localStorage (admin_user = { nombre, rol })
export type AdminRol = 'moderador' | 'admin' | 'superadmin';

export function getAdminRol(): AdminRol | null {
  try {
    const raw = localStorage.getItem('admin_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    const rol = (u?.rol || '').toLowerCase();
    if (rol === 'moderador') return 'moderador';
    if (rol === 'superadmin') return 'superadmin';
    if (rol === 'admin') return 'admin';
    return null;
  } catch {
    return null;
  }
}

export function esAdminOSuperior(): boolean {
  const r = getAdminRol();
  return r === 'admin' || r === 'superadmin';
}

export function esModerador(): boolean {
  return getAdminRol() === 'moderador';
}
