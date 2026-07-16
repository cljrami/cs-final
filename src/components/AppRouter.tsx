// src/AppRouter.tsx
import { useState, useEffect, lazy, Suspense } from 'react';

const EscortProfile = lazy(() => import('./EscortProfile'));

export default function AppRouter() {
  const [view, setView] = useState<'loading' | 'home' | 'profile'>('loading');

  useEffect(() => {
    const path = window.location.pathname;
    // Detectar rutas como /8, /123, /8/ (solo números)
    const isEscortProfile = /^\/\d+\/?$/.test(path);

    if (isEscortProfile) {
      setView('profile');
    } else {
      setView('home');
    }
  }, []);

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (view === 'profile') {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-400">Cargando perfil...</p>
          </div>
        </div>
      }>
        <EscortProfile />
      </Suspense>
    );
  }

  // Fallback: redirigir a home de Astro
  window.location.href = '/';
  return null;
}