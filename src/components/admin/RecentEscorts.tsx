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
}

interface RecentEscortsProps {
  escorts: Escort[];
  loading?: boolean;
}

export default function RecentEscorts({ escorts, loading }: RecentEscortsProps) {
  return (
    <div className="bg-admin-card border border-admin-border rounded-2xl p-6 mb-8">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <i className="fas fa-clock text-red-500"></i>
        Escorts recientes
      </h3>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Escort</th>
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Ciudad</th>
              <th className="text-left text-xs text-admin-muted uppercase p-3 tracking-wider">Estado</th>
              <th className="text-center text-xs text-admin-muted uppercase p-3 tracking-wider">Verif.</th>
              <th className="text-center text-xs text-admin-muted uppercase p-3 tracking-wider">VIP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-admin-border">
                  <td className="p-3">
                    <Skeleton width={120} height={16} className="mb-1" />
                    <Skeleton width={60} height={12} />
                  </td>
                  <td className="p-3"><Skeleton width={80} height={16} /></td>
                  <td className="p-3"><Skeleton width={70} height={24} borderRadius={9999} /></td>
                  <td className="p-3 text-center"><Skeleton circle width={16} height={16} /></td>
                  <td className="p-3 text-center"><Skeleton circle width={16} height={16} /></td>
                </tr>
              ))
            ) : escorts.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-admin-muted">
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
                    <td className="p-3">
                      <a href={`/${escort.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-blue-400 hover:text-blue-300 transition-colors" onClick={e => e.stopPropagation()}>{escort.nombre}</a>
                      <div className="text-xs text-admin-muted">{escort.edad} años • {fecha}</div>
                    </td>
                    <td className="p-3 text-admin-muted text-sm">{escort.ciudad}</td>
                    <td className="p-3 text-admin-muted text-sm">—</td>
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