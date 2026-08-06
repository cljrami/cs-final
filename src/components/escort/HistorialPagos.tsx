import { useState, useEffect } from 'react';
import { Skeleton } from '../ui/Skeleton';

interface Pago {
  id: number;
  monto: string;
  moneda: string;
  concepto: string;
  metodo_pago: string;
  estado_pago: string;
  comprobante_url: string | null;
  creado_en: string;
  pagado_en: string | null;
  plan_nombre: string | null;
  vencimiento: string | null;
}

const estadoConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  pendiente: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: 'fa-clock', label: 'Pendiente' },
  completado: { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'fa-check-circle', label: 'Completado' },
  rechazado: { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'fa-times-circle', label: 'Rechazado' },
  reembolsado: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: 'fa-undo', label: 'Reembolsado' },
};

export default function HistorialPagos() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPagos();
  }, []);

  const fetchPagos = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('escort_token');
      const res = await fetch('/api/escort/pagos.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPagos(data.pagos || []);
      } else {
        setError(data.error || 'Error al cargar pagos');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const conceptoLabel = (concepto: string) => {
    const map: Record<string, string> = { plan: 'Plan', vip: 'VIP', destacado: 'Destacado', otro: 'Otro' };
    return map[concepto] || concepto;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('es-CL');
    } catch {
      return dateStr;
    }
  };

  const isVencido = (vencimiento: string | null) => {
    if (!vencimiento) return false;
    try {
      return new Date(vencimiento) < new Date();
    } catch {
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-receipt text-red-500"></i>
          Historial de Pagos
        </h1>
        <p className="text-gray-500 mt-1">Revisa el estado de todos tus pagos realizados</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}

      <div className="bg-[#13131a] border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 font-medium px-3 sm:px-5 py-3 whitespace-nowrap text-xs sm:text-sm">Fecha</th>
                <th className="text-left text-gray-500 font-medium px-3 sm:px-5 py-3 whitespace-nowrap text-xs sm:text-sm">Concepto</th>
                <th className="text-left text-gray-500 font-medium px-3 sm:px-5 py-3 whitespace-nowrap text-xs sm:text-sm">Monto</th>
                <th className="text-left text-gray-500 font-medium px-3 sm:px-5 py-3 whitespace-nowrap text-xs sm:text-sm">Vencimiento</th>
                <th className="text-center text-gray-500 font-medium px-3 sm:px-5 py-3 whitespace-nowrap text-xs sm:text-sm">Estado</th>
                <th className="text-left text-gray-500 font-medium px-3 sm:px-5 py-3 whitespace-nowrap text-xs sm:text-sm">Comp.</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="px-3 sm:px-5 py-3 sm:py-4"><Skeleton width={80} height={14} /></td>
                    <td className="px-3 sm:px-5 py-3 sm:py-4"><Skeleton width={60} height={14} /></td>
                    <td className="px-3 sm:px-5 py-3 sm:py-4"><Skeleton width={70} height={14} /></td>
                    <td className="px-3 sm:px-5 py-3 sm:py-4"><Skeleton width={80} height={14} /></td>
                    <td className="px-3 sm:px-5 py-3 sm:py-4 text-center"><Skeleton width={80} height={22} borderRadius={12} className="inline-block" /></td>
                    <td className="px-3 sm:px-5 py-3 sm:py-4"><Skeleton width={20} height={14} /></td>
                  </tr>
                ))
              ) : pagos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-500">
                    <i className="fas fa-receipt text-4xl mb-4 opacity-50"></i>
                    <p className="text-lg font-medium">No hay pagos registrados</p>
                    <p className="text-sm mt-1">Los pagos aparecerán aquí cuando solicites un plan</p>
                  </td>
                </tr>
              ) : (
                pagos.map((pago) => {
                  const cfg = estadoConfig[pago.estado_pago] || estadoConfig.pendiente;
                  const vencido = isVencido(pago.vencimiento);
                  return (
                    <tr key={pago.id} className="border-b border-gray-800/50 hover:bg-[#1a1a24] transition-colors">
                      <td className="px-3 sm:px-5 py-3 sm:py-4 text-gray-300 whitespace-nowrap text-xs sm:text-sm">{formatDate(pago.creado_en)}</td>
                      <td className="px-3 sm:px-5 py-3 sm:py-4">
                        <div className="text-white text-xs sm:text-sm">{conceptoLabel(pago.concepto)}</div>
                        {pago.plan_nombre && (
                          <div className="text-gray-500 text-[10px] sm:text-xs">{pago.plan_nombre}</div>
                        )}
                      </td>
                      <td className="px-3 sm:px-5 py-3 sm:py-4">
                        <span className="text-white font-medium text-xs sm:text-sm">
                          ${parseFloat(pago.monto).toLocaleString()}
                        </span>
                        <span className="text-gray-500 text-[10px] sm:text-xs ml-1">{pago.moneda}</span>
                      </td>
                      <td className="px-3 sm:px-5 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                        {pago.vencimiento ? (
                          <span className={vencido ? 'text-red-400' : 'text-gray-300'}>
                            {formatDate(pago.vencimiento)}
                            {vencido && <i className="fas fa-exclamation-circle ml-1 text-red-400/70" />}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                       <td className="px-3 sm:px-5 py-3 sm:py-4 text-center">
                         <span className={`inline-flex items-center gap-1 px-2 sm:gap-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                           <i className={`fas ${cfg.icon} text-[0.5rem] sm:text-[0.6rem]`}></i>
                           <span className="hidden sm:inline">{cfg.label}</span>
                           <span className="sm:hidden">{cfg.label.charAt(0)}</span>
                         </span>
                       </td>
                       <td className="px-3 sm:px-5 py-3 sm:py-4">
                          {pago.comprobante_url ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <a
                                href={pago.comprobante_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-[10px] sm:text-xs"
                                title="Comprobante de pago"
                              >
                                {pago.comprobante_url.match(/\.pdf$/i) ? (
                                  <i className="fas fa-file-pdf text-red-400"></i>
                                ) : (
                                  <i className="fas fa-file-image"></i>
                                )}
                              </a>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-[10px] sm:text-xs">—</span>
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
    </div>
  );
}
