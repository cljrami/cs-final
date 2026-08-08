import { addDays, endOfMonth, format, startOfTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';

export interface PresetOption {
  id: string;
  label: string;
  icon: string;
  getRange: () => { from: Date; to: Date };
}

export const PRESETS: PresetOption[] = [
  {
    id: 'esta_semana',
    label: 'Esta semana',
    icon: 'fa-calendar-week',
    getRange: () => {
      const from = startOfTomorrow();
      const to = addDays(from, 6);
      return { from, to };
    },
  },
  {
    id: 'dos_semanas',
    label: '2 semanas',
    icon: 'fa-calendar-alt',
    getRange: () => {
      const from = startOfTomorrow();
      const to = addDays(from, 13);
      return { from, to };
    },
  },
  {
    id: 'este_mes',
    label: 'Este mes',
    icon: 'fa-calendar',
    getRange: () => {
      const from = startOfTomorrow();
      const to = endOfMonth(from);
      return { from, to };
    },
  },
  {
    id: 'treinta_dias',
    label: '30 días',
    icon: 'fa-calendar-check',
    getRange: () => {
      const from = startOfTomorrow();
      const to = addDays(from, 29);
      return { from, to };
    },
  },
];

interface Props {
  onSelect: (from: string, to: string) => void;
}

export default function GiraDatePresets({ onSelect }: Props) {
  const handleClick = (preset: PresetOption) => {
    const { from, to } = preset.getRange();
    onSelect(format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd'));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => handleClick(preset)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0f0f1a] border border-gray-700 rounded-lg text-xs font-medium text-gray-300 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-300 transition-all active:scale-95"
        >
          <i className={`fas ${preset.icon} text-xs`}></i>
          {preset.label}
        </button>
      ))}
    </div>
  );
}
