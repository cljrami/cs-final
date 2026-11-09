import type { Escort } from '../types/escort';

export default function EscortCircleCard({ escort }: { escort: Escort }) {
  return (
    <div className="flex flex-col items-center">
      <a
        href={`/cs${escort.id}`}
        className="relative w-20 h-20 mx-auto rounded-full p-[3px] bg-gradient-to-tr from-red-500 via-pink-500 to-yellow-500 hover:brightness-110 block transition-all duration-300 hover:scale-105"
      >
        <span className="block w-full h-full rounded-full overflow-hidden bg-surface border-2 border-page">
          {escort.foto_principal ? (
            <img
              src={escort.foto_principal}
              alt={escort.nombre}
              className="w-full h-full object-cover rounded-full"
              loading="lazy"
              decoding="async"
              onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-raised">
              <i className="fas fa-user text-muted text-2xl"></i>
            </div>
          )}
        </span>
        {escort.disponible_ahora === 1 && (
          <span className="absolute -top-0.5 -right-0.5 z-10 w-4 h-4 rounded-full bg-green-500 border-2 border-page shadow-lg shadow-green-600/50 animate-pulse" title="Disponible"></span>
        )}
      </a>
      <span className="inline-flex items-center gap-1 mt-2 w-full max-w-20 justify-center px-1">
        <span className="text-ink text-xs font-medium leading-tight truncate">{escort.nombre}</span>
        {escort.verificado_vigente === 1 && (
          <span className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center shrink-0" title="Verificada">
            <i className="fas fa-check text-[0.45rem] text-white"></i>
          </span>
        )}
        {escort.verificado === 1 && escort.verificado_vigente === 0 && (
          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center shrink-0" title="Verificada (expirada)">
            <i className="fas fa-exclamation-triangle text-[0.45rem] text-white"></i>
          </span>
        )}
        {escort.vip_vigente === 1 && (
          <span className="w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center shrink-0" title="VIP">
            <i className="fas fa-crown text-[0.45rem] text-black"></i>
          </span>
        )}
        {escort.vip === 1 && escort.vip_vigente === 0 && (
          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center shrink-0" title="VIP (expirado)">
            <i className="fas fa-exclamation-triangle text-[0.45rem] text-white"></i>
          </span>
        )}
      </span>
    </div>
  );
}