import { useState, useEffect } from 'react';
import { authFetch, requireAuth } from '../lib/usuarioAuth';

interface Favorito {
  id: number;
  nombre: string;
  slug: string;
  edad: number;
  ciudad: string;
  foto_principal: string | null;
  vip: number;
  verificado: number;
  destacado: number;
  rating: string;
  favorito_desde: string;
}

export default function MisFavoritos() {
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const esTactil = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  useEffect(() => {
    requireAuth();
    authFetch('/api/usuarios/favoritos.php')
      .then(r => r.json())
      .then(data => {
        if (data.success) setFavoritos(data.favoritos);
        else setError(data.error || 'Error al cargar');
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setCargando(false));
  }, []);

  const quitarFavorito = async (escortId: number) => {
    const res = await authFetch('/api/usuarios/favoritos.php', {
      method: 'DELETE',
      body: JSON.stringify({ escort_id: escortId }),
    });
    const data = await res.json();
    if (data.success) {
      setFavoritos(prev => prev.filter(f => f.id !== escortId));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-heart text-red-500"></i>
          Mis Favoritos
          <span className="text-sm font-normal text-gray-500">({favoritos.length})</span>
        </h1>
      </div>

      {error && (
        <div className="text-center py-8 text-red-400">
          <i className="fas fa-exclamation-circle mr-2"></i>{error}
        </div>
      )}

      {cargando ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-[#1a1a2e] rounded-xl overflow-hidden border border-white/5">
              <div className="aspect-[3/4] bg-gray-800 animate-pulse"></div>
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-800 rounded animate-pulse w-24"></div>
                <div className="h-3 bg-gray-800 rounded animate-pulse w-16"></div>
              </div>
            </div>
          ))}
        </div>
      ) : favoritos.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#1a1a2e] flex items-center justify-center">
            <i className="fas fa-heart-broken text-3xl text-gray-600"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-400 mb-2">Sin favoritos aún</h2>
          <p className="text-gray-600 mb-6">Explora y agrega escorts a tus favoritos</p>
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all">
            <i className="fas fa-search"></i>
            Explorar escorts
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {favoritos.map(f => (
            <div key={f.id} className="group relative bg-[#1a1a2e] rounded-xl overflow-hidden border border-white/5 hover:border-red-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/5">
              <a href={`/${f.id}`} className="block">
                <div className="relative aspect-[3/4] bg-gradient-to-b from-[#2a2a3e] to-[#1a1a2e] overflow-hidden">
                  {f.foto_principal ? (
                    <img
                      src={f.foto_principal}
                      alt={f.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-[#2a2a3e] flex items-center justify-center">
                        <i className="fas fa-user text-2xl text-gray-600"></i>
                      </div>
                    </div>
                  )}
                  {f.vip === 1 && (
                    <div className="absolute bottom-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                      <i className="fas fa-crown text-[0.6rem] mr-1"></i>VIP
                    </div>
                  )}
                  {f.verificado === 1 && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                      <i className="fas fa-check text-white text-[0.6rem]"></i>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-white font-semibold text-sm truncate">{f.nombre}</h3>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-gray-500">
                      <i className="fas fa-map-marker-alt text-[0.6rem] mr-1"></i>
                      {f.ciudad}
                    </span>
                    <span className="text-red-400">{f.edad} años</span>
                  </div>
                  {Number(f.rating) > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-yellow-400 text-xs">
                      <i className="fas fa-star text-[0.6rem]"></i>
                      <span>{Number(f.rating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </a>
              <button
                onClick={() => quitarFavorito(f.id)}
                className={`absolute top-3 left-3 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500/80 transition-all ${esTactil ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                title="Quitar de favoritos"
              >
                <i className="fas fa-times text-white text-xs"></i>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
