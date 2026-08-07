import { Skeleton } from '../ui/Skeleton';

interface Escort {
  id: number;
  nombre: string;
  edad: number;
  ciudad: string;
  estado: string;
  verificado: number;
  vip: number;
  activa: number;
  created_at: string;
  foto_principal?: string | null;
  plan_base?: string | null;
  plan_badge?: string | null;
  plan_inicio?: string | null;
  plan_fin?: string | null;
  extras?: string | null;
  estado_plan?: string | null;
}

interface RecentEscortsProps {
  escorts: Escort[];
  loading?: boolean;
}

function fmtFecha(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ESTADO_STYLES: Record<string, { label: string; cls: string }> = {
  activa: { label: 'Activa', cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
  pausada: { label: 'Pausada', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  vencida: { label: 'Vencida', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  pendiente: { label: 'Pendiente', cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  rechazada: { label: 'Rechazada', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  cancelada: { label: 'Cancelada', cls: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
  sin_plan: { label: 'Sin plan', cls: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
};

function EstadoBadge({ estado }: { estado?: string | null }) {
  const cfg = ESTADO_STYLES[estado || ''] ?? ESTADO_STYLES.sin_plan;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-1 whitespace-nowrap ${cfg.cls}`}>
      <i className="fas fa-circle text-[0.35rem]"></i>
      {cfg.label}
    </span>
  );
}

export default function RecentEscorts({ escorts, loading }: RecentEscortsProps) {
  return (
    <div className="bg-admin-card border border-admin-border rounded-2xl p-6 mb-8">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <i className="fas fa-clock text-red-500"></i>
        Escorts recientes
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: 980 }}>
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Escort</th>
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Ciudad</th>
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Estado</th>
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Plan (base)</th>
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Inicio</th>
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Término</th>
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Extras</th>
              <th className="text-center text-xs text-admin-muted uppercase p-3 tracking-wider">Verif.</th>
              <th className="text-center text-xs text-admin-muted uppercase p-3 tracking-wider">VIP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-admin-border">
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <Skeleton circle width={36} height={36} />
                      <div>
                        <Skeleton width={120} height={16} className="mb-1" />
                        <Skeleton width={60} height={12} />
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><Skeleton width={80} height={16} /></td>
                  <td className="p-3"><Skeleton width={70} height={24} borderRadius={9999} /></td>
                  <td className="p-3"><Skeleton width={90} height={16} /></td>
                  <td className="p-3"><Skeleton width={80} height={16} /></td>
                  <td className="p-3"><Skeleton width={80} height={16} /></td>
                  <td className="p-3"><Skeleton width={120} height={16} /></td>
                  <td className="p-3 text-center"><Skeleton circle width={16} height={16} /></td>
                  <td className="p-3 text-center"><Skeleton circle width={16} height={16} /></td>
                </tr>
              ))
            ) : escorts.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-admin-muted">
                  <i className="fas fa-inbox text-3xl mb-3 block opacity-30"></i>
                  No hay escorts recientes
                </td>
              </tr>
            ) : (
              escorts.map(escort => {
                const fecha = new Date(escort.created_at).toLocaleDateString('es-CL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });

                return (
                  <tr key={escort.id} className="border-b border-admin-border hover:bg-[#252538] transition-colors cursor-pointer" onClick={() => window.open(`/${escort.id}`, '_blank')}>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#252538] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {escort.foto_principal ? (
                            <img src={escort.foto_principal} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <i className="fas fa-user text-gray-500 text-xs" />
                          )}
                        </div>
                        <div>
                          <a href={`/${escort.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-blue-400 hover:text-blue-300 transition-colors" onClick={e => e.stopPropagation()}>{escort.nombre}</a>
                          <div className="text-xs text-admin-muted">{escort.edad} años • {fecha}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-admin-muted text-sm whitespace-nowrap">{escort.ciudad}</td>
                    <td className="p-3 whitespace-nowrap">
                      <EstadoBadge estado={escort.estado_plan} />
                    </td>
                    <td className="p-3 text-sm whitespace-nowrap">
                      {escort.plan_base ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-white font-medium">{escort.plan_base}</span>
                          <span className="text-[0.6rem] uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">Base</span>
                        </span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="p-3 text-admin-muted text-sm whitespace-nowrap">{fmtFecha(escort.plan_inicio)}</td>
                    <td className="p-3 text-admin-muted text-sm whitespace-nowrap">{fmtFecha(escort.plan_fin)}</td>
                    <td className="p-3 text-sm whitespace-nowrap">
                      {escort.extras ? (
                        <span className="text-green-400">{escort.extras}</span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {escort.verificado ? (
                        <i className="fas fa-check-circle text-green-500" title="Verificada"></i>
                      ) : (
                        <i className="fas fa-clock text-yellow-400" title="Pendiente"></i>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {escort.vip ? (
                        <i className="fas fa-crown text-yellow-400" title="VIP"></i>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}