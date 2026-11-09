import { useEffect } from 'react';

export default function AdminFancyboxInit() {
  useEffect(() => {
    let disposed = false;
    import('@fancyapps/ui').then((mod) => {
      if (disposed) return;
      const Fancybox = mod.Fancybox;
      if (!Fancybox) return;

      // Limpiar binds previos para evitar duplicados
      try { Fancybox.unbind('[data-fancybox]'); } catch {}

      Fancybox.bind('[data-fancybox]', {
        compact: false,
        idle: false,
        Toolbar: { display: ['close'] },
        Thumbs: false,
        Image: { fit: 'contain' },
        // Opciones comunes para comprobantes
        maxWidth: '90%',
        maxHeight: '85vh',
        backdropClick: true,
      });

      // Desvincular al desmontar
      return () => Fancybox.unbind('[data-fancybox]');
    });

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
