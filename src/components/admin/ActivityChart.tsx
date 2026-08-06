import { Skeleton } from '../ui/Skeleton';

interface ActivityData {
  fecha: string;
  dia: string;
  cantidad: number;
}

interface ActivityChartProps {
  data: ActivityData[];
  loading?: boolean;
}

export default function ActivityChart({ data, loading }: ActivityChartProps) {
  const maxValue = Math.max(...data.map(d => d.cantidad), 1);
  const CHART_H = 176;

  return (
    <div className="bg-admin-card border border-admin-border rounded-2xl p-6 mb-8">
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
        <i className="fas fa-chart-bar text-red-500"></i>
        Escorts Registradas en los últimos 12 días
      </h3>
      
      {loading ? (
        <div className="flex items-end gap-1.5" style={{ height: CHART_H }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <Skeleton width="100%" height={Math.random() * 120 + 40} borderRadius={4} />
              <Skeleton width={24} height={14} />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center text-admin-muted" style={{ height: CHART_H }}>
          <div className="text-center">
            <i className="fas fa-chart-bar text-4xl mb-3 opacity-30"></i>
            <p className="text-sm">Sin datos de actividad</p>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-1.5" style={{ height: CHART_H }}>
          {data.map((item, index) => {
            const height = item.cantidad > 0 ? Math.max((item.cantidad / maxValue) * (CHART_H - 24), 6) : 6;
            
            return (
              <div key={index} className="flex-1 min-w-0 flex flex-col items-center gap-2 group h-full justify-end">
                <div 
                  className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded-t-lg transition-all duration-500 hover:from-red-500 hover:to-red-300 relative overflow-hidden"
                  style={{ height: `${height}px` }}
                  title={`${item.fecha}: ${item.cantidad} escorts`}
                >
                  <span className="absolute inset-x-0 top-1 text-center text-[0.6rem] font-semibold text-white/90">
                    {item.cantidad > 0 ? item.cantidad : ''}
                  </span>
                </div>
                <div className="text-[0.65rem] text-admin-muted truncate w-full text-center">
                  {item.dia}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}