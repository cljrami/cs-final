interface Props {
  icon: string;
  value: number | string;
  label: string;
  color?: string;
  loading?: boolean;
}

export default function EscortStatCard({ icon, value, label, color = '#8b5cf6', loading }: Props) {
  return (
    <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-5 flex items-center gap-4 transition-all duration-200 hover:border-gray-600">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <i className={`fas ${icon}`} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold text-white leading-none">
          {loading ? (
            <div className="h-7 w-14 bg-gray-800 rounded animate-pulse" />
          ) : (
            value
          )}
        </div>
        <div className="text-xs text-gray-500 mt-1 truncate">
          {loading ? (
            <div className="h-3 w-24 bg-gray-800 rounded animate-pulse mt-1" />
          ) : (
            label
          )}
        </div>
      </div>
    </div>
  );
}
