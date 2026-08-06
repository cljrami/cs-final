// src/components/EscortCard.tsx
import type { Escort, EscortCardProps } from '../types/escort';
import { isNueva } from '../utils/fecha';
import { Skeleton } from './ui/Skeleton';

function getImageSrcSet(src: string): string {
  if (!src) return '';
  const base = src.split('?')[0];
  const ext = base.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return '';
  
  const widths = [320, 480, 640];
  return widths
    .map(w => `${base}?w=${w}&q=65&fm=webp ${w}w`)
    .join(', ');
}

function getBlurDataURL(src: string): string {
  if (!src) return '';
  // Very small base64 placeholder - 10px blurred version
  return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAh5DwHEEwKLAAAAABJRU5ErkJggg==`;
}

export default function EscortCard({ escort, skeleton = false }: EscortCardProps) {
  const imgSrc = escort.foto_principal;
  const srcSet = getImageSrcSet(imgSrc || '');
  const blurDataURL = getBlurDataURL(imgSrc || '');

  if (skeleton) {
    return (
      <a className="group block bg-surface rounded-xl overflow-hidden border border-white/5 animate-pulse pointer-events-none">
        <div className="relative aspect-[3/4] bg-gradient-to-b from-raised to-surface overflow-hidden">
          <Skeleton className="w-full h-full !rounded-none" />
        </div>
        <div className="p-3">
          <div className="mb-1.5">
            <Skeleton width="60%" height={20} />
          </div>
          <Skeleton width="40%" height={14} />
        </div>
      </a>
    );
  }

  return (
    <a
      href={`/${escort.id}`}
      className="group block bg-surface rounded-xl overflow-hidden border border-white/5 hover:border-red-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
    >
      <div className="relative aspect-[3/4] bg-gradient-to-b from-raised to-surface overflow-hidden">
        {imgSrc ? (
          <picture>
            <source
              srcSet={srcSet}
              sizes="(max-width: 640px) 320px, (max-width: 1024px) 480px, 640px"
              type="image/webp"
            />
            <img
              src={imgSrc}
              srcSet={srcSet}
              alt={escort.nombre}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              decoding="async"
              style={{ opacity: 1 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </picture>
        ) : (
          <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
            <div className="w-20 h-20 rounded-full bg-raised flex items-center justify-center">
              <i className="fas fa-user text-3xl text-muted"></i>
            </div>
          </div>
        )}

        {escort.disponible_ahora === 1 && (
          <span className="absolute top-2 left-2 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-600/50 animate-pulse" title="Disponible">
          </span>
        )}

        {escort.gira_activa === 1 && (
          <span
            className="absolute bottom-2 left-2 z-10
              bg-gradient-to-r from-purple-500 to-fuchsia-600
              text-white text-[0.6rem] sm:text-xs font-semibold px-2 py-0.5
              rounded-full flex items-center gap-1
              shadow-md shadow-purple-500/30
              border border-white/20"
            title={escort.gira_ciudad ? `En gira en ${escort.gira_ciudad}` : 'En gira'}
          >
            <i className="fas fa-plane-departure text-[0.5rem]"></i>{escort.gira_ciudad || 'En gira'}
          </span>
        )}

        {isNueva(escort.fecha_aprobacion) && (
          <span
            className="absolute top-2 right-2 z-10
              bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500
              text-white text-[0.6rem] sm:text-xs font-semibold px-2 py-0.5
              rounded-full flex items-center gap-1
              shadow-md shadow-amber-500/30
              border border-white/20"
            title="Nueva"
          >
            <i className="fas fa-star text-[0.5rem]"></i>Nueva
          </span>
        )}

      </div>

      <div className="p-3">
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="text-ink font-semibold text-sm leading-tight truncate">{escort.nombre}</h3>
            {escort.verificado === 1 && (
              <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0" title="Verificada">
                <i className="fas fa-check text-[0.35rem] text-white"></i>
              </span>
            )}
            {escort.vip === 1 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shrink-0" title="VIP">
                <i className="fas fa-crown text-[0.35rem] text-black"></i>
              </span>
            )}
          </div>
          {(escort.total_valoraciones ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-yellow-400 text-xs flex-shrink-0" aria-label={`Valoración: ${Number(escort.rating).toFixed(1)} estrellas, ${escort.total_valoraciones} reseñas`}>
              <i className="fas fa-star text-[0.55rem]" aria-hidden="true"></i>
              <span>{Number(escort.rating).toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <i className="fas fa-map-marker-alt text-[0.55rem] flex-shrink-0" aria-hidden="true"></i>
          <span className="truncate">{escort.ciudad}</span>
          <span className="text-gray-700" aria-hidden="true">•</span>
          <span className="text-red-400">{escort.edad} años</span>
        </div>
      </div>
    </a>
  );
}