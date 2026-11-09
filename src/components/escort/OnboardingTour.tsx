import { useEffect, useState } from 'react';
import { API_BASE, decodeEscortToken } from '../../lib/escortAuth';

export default function OnboardingTour() {
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('escort_token') : '';

  useEffect(() => {
    const t = localStorage.getItem('escort_token');
    const tokenData = t ? decodeEscortToken(t) : null;

    if (!t || !tokenData) {
      window.location.replace('/micuenta/login');
      return;
    }
    if (!tokenData.exp || tokenData.exp < Date.now() / 1000) {
      localStorage.removeItem('escort_token');
      localStorage.removeItem('escort_data');
      window.location.replace('/micuenta/login');
      return;
    }
    if (tokenData.primer_login === 0) {
      window.location.replace('/micuenta/mi-plan');
      return;
    }
    setTokenValid(true);
  }, []);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/onboarding-completed.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('escort_token', data.token);
      }
    } catch {}
    window.location.replace('/micuenta/mi-plan');
  };

  if (tokenValid === null) {
    return (
      <div style={{position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.9)', backdropFilter:'blur(8px)'}} className="flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-2xl flex items-center justify-center">
            <i className="fas fa-circle-notch fa-spin text-red-500 text-2xl"></i>
          </div>
          <p className="text-gray-400">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.9)', backdropFilter:'blur(8px)'}} className="flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl my-4">
        <div className="relative bg-[#13131a] border border-gray-800 rounded-3xl p-6 md:p-8 text-center shadow-2xl">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br from-red-500 to-red-600 opacity-10 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl">
              <i className="fas fa-shield-alt text-white text-3xl"></i>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">¡Bienvenida a tu panel!</h2>
            <p className="text-red-400 text-xs font-medium mb-3 uppercase tracking-wider">Empecemos</p>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-md mx-auto">
              Para publicar tu anuncio primero debes activar un plan en <strong className="text-white">Mi Plan</strong>. Una vez aprobado, podrás editar tu perfil, subir fotos, historias y usar todas las opciones del panel.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 mb-4">
                <i className="fas fa-exclamation-triangle"></i>
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6 text-left">
              {[
                { icon: 'fa-user-edit', color: 'text-orange-400', label: 'Editar perfil', desc: 'Datos, medidas, servicios' },
                { icon: 'fa-images', color: 'text-pink-400', label: 'Subir fotos', desc: 'Galería y portada' },
                { icon: 'fa-history', color: 'text-purple-400', label: 'Historias', desc: 'Contenido de 24 horas' },
                { icon: 'fa-crown', color: 'text-amber-400', label: 'VIP & Destacado', desc: 'Según tu plan' },
              ].map((c) => (
                <div key={c.label} className="bg-[#0a0a0f] border border-gray-800 rounded-xl p-3 flex items-center gap-3 opacity-70">
                  <div className="w-9 h-9 rounded-lg bg-[#1a1a24] flex items-center justify-center flex-shrink-0">
                    <i className={`fas ${c.icon} ${c.color} text-sm`}></i>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-gray-300 font-medium flex items-center gap-1.5">
                      {c.label}
                      <i className="fas fa-lock text-[10px] text-gray-600"></i>
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={finish}
              disabled={finishing}
              className={`w-full py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 ${finishing ? 'opacity-70 cursor-wait' : ''}`}
            >
              <i className={`fas ${finishing ? 'fa-circle-notch fa-spin' : 'fa-arrow-right'}`}></i>
              {finishing ? 'Finalizando...' : 'Continuar a Mi Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
