// src/components/escort/GuidedTour.tsx
// Tour guiado "magnifier" sobre el panel real. Se muestra solo la primera vez
// (columna escorts.tour_completado). En escritorio la tarjeta se ancla junto al
// elemento resaltado; en móvil se abre el drawer del sidebar para iluminar sus
// ítems y la tarjeta se fija como bottom-sheet (no tapa el elemento).

import { useState, useEffect, useCallback } from 'react';

interface Step {
  selector: string;
  title: string;
  text: string;
  icon: string;
  color: string;
  drawer?: boolean; // el objetivo vive en el drawer del sidebar (móvil)
}

const STEPS: Step[] = [
  {
    selector: 'aside a[href="/micuenta/resumen"]',
    title: 'Resumen',
    text: 'Aquí empieza tu panel: ves el estado de tu publicación, tu plan y lo esencial de tu cuenta.',
    icon: 'fa-chart-line',
    color: 'text-red-400',
    drawer: true,
  },
  {
    selector: 'aside a[href="/micuenta/perfil"]',
    title: 'Editar Perfil',
    text: 'Completa o actualiza tus datos, medidas, servicios y descripciones. Tu anuncio se construye aquí.',
    icon: 'fa-user-edit',
    color: 'text-orange-400',
    drawer: true,
  },
  {
    selector: 'aside a[href="/micuenta/fotos"]',
    title: 'Gestionar Fotos',
    text: 'Sube tu galería y elige la portada. Las fotos privadas y de verificación también viven aquí.',
    icon: 'fa-images',
    color: 'text-pink-400',
    drawer: true,
  },
  {
    selector: 'aside a[href="/micuenta/mi-plan"]',
    title: 'Mi Plan',
    text: 'Elige tu plan, revisa días restantes, pausas y adjunta tu comprobante de pago.',
    icon: 'fa-credit-card',
    color: 'text-amber-400',
    drawer: true,
  },
  {
    selector: 'aside a[href="/micuenta/verificacion"]',
    title: 'Verificación',
    text: 'Verifícate para ganar la insignia de confianza. Necesitarás una selfie y tu documento.',
    icon: 'fa-shield-alt',
    color: 'text-blue-400',
    drawer: true,
  },
  {
    selector: 'aside a[href="/micuenta/vip"]',
    title: 'VIP',
    text: 'Solicita VIP y extras para destacar tu anuncio frente a otros perfiles.',
    icon: 'fa-crown',
    color: 'text-amber-300',
    drawer: true,
  },
  {
    selector: 'header',
    title: 'Tu cabecera',
    text: 'El título te indica en qué sección estás. Desde la campana recibirás los avisos importantes.',
    icon: 'fa-map-pin',
    color: 'text-green-400',
  },
  {
    selector: 'button[aria-label="Notificaciones"]',
    title: 'Notificaciones',
    text: 'Aprobación de tu plan, verificación, nuevas valoraciones: todo llega aquí.',
    icon: 'fa-bell',
    color: 'text-red-400',
  },
  {
    selector: 'header a[aria-label="Ver sitio"]',
    title: 'Ver tu perfil público',
    text: 'Este botón abre tu anuncio tal como lo ven los clientes en la web.',
    icon: 'fa-external-link-alt',
    color: 'text-purple-400',
  },
];

const lgQuery = '(min-width: 1024px)';

export default function GuidedTour() {
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [targetVisible, setTargetVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [saving, setSaving] = useState(false);

  const openDrawer = useCallback((open: boolean) => {
    window.dispatchEvent(new CustomEvent('escort-tour-drawer', { detail: { open } }));
    setDrawerOpen(open);
  }, []);

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const measure = useCallback(async (step: Step) => {
    const mobile = !isDesktop;

    if (mobile) {
      if (step.drawer && !drawerOpen) {
        openDrawer(true);
        await wait(350);
      } else if (!step.drawer && drawerOpen) {
        openDrawer(false);
        await wait(350);
      }
    } else if (drawerOpen) {
      openDrawer(false);
      await wait(350);
    }

    const el = document.querySelector<HTMLElement>(step.selector);
    if (!el) {
      setTargetVisible(false);
      setRect(null);
      return;
    }

    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    await wait(60);

    const r = el.getBoundingClientRect();
    setRect(r);
    setTargetVisible(true);
  }, [isDesktop, drawerOpen, openDrawer]);

  const finishTour = useCallback(async (completed: boolean) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('escort_token') || '';
      await fetch('/api/escort/tour-completado.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completado: completed ? 1 : 0 }),
      });
    } catch {
      // No bloquear el cierre si falla la red
    }
    try {
      localStorage.setItem('escort_tour_visto', '1');
    } catch {
      // storage puede no estar disponible
    }
    openDrawer(false);
    setSaving(false);
    setReady(false);
  }, [openDrawer]);

  const next = useCallback(() => {
    if (index >= STEPS.length - 1) {
      finishTour(true);
      return;
    }
    setIndex((i) => i + 1);
  }, [index, finishTour]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Arranque
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.includes('/onboarding')) return;

    const token = localStorage.getItem('escort_token');
    if (!token) return;

    let activo = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const mq = window.matchMedia(lgQuery);
    const updateDesktop = () => setIsDesktop(mq.matches);
    updateDesktop();
    mq.addEventListener('change', updateDesktop);

    fetch('/api/escort/verificar-sesion.php', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((d) => {
        if (!activo) return;
        const yaVisto = d?.tour_completado === 1 || localStorage.getItem('escort_tour_visto') === '1';
        if (d?.success && !yaVisto) {
          timeout = setTimeout(() => {
            if (activo) {
              setReady(true);
              setIndex(0);
            }
          }, 900);
        }
      })
      .catch(() => {
        /* si falla el check, no mostrar el tour */
      });

    return () => {
      activo = false;
      if (timeout) clearTimeout(timeout);
      mq.removeEventListener('change', updateDesktop);
    };
  }, []);

  // Medir el paso actual
  useEffect(() => {
    if (!ready) return;
    const step = STEPS[index];
    measure(step);
    const onResize = () => measure(step);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [ready, index, measure]);

  if (!ready) return null;

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const padding = 6;

  const tooltipTop = rect
    ? Math.max(12, Math.min(window.innerHeight - 280, rect.top - 16))
    : 120;

  return (
    <>
      {/* Capturador de clics (bloquea la interacción con el panel durante el tour) */}
      <div className="fixed inset-0 z-[300]" />

      {/* Spotlight: agujero sobre el elemento objetivo */}
      {rect && targetVisible && (
        <div
          className="fixed z-[301] rounded-xl border-2 border-red-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.82)]"
          style={{
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tarjeta de paso */}
      <div
        className={`
          fixed z-[302]
          ${isDesktop
            ? 'w-[min(92vw,560px)]'
            : 'w-[min(94vw,420px)] rounded-t-2xl rounded-b-2xl border border-escort-border'}
        `}
        style={
          isDesktop
            ? { top: tooltipTop, left: '50%', transform: 'translateX(-50%)' }
            : { bottom: 12, left: '50%', transform: 'translateX(-50%)' }
        }
      >
        <div className="bg-[#1a1a2e] border border-escort-border rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="flex items-start gap-3 p-5 pb-3">
            <div className="w-11 h-11 rounded-xl bg-[#2d2d44] flex items-center justify-center flex-shrink-0">
              <i className={`fas ${step.icon} ${step.color} text-base`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-base">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed mt-1.5">{step.text}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-5 pt-3 pb-5">
            <button
              onClick={() => finishTour(false)}
              disabled={saving}
              className="text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
            >
              Omitir
            </button>

            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === index ? 'bg-red-500' : 'bg-[#2d2d44]'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  onClick={prev}
                  disabled={saving}
                  className="w-9 h-9 rounded-lg bg-[#2d2d44] hover:bg-[#3d3d5c] text-gray-300 flex items-center justify-center transition-colors"
                  aria-label="Anterior"
                >
                  <i className="fas fa-chevron-left text-xs"></i>
                </button>
              )}
              <button
                onClick={next}
                disabled={saving}
                className={`
                  px-5 h-9 rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 transition-all
                  ${isLast
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-lg shadow-green-500/20'
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-lg shadow-red-500/20'}
                `}
              >
                {saving ? (
                  <i className="fas fa-circle-notch fa-spin"></i>
                ) : isLast ? (
                  <>
                    <i className="fas fa-check"></i>
                    Finalizar
                  </>
                ) : (
                  <>
                    Siguiente
                    <i className="fas fa-chevron-right text-[10px]"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
