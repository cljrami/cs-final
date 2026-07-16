interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantConfig: Record<string, { icon: string; circleBg: string; iconColor: string; btn: string }> = {
  danger: { icon: 'fa-exclamation-triangle', circleBg: 'bg-red-500/20', iconColor: 'text-red-400', btn: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: 'fa-exclamation-circle', circleBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400', btn: 'bg-yellow-600 hover:bg-yellow-700' },
  info: { icon: 'fa-question-circle', circleBg: 'bg-blue-500/20', iconColor: 'text-blue-400', btn: 'bg-blue-600 hover:bg-blue-700' },
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const cfg = variantConfig[variant] || variantConfig.danger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onCancel}>
      <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full ${cfg.circleBg} flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${cfg.icon} ${cfg.iconColor} text-lg`}></i>
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed mt-0.5">{message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              className={`px-4 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors ${cfg.btn}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
