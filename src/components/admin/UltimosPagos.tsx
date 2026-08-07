import { Skeleton } from '../ui/Skeleton';

interface Pago {
  escort_id: number;
  escort_nombre: string;
  foto_principal?: string | null;
  plan_nombre: string;
  plan_tipo: string;
  precio_pagado: string | number;
  moneda: string;
  fecha_aprobacion: string;
  fecha_fin: string;
}

interface UltimosPagosProps {
  pagos: Pago[];
  loading?: boolean;
}

function fmtMonto(value: string | number, moneda: string) {
  const n = parseFloat(String(value));
  if (isNaN(n)) return '—';
  const symbol = moneda === 'USD' ? 'US$' : '$';
  return `${symbol}${n.toLocaleString('es-CL', { minimumFractionDigits: 0 })}`;
}

function fmtFecha(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function UltimosPagos({ pagos, loading }: UltimosPagosProps) {
  return (
    <div className="bg-admin-card border border-admin-border rounded-2xl p-6 mb-8">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <i className="fas fa-credit-card text-green-500"></i>
        Últimos pagos / planes aprobados
      </h3>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton circle width={36} height={36} />
              <div className="flex-1">
                <Skeleton width={140} height={14} className="mb-1" />
                <Skeleton width={100} height={12} />
              </div>
              <Skeleton width={70} height={16} />
            </div>
          ))}
        </div>
      ) : pagos.length === 0 ? (
        <div className="p-8 text-center text-admin-muted">
          <i className="fas fa-wallet text-3xl mb-3 block opacity-30"></i>
          Sin pagos aprobados
        </div>
      ) : (
        <div className="space-y-3">
          {pagos.map((pago, idx) => (
            <div key={`${pago.escort_id}-${idx}`} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#252538] flex items-center justify-center overflow-hidden flex-shrink-0">
                {pago.foto_principal ? (
                  <img src={pago.foto_principal} alt="" className="w-full h-full object-cover" />
                ) : (
                  <i className="fas fa-user text-gray-500 text-xs" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <a href={`/${pago.escort_id}`} target="_blank" rel="noopener noreferrer" className="text-white text-sm font-medium truncate block hover:text-blue-300 transition-colors">
                  {pago.escort_nombre}
                </a>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[0.6rem] uppercase tracking-wider rounded-full px-2 py-0.5 font-medium ${
                    pago.plan_tipo === 'base'
                      ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                      : 'text-green-400 bg-green-500/10 border border-green-500/20'
                  }`}>
                    {pago.plan_tipo === 'base' ? 'Base' : 'Extra'}
                  </span>
                  <span className="text-xs text-admin-muted truncate">{pago.plan_nombre || '—'}</span>
                </div>
                <div className="text-xs text-gray-600">Aprobado: {fmtFecha(pago.fecha_aprobacion)}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-green-400 text-sm font-semibold whitespace-nowrap">{fmtMonto(pago.precio_pagado, pago.moneda)}</div>
                <div className="text-xs text-gray-600 whitespace-nowrap">Vence: {fmtFecha(pago.fecha_fin)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}