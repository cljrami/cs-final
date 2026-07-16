import { useState, useRef, useEffect, useCallback } from 'react';

export interface ActionItem {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  actions: ActionItem[];
}

export default function ActionMenu({ actions }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, alignRight: true });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 192; // w-48 = 12rem = 192px
      const menuHeight = actions.length * 40 + 16; // aproximado
      const padding = 8;

      let left = rect.right - menuWidth;
      let top = rect.bottom + 4;
      let alignRight = true;

      // Si se sale por la izquierda, alinear a la derecha del botón
      if (left < padding) {
        left = rect.left;
        alignRight = false;
      }

      // Si se sale por abajo, mostrar arriba del botón
      if (top + menuHeight > window.innerHeight - padding) {
        top = rect.top - menuHeight - 4;
      }

      // Si se sale por la derecha, ajustar
      if (left + menuWidth > window.innerWidth - padding) {
        left = window.innerWidth - menuWidth - padding;
      }

      setPos({ top, left, alignRight });
    }
  }, [actions.length]);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handle);
    }
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          if (!open) updatePosition();
          setOpen(!open);
        }}
        className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-admin-border"
      >
        <i className="fas fa-ellipsis-v" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed w-48 bg-admin-card border border-admin-border rounded-lg shadow-2xl z-[9999] overflow-hidden"
          style={{ top: pos.top, left: pos.left }}
        >
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                setTimeout(() => {
                  a.onClick();
                }, 0);
              }}
              disabled={a.disabled}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 ${
                a.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <i className={`fas ${a.icon} w-4`} />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}