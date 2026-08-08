import type { Escort, EscortCardProps } from '../types/escort';
import { Skeleton } from './ui/Skeleton';

function getResizedSrc(src: string): string {
  if (!src) return '';
  const base = src.split('?')[0];
  const ext = base.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return src;
  return `${base}?w=320&q=65&fm=webp`;
}

function getImageSrcSet(src: string): string {
  if (!src) return '';
  const base = src.split('?')[0];
  const ext = base.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return '';
  const widths = [200, 320];
  return widths.map(w => `${base}?w=${w}&q=65&fm=webp ${w}w`).join(', ');
}

export default function EscortCardCompact({ escort, skeleton = false, priority = false }: EscortCardProps) {
  const imgSrc = getResizedSrc(escort.foto_principal || '');
  const srcSet = getImageSrcSet(imgSrc || '');

  if (skeleton) {
    return (
      <div className="bg-surface rounded-lg overflow-hidden border border-white/5 animate-pulse">
        <div className="relative aspect-[1/1] bg-raised">
          <Skeleton className="w-full h-full !rounded-none" />
        </div>
        <div className="p-2 space-y-1">
          <Skeleton className="w-3/4 h-3 !rounded-md" />
          <Skeleton className="w-1/2 h-2.5 !rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <a
      href={`/${escort.id}`}
      className="group block bg-surface rounded-lg overflow-hidden border border-white/5 hover:border-red-500/20 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
    >
      <div className="relative aspect-[1/1] bg-gradient-to-b from-raised to-surface overflow-hidden">
        {imgSrc ? (
          <picture>
            <source
              srcSet={srcSet}
              sizes="(max-width: 640px) 120px, (max-width: 1024px) 160px, 200px"
              type="image/webp"
            />
            <img
              src={imgSrc}
              srcSet={srcSet}
              alt={escort.nombre}
              width={160}
              height={160}
              className="w-full h-full object-cover"
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </picture>
        ) : (
          <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
            <div className="w-12 h-12 rounded-full bg-raised flex items-center justify-center">
              <i className="fas fa-user text-muted text-xl"></i>
            </div>
          </div>
        )}

        {escort.gira_activa === 1 && (
          <span
            className="absolute bottom-1 left-1 z-10
              bg-gradient-to-r from-purple-500/90 to-fuchsia-600/90
              text-white text-[0.5rem] px-1 py-0.25
              rounded flex items-center gap-0.5
              shadow-md"
            title={escort.gira_ciudad ? `En gira en ${escort.gira_ciudad}` : 'En gira'}
          >
            <i className="fas fa-plane-departure text-[0.4rem]"></i>
          </span>
        )}
      </div>

      <div className="p-2">
        <div className="flex items-center gap-1 min-w-0">
          <h3 className="text-ink font-medium text-xs leading-tight truncate">{escort.nombre}</h3>
          {escort.verificado === 1 && (
            <span className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center shrink-0" title="Verificada">
              <i className="fas fa-check text-[0.2rem] text-white"></i>
            </span>
          )}
          {escort.vip === 1 && (
            <span className="w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center shrink-0" title="VIP">
              <i className="fas fa-crown text-[0.2rem] text-black"></i>
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
