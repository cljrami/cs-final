// src/components/ui/StatsCards.tsx

import DataCell from './DataCell';

interface StatCardProps {
  icon: string;
  value: number | string;
  label: string;
  color: string;
  loading?: boolean;
}

export default function StatCard({ icon, value, label, color, loading }: StatCardProps) {
  return (
    <div 
      className="bg-admin-card border border-admin-border rounded-2xl p-5 md:p-6 flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5 cursor-default"
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = color;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#2d2d44';
      }}
    >
      <div 
        className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <i className={`fas ${icon}`} style={{ color: color, fontSize: '1.1rem' }}></i>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xl md:text-2xl font-bold leading-none">
          <DataCell value={value} loading={loading} width={50} height={28} />
        </div>
        <div className="text-xs md:text-sm text-admin-muted mt-1 truncate">
          <DataCell value={label} loading={loading} width={90} height={14} />
        </div>
      </div>
    </div>
  );
}