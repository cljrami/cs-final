import { useState, useEffect, type ReactNode } from 'react';
import { Skeleton } from '../ui/Skeleton';
import { API_BASE, getEscortHeaders } from '../../lib/escortAuth';

interface PlanData {
  estado: string;
  plan_nombre: string | null;
  badge: string | null;
  color_badge: string | null;
  duracion_dias: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  dias_pausados: number;
  dia_publicado: number;
  dias_restantes: number;
  visitas: number;
  contactos: number;
  favoritos: number;
  promedio_dia: number;
  proyeccion_total: number;
  pausas_permitidas: number;
  pausas_usadas: number;
  pausas_restantes: number;
  fecha_pausa: string | null;
  fecha_fin_proyectada: string | null;
  fecha_limite_pausas: string | null;
  plazo_dias_restantes: number | null;
  plazo_vencido: boolean;
  dias_guardados_pausas: number;
  pausas_detalle: {
    inicio: string;
    fin: string | null;
    dias: number;
    vigente: boolean;
  }[];
}

interface StatsData {
  periodo: string;
  hoy: { visitas: number; contactos: number; favoritos: number };
  all_time: {
    visitas_perfil: number;
    contactos: number;
    favoritos: number;
    comentarios: number;
  };
  publicada_desde: string | null;
  dias_activa: number;
  plan: PlanData | null;
}

const PERIODO_FIJO = '30d';

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '';
  try {
    return new Date(fecha).toLocaleDateString('es-CL');
  } catch {
    return '';
  }
}

function StatCard({ icon, iconColor, label, value, sub, subClass, loading }: {
  icon: string;
  iconColor: string;
  label: string;
  value: string | number;
  sub?: ReactNode;
  subClass?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <i className={`fas ${icon} ${iconColor}`}></i>
        <span className="text-gray-500 text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">
        {loading ? <Skeleton width={60} height={28} /> : value}
      </p>
      {loading
        ? <Skeleton width={80} height={12} className="mt-1" />
        : sub ? <p className={`text-xs mt-1 ${subClass || 'text-gray-600'}`}>{sub}</p> : null}
    </div>
  );
}

export default function EstadisticasDashboard() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/estadisticas.php?periodo=${PERIODO_FIJO}`, {
        headers: getEscortHeaders(),
        cache: 'no-store'
      });
      const d = await res.json();
      if (d.success) setData(d.data);
      else setError(d.error || 'Error');
    } catch {
      setError('Error de conexión');
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-chart-line text-blue-400"></i> Estadísticas
        </h1>
        <p className="text-gray-400 mt-1">Rendimiento de tu perfil</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          <i className="fas fa-exclamation-triangle mr-2"></i>{error}
        </div>
      )}

      <div className="space-y-6">
        {/* Hoy */}
        <section className="space-y-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <i className="fas fa-sun text-yellow-400"></i> Hoy
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard
              icon="fa-eye"
              iconColor="text-blue-400"
              label="Visitas hoy"
              value={(data?.hoy.visitas ?? 0).toLocaleString()}
              sub="visitas únicas del día"
              loading={loading}
            />
            <StatCard
              icon="fa-phone"
              iconColor="text-green-400"
              label="Contactos hoy"
              value={(data?.hoy.contactos ?? 0).toLocaleString()}
              sub="WhatsApp + llamar"
              loading={loading}
            />
            <StatCard
              icon="fa-heart"
              iconColor="text-red-400"
              label="Favoritos hoy"
              value={(data?.hoy.favoritos ?? 0).toLocaleString()}
              sub="agregados hoy"
              loading={loading}
            />
          </div>
        </section>

        {/* Plan base */}
        {(loading || data?.plan) && (
          <section className="space-y-3">
            <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-crown text-yellow-400"></i>
                <span className="text-gray-500 text-xs uppercase tracking-wider">Plan base</span>
              </div>
              <p className="text-xl font-bold text-white">
                {loading ? <Skeleton width={120} height={28} /> : (data?.plan?.plan_nombre || 'Plan')}
              </p>
              <div className="mt-3 space-y-1 text-xs text-gray-400">
                {loading ? (
                  <>
                    <Skeleton width={140} height={12} className="mt-1" />
                    <Skeleton width={140} height={12} className="mt-1" />
                  </>
                ) : (
                  <>
                    <p>
                      <i className="fas fa-calendar-plus text-green-400 mr-1.5 w-4"></i>
                      Inicio: {formatearFecha(data?.plan?.fecha_inicio ?? null)}
                    </p>
                    <p>
                      <i className="fas fa-calendar-xmark text-red-400 mr-1.5 w-4"></i>
                      {data?.plan?.estado === 'pausada' && data?.plan?.fecha_fin_proyectada
                        ? `Vencimiento estimado: ${data?.plan?.fecha_fin_proyectada}`
                        : `Término: ${formatearFecha(data?.plan?.fecha_fin ?? null)}`}
                    </p>
                    {data?.plan?.estado === 'pausada' && data?.plan?.fecha_pausa && (
                      <p>
                        <i className="fas fa-pause text-amber-400 mr-1.5 w-4"></i>
                        Pausado desde: {data?.plan?.fecha_pausa}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                icon="fa-eye"
                iconColor="text-blue-400"
                label="Visitas"
                value={(data?.plan?.visitas ?? 0).toLocaleString()}
                sub="en este plan"
                loading={loading}
              />
              <StatCard
                icon="fa-phone"
                iconColor="text-green-400"
                label="Contactos"
                value={(data?.plan?.contactos ?? 0).toLocaleString()}
                sub="en este plan"
                loading={loading}
              />
              <StatCard
                icon="fa-heart"
                iconColor="text-red-400"
                label="Favoritos"
                value={(data?.plan?.favoritos ?? 0).toLocaleString()}
                sub="en este plan"
                loading={loading}
              />
              <StatCard
                icon="fa-chart-simple"
                iconColor="text-purple-400"
                label="Promedio / día"
                value={(data?.plan?.promedio_dia ?? 0).toLocaleString()}
                sub="visitas por día publicado"
                loading={loading}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard
                icon="fa-pause"
                iconColor="text-gray-400"
                label="Pausas permitidas"
                value={(data?.plan?.pausas_permitidas ?? 0).toLocaleString()}
                sub="según tu plan"
                loading={loading}
              />
              <StatCard
                icon="fa-pause-circle"
                iconColor="text-amber-400"
                label="Pausas usadas"
                value={(data?.plan?.pausas_usadas ?? 0).toLocaleString()}
                sub="ya utilizadas"
                loading={loading}
              />
              <StatCard
                icon="fa-check-circle"
                iconColor="text-green-400"
                label="Pausas restantes"
                value={(data?.plan?.pausas_restantes ?? 0).toLocaleString()}
                sub="disponibles"
                loading={loading}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard
                icon="fa-clock-rotate-left"
                iconColor="text-blue-400"
                label="Días pausados"
                value={(data?.plan?.dias_pausados ?? 0).toLocaleString()}
                sub="sumados al vencimiento"
                loading={loading}
              />
              <StatCard
                icon="fa-hourglass-half"
                iconColor={data?.plan?.plazo_vencido ? 'text-red-400' : 'text-purple-400'}
                label="Plazo para pausar"
                value={data?.plan?.fecha_limite_pausas || '—'}
                sub={data?.plan?.fecha_limite_pausas ? 'último día para iniciar una pausa' : 'aún sin primera pausa'}
                loading={loading}
              />
              <StatCard
                icon="fa-calendar-days"
                iconColor="text-teal-400"
                label="Días de plazo"
                value={data?.plan?.plazo_dias_restantes != null ? data.plan.plazo_dias_restantes.toLocaleString() : '—'}
                sub="restantes del plazo de pausas"
                loading={loading}
              />
            </div>
            {!loading && data?.plan?.plazo_vencido && data?.plan?.pausas_restantes > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Tu plazo para usar pausas venció el {data.plan.fecha_limite_pausas}. Las {data.plan.pausas_restantes.toLocaleString()} pausas restantes se perdieron.
              </div>
            )}
            {!loading && data?.plan && data.plan.pausas_detalle.length > 0 && (
              <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-clock-rotate-left text-blue-400"></i>
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Historial de pausas</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    <b className="text-blue-400">{data.plan.dias_guardados_pausas.toLocaleString()}</b> días guardados
                  </span>
                </div>
                <div className="space-y-2">
                  {data.plan.pausas_detalle.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm bg-[#1a1a22] border border-gray-800 rounded-lg px-3 py-2">
                      <span className="text-gray-300">
                        <i className="fas fa-pause text-amber-400 mr-2"></i>
                        {p.inicio}
                        {p.fin ? (
                          <>
                            <span className="text-gray-600 mx-1">→</span>
                            <i className="fas fa-play text-green-400 mr-2"></i>
                            {p.fin}
                          </>
                        ) : (
                          <span className="text-amber-400 ml-2 text-xs">(pausa vigente)</span>
                        )}
                      </span>
                      <span className="text-gray-400 whitespace-nowrap ml-3">
                        <b className={p.vigente ? 'text-amber-400' : 'text-green-400'}>{p.dias.toLocaleString()}</b> días
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!loading && data?.plan && data.plan.proyeccion_total > 0 && (
              <p className="text-sm text-gray-300 flex items-center gap-2">
                <i className="fas fa-bolt text-yellow-400"></i>
                Al ritmo actual, llegarás a ~{data.plan.proyeccion_total.toLocaleString()} visitas al finalizar tu plan
              </p>
            )}
          </section>
        )}

        {/* Desde tu publicación */}
        <section className="space-y-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <i className="fas fa-history text-purple-400"></i> Desde tu publicación
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon="fa-eye"
              iconColor="text-blue-400"
              label="Total visitas"
              value={(data?.all_time.visitas_perfil ?? 0).toLocaleString()}
              sub="desde tu publicación"
              loading={loading}
            />
            <StatCard
              icon="fa-phone"
              iconColor="text-green-400"
              label="Contactos"
              value={(data?.all_time.contactos ?? 0).toLocaleString()}
              sub="desde tu publicación"
              loading={loading}
            />
            <StatCard
              icon="fa-heart"
              iconColor="text-red-400"
              label="Favoritos"
              value={(data?.all_time.favoritos ?? 0).toLocaleString()}
              sub="en total"
              loading={loading}
            />
            <StatCard
              icon="fa-star"
              iconColor="text-yellow-400"
              label="Comentarios"
              value={(data?.all_time.comentarios ?? 0).toLocaleString()}
              sub="en total"
              loading={loading}
            />
          </div>
          {!loading && data?.publicada_desde && (
            <p className="text-gray-500 text-xs">
              <i className="fas fa-calendar-alt mr-1"></i>
              Publicada el {formatearFecha(data.publicada_desde)} · {data.dias_activa} días activa
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
