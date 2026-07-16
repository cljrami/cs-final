// src/components/EscortCard.tsx

interface Servicio {
    nombre: string;
    icono: string;
  }
  
  export interface Escort {
    id: number;
    nombre: string;
    slug: string;
    edad: number;
    ciudad: string;
    foto_principal: string | null;
    vip: number;
    verificado: number;
    destacado: number;
    estado: string;
    likes: number;
    visitas_perfil: number;
    rating: number;
    tarifa_1h: number | null;
    servicios?: Servicio[];
  }
  
  interface EscortCardProps {
    escort: Escort;
  }
  
  export default function EscortCard({ escort }: EscortCardProps) {
    return (
      <a
        href={`/${escort.id}`}
        className="group block bg-[#1a1a2e] rounded-xl overflow-hidden border border-white/5 hover:border-red-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/5"
      >
        <div className="relative aspect-[3/4] bg-gradient-to-b from-[#2a2a3e] to-[#1a1a2e] overflow-hidden">
          {escort.foto_principal ? (
            <img
              src={escort.foto_principal}
              alt={escort.nombre}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-[#2a2a3e] flex items-center justify-center">
                <i className="fas fa-user text-3xl text-gray-600"></i>
              </div>
            </div>
          )}
  
          {escort.vip === 1 && (
            <div className="absolute bottom-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-lg">
              <i className="fas fa-crown text-[0.6rem]"></i>VIP
            </div>
          )}
  
          {escort.destacado === 1 && escort.vip !== 1 && (
            <div className="absolute bottom-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-lg">
              <i className="fas fa-star text-[0.6rem]"></i>Destacada
            </div>
          )}
  
          {escort.verificado === 1 && (
            <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <i className="fas fa-check text-white text-[0.6rem]"></i>
            </div>
          )}
  
          {escort.servicios && escort.servicios.length > 0 && (
            <div className="absolute bottom-3 left-3 flex gap-1">
              {escort.servicios.map((s, i) => (
                <span key={i} className="bg-black/60 backdrop-blur-sm text-white text-[0.6rem] px-1.5 py-0.5 rounded">
                  {s.nombre}
                </span>
              ))}
            </div>
          )}
        </div>
  
        <div className="p-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-white font-semibold text-sm">{escort.nombre}</h3>
            {escort.rating > 0 && (
              <div className="flex items-center gap-1 text-yellow-400 text-xs">
                <i className="fas fa-star text-[0.6rem]"></i>
                <span>{Number(escort.rating).toFixed(1)}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-gray-500">
              <i className="fas fa-map-marker-alt text-[0.6rem]"></i>
              <span>{escort.ciudad}</span>
              <span className="text-gray-700">•</span>
              <span className="text-red-400">{escort.edad} años</span>
            </div>
            {escort.likes > 0 && (
              <div className="flex items-center gap-1 text-red-400">
                <i className="fas fa-heart text-[0.6rem]"></i>
                <span>{escort.likes}</span>
              </div>
            )}
          </div>
          
          {escort.tarifa_1h && (
            <div className="mt-2 text-xs text-gray-600">
              Desde <span className="text-green-400 font-medium">${Number(escort.tarifa_1h).toLocaleString('es-CL')}</span>/hora
            </div>
          )}
        </div>
      </a>
    );
  }