// src/components/escort/OnboardingTour.tsx
import { useState, useEffect } from 'react';
import { API_BASE, decodeEscortToken } from '../../lib/escortAuth';

const steps = [
  {
    id: 'welcome',
    title: '¡Bienvenida a CS Panel!',
    subtitle: 'Tu espacio para gestionar tu perfil',
    description: 'Aquí podrás editar tu ficha, subir fotos, crear historias y mucho más. Te mostramos todo en un recorrido rápido.',
    icon: 'fa-shield-alt',
    color: 'from-red-500 to-red-600',
    demo: null,
  },
  {
    id: 'perfil',
    title: 'Edita tu Perfil',
    subtitle: 'Tu carta de presentación',
    description: 'Completa todos tus datos: nombre artístico, medidas, servicios, ciudades donde atiendes y más. Un perfil completo recibe hasta 3x más visitas.',
    icon: 'fa-user-edit',
    color: 'from-orange-500 to-red-500',
    demo: null,
  },
  {
    id: 'fotos',
    title: 'Galería de Fotos',
    subtitle: 'Arrastra y ordena',
    description: 'Sube tus mejores fotos, arrástralas para ordenarlas como quieras, selecciona una como portada y elimina las que no te gusten.',
    icon: 'fa-images',
    color: 'from-pink-500 to-red-500',
    demo: 'fotos',
  },
  {
    id: 'historias',
    title: 'Historias',
    subtitle: 'Contenido temporal',
    description: 'Sube fotos o videos que desaparecen en 24h. Es la forma perfecta de mostrar tu día a día y mantener a tus clientes enganchados.',
    icon: 'fa-history',
    color: 'from-purple-500 to-pink-500',
    demo: 'historias',
  },
  {
    id: 'vip',
    title: 'Verificación & VIP',
    subtitle: 'Destaca sobre el resto',
    description: 'Solicita tu verificación para mostrar el badge de confianza. Activa VIP para aparecer primero en los resultados y acceder a funciones exclusivas.',
    icon: 'fa-crown',
    color: 'from-yellow-500 to-orange-500',
    demo: null,
  },
  {
    id: 'ready',
    title: '¡Todo listo!',
    subtitle: 'Comienza a brillar',
    description: 'Tu panel está configurado. Edita tu perfil ahora para activar tu anuncio y empezar a recibir clientes.',
    icon: 'fa-rocket',
    color: 'from-green-500 to-emerald-500',
    demo: null,
  },
];

// Helper seguro para decodificar token
function decodeToken(token: string | null): any {
  if (!token) return null;
  return decodeEscortToken(token);
}

export default function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Verificar token al montar el componente
  useEffect(() => {
    const token = localStorage.getItem('escort_token');
    const tokenData = decodeToken(token);
    
    if (!token || !tokenData) {
      window.location.replace('/micuenta/login');
      return;
    }

    // Verificar expiración
    if (!tokenData.exp || tokenData.exp < Date.now() / 1000) {
      localStorage.removeItem('escort_token');
      localStorage.removeItem('escort_data');
      window.location.replace('/micuenta/login');
      return;
    }

    // Si el token ya tiene primer_login = 0, no debería estar aquí
    if (tokenData.primer_login === 0) {
      window.location.replace('/micuenta/perfil');
      return;
    }

    setTokenValid(true);
  }, []);

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const goToStep = (newStep: number) => {
    if (isAnimating || newStep < 0 || newStep >= steps.length) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(newStep);
      setIsAnimating(false);
    }, 300);
  };

  const finish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    const token = localStorage.getItem('escort_token');

    if (!token) {
      window.location.replace('/micuenta/login');
      return;
    }

    // El token está firmado en el servidor: pedimos el nuevo token a la API.
    try {
      const response = await fetch(`${API_BASE}/onboarding-completed.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('escort_token', data.token);
      }
    } catch {
      // Si falla la red, redirigimos igual; el guard revalidará luego.
    }

    window.location.replace('/micuenta/perfil');
  };

  if (tokenValid === null) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4">
        {/* Close button */}
        <button
          onClick={finish}
          className="absolute -top-3 -right-3 z-20 w-10 h-10 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-xl"
        >
          <i className="fas fa-times"></i>
        </button>

        {/* Glow */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br ${step.color} opacity-10 rounded-full blur-[100px] pointer-events-none`}></div>

        <div className="relative bg-[#13131a] border border-gray-800 rounded-3xl p-8 text-center shadow-2xl">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Paso {currentStep + 1} de {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          <div className={`transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            {/* Icon */}
            <div className={`w-20 h-20 mx-auto mb-6 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center shadow-xl`}>
              <i className={`fas ${step.icon} text-white text-3xl`}></i>
            </div>

            {/* Content */}
            <h2 className="text-2xl font-bold text-white mb-1">{step.title}</h2>
            <p className="text-red-400 text-xs font-medium mb-3 uppercase tracking-wider">{step.subtitle}</p>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-sm mx-auto">{step.description}</p>

            {/* Demo visuals */}
            {step.demo === 'fotos' && (
              <div className="bg-[#0a0a0f] rounded-xl p-4 mb-6 border border-gray-800">
                <div className="flex gap-2 justify-center mb-3">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className={`w-14 h-18 rounded-lg ${i === 1 ? 'bg-red-500/20 border-2 border-red-500 relative' : 'bg-gray-800'} flex items-center justify-center`}>
                      <i className="fas fa-image text-gray-600 text-lg"></i>
                      {i === 1 && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <i className="fas fa-star text-white text-[10px]"></i>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-gray-500 text-xs">Arrastra para reordenar • Click en ⭐ para portada</p>
              </div>
            )}

            {step.demo === 'historias' && (
              <div className="bg-[#0a0a0f] rounded-xl p-4 mb-6 border border-gray-800 flex justify-center">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-0.5">
                    <div className="w-full h-full rounded-full bg-[#0a0a0f] flex items-center justify-center">
                      <i className="fas fa-plus text-gray-400"></i>
                    </div>
                  </div>
                  {[1,2,3].map((i) => (
                    <div key={i} className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center border-2 border-gray-700">
                      <i className="fas fa-image text-gray-600"></i>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <button
                    onClick={() => goToStep(currentStep - 1)}
                    className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all duration-300 flex items-center gap-2 text-sm"
                  >
                    <i className="fas fa-arrow-left"></i>
                    Anterior
                  </button>
                )}

                {currentStep < steps.length - 1 ? (
                  <button
                    onClick={() => goToStep(currentStep + 1)}
                    className={`px-6 py-2.5 bg-gradient-to-r ${step.color} hover:opacity-90 text-white rounded-xl transition-all duration-300 shadow-lg flex items-center gap-2 text-sm`}
                  >
                    Siguiente
                    <i className="fas fa-arrow-right"></i>
                  </button>
                ) : (
                  <button
                    onClick={finish}
                    disabled={isFinishing}
                    className={`px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white rounded-xl transition-all duration-300 shadow-lg shadow-green-500/20 flex items-center gap-2 text-sm ${isFinishing ? 'opacity-70 cursor-wait' : 'animate-pulse'}`}
                  >
                    <i className={`fas ${isFinishing ? 'fa-spinner fa-spin' : 'fa-rocket'}`}></i>
                    {isFinishing ? 'Guardando...' : '¡Comenzar!'}
                  </button>
                )}
              </div>

              {currentStep < steps.length - 1 && (
                <button
                  onClick={finish}
                  className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                >
                  Saltar tour
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-4">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-red-500' : i < currentStep ? 'w-2 bg-red-500/50' : 'w-2 bg-gray-600 hover:bg-gray-500'}`}
            ></button>
          ))}
        </div>
      </div>
    </div>
  );
}