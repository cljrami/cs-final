import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';
export const TOAST_EVENT = 'app-toast';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

let toastSeq = 0;

export function showToast(msg: string, type: ToastType = 'success') {
  if (typeof window === 'undefined' || !msg) return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { id: ++toastSeq, msg, type } }));
}

const styles: Record<ToastType, { bg: string; border: string; icon: string; color: string }> = {
  success: { bg: 'bg-[#12291c]', border: 'border-emerald-700/60', icon: 'fa-check-circle', color: 'text-emerald-400' },
  error: { bg: 'bg-[#33121a]', border: 'border-red-700/60', icon: 'fa-exclamation-circle', color: 'text-red-400' },
  info: { bg: 'bg-[#0f1f33]', border: 'border-blue-700/60', icon: 'fa-info-circle', color: 'text-blue-400' },
};

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, msg, type } = (e as CustomEvent).detail as ToastItem;
      setToasts((prev) => [...prev.slice(-3), { id, msg, type }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3400);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[10000] flex flex-col items-end gap-2 pointer-events-none" aria-live="polite">
      {toasts.map((t) => {
        const s = styles[t.type] || styles.success;
        return (
          <div
            key={t.id}
            role="status"
            className={`toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-sm ${s.bg} ${s.border}`}
          >
            <i className={`fas ${s.icon} ${s.color} text-base`}></i>
            <span className="text-white text-sm font-medium leading-snug">{t.msg}</span>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-1 text-gray-500 hover:text-white transition-colors"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>
        );
      })}
    </div>
  );
}
