// src/components/ui/InfoModal.tsx
import { useState, useEffect } from 'react';

interface TutorialStepData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  demo?: string | null;
}

const steps: TutorialStepData[] = [
  {
    id: 'subir',
    title: 'Subir Fotos y Videos',
    subtitle: 'Tu contenido visual',
    description: 'Toca el botón + Subir o el + de abajo para seleccionar fotos y videos. En escritorio también funciona arrastrar archivos desde tu computadora. Límite según tu plan.',
    icon: 'fa-plus',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'ordenar',
    title: 'Ordenar Galería',
    subtitle: 'Organize como quiere',
    description: 'Arrastra el icono ⋮⋮ (grip vertical) en la esquina superior izquierda de cada foto para reordenar. El orden se guarda automáticamente.',
    icon: 'fa-grip-vertical',
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'portada',
    title: 'Foto de Portada',
    subtitle: 'Su foto principal',
    description: 'Pulsa la estrella en cualquier foto para establecerla como portada. Aparecerá con un anillo amarillo y se usará como imagen principal de tu perfil.',
    icon: 'fa-star',
    color: 'from-yellow-500 to-yellow-600',
  },
  {
    id: 'eliminar',
    title: 'Eliminar Fotos',
    subtitle: 'Limpieza rápida',
    description: 'Pulsa el icono de papelera en cualquier foto para borrarla permanentemente. Confirma en el cuadro que aparece.',
    icon: 'fa-trash-alt',
    color: 'from-red-500 to-red-600',
  },
  {
    id: 'ver',
    title: 'Ver Fotos',
    subtitle: 'A pantalla completa',
    description: 'Toca cualquier foto para abrirla a pantalla completa. Desliza para navegar entre todas tus imágenes.',
    icon: 'fa-expand',
    color: 'from-green-500 to-green-600',
  },
];

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxFotos?: number;
}

export default function InfoModal({ isOpen, onClose, maxFotos = 5 }: InfoModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setDontShowAgain(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem('gallery_tutorial_seen', 'true');
    }
    onClose();
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      localStorage.setItem('gallery_tutorial_seen', 'true');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4">
        {/* Close button */}
        <button
          onClick={handleSkip}
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
                  {[1, 2, 3, 4].map((i) => (
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
                    onClick={handleConfirm}
                    className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white rounded-xl transition-all duration-300 shadow-lg shadow-green-500/20 flex items-center gap-2 text-sm"
                  >
                    <i className="fas fa-check"></i>
                    ¡Entendido!
                  </button>
                )}
              </div>

              {currentStep < steps.length - 1 && (
                <button
                  onClick={handleSkip}
                  className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                >
                  Saltar tour
                </button>
              )}
            </div>

            {/* Don't show again */}
            <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-center gap-2">
              <input
                type="checkbox"
                id="dont-show-again"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded bg-[#2a2a3e] border border-[#353550] text-red-500 focus:ring-red-500/50"
              />
              <label htmlFor="dont-show-again" className="text-xs text-gray-400 cursor-pointer">
                No volver a mostrar
              </label>
            </div>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-4">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-6 bg-red-500'
                  : i < currentStep
                  ? 'w-2 bg-red-500/50'
                  : 'w-2 bg-gray-600 hover:bg-gray-500'
              }`}
            ></button>
          ))}
        </div>
      </div>
    </div>
  );
}
