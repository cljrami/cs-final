// src/components/escort/EscortAuthGuard.tsx
import { useState, useEffect } from 'react';
import { decodeEscortToken } from '../../lib/escortAuth';

interface Props {
  children: React.ReactNode;
}

export default function EscortAuthGuard({ children }: Props) {
  const [authState, setAuthState] = useState<'checking' | 'auth'>('checking');

  useEffect(() => {
    const token = localStorage.getItem('escort_token');
    const currentPath = window.location.pathname;
    const isOnboarding = currentPath.includes('/onboarding');
    const isLogin = currentPath.includes('/login');

    // Sin token → login
    if (!token) {
      if (!isLogin) {
        window.location.replace('/micuenta/login');
      }
      return;
    }

    try {
      const tokenData = decodeEscortToken(token);

      // Token inválido o expirado
      if (!tokenData || !tokenData.exp || tokenData.exp < Date.now() / 1000) {
        localStorage.removeItem('escort_token');
        localStorage.removeItem('escort_data');
        window.location.replace('/micuenta/login');
        return;
      }

      const primerLogin = tokenData.primer_login ?? 0;

      // Es primer login pero NO está en onboarding → ir a onboarding
      if (primerLogin === 1 && !isOnboarding) {
        window.location.replace('/micuenta/onboarding');
        return;
      }

      // NO es primer login pero está en onboarding → ir a perfil
      if (primerLogin === 0 && isOnboarding) {
        window.location.replace('/micuenta/perfil');
        return;
      }

      // Todo OK
      setAuthState('auth');
    } catch {
      localStorage.removeItem('escort_token');
      localStorage.removeItem('escort_data');
      window.location.replace('/micuenta/login');
    }
  }, []);

  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-2xl flex items-center justify-center">
            <i className="fas fa-circle-notch fa-spin text-red-500 text-2xl"></i>
          </div>
          <p className="text-gray-400">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}