// src/components/escort/AudioPreviewPlayer.tsx
// Badge decorativo de audífonos que indica que el escort tiene audio de presentación (15s).
// No reproduce audio: la escucha se realiza en el modal del perfil (escort.php) o el player nativo.

interface Props {
  audioUrl: string | null | undefined;
  size?: 'sm' | 'md';
}

export default function AudioPreviewPlayer({ audioUrl, size = 'md' }: Props) {
  if (!audioUrl) return null;

  const btnSize = size === 'sm' ? 'w-7 h-7' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span
      className={`
        absolute bottom-2 right-2 z-20 rounded-full
        bg-red-500/90 text-white
        flex items-center justify-center
        shadow-lg shadow-black/30
        ${btnSize}
      `}
      title="Tiene audio de presentación"
    >
      <i className={`fas fa-headphones ${iconSize}`}></i>
    </span>
  );
}