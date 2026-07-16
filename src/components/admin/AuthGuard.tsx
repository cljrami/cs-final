// src/components/admin/AuthGuard.tsx
import { useEffect, useState, useRef } from 'react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const hasRedirected = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    
    if (!token) {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        window.location.href = '/admin/login';
      }
      return;
    }

    let cancelled = false;

    fetch('/api/admin/verify-token.php', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(async r => {
      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        // Respuesta no válida: tratar como no autorizado (no asumir válido)
        return { success: false, valid: false };
      }
    })
    .then(data => {
      if (cancelled) return;

      const isValid = data.valid === true || data.success === true;

      if (isValid) {
        setAuth('authenticated');
      } else {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        setAuth('unauthenticated');
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          window.location.href = '/admin/login';
        }
      }
    })
    .catch(() => {
      if (cancelled) return;
      // Ante error de red NO concedemos acceso: mostramos estado no autenticado.
      setAuth('unauthenticated');
    });

    return () => { cancelled = true; };
  }, []);

  if (auth === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <i className="fas fa-circle-notch fa-spin text-yellow-400 text-3xl"></i>
          <p className="text-gray-400 text-sm">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (auth === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <i className="fas fa-triangle-exclamation text-red-400 text-3xl"></i>
          <p className="text-gray-400 text-sm">No se pudo verificar la sesión.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}