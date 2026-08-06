import { useEffect, useState } from 'react';

import StatCard from './StatCard';
import ActivityChart from './ActivityChart';
import RecentEscorts from './RecentEscorts';
import EscortsTable from './EscortsTable';

interface Stats {
  total: number;
  pendientes: number;
  aprobadas: number;
  pausadas: number;
  por_vencer: number;
  rechazadas: number;
  verificadas: number;
  vip: number;
  destacadas: number;
  planes_por_activar: number;
  verificaciones_pendientes: number;
  nuevas_hoy: number;
  total_usuarios: number;
  total_ciudades: number;
  total_categorias: number;
}

interface ActivityItem {
  fecha: string;
  dia: string;
  cantidad: number;
}

interface IncomeItem {
  mes: string;
  label: string;
  total: number;
}

interface CityItem {
  ciudad: string;
  total: number;
}

interface TopEscort {
  id: number;
  nombre: string;
  slug: string;
  ciudad: string;
  visitas_perfil: number;
  foto_principal: string | null;
}

interface PorVencer {
  id: number;
  escort_id: number;
  escort_nombre: string;
  plan_nombre: string;
  fecha_fin: string;
  dias_restantes: number;
}

interface Escort {
  id: number;
  nombre: string;
  slug?: string;
  edad: number;
  ciudad: string;
  estado: string;
  verificado: number;
  vip: number;
  destacado?: number;
  activa: number;
  created_at: string;
  foto_principal?: string | null;
}

export default function DashboardData() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [actividad, setActividad] = useState<ActivityItem[]>([]);
  const [ingresos, setIngresos] = useState<IncomeItem[]>([]);
  const [topCiudades, setTopCiudades] = useState<CityItem[]>([]);
  const [topEscorts, setTopEscorts] = useState<TopEscort[]>([]);
  const [porVencer, setPorVencer] = useState<PorVencer[]>([]);
  const [recentEscorts, setRecentEscorts] = useState<Escort[]>([]);
  const [escorts, setEscorts] = useState<Escort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    
    fetch('/api/admin/dashboard.php', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(async r => {
      const text = await r.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('Respuesta no es JSON: ' + text.substring(0, 100));
      }
    })
    .then(data => {
      if (data.success) {
        setStats(data.stats);
        setActividad(data.actividad || []);
        setIngresos(data.ingresos || []);
        setTopCiudades(data.topCiudades || []);
        setTopEscorts(data.topEscorts || []);
        setPorVencer(data.porVencer || []);
        setRecentEscorts(data.recentEscorts || []);
        setEscorts(data.escorts || []);
      } else {
        setError(data.error || 'Error al cargar datos');
      }
    })
    .catch(err => {
      setError('Error de conexión: ' + err.message);
    })
    .finally(() => {
      setLoading(false);
    });
  }, []);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-400">
        <i className="fas fa-exclamation-circle mr-2"></i>
        {error}
      </div>
    );
  }

  const ingresoMax = Math.max(...ingresos.map(i => i.total), 1);

  return (
      <div className="space-y-8">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <i className="fas fa-chart-line text-red-500"></i>
          Dashboard
        </h1>
        <p className="text-admin-muted -mt-6">
          Resumen de actividad y estadísticas
        </p>

        {/* Atención requerida */}
        {(() => {
          const acciones = [
            { label: 'Escorts por aprobar', href: '/admin/escorts', color: 'text-red-400', icon: 'fa-user-clock', count: stats?.pendientes ?? 0 },
            { label: 'Solicitudes VIP por activar', href: '/admin/solicitudes-vip', color: 'text-yellow-400', icon: 'fa-crown', count: stats?.planes_por_activar ?? 0 },
            { label: 'Verificaciones pendientes', href: '/admin/verificaciones', color: 'text-purple-400', icon: 'fa-id-card', count: stats?.verificaciones_pendientes ?? 0 },
            { label: 'Suscripciones por vencer (7 días)', href: '/admin/suscripciones', color: 'text-orange-400', icon: 'fa-clock', count: stats?.por_vencer ?? 0 },
          ].filter(a => !loading && a.count > 0);

          if (acciones.length === 0) return null;

          return (
            <div className="bg-admin-card border border-admin-border rounded-2xl p-5">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <i className="fas fa-exclamation-triangle text-yellow-400"></i>
                Atención requerida
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {acciones.map(a => (
                  <a
                    key={a.label}
                    href={a.href}
                    className={`flex items-center gap-3 bg-[#252538] hover:bg-[#2d2d44] rounded-xl px-4 py-3 transition-colors`}
                  >
                    <i className={`fas ${a.icon} ${a.color} text-lg flex-shrink-0`}></i>
                    <span className="flex-1 min-w-0 text-sm text-gray-300 truncate">{a.label}</span>
                    <span className={`text-lg font-bold ${a.color}`}>{a.count}</span>
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <StatCard icon="fa-users" value={stats?.total ?? 0} label="Total Escorts" color="#3b82f6" loading={loading} />
          <StatCard icon="fa-check-circle" value={stats?.aprobadas ?? 0} label="Activas" color="#10b981" loading={loading} />
          <StatCard icon="fa-pause-circle" value={stats?.pausadas ?? 0} label="Pausadas" color="#f59e0b" loading={loading} />
          <StatCard icon="fa-city" value={stats?.total_ciudades ?? 0} label="Ciudades" color="#a855f7" loading={loading} />
          <StatCard icon="fa-star" value={stats?.nuevas_hoy ?? 0} label="Nuevas Hoy" color="#ef4444" loading={loading} />
        </div>

        {/* Stats acción */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <StatCard icon="fa-user-clock" value={stats?.pendientes ?? 0} label="Por aprobar" color="#f97316" loading={loading} href="/admin/escorts" />
          <StatCard icon="fa-star" value={stats?.vip ?? 0} label="VIP Activos" color="#eab308" loading={loading} href="/admin/vip-activos" />
          <StatCard icon="fa-shield-alt" value={stats?.verificadas ?? 0} label="Verificadas" color="#06b6d4" loading={loading} href="/admin/verificaciones" />
          <StatCard icon="fa-flag" value={stats?.destacadas ?? 0} label="Destacadas" color="#ec4899" loading={loading} />
          <StatCard icon="fa-clock" value={stats?.por_vencer ?? 0} label="Por vencer (7d)" color="#8b5cf6" loading={loading} href="/admin/suscripciones" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Activity chart */}
          <ActivityChart data={actividad} loading={loading} />

          {/* Income chart */}
          <div className="bg-admin-card border border-admin-border rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <i className="fas fa-dollar-sign text-green-500"></i>
              Ingresos últimos 12 días
            </h3>
            {loading ? (
              <div className="flex items-end gap-1.5" style={{ height: 176 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-[#2d2d44] rounded-t" style={{ height: `${Math.random() * 120 + 10}px` }} />
                    <div className="w-5 h-3 bg-[#2d2d44] rounded" />
                  </div>
                ))}
              </div>
            ) : ingresos.length === 0 ? (
              <div className="flex items-center justify-center text-admin-muted" style={{ height: 176 }}>
                <div className="text-center">
                  <i className="fas fa-chart-line text-4xl mb-3 opacity-30"></i>
                  <p className="text-sm">Sin datos de ingresos</p>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-1.5" style={{ height: 176 }}>
                {ingresos.map((item, idx) => {
                  const height = item.total > 0 ? Math.max((item.total / ingresoMax) * 152, 6) : 6;
                  return (
                    <div key={idx} className="flex-1 min-w-0 flex flex-col items-center gap-1 group h-full justify-end">
                      <div
                        className="w-full bg-gradient-to-t from-green-700 to-green-500 rounded-t transition-all duration-500 hover:from-green-600 hover:to-green-400 relative overflow-hidden"
                        style={{ height: `${height}px` }}
                        title={`${item.label}: $${item.total.toLocaleString('es-CL')}`}
                      >
                        {item.total > 0 && (
                          <span className="absolute inset-x-0 top-0.5 text-center text-[0.55rem] font-semibold text-white/90">
                            {(item.total / 1000).toFixed(1)}k
                          </span>
                        )}
                      </div>
                      <div className="text-[0.6rem] text-admin-muted truncate w-full text-center">{item.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top ciudades */}
          <div className="bg-admin-card border border-admin-border rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <i className="fas fa-city text-blue-400"></i>
              Top Ciudades
            </h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-[#2d2d44] rounded" />
                ))}
              </div>
            ) : topCiudades.length === 0 ? (
              <p className="text-admin-muted text-sm">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {topCiudades.map((item, idx) => {
                  const maxTotal = Math.max(...topCiudades.map(c => c.total), 1);
                  const width = (item.total / maxTotal) * 100;
                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{item.ciudad}</span>
                        <span className="text-gray-500">{item.total}</span>
                      </div>
                      <div className="h-2 bg-[#2d2d44] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top escorts más visitadas */}
          <div className="bg-admin-card border border-admin-border rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <i className="fas fa-eye text-purple-400"></i>
              Más Visitadas
            </h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-[#2d2d44] rounded" />
                ))}
              </div>
            ) : topEscorts.length === 0 ? (
              <p className="text-admin-muted text-sm">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {topEscorts.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2d2d44] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.foto_principal ? (
                        <img src={item.foto_principal} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <i className="fas fa-user text-gray-500 text-xs" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{item.nombre}</div>
                      <div className="text-gray-500 text-xs">{item.ciudad}</div>
                    </div>
                    <div className="text-purple-400 text-sm font-medium">{item.visitas_perfil.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suscripciones por vencer */}
          <div className="bg-admin-card border border-admin-border rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <i className="fas fa-clock text-red-400"></i>
              Por Vencer (7 días)
            </h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-[#2d2d44] rounded" />
                ))}
              </div>
            ) : porVencer.length === 0 ? (
              <p className="text-admin-muted text-sm">Ninguna por vencer</p>
            ) : (
              <div className="space-y-3">
                {porVencer.map((item) => (
                  <div key={item.id} className="bg-[#252538] rounded-lg p-3">
                    <div className="text-white text-sm font-medium">{item.escort_nombre}</div>
                    <div className="text-gray-500 text-xs">{item.plan_nombre}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-600 text-xs">Vence: {item.fecha_fin}</span>
                      <span className={`text-xs font-medium ${item.dias_restantes <= 2 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {item.dias_restantes}d
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <RecentEscorts escorts={recentEscorts} loading={loading} />

        <h2 className="text-xl font-bold flex items-center gap-2">
          <i className="fas fa-users text-red-500"></i>
          Gestión de Escorts
        </h2>
        <EscortsTable escorts={escorts} loading={loading} />
      </div>
  );
}