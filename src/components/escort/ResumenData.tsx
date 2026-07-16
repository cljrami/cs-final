// src/components/escort/ResumenData.tsx
import { useState, useEffect } from 'react';
import { API_BASE, getEscortHeaders } from '../../lib/escortAuth';

interface EscortData {
  nombre: string;
  nombreArtistico: string;
  aprobada: number;
  estado: string;
  activa: number;
  verificado: number;
  vip: number;
  destacado: number;
  planVencido: boolean;
  planVigente: boolean;
  planNombre: string | null;
  planBadge: string | null;
  planColor: string | null;
  planDiasRestantes: number;
  fotosCount: number;
  historiasCount: number;
  visitasHoy: number;
  visitasTotal: number;
  contactosRecibidos: number;
  rating: number;
  totalValoraciones: number;
  perfilCompleto: number;
  ciudad: string;
  fotoPrincipal: string | null;
  vipVencido: boolean;
  destacadoVencido: boolean;
}

export default function ResumenData() {
  const [data, setData] = useState<EscortData | null>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/resumen.php?_t=${Date.now()}`, { headers: getEscortHeaders(), cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setData(d.data);
          if (d.data.id) {
            fetch(`/api/escorts/favorito.php?id=${d.data.id}`)
              .then(r => r.json())
              .then(fd => { if (fd.success) setFavoritesCount(fd.likes ?? 0); })
              .catch(() => {});
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const cards = [
    { id: 'perfil', label: 'Editar Perfil', desc: 'Datos, plan, pausas', icon: 'fa-user-edit', color: 'text-red-500', href: '/micuenta/perfil' },
    { id: 'datos', label: 'Mis Datos', desc: 'Email y contraseña', icon: 'fa-id-card', color: 'text-red-500', href: '/micuenta/datos' },
    { id: 'fotos', label: 'Galería', desc: 'Fotos y videos', icon: 'fa-images', color: 'text-red-500', href: '/micuenta/fotos' },
    { id: 'historias', label: 'Historias', desc: 'Contenido temporal', icon: 'fa-history', color: 'text-red-500', href: '/micuenta/historias' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Bienvenida, {data?.nombre || data?.nombreArtistico || 'Analia'}</h1>
          {data?.ciudad && <p className="text-gray-500 text-sm mt-1"><i className="fas fa-map-marker-alt mr-1"></i>{data.ciudad}</p>}
        </div>
        {data?.aprobada ? (
          <span className="px-4 py-2 bg-green-500/10 text-green-400 rounded-full text-sm font-medium border border-green-500/20">
            Aprobado
          </span>
        ) : (
          <span className="px-4 py-2 bg-amber-500/10 text-amber-400 rounded-full text-sm font-medium border border-amber-500/20">
            Pendiente
          </span>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-3">
        {data?.verificado === 1 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
            <i className="fas fa-check-circle"></i> Verificada
          </span>
        )}
        {data?.vip === 1 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">
            <i className="fas fa-crown"></i> VIP
          </span>
        )}
        {data?.destacado === 1 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
            <i className="fas fa-fire"></i> Destacada
          </span>
        )}
        {data?.planVigente && data?.planNombre && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
            <i className="fas fa-check-circle"></i> {data.planNombre} · {data.planDiasRestantes}d
          </span>
        )}
      </div>

      {/* Plan vencido warning */}
      {data?.planVencido && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-3"></i>
          <h3 className="text-white font-bold mb-1">Tu plan ha vencido</h3>
          <p className="text-gray-400 text-sm mb-4">Tu anuncio ya no aparece en el directorio</p>
          <a href="/micuenta/planes" className="inline-block px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all">
            Renovar plan
          </a>
        </div>
      )}

      {/* Profile completion */}
      {data && (
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium">Perfil completado</span>
            <span className="text-white text-sm font-bold">{data.perfilCompleto}%</span>
          </div>
          <div className="h-2.5 bg-[#1a1a24] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700"
              style={{ width: `${data.perfilCompleto}%` }}
            />
          </div>
          {data.perfilCompleto < 100 && (
            <p className="text-gray-600 text-xs mt-2">
              <i className="fas fa-info-circle mr-1"></i>
              Completa tu perfil para aparecer mejor en el directorio
            </p>
          )}
        </div>
      )}

      {/* Quick access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <a
            key={card.id}
            href={card.href}
            className="bg-[#13131a] border border-gray-800 hover:border-gray-700 rounded-2xl p-6 text-center transition-all duration-300 hover:scale-[1.02] group"
          >
            <div className="w-14 h-14 mx-auto mb-4 bg-[#1a1a24] rounded-2xl flex items-center justify-center group-hover:bg-red-500/10 transition-colors">
              <i className={`fas ${card.icon} ${card.color} text-2xl`}></i>
            </div>
            <h3 className="text-white font-bold mb-1">{card.label}</h3>
            <p className="text-gray-500 text-sm">{card.desc}</p>
          </a>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-eye text-blue-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Visitas</span>
          </div>
          <p className="text-2xl font-bold text-white">{(data?.visitasTotal || 0).toLocaleString()}</p>
          <p className="text-gray-600 text-xs mt-1">hoy: {data?.visitasHoy || 0}</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-heart text-red-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Favoritos</span>
          </div>
          <p className="text-2xl font-bold text-white">{favoritesCount}</p>
          <p className="text-gray-600 text-xs mt-1">usuarios te agregaron</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-star text-yellow-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Valoración</span>
          </div>
          <p className="text-2xl font-bold text-white">{data?.rating ? data.rating.toFixed(1) : '—'}</p>
          <p className="text-gray-600 text-xs mt-1">{data?.totalValoraciones || 0} valoraciones</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-phone text-green-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Contactos</span>
          </div>
          <p className="text-2xl font-bold text-white">{data?.contactosRecibidos || 0}</p>
          <p className="text-gray-600 text-xs mt-1">recibidos</p>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-images text-green-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Fotos</span>
          </div>
          <p className="text-2xl font-bold text-white">{data?.fotosCount || 0}</p>
          <p className="text-gray-600 text-xs mt-1">subidas</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-history text-purple-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Historias</span>
          </div>
          <p className="text-2xl font-bold text-white">{data?.historiasCount || 0}</p>
          <p className="text-gray-600 text-xs mt-1">activas</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-crown text-amber-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">VIP</span>
          </div>
          <p className="text-2xl font-bold text-white">{data?.vip && !data?.vipVencido ? 'Activo' : '—'}</p>
          <p className="text-gray-600 text-xs mt-1">{data?.vip && !data?.vipVencido ? 'Badge visible' : 'No activo'}</p>
        </div>
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-fire text-orange-400"></i>
            <span className="text-gray-500 text-xs uppercase tracking-wider">Destacado</span>
          </div>
          <p className="text-2xl font-bold text-white">{data?.destacado && !data?.destacadoVencido ? 'Activo' : '—'}</p>
          <p className="text-gray-600 text-xs mt-1">{data?.destacado && !data?.destacadoVencido ? 'En directorio' : 'No activo'}</p>
        </div>
      </div>
    </div>
  );
}