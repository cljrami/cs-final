// src/components/AgeGate.tsx
import { useState, useEffect } from 'react';
import BannerSlot from './BannerSlot';

interface AgeGateProps {
  alwaysShow?: boolean;
}

export default function AgeGate({ alwaysShow = false }: AgeGateProps) {
  const [checked, setChecked] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (alwaysShow) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('age_gate_accepted');
      if (accepted === '1') {
        setShow(false);
        return;
      }
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [alwaysShow]);

  useEffect(() => {
    if (!show) {
      document.body.style.overflow = '';
    }
  }, [show]);

  const salir = () => {
    window.location.href = 'https://google.com';
  };

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">

      <div className="w-full max-w-md bg-surface border border-edge rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
        </div>
        <h1 className="text-xl font-bold text-ink mb-2">Sitio para mayores de 18 años</h1>
        <p className="text-muted text-sm leading-relaxed mb-6">
          Este sitio contiene contenido para adultos y solo puede ser visto por personas mayores de 18 años.
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-ink text-sm font-medium cursor-pointer select-none hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="w-5 h-5 rounded-md border-2 border-red-400 bg-transparent text-red-500 focus:ring-2 focus:ring-red-400/30 accent-red-500 cursor-pointer"
            />
            Soy mayor de 18 años
          </label>

          <button
             onClick={() => {
               if (typeof window !== 'undefined') localStorage.setItem('age_gate_accepted', '1');
               setShow(false);
             }}
             disabled={!checked}
             className={`w-full py-3 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
               checked
                 ? 'bg-gradient-to-r from-red-500/30 to-amber-500/30 border border-red-500/30 text-ink hover:brightness-110'
                 : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
             }`}
           >
             <i className="fas fa-check text-red-400"></i>
             Continuar al sitio
           </button>

          <button
            onClick={salir}
            className="w-full py-3 bg-raised hover:bg-raised text-muted font-medium rounded-xl transition-colors"
          >
            Salir
          </button>
        </div>
        <div className="mt-4">
          <BannerSlot placement="selector_ciudad" />
        </div>
      </div>
    </div>
  );
}
