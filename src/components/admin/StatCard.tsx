import { Skeleton } from '../ui/Skeleton';

interface StatCardProps {
  icon: string;
  value: number | string;
  label: string;
  color: string;
  loading?: boolean;
  href?: string;
}

export default function StatCard({ icon, value, label, color, loading, href }: StatCardProps) {
  const content = (
    <>
      <div 
        className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <i className={`fas ${icon}`} style={{ color: color, fontSize: '1.1rem' }}></i>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xl md:text-2xl font-bold leading-none">
          {loading ? <Skeleton width={50} height={28} /> : value}
        </div>
        <div className="text-xs md:text-sm text-admin-muted mt-1 truncate">{label}</div>
      </div>
    </>
  );

  const baseClass = 'bg-admin-card border border-admin-border rounded-2xl p-5 md:p-6 flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5';
  const handlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      (e.currentTarget as HTMLElement).style.borderColor = color;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      (e.currentTarget as HTMLElement).style.borderColor = '#2d2d44';
    },
  };

  if (href) {
    return (
      <a href={href} className={`${baseClass} cursor-pointer hover:shadow-lg hover:shadow-black/20`} {...handlers}>
        {content}
      </a>
    );
  }

  return (
    <div className={`${baseClass} cursor-default`} {...handlers}>
      {content}
    </div>
  );
}