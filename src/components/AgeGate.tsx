// src/components/AgeGate.tsx
import { useState, useEffect } from 'react';

const AGE_KEY = 'age_verified';

export default function AgeGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let verified = false;
    try {
      verified = localStorage.getItem(AGE_KEY) === '1';
    } catch {}
    if (!verified) {
      setShow(true);
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const confirmar = () => {
    try { localStorage.setItem(AGE_KEY, '1'); } catch {}
    setShow(false);
    document.body.style.overflow = '';
  };

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
          <button
            onClick={confirmar}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
          >
            Sí, soy mayor de 18 años
          </button>
          <button
            onClick={salir}
            className="w-full py-3 bg-raised hover:bg-raised text-muted font-medium rounded-xl transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
