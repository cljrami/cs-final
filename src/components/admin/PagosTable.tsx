import { useState, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton';
import SearchFilters from './SearchFilters';
import '@fancyapps/ui/dist/fancybox/fancybox.css';

interface Pago {
  id: number;
  monto: number;
  moneda: string;
  concepto: string;
  metodo_pago: string;
  estado_pago: string;
  comprobante_url: string;
  referencia_externa: string;
  notas: string;
  pagado_en: string;
  creado_en: string;
  escort_nombre: string;
  escort_email: string;
  plan_nombre: string;
}

interface Props {
  pagos: Pago[];
  loading: boolean;
}

export default function PagosTable({ pagos, loading }: Props) {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [conceptoFilter, setConceptoFilter] = useState('todos');

  useEffect(() => {
    let disposed = false;
    import('@fancyapps/ui').then((mod) => {
      if (disposed) return;
      const F = mod.Fancybox;
      F.bind('[data-fancybox]', {
        compact: false,
        idle: false,
        Toolbar: { display: ['close'] },
      });
    });
    return () => { disposed = true; };
  }, []);

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400"><i className="fas fa-clock mr-1"></i>Pendiente</span>;
      case 'completado': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400"><i className="fas fa-check mr-1"></i>Completado</span>;
      case 'rechazado': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400"><i className="fas fa-times mr-1"></i>Rechazado</span>;
      case 'reembolsado': return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400"><i className="fas fa-undo mr-1"></i>Reembolsado</span>;
      default: return null;
    }
  };

  const getConceptoBadge = (concepto: string) => {
    switch (concepto) {
      case 'plan': return <span className="text-blue-400"><i className="fas fa-box mr-1"></i>Plan</span>;
      case 'vip': return <span className="text-purple-400"><i className="fas fa-crown mr-1"></i>VIP</span>;
      case 'destacado': return <span className="text-amber-400"><i className="fas fa-star mr-1"></i>Destacado</span>;
      default: return <span className="text-gray-400"><i className="fas fa-circle mr-1"></i>Otro</span>;
    }
  };

  const filtered = pagos.filter(p => {
    if (estadoFilter !== 'todos' && p.estado_pago !== estadoFilter) return false;
    if (conceptoFilter !== 'todos' && p.concepto !== conceptoFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.escort_nombre.toLowerCase().includes(s) || p.escort_email.toLowerCase().includes(s) || (p.referencia_externa && p.referencia_externa.toLowerCase().includes(s));
    }
    return true;
  });

  return (
    <div>
      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por escort o referencia..."
        filters={[
          { key: 'todos', label: 'Todos estados' },
          { key: 'pendiente', label: 'Pendiente' },
          { key: 'completado', label: 'Completado' },
          { key: 'rechazado', label: 'Rechazado' },
        ]}
        activeFilter={estadoFilter}
        onFilterChange={setEstadoFilter}
      />
      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por escort o referencia..."
        hideSearch
        filters={[
          { key: 'todos', label: 'Todos conceptos' },
          { key: 'plan', label: 'Planes' },
          { key: 'vip', label: 'VIP' },
          { key: 'destacado', label: 'Destacados' },
        ]}
        activeFilter={conceptoFilter}
        onFilterChange={setConceptoFilter}
      />

      {/* Table */}
      <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b border-[#2a2a3e] last:border-0">
                <Skeleton width={40} height={40} circle />
                <div className="flex-1">
                  <Skeleton width={150} height={20} className="mb-2" />
                  <Skeleton width={200} height={14} />
                </div>
                <Skeleton width={80} height={32} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <i className="fas fa-receipt text-4xl text-gray-600 mb-4"></i>
            <p className="text-gray-400">No hay pagos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a3e] text-left text-xs text-gray-400 uppercase">
                  <th className="px-4 py-3">Escort</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[#2a2a3e] last:border-0 hover:bg-[#252538] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white text-sm font-medium">{p.escort_nombre}</div>
                      <div className="text-gray-500 text-xs">{p.escort_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{getConceptoBadge(p.concepto)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${p.estado_pago === 'completado' ? 'text-emerald-400' : 'text-gray-400'}`}>
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: p.moneda, minimumFractionDigits: 0 }).format(p.monto)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getEstadoBadge(p.estado_pago)}</td>
                    <td className="px-4 py-3">
                      {p.comprobante_url ? (
                        <a href={p.comprobante_url} data-fancybox="pago-comprobante" className="text-blue-400 hover:text-blue-300 text-sm">
                          <i className="fas fa-file-alt mr-1"></i> Ver
                        </a>
                      ) : (
                        <span className="text-gray-600 text-xs">Sin comprobante</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}